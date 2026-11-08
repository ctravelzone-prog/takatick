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
    body: { name, email, password: 'password123', package: pkg },
  });
  assert.equal(r.status, 201, `signup ${email}: ${JSON.stringify(r.json)}`);
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });
  assert.equal(login.json.ok, true);
  return { ...r.json, token: login.json.token };
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

test('landing page at / : hero, features, pricing, FAQ, seller number; /pricing.html redirects', async () => {
  const r = await req('/');
  assert.equal(r.status, 200, `GET / status ${r.status}`);
  assert.match(r.text, /TakaTick/);
  assert.match(r.text, /bKash, Nagad, Rocket/);
  assert.match(r.text, /How it works/);
  assert.match(r.text, /Pricing/);
  assert.match(r.text, /Frequently asked questions/);
  assert.match(r.text, /Sign up/);
  assert.match(r.text, new RegExp(SELLER_BKASH));
  assert.match(r.text, /Log in/);
  assert.doesNotMatch(r.text, /\{\{BRAND\}\}|\{\{SELLER_BKASH\}\}/);

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

  // SMS ingest stores the transaction, but verify is blocked while pending.
  await req('/api/sms', {
    method: 'POST', appKey: m.appKey,
    body: { sender: 'bKash', text: 'You have received Tk 1,000.00 from 01712345678. TrxID: PEND00001. Thank you.' },
  });
  const verify = await req('/api/v1/verify', {
    method: 'POST',
    body: { apiKey: m.apiKey, amount: 1000, transactionId: 'PEND00001' },
  });
  assert.equal(verify.status, 403);
  assert.equal(verify.json.error, 'PACKAGE_NOT_ACTIVE');

  // Pay page blocked while pending.
  const payPage = await req(`/pay/${m.payKey}?amount=1000`);
  assert.equal(payPage.status, 403);
  assert.match(payPage.text, /not active yet/i);

  // Order + approve activates with a fresh 30 days.
  const before = Date.now();
  await activateMerchant(m.token, 'basic', 'PEND-ORDER-1');
  const after = await req('/api/me/profile', { token: m.token });
  assert.equal(after.json.expiryState, 'active');
  const deltaDays = (new Date(after.json.packageExpiresAt).getTime() - before) / (24 * 3600 * 1000);
  assert.ok(deltaDays > 29.9 && deltaDays < 30.1, `activation window days: ${deltaDays}`);

  // Now the earlier SMS verifies fine.
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
  assert.match(home.text, /id="enrollTitle"/);
  const login = await req('/login.html');
  assert.match(login.text, /location\.href='\/dashboard\.html'/);
  assert.match(login.text, /location\.href='\/\#enroll'/);
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
