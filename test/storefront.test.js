// test/storefront.test.js — storefront v1.3 tests: landing page, enroll/order
// flow, admin panel, package expiry + 3-day grace, deactivation.
// Runs against a live server on an ephemeral port with a temp DB file.
// Uses only global fetch + node:test; no extra test framework.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let base;
let server;
let tmpDir;

const ADMIN_EMAIL = 'admin@takatick.test';
const ADMIN_PASSWORD = 'adminpass123';
const SELLER_BKASH = '01740707570';

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
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_e) { /* HTML pages */ }
  return { status: res.status, json, text, location: res.headers.get('location') };
}

async function signup(name, email, pkg) {
  const r = await req('/api/auth/signup', {
    method: 'POST',
    body: { name, email, phone: '01712345678', password: 'password123', package: pkg },
  });
  assert.equal(r.status, 201, `signup ${email}: ${JSON.stringify(r.json)}`);
  // v2.2: signup issues NO keys — they come only on activation.
  assert.ok(!('apiKey' in r.json) && !('appKey' in r.json) && !('payKey' in r.json));
  assert.equal(r.json.merchant.pay_key.startsWith('pending_'), true);
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });
  assert.equal(login.json.ok, true);
  return { ...r.json, token: login.json.token };
}

// v2.2: fetch the keys issued on activation (API key, app key, pay key).
async function fetchKeys(token) {
  const apiKeyRes = await req('/api/me/api-key', { token });
  assert.equal(apiKeyRes.status, 200, `api-key: ${JSON.stringify(apiKeyRes.json)}`);
  const appKeyRes = await req('/api/me/app-key', { token });
  assert.equal(appKeyRes.status, 200, `app-key: ${JSON.stringify(appKeyRes.json)}`);
  const profile = await req('/api/me/profile', { token });
  assert.ok(profile.json.merchant.pay_key.startsWith('pay_'), `pay_key: ${profile.json.merchant.pay_key}`);
  return {
    apiKey: apiKeyRes.json.apiKey,
    appKey: appKeyRes.json.appKey,
    payKey: profile.json.merchant.pay_key,
  };
}

async function adminLogin(password = ADMIN_PASSWORD) {
  const r = await req('/api/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password },
  });
  return r;
}

async function approveOrder(orderId) {
  const r = await req(`/api/admin/orders/${orderId}/approve`, {
    method: 'POST', token: adminToken, body: {},
  });
  assert.equal(r.status, 200, `approve order ${orderId}: ${JSON.stringify(r.json)}`);
  return r.json;
}

const ORDER_PRICES = { basic: 300, standard: 600, premium: 900 };
async function activateMerchant(token, pkg, trxid) {
  const order = await req('/api/me/orders', {
    method: 'POST', token,
    body: { package: pkg, trxid, sender: SELLER_BKASH, amount: ORDER_PRICES[pkg] },
  });
  assert.equal(order.status, 201, `activate order: ${JSON.stringify(order.json)}`);
  await approveOrder(order.json.order.id);
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takatick-storefront-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.JWT_SECRET = 'test-secret';
  process.env.BRAND_NAME = 'TakaTick';
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.SELLER_BKASH_NUMBER = SELLER_BKASH;

  const { startServer } = require('../server');
  server = await startServer(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    const { db } = require('../server');
    db.close();
  } catch (_e) { /* already closed */ }
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('public pricing returns packages + seller bKash + grace days', async () => {
  const r = await req('/api/public/pricing');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.brand, 'TakaTick');
  assert.equal(r.json.sellerBkash, SELLER_BKASH);
  assert.equal(r.json.graceDays, 3);
  assert.equal(r.json.packages.length, 3);
  const byId = Object.fromEntries(r.json.packages.map((p) => [p.id, p]));
  assert.equal(byId.basic.priceBDT, 300);
  assert.equal(byId.standard.priceBDT, 600);
  assert.equal(byId.premium.priceBDT, 900);
});

test('landing page at / : hero, features, pricing, FAQ; /pricing.html redirects; seller number on /enroll.html', async () => {
  const r = await req('/');
  assert.equal(r.status, 200, `GET / status ${r.status}`);
  assert.match(r.text, /TakaTick/);
  assert.match(r.text, /bKash, Nagad, Rocket/);
  assert.match(r.text, /How it works/);
  assert.match(r.text, /Pricing/);
  assert.match(r.text, /Frequently asked questions/);
  assert.match(r.text, /Sign up/);
  assert.match(r.text, /Log in/);
  assert.doesNotMatch(r.text, /\{\{BRAND\}\}|\{\{SELLER_BKASH\}\}/);
  // The seller bKash number moved with the wizard to the enroll page.
  const enroll = await req('/enroll.html');
  assert.equal(enroll.status, 200);
  assert.match(enroll.text, new RegExp(SELLER_BKASH));
  assert.doesNotMatch(enroll.text, /\{\{BRAND\}\}|\{\{SELLER_BKASH\}\}/);

  const redir = await req('/pricing.html');
  assert.equal(redir.status, 302);
  assert.equal(redir.location, '/#pricing');

  const login = await req('/login.html');
  assert.equal(login.status, 200);
  assert.match(login.text, /#pricing/);
});

let adminToken;
let buyer1;

test('admin login: wrong password 401; correct login works', async () => {
  const wrong = await adminLogin('nope-wrong-password');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, 'INVALID_CREDENTIALS');

  const ok = await adminLogin();
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.ok, true);
  assert.ok(ok.json.token);
  adminToken = ok.json.token;
});

test('merchant token cannot access admin routes; no token 401', async () => {
  buyer1 = await signup('Buyer One', 'buyer1@takatick.test', 'basic');
  const asMerchant = await req('/api/admin/merchants', { token: buyer1.token });
  assert.equal(asMerchant.status, 403);
  assert.equal(asMerchant.json.error, 'FORBIDDEN');

  const noToken = await req('/api/admin/merchants');
  assert.equal(noToken.status, 401);

  const orders = await req('/api/admin/orders', { token: buyer1.token });
  assert.equal(orders.status, 403);
});

test('order create: success, wrong amount, duplicate TrxID, invalid package', async () => {
  const ok = await req('/api/me/orders', {
    method: 'POST', token: buyer1.token,
    body: { package: 'premium', trxid: 'SELL000001', sender: SELLER_BKASH, amount: 900 },
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.equal(ok.json.ok, true);
  assert.equal(ok.json.order.status, 'pending');
  assert.equal(ok.json.order.package, 'premium');

  const wrongAmount = await req('/api/me/orders', {
    method: 'POST', token: buyer1.token,
    body: { package: 'premium', trxid: 'SELL000002', sender: SELLER_BKASH, amount: 899 },
  });
  assert.equal(wrongAmount.status, 400);
  assert.equal(wrongAmount.json.error, 'AMOUNT_MISMATCH');
  assert.equal(wrongAmount.json.expectedBDT, 900);

  const dup = await req('/api/me/orders', {
    method: 'POST', token: buyer1.token,
    body: { package: 'premium', trxid: 'SELL000001', sender: SELLER_BKASH, amount: 900 },
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error, 'DUPLICATE_TRXID');

  const badPkg = await req('/api/me/orders', {
    method: 'POST', token: buyer1.token,
    body: { package: 'ultra', trxid: 'SELL000003', sender: SELLER_BKASH, amount: 900 },
  });
  assert.equal(badPkg.status, 400);
  assert.equal(badPkg.json.error, 'INVALID_PACKAGE');
});

test('admin approve activates package + 30-day expiry (fresh from approval)', async () => {
  const before = Date.now();
  const approve = await req('/api/admin/orders/1/approve', {
    method: 'POST', token: adminToken, body: {},
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  assert.equal(approve.json.order.status, 'approved');
  assert.equal(approve.json.merchant.package, 'premium');

  const profile = await req('/api/me/profile', { token: buyer1.token });
  assert.equal(profile.json.merchant.package, 'premium');
  assert.equal(profile.json.expiryState, 'active');
  const expiresMs = new Date(profile.json.packageExpiresAt).getTime();
  const deltaDays = (expiresMs - before) / (24 * 3600 * 1000);
  assert.ok(deltaDays > 29.9 && deltaDays < 30.1, `expiry delta days: ${deltaDays}`);

  // Approving again fails (already decided).
  const again = await req('/api/admin/orders/1/approve', {
    method: 'POST', token: adminToken, body: {},
  });
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'ORDER_ALREADY_DECIDED');
});

test('admin reject keeps the old package', async () => {
  const buyer2 = await signup('Buyer Two', 'buyer2@takatick.test', 'basic');
  const order = await req('/api/me/orders', {
    method: 'POST', token: buyer2.token,
    body: { package: 'standard', trxid: 'SELL000010', sender: SELLER_BKASH, amount: 600 },
  });
  assert.equal(order.status, 201);
  const reject = await req(`/api/admin/orders/${order.json.order.id}/reject`, {
    method: 'POST', token: adminToken, body: {},
  });
  assert.equal(reject.status, 200, JSON.stringify(reject.json));
  assert.equal(reject.json.order.status, 'rejected');
  const profile = await req('/api/me/profile', { token: buyer2.token });
  assert.equal(profile.json.merchant.package, 'basic');
  // Still pending — rejection does not activate anything.
  assert.equal(profile.json.expiryState, 'pending');
});

let expiryMerchant;

test('expiry: 4 days past expiry -> verify 403 PACKAGE_EXPIRED + pay page blocked', async () => {
  expiryMerchant = await signup('Expiry Merchant', 'expiry@takatick.test', 'premium');
  await activateMerchant(expiryMerchant.token, 'premium', 'EXPIRE-ACT-1');
  Object.assign(expiryMerchant, await fetchKeys(expiryMerchant.token));
  const ingest = await req('/api/sms', {
    method: 'POST', appKey: expiryMerchant.appKey,
    body: { sender: 'bKash', text: 'You have received Tk 1,000.00 from 01712345678. TrxID: EXPIRE0001. Thank you.' },
  });
  assert.equal(ingest.json.ok, true, JSON.stringify(ingest.json));

  const { db } = require('../server');
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE merchants SET package_expires_at = ? WHERE id = ?')
    .run(fourDaysAgo, expiryMerchant.merchant.id);

  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: expiryMerchant.apiKey, amount: 1000, transactionId: 'EXPIRE0001' },
  });
  assert.equal(verify.status, 403);
  assert.equal(verify.json.error, 'PACKAGE_EXPIRED');

  const payPage = await req(`/pay/${expiryMerchant.payKey}?amount=1000`);
  assert.equal(payPage.status, 403);
  assert.match(payPage.text, /expired/i);

  const claim = await fetch(`${base}/pay/${expiryMerchant.payKey}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ method: 'bkash', amount: '1000', transactionId: 'EXPIRE0001' }),
    redirect: 'manual',
  });
  assert.equal(claim.status, 403);
});

test('grace: 1 day past expiry still verifies OK; pay page works with grace notice', async () => {
  const { db } = require('../server');
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE merchants SET package_expires_at = ? WHERE id = ?')
    .run(oneDayAgo, expiryMerchant.merchant.id);

  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: expiryMerchant.apiKey, amount: 1000, transactionId: 'EXPIRE0001' },
  });
  assert.equal(verify.json.ok, true, JSON.stringify(verify.json));
  assert.equal(verify.json.amount, 1000);

  const profile = await req('/api/me/profile', { token: expiryMerchant.token });
  assert.equal(profile.json.expiryState, 'grace');
  assert.equal(profile.json.graceDaysLeft, 2);

  const payPage = await req(`/pay/${expiryMerchant.payKey}?amount=1000`);
  assert.equal(payPage.status, 200);
  assert.match(payPage.text, /grace period/i);
});

test('deactivated merchant verify -> 403 ACCOUNT_DEACTIVATED; reactivate works', async () => {
  const off = await req(`/api/admin/merchants/${expiryMerchant.merchant.id}/status`, {
    method: 'POST', token: adminToken, body: { status: 'deactivated' },
  });
  assert.equal(off.status, 200, JSON.stringify(off.json));
  assert.equal(off.json.merchant.status, 'deactivated');

  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: expiryMerchant.apiKey, amount: 1000, transactionId: 'EXPIRE0001' },
  });
  assert.equal(verify.status, 403);
  assert.equal(verify.json.error, 'ACCOUNT_DEACTIVATED');

  const on = await req(`/api/admin/merchants/${expiryMerchant.merchant.id}/status`, {
    method: 'POST', token: adminToken, body: { status: 'active' },
  });
  assert.equal(on.json.merchant.status, 'active');
  const verifyAgain = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: expiryMerchant.apiKey, amount: 1000, transactionId: 'EXPIRE0001' },
  });
  assert.equal(verifyAgain.json.ok, true, JSON.stringify(verifyAgain.json));
});

test('plan deactivated: number/website/settings/key writes -> 403 ACCOUNT_DEACTIVATED; reactivate restores', async () => {
  const off = await req(`/api/admin/merchants/${expiryMerchant.merchant.id}/status`, {
    method: 'POST', token: adminToken, body: { status: 'deactivated' },
  });
  assert.equal(off.json.merchant.status, 'deactivated');

  const profile = await req('/api/me/profile', { token: expiryMerchant.token });
  assert.equal(profile.json.expiryState, 'deactivated');

  const num = await req('/api/me/numbers', {
    method: 'POST', token: expiryMerchant.token,
    body: { method: 'bkash', number: '01712345678', label: 'test' },
  });
  assert.equal(num.status, 403);
  assert.equal(num.json.error, 'ACCOUNT_DEACTIVATED');

  const site = await req('/api/me/websites', {
    method: 'POST', token: expiryMerchant.token, body: { domain: 'example.com' },
  });
  assert.equal(site.status, 403);
  assert.equal(site.json.error, 'ACCOUNT_DEACTIVATED');

  const settings = await req('/api/me/settings', {
    method: 'POST', token: expiryMerchant.token, body: { webhook_url: 'https://example.com/hook' },
  });
  assert.equal(settings.status, 403);
  assert.equal(settings.json.error, 'ACCOUNT_DEACTIVATED');

  const regen = await req('/api/me/api-key/regenerate', {
    method: 'POST', token: expiryMerchant.token, body: {},
  });
  assert.equal(regen.status, 403);
  assert.equal(regen.json.error, 'ACCOUNT_DEACTIVATED');

  const delNum = await req('/api/me/numbers/999999', { method: 'DELETE', token: expiryMerchant.token });
  assert.equal(delNum.status, 403);
  assert.equal(delNum.json.error, 'ACCOUNT_DEACTIVATED');

  const on = await req(`/api/admin/merchants/${expiryMerchant.merchant.id}/status`, {
    method: 'POST', token: adminToken, body: { status: 'active' },
  });
  assert.equal(on.json.merchant.status, 'active');

  const numAgain = await req('/api/me/numbers', {
    method: 'POST', token: expiryMerchant.token,
    body: { method: 'bkash', number: '01712345678', label: 'test' },
  });
  assert.equal(numAgain.status, 201, JSON.stringify(numAgain.json));
});

test('dashboard shows Plan deactivated state + disabled-actions markup', async () => {
  const d = await req('/dashboard.html');
  assert.equal(d.status, 200);
  assert.match(d.text, /Plan deactivated/);
  assert.match(d.text, /id="regenBtn"/);
  assert.match(d.text, /planOff/);
});

test('admin merchants list shows expiry state; manual package change works', async () => {
  const list = await req('/api/admin/merchants', { token: adminToken });
  assert.equal(list.status, 200);
  const row = list.json.merchants.find((m) => m.email === 'expiry@takatick.test');
  assert.ok(row);
  assert.equal(row.expiry_state, 'grace');
  assert.ok(row.package_expires_at);
  assert.equal(row.grace_days_left, 2);

  const change = await req(`/api/admin/merchants/${row.id}/package`, {
    method: 'POST', token: adminToken, body: { package: 'standard' },
  });
  assert.equal(change.status, 200, JSON.stringify(change.json));
  assert.equal(change.json.merchant.package, 'standard');
  const profile = await req('/api/me/profile', { token: expiryMerchant.token });
  assert.equal(profile.json.merchant.package, 'standard');
});

test('renewal during grace: approve resets expiry to approval + 30d (not stacked)', async () => {
  const { db } = require('../server');
  // The previous test's manual package change gave a fresh 30-day window;
  // put the merchant back into grace (1 day past expiry) for this test.
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE merchants SET package_expires_at = ? WHERE id = ?')
    .run(oneDayAgo, expiryMerchant.merchant.id);
  const oldExpiry = oneDayAgo;
  const order = await req('/api/me/orders', {
    method: 'POST', token: expiryMerchant.token,
    body: { package: 'premium', trxid: 'RENEW00001', sender: SELLER_BKASH, amount: 900 },
  });
  assert.equal(order.status, 201, JSON.stringify(order.json));
  const approve = await req(`/api/admin/orders/${order.json.order.id}/approve`, {
    method: 'POST', token: adminToken, body: {},
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  const profile = await req('/api/me/profile', { token: expiryMerchant.token });
  assert.equal(profile.json.merchant.package, 'premium');
  assert.equal(profile.json.expiryState, 'active');
  // Fresh 30 days from approval: new expiry - old expiry must be ~31 days
  // (old expiry was 1 day in the past). Stacked (old + 30d) would be 30.
  const newMs = new Date(profile.json.packageExpiresAt).getTime();
  const oldMs = new Date(oldExpiry).getTime();
  const gapDays = (newMs - oldMs) / (24 * 3600 * 1000);
  assert.ok(gapDays > 30.5 && gapDays < 31.5, `renewal gap days: ${gapDays}`);
});

test('signup is pending: no service until admin approves (Siam bug report)', async () => {
  const m = await signup('Pending Merchant', 'pending@takatick.test', 'basic');
  const profile = await req('/api/me/profile', { token: m.token });
  assert.equal(profile.json.expiryState, 'pending');
  assert.equal(profile.json.packageExpiresAt, null);
  // v2.2: no keys at all while pending — nothing to use.
  assert.equal(profile.json.apiKeyMasked, null);
  assert.equal(profile.json.merchant.pay_key.startsWith('pending_'), true);
  const appKey = await req('/api/me/app-key', { token: m.token });
  assert.equal(appKey.status, 403);
  assert.equal(appKey.json.error, 'PACKAGE_NOT_ACTIVE');

  // SMS ingest without an app key is rejected.
  const ingest = await req('/api/sms', {
    method: 'POST',
    body: { sender: 'bKash', text: 'You have received Tk 1,000.00 from 01712345678. TrxID: PEND00001. Thank you.' },
  });
  assert.equal(ingest.status, 401);

  // Verify with an unknown key is rejected.
  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: 'invalid_api_key_123', amount: 1000, transactionId: 'PEND00001' },
  });
  assert.equal(verify.status, 401);

  // Pay page with an unknown pay key is not found.
  const payPage = await req('/pay/pay_00000000000000000000000000000000?amount=1000');
  assert.equal(payPage.status, 404);

  // Order + approve activates with a fresh 30 days — and issues the keys.
  const before = Date.now();
  await activateMerchant(m.token, 'basic', 'PEND-ORDER-1');
  const after = await req('/api/me/profile', { token: m.token });
  assert.equal(after.json.expiryState, 'active');
  const deltaDays = (new Date(after.json.packageExpiresAt).getTime() - before) / (24 * 3600 * 1000);
  assert.ok(deltaDays > 29.9 && deltaDays < 30.1, `activation window days: ${deltaDays}`);
  Object.assign(m, await fetchKeys(m.token));

  // Now SMS ingest + verify work with the issued keys.
  const ingest2 = await req('/api/sms', {
    method: 'POST', appKey: m.appKey,
    body: { sender: 'bKash', text: 'You have received Tk 1,000.00 from 01712345678. TrxID: PEND00001. Thank you.' },
  });
  assert.equal(ingest2.status, 200, JSON.stringify(ingest2.json));
  const verify2 = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: m.apiKey, amount: 1000, transactionId: 'PEND00001' },
  });
  assert.equal(verify2.json.ok, true, JSON.stringify(verify2.json));
});

test('admin manual package change activates a pending merchant', async () => {
  const m = await signup('Manual Merchant', 'manual@takatick.test', 'basic');
  const before = Date.now();
  const change = await req(`/api/admin/merchants/${m.merchant.id}/package`, {
    method: 'POST', token: adminToken, body: { package: 'standard' },
  });
  assert.equal(change.status, 200, JSON.stringify(change.json));
  assert.equal(change.json.merchant.package, 'standard');
  assert.equal(change.json.merchant.status, 'active');
  const profile = await req('/api/me/profile', { token: m.token });
  assert.equal(profile.json.expiryState, 'active');
  const deltaDays = (new Date(profile.json.packageExpiresAt).getTime() - before) / (24 * 3600 * 1000);
  assert.ok(deltaDays > 29.9 && deltaDays < 30.1, `manual activation window days: ${deltaDays}`);
  // v2.2: manual activation also issues the keys.
  const keys = await fetchKeys(m.token);
  assert.ok(keys.apiKey.startsWith('sk_live_'));
  assert.ok(keys.appKey.startsWith('app_'));
  assert.ok(keys.payKey.startsWith('pay_'));
});

test('landing + login pages: logged-in nav hooks present', async () => {
  const home = await req('/');
  assert.match(home.text, /id="authNav"/);
  assert.match(home.text, /id="heroSignup"/);
  assert.match(home.text, /\/api\/me\/profile/);
  assert.match(home.text, /My profile/);
  assert.match(home.text, /border-radius:50%/);
  assert.match(home.text, /href="\/dashboard\.html"/);
  assert.match(home.text, /Go to dashboard/);
  const enroll = await req('/enroll.html');
  assert.match(enroll.text, /id="enrollTitle"/);
  const login = await req('/login.html');
  assert.match(login.text, /location\.href='\/dashboard\.html'/);
  // v2.3: signup moved to its own page — login has no signup form, and the
  // post-signup redirect to #pricing lives on /signup.html now.
  assert.doesNotMatch(login.text, /id="signupForm"/);
  assert.doesNotMatch(login.text, /Create account/);
  assert.match(login.text, /href="\/signup\.html"/);
  const signup = await req('/signup.html');
  assert.equal(signup.status, 200);
  assert.match(signup.text, /id="signupForm"/);
  assert.match(signup.text, /Create account/);
  assert.match(signup.text, /location\.href='\/\#pricing'/);
  assert.match(signup.text, /href="\/login\.html"/);
  // Standard flow: account creation asks for name/email/password only —
  // no plan/price selection at signup (plan is chosen in the wizard).
  assert.doesNotMatch(signup.text, /name="package"/);
});

test('v2.3: header + hero Sign up go to the signup page, not to pricing', async () => {
  const home = await req('/');
  assert.match(home.text, /href="\/signup\.html">Sign up<\/a>/);
  assert.match(home.text, /id="heroSignup"[^>]*href="\/signup\.html"|href="\/signup\.html" id="heroSignup"/);
  assert.match(home.text, /href="#pricing">See pricing<\/a>/);
});

test('signup step asks no plan: no package dropdown, selected plan shown as text', async () => {
  const page = await req('/enroll.html');
  assert.doesNotMatch(page.text, /id="pkgSelect"/);
  assert.match(page.text, /id="signupPlan"/);
  assert.match(page.text, /Selected plan:/);
});

test('enroll is a stepped wizard on its own page: landing has none, /enroll.html has all steps', async () => {
  const home = await req('/');
  assert.doesNotMatch(home.text, /id="enroll"/);
  assert.doesNotMatch(home.text, /id="planStep"/);
  const page = await req('/enroll.html');
  assert.match(page.text, /id="planStep"/);
  assert.match(page.text, /id="planOptions"/);
  assert.match(page.text, /showEnroll\(\)/);
  assert.match(page.text, /Choose your plan/);
  assert.match(page.text, /Continue to payment/);
  assert.match(page.text, /Step 1 of 3/);
  assert.match(page.text, /Step 2 of 3/);
  assert.match(page.text, /Step 3 of 3/);
});

test('v1.8 logo + hero + favicon: files exist and pages reference them', async () => {
  const home = await req('/');
  assert.match(home.text, /\/images\/logo\.png/);
  assert.match(home.text, /\/images\/hero\.png/);
  assert.match(home.text, /hero-grid/);
  assert.match(home.text, /Space Grotesk/);
  for (const p of ['/images/logo.png', '/images/hero.png', '/favicon.png', '/images/feature-sms.png']) {
    const r = await req(p);
    assert.equal(r.status, 200, `${p} status ${r.status}`);
  }
  for (const p of ['/login.html', '/dashboard.html', '/admin.html']) {
    const r = await req(p);
    assert.equal(r.status, 200, `${p} status ${r.status}`);
    assert.match(r.text, /\/images\/logo\.png/, `${p} has the logo`);
    assert.match(r.text, /\/favicon\.png/, `${p} has the favicon`);
  }
});

test('v1.8 optimistic profile chip: setProfileChip sets the chip from signup data (on /enroll.html)', async () => {
  const page = await req('/enroll.html');
  assert.match(page.text, /function setProfileChip/);
  assert.match(page.text, /setProfileChip\(f\.get\('name'\)/);
  assert.match(page.text, /Waiting for approval/);
  assert.match(page.text, /setProfileChip\(p\.merchant\.name, p\.package\.name, stateLabel\)/);
  // The landing still shows the chip for logged-in merchants via updateNav.
  const home = await req('/');
  assert.match(home.text, /function setProfileChip/);
  assert.match(home.text, /setProfileChip\(p\.merchant\.name, p\.package\.name, stateLabel\)/);
});

test('v1.8 master admin: extended stats (per-package, per-status, revenue, verifications)', async () => {
  const s = await req('/api/admin/stats', { token: adminToken });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  const st = s.json.stats;
  assert.equal(st.merchants, 5);
  assert.equal(st.byPackage.basic, 2);
  assert.equal(st.byPackage.standard, 1);
  assert.equal(st.byPackage.premium, 2);
  assert.equal(st.byStatus.active, 4);
  assert.equal(st.byStatus.pending, 1);
  assert.equal(st.byStatus.deactivated, 0);
  assert.equal(st.pendingOrders, 0);
  assert.equal(st.verificationsThisMonth, 3);
  assert.equal(st.revenueThisMonthBDT, 3000);
  assert.equal(st.graceDays, 3);
});

let masterMerchant = null;

test('v1.8 master admin: merchant detail endpoint', async () => {
  masterMerchant = await signup('Master Merchant', 'master@takatick.test', 'basic');
  const num = await req('/api/me/numbers', {
    method: 'POST', token: masterMerchant.token,
    body: { method: 'bkash', number: '01799998888' },
  });
  assert.equal(num.status, 201, JSON.stringify(num.json));
  await activateMerchant(masterMerchant.token, 'basic', 'MASTER-ORDER-1');
  Object.assign(masterMerchant, await fetchKeys(masterMerchant.token));

  const d = await req(`/api/admin/merchants/${masterMerchant.merchant.id}`, { token: adminToken });
  assert.equal(d.status, 200, JSON.stringify(d.json));
  assert.equal(d.json.merchant.email, 'master@takatick.test');
  assert.equal(d.json.merchant.package, 'basic');
  assert.equal(d.json.merchant.expiry_state, 'active');
  assert.ok(d.json.numbers.some((n) => n.number === '01799998888'));
  assert.ok(d.json.orders.some((o) => o.trxid === 'MASTER-ORDER-1' && o.status === 'approved'));
  assert.equal(d.json.websites.length, 0);

  const missing = await req('/api/admin/merchants/999999', { token: adminToken });
  assert.equal(missing.status, 404);
  const asMerchant = await req(`/api/admin/merchants/${masterMerchant.merchant.id}`, { token: masterMerchant.token });
  assert.equal(asMerchant.status, 403);
  assert.equal(asMerchant.json.error, 'FORBIDDEN');
});

test('v1.8 master admin: transactions endpoint lists SMS + verifications', async () => {
  await req('/api/sms', {
    method: 'POST', appKey: masterMerchant.appKey,
    body: { sender: 'bKash', text: 'You have received Tk 500.00 from 01712345678. TrxID: MASTER0001. Thank you.' },
  });
  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: masterMerchant.apiKey, amount: 500, transactionId: 'MASTER0001' },
  });
  assert.equal(verify.json.ok, true, JSON.stringify(verify.json));

  const t = await req('/api/admin/transactions', { token: adminToken });
  assert.equal(t.status, 200, JSON.stringify(t.json));
  const sms = t.json.smsTransactions.find((x) => x.trxid === 'MASTER0001');
  assert.ok(sms, 'SMS transaction listed');
  assert.equal(sms.merchant_email, 'master@takatick.test');
  assert.equal(sms.method, 'bkash');
  const v = t.json.verifications.find((x) => x.transaction_id === 'MASTER0001');
  assert.ok(v, 'verification listed');
  assert.equal(v.merchant_email, 'master@takatick.test');

  const asMerchant = await req('/api/admin/transactions', { token: masterMerchant.token });
  assert.equal(asMerchant.status, 403);
});

test('v1.8 master admin: package editing applies live + validates + restores', async () => {
  const edit = await req('/api/admin/packages/standard', {
    method: 'POST', token: adminToken, body: { priceBDT: 650 },
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.json));
  assert.equal(edit.json.package.priceBDT, 650);
  try {
    const pricing = await req('/api/public/pricing');
    const std = pricing.json.packages.find((p) => p.id === 'standard');
    assert.equal(std.priceBDT, 650, 'public pricing shows the new price immediately');

    const badPrice = await req('/api/admin/packages/standard', {
      method: 'POST', token: adminToken, body: { priceBDT: -5 },
    });
    assert.equal(badPrice.status, 400);
    const badPkg = await req('/api/admin/packages/ultra', {
      method: 'POST', token: adminToken, body: { priceBDT: 100 },
    });
    assert.equal(badPkg.status, 404);
    const asMerchant = await req('/api/admin/packages/standard', {
      method: 'POST', token: masterMerchant.token, body: { priceBDT: 700 },
    });
    assert.equal(asMerchant.status, 403);
  } finally {
    const restore = await req('/api/admin/packages/standard', {
      method: 'POST', token: adminToken, body: { priceBDT: 600 },
    });
    assert.equal(restore.status, 200, JSON.stringify(restore.json));
    const pricing = await req('/api/public/pricing');
    assert.equal(pricing.json.packages.find((p) => p.id === 'standard').priceBDT, 600);
  }
});

test('v1.8 master admin: admin.html has all sections', async () => {
  const r = await req('/admin.html');
  assert.equal(r.status, 200);
  assert.match(r.text, /Master Admin/);
  for (const sec of ['dashboard', 'merchants', 'orders', 'packages', 'transactions', 'settings']) {
    assert.match(r.text, new RegExp(`id="sec-${sec}"`), `section ${sec} present`);
  }
  assert.match(r.text, /showSection\('merchants'\)/);
  assert.match(r.text, /loadMerchantDetail/);
  assert.match(r.text, /savePackage/);
});

test('admin login returns ADMIN_NOT_CONFIGURED when no admin exists', async () => {
  const { db } = require('../server');
  db.prepare('DELETE FROM admins').run();
  const r = await req('/api/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  assert.equal(r.status, 503);
  assert.equal(r.json.error, 'ADMIN_NOT_CONFIGURED');
});

test('v1.9 plan-choose step: 3-card picker with featured Premium + hidden radios (on /enroll.html)', async () => {
  const page = await req('/enroll.html');
  assert.equal(page.status, 200);
  const home = page;
  assert.match(home.text, /id="enrollBox"/);
  assert.match(home.text, /plan-grid/);
  assert.match(home.text, /plan-card/);
  assert.match(home.text, /plan-ribbon/);
  assert.match(home.text, /Most Popular/);
  assert.match(home.text, /plan-selected-badge/);
  assert.match(home.text, /method-chip/);
  assert.match(home.text, /renderPlanOptions/);
  assert.match(home.text, /enroll-box\.wide/);
  assert.match(home.text, /classList\.add\('wide'\)/);
  // Radio inputs stay in the DOM (visually hidden, name="plan") so the
  // existing selection logic keeps working.
  assert.match(home.text, /type="radio" name="plan"/);
  // Cards are ordered Basic → Standard → Premium in the renderer.
  assert.match(home.text, /\['basic','standard','premium'\]/);
  // Wizard contract intact.
  assert.match(home.text, /id="planStep"/);
  assert.match(home.text, /id="planOptions"/);
  assert.match(home.text, /confirmPlan\(\)/);
  assert.match(home.text, /Continue to payment/);
  assert.match(home.text, /You can change the plan before paying/);
  // The enroll page takes the plan from the URL (?plan= / ?package=).
  assert.match(home.text, /params\.get\('plan'\)/);
  assert.match(home.text, /loadPricing\(\)\.then\(\(\) => showEnroll\(\)\)/);
});

test('v2.0 enroll is a separate page: landing has no wizard, Choose navigates to /enroll.html', async () => {
  const home = await req('/');
  assert.equal(home.status, 200);
  assert.doesNotMatch(home.text, /id="enrollBox"/);
  assert.doesNotMatch(home.text, /renderPlanOptions/);
  assert.doesNotMatch(home.text, /id="signupForm"/);
  assert.match(home.text, /\/enroll\.html\?plan=/);
  assert.match(home.text, /choosePackage/);
  const page = await req('/enroll.html?plan=standard');
  assert.equal(page.status, 200);
  assert.match(page.text, /id="enrollBox"/);
  assert.match(page.text, /01740707570/);
});

test('v2.4: signup asks phone number; admin shows it', async () => {
  for (const p of ['/signup.html', '/enroll.html']) {
    const page = await req(p);
    assert.equal(page.status, 200, p);
    assert.match(page.text, /name="phone"/);
    assert.match(page.text, /Phone number/);
  }
  const admin = await req('/admin.html');
  assert.match(admin.text, /<th>Phone<\/th>/);
  assert.match(admin.text, /x\.phone/);
  assert.match(admin.text, /href="tel:/);
});

test('v2.5: expired merchant cannot change numbers/settings or regenerate keys, but renewal stays open', async () => {
  // The shared expiry fixture was moved back to grace (1 day past expiry)
  // by later tests — force it to fully expired (4 days past) again.
  const { db } = require('../server');
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE merchants SET package_expires_at = ? WHERE id = ?')
    .run(fourDaysAgo, expiryMerchant.merchant.id);
  const prof = await req('/api/me/profile', { token: expiryMerchant.token });
  assert.equal(prof.json.expiryState, 'expired');
  const t = expiryMerchant.token;
  const num = await req('/api/me/numbers', { method: 'POST', token: t, body: { method: 'bkash', number: '01711111111', label: 'Test' } });
  assert.equal(num.status, 403);
  assert.equal(num.json.error, 'PACKAGE_EXPIRED');
  const st = await req('/api/me/settings', { method: 'POST', token: t, body: { webhook_url: 'https://example.com/hook', success_url: '', fail_url: '' } });
  assert.equal(st.status, 403);
  assert.equal(st.json.error, 'PACKAGE_EXPIRED');
  const rg = await req('/api/me/api-key/regenerate', { method: 'POST', token: t, body: {} });
  assert.equal(rg.status, 403);
  assert.equal(rg.json.error, 'PACKAGE_EXPIRED');
  // Renewal stays open: ordering a new package is NOT blocked.
  const order = await req('/api/me/orders', { method: 'POST', token: t, body: { package: 'basic', trxid: 'EXPIRE-RENEW-1', sender: '01712345678', amount: 300 } });
  assert.equal(order.status, 201, JSON.stringify(order.json));
});

test('v2.5: dashboard warns 1 day before expiry + big expired box listing what stopped', async () => {
  const d = await req('/dashboard.html');
  assert.equal(d.status, 200);
  assert.match(d.text, /kal sesh hobe/);
  assert.match(d.text, /daysLeft <= 1/);
  assert.match(d.text, /Package-er meyad sesh/);
  assert.match(d.text, /kichui kaj korbe na/);
  assert.match(d.text, /SMS asleo confirm hobe na/);
  assert.match(d.text, /const frozen = planOff/);
});
