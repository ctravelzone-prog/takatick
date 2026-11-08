// test/api.test.js — end-to-end API tests against a live server on an
// ephemeral port with a temp DB file. Exercises the full TakaTick flow:
// health -> signup -> login -> numbers (incl. Premium-only Rocket/Upay
// gate) -> SMS ingest -> verify -> confirm -> webhook -> error cases,
// plus a Rocket ingest->verify->confirm pass and a Upay pay-page claim.
// Uses only global fetch + node:test; no extra test framework.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

let base;
let server;
let catcherServer;
let catcherPort;
let tmpDir;
const deliveries = []; // webhook POSTs received by the catcher

async function waitFor(fn, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return fn();
}

async function req(p, { method = 'GET', token, appKey, body, headers = {} } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(appKey ? { 'x-app-key': appKey } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_e) { /* HTML pages */ }
  return { status: res.status, json, text };
}

async function signup(name, email, pkg) {
  const r = await req('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password: 'password123', package: pkg },
  });
  assert.equal(r.status, 201, `signup ${email}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.ok, true);
  assert.ok(r.json.apiKey.startsWith('sk_live_'));
  assert.ok(r.json.appKey.startsWith('app_'));
  assert.ok(r.json.payKey.startsWith('pay_'));
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });
  assert.equal(login.json.ok, true);
  assert.ok(login.json.token);
  // v1.5: signups are pending — activate via order + admin approval,
  // exactly like a real merchant, before using verify/pay-page.
  await activate(login.json.token, pkg);
  return { ...r.json, token: login.json.token };
}

let adminTokenCache = null;
async function adminToken() {
  if (adminTokenCache) return adminTokenCache;
  const r = await req('/api/admin/login', {
    method: 'POST',
    body: { email: 'admin@takatick.test', password: 'adminpass123' },
  });
  assert.equal(r.status, 200, `admin login: ${JSON.stringify(r.json)}`);
  adminTokenCache = r.json.token;
  return adminTokenCache;
}

let trxSeq = 0;
async function activate(token, pkg) {
  const prices = { basic: 300, standard: 600, premium: 900 };
  trxSeq += 1;
  const order = await req('/api/me/orders', {
    method: 'POST', token,
    body: { package: pkg, trxid: 'ACT' + String(trxSeq).padStart(6, '0'), sender: '01712345678', amount: prices[pkg] },
  });
  assert.equal(order.status, 201, `activate order: ${JSON.stringify(order.json)}`);
  const tok = await adminToken();
  const approve = await req(`/api/admin/orders/${order.json.order.id}/approve`, {
    method: 'POST', token: tok, body: {},
  });
  assert.equal(approve.status, 200, `approve: ${JSON.stringify(approve.json)}`);
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takatick-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.JWT_SECRET = 'test-secret';
  process.env.BRAND_NAME = 'TakaTick';
  process.env.ADMIN_EMAIL = 'admin@takatick.test';
  process.env.ADMIN_PASSWORD = 'adminpass123';

  // Tiny webhook catcher: records every signed webhook POST.
  catcherServer = http.createServer((reqClient, resClient) => {
    let raw = '';
    reqClient.on('data', (c) => { raw += c; });
    reqClient.on('end', () => {
      let body = null;
      try { body = JSON.parse(raw); } catch (_e) { /* ignore */ }
      deliveries.push({ headers: reqClient.headers, body, raw });
      resClient.writeHead(200, { 'Content-Type': 'application/json' });
      resClient.end('{"ok":true}');
    });
  });
  await new Promise((resolve) => catcherServer.listen(0, resolve));
  catcherPort = catcherServer.address().port;

  const { startServer } = require('../server');
  server = await startServer(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (catcherServer) await new Promise((resolve) => catcherServer.close(resolve));
  try {
    const { db } = require('../server');
    db.close();
  } catch (_e) { /* already closed */ }
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('health returns ok', async () => {
  const r = await req('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
});

test('brand: login page shows TakaTick from config, no placeholder', async () => {
  const r = await req('/login.html');
  assert.equal(r.status, 200);
  assert.match(r.text, /TakaTick/);
  assert.doesNotMatch(r.text, /\[Your Brand\]|\{\{BRAND\}\}/);
});

let basic;
let premium;

test('signup basic + login; Rocket/Upay numbers rejected for Basic', async () => {
  basic = await signup('Basic Seller', 'basic@takatick.test', 'basic');
  const ok = await req('/api/me/numbers', {
    method: 'POST', token: basic.token,
    body: { method: 'bkash', number: '01712345678', label: 'Shop bKash' },
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.equal(ok.json.number.method, 'bkash');

  for (const method of ['rocket', 'upay']) {
    const denied = await req('/api/me/numbers', {
      method: 'POST', token: basic.token,
      body: { method, number: '01712345678' },
    });
    assert.equal(denied.status, 403, `${method}: ${JSON.stringify(denied.json)}`);
    assert.equal(denied.json.error, 'METHOD_NOT_ALLOWED_FOR_PACKAGE');
  }

  const profile = await req('/api/me/profile', { token: basic.token });
  assert.deepEqual(profile.json.package.methods, ['bkash', 'nagad']);
  assert.equal(profile.json.usage.verificationsLimit, 500);
});

test('signup premium; Rocket + Upay numbers allowed', async () => {
  premium = await signup('Premium Seller', 'premium@takatick.test', 'premium');
  for (const [method, number] of [['rocket', '01722223333'], ['upay', '01933334444']]) {
    const r = await req('/api/me/numbers', {
      method: 'POST', token: premium.token,
      body: { method, number, label: `Shop ${method}` },
    });
    assert.equal(r.status, 201, `${method}: ${JSON.stringify(r.json)}`);
    assert.equal(r.json.number.method, method);
  }
  const profile = await req('/api/me/profile', { token: premium.token });
  assert.deepEqual(profile.json.package.methods, ['bkash', 'nagad', 'rocket', 'upay']);
  assert.equal(profile.json.usage.verificationsLimit, null); // unlimited

  // Point both merchants' webhooks at the catcher.
  const webhookUrl = `http://127.0.0.1:${catcherPort}/hook`;
  for (const m of [basic, premium]) {
    const s = await req('/api/me/settings', {
      method: 'POST', token: m.token,
      body: { webhook_url: webhookUrl, success_url: '', fail_url: '' },
    });
    assert.equal(s.json.ok, true);
  }
});

test('bKash flow: ingest SMS -> verify -> confirm -> webhook; error cases', async () => {
  const smsText = 'You have received Tk 1,000.00 from 01712345678. TrxID: 9AB12CD34E. Your bKash balance is Tk 5,000.00.';
  const ingest = await req('/api/sms', {
    method: 'POST', appKey: basic.appKey,
    body: { sender: 'bKash', text: smsText },
  });
  assert.equal(ingest.status, 200, JSON.stringify(ingest.json));
  assert.equal(ingest.json.ok, true);
  assert.equal(ingest.json.trxid, '9AB12CD34E');
  assert.equal(ingest.json.method, 'bkash');
  assert.equal(ingest.json.amount, 1000);

  // Duplicate ingest returns duplicate:true.
  const dup = await req('/api/sms', {
    method: 'POST', appKey: basic.appKey,
    body: { sender: 'bKash', text: smsText },
  });
  assert.equal(dup.json.ok, true);
  assert.equal(dup.json.duplicate, true);

  // Unknown TrxID.
  const unknown = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: basic.apiKey, amount: 1000, transactionId: 'NOPE123456' },
  });
  assert.equal(unknown.json.ok, false);
  assert.equal(unknown.json.error, 'TRANSACTION_NOT_FOUND');

  // Correct verify.
  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: basic.apiKey, amount: 1000, transactionId: '9AB12CD34E', order_id: 'ORD-1' },
  });
  assert.equal(verify.json.ok, true, JSON.stringify(verify.json));
  assert.equal(verify.json.method, 'bkash');
  assert.equal(verify.json.amount, 1000);
  assert.equal(verify.json.senderMasked, '017******78');
  assert.ok(verify.json.id);

  // Confirm.
  const confirm = await req('/api/v1/confirm', {
    method: 'POST',
    body: { apiKey: basic.apiKey, amount: 1000, transactionId: '9AB12CD34E', id: verify.json.id },
  });
  assert.equal(confirm.json.ok, true, JSON.stringify(confirm.json));
  assert.equal(confirm.json.method, 'bkash');
  assert.equal(confirm.json.sender, '01712345678');

  // Webhook received by the catcher, with HMAC signature header.
  const gotWebhook = await waitFor(() =>
    deliveries.some((d) => d.body && d.body.event === 'payment.confirmed' && d.body.transactionId === '9AB12CD34E'));
  assert.equal(gotWebhook, true, 'webhook for 9AB12CD34E not received');
  const hook = deliveries.find((d) => d.body.transactionId === '9AB12CD34E');
  assert.ok(hook.headers['x-signature']);
  assert.match(hook.headers['x-signature'], /^[0-9a-f]{64}$/);
  assert.equal(hook.body.order_id, 'ORD-1');

  // Duplicate confirm fails ALREADY_USED.
  const dupConfirm = await req('/api/v1/confirm', {
    method: 'POST',
    body: { apiKey: basic.apiKey, amount: 1000, transactionId: '9AB12CD34E', id: verify.json.id },
  });
  assert.equal(dupConfirm.json.ok, false);
  assert.equal(dupConfirm.json.error, 'ALREADY_USED');

  // Wrong amount fails AMOUNT_MISMATCH (fresh SMS so it is not already used).
  await req('/api/sms', {
    method: 'POST', appKey: basic.appKey,
    body: { sender: '16247', text: 'You have received Tk 250.00 from 01911223344. Trx ID: BKASH98765. Thank you for using bKash.' },
  });
  const wrong = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: basic.apiKey, amount: 999, transactionId: 'BKASH98765' },
  });
  assert.equal(wrong.json.ok, false);
  assert.equal(wrong.json.error, 'AMOUNT_MISMATCH');

  // Unparseable SMS -> 422 UNPARSEABLE; bad app key -> 401.
  const bad = await req('/api/sms', {
    method: 'POST', appKey: basic.appKey,
    body: { sender: 'bKash', text: 'Your balance is Tk 5,000.00. Thank you.' },
  });
  assert.equal(bad.status, 422);
  assert.equal(bad.json.error, 'UNPARSEABLE');
  const badKey = await req('/api/sms', {
    method: 'POST', appKey: 'app_wrong',
    body: { sender: 'bKash', text: smsText },
  });
  assert.equal(badKey.status, 401);
});

test('Rocket flow: ingest -> verify -> confirm -> webhook', async () => {
  const ingest = await req('/api/sms', {
    method: 'POST', appKey: premium.appKey,
    body: { sender: 'Rocket', text: 'You have received Tk 750.00 from 01722223333. TrxID: ROCKET12345. Your Rocket balance is Tk 3,000.00.' },
  });
  assert.equal(ingest.json.ok, true, JSON.stringify(ingest.json));
  assert.equal(ingest.json.method, 'rocket');
  assert.equal(ingest.json.amount, 750);

  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: premium.apiKey, amount: 750, transactionId: 'ROCKET12345', order_id: 'ORD-R1' },
  });
  assert.equal(verify.json.ok, true, JSON.stringify(verify.json));
  assert.equal(verify.json.method, 'rocket');

  const confirm = await req('/api/v1/confirm', {
    method: 'POST',
    body: { apiKey: premium.apiKey, amount: 750, transactionId: 'ROCKET12345', id: verify.json.id },
  });
  assert.equal(confirm.json.ok, true, JSON.stringify(confirm.json));
  assert.equal(confirm.json.method, 'rocket');

  const gotWebhook = await waitFor(() =>
    deliveries.some((d) => d.body && d.body.transactionId === 'ROCKET12345'));
  assert.equal(gotWebhook, true, 'webhook for ROCKET12345 not received');

  const txns = await req('/api/me/transactions', { token: premium.token });
  const rocketRow = (txns.json.transactions || []).find((t) => t.trxid === 'ROCKET12345');
  assert.ok(rocketRow);
  assert.equal(rocketRow.method, 'rocket');
  assert.equal(rocketRow.status, 'used');
});

test('pay page: Premium shows Rocket + Upay numbers grouped, brand TakaTick', async () => {
  const res = await fetch(`${base}/pay/${premium.payKey}?amount=750&order_id=ORD-R1`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /TakaTick/);
  assert.match(html, /Rocket/);
  assert.match(html, /01722223333/);
  assert.match(html, /Upay/);
  assert.match(html, /01933334444/);
  assert.match(html, /name="method"/);
});

test('Upay pay-page claim confirms payment', async () => {
  await req('/api/sms', {
    method: 'POST', appKey: premium.appKey,
    body: { sender: 'Upay', text: 'You have received Tk 2,000.00 from 01933334444. TrxID: UPAY987654. Your Upay balance is Tk 4,500.00.' },
  });
  const res = await fetch(`${base}/pay/${premium.payKey}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ method: 'upay', amount: '2000', order_id: 'ORD-U1', transactionId: 'UPAY987654' }),
    redirect: 'manual',
  });
  const html = await res.text();
  assert.equal(res.status, 200, html.slice(0, 200));
  assert.match(html, /Payment confirmed/);
  assert.match(html, /UPAY987654/);
  const gotWebhook = await waitFor(() =>
    deliveries.some((d) => d.body && d.body.transactionId === 'UPAY987654'));
  assert.equal(gotWebhook, true, 'webhook for UPAY987654 not received');
});
