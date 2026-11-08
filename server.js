// server.js — TakaTick payment-verification MVP (Express + node:sqlite).
// Brand: TakaTick (from config/packages.json brand / BRAND_NAME env —
// getBrand() in src/limits.js is the single source; pages never hardcode it).
//
// Money NEVER flows through this server. Merchants receive bKash/Nagad/
// Rocket/Upay payments to their own personal numbers; their Android app
// forwards the payment SMS here, and this server only verifies a payment
// claim (TrxID + amount) against a forwarded SMS, then confirms it and
// fires an optional signed webhook. All secrets come from env, never hardcoded.
// Money is stored as integer poisha (BDT * 100).
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db, nowIso, currentMonthPrefix } = require('./src/db');
const { parseSms } = require('./src/smsParser');
const { fireWebhook } = require('./src/webhook');
const { getConfig, getBrand, getPackage, getGraceDays, verificationLimitReached, ALL_METHODS, methodAllowedForPackage } = require('./src/limits');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const PORT = parseInt(process.env.PORT || '3000', 10);
const config = getConfig();
const DAY_MS = 24 * 3600 * 1000;
const PACKAGE_DAYS = 30;

// Seller payment number (public — shown on the enroll/pricing page).
// Siam's bKash number; SELLER_BKASH_NUMBER env overrides, the fallback
// below is the same number (it is meant to be shown publicly).
const SELLER_BKASH_NUMBER = process.env.SELLER_BKASH_NUMBER || '01883042132';
// Admin account: seeded from env on first boot (see ensureAdminSeeded).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Brand injection for static pages: login.html / dashboard.html / pricing.html /
// admin.html / enroll.html carry the {{BRAND}} placeholder (no hardcoded brand string in the
// pages). The brand comes from the single config value — config/packages.json
// `brand`, or BRAND_NAME env which overrides it (see getBrand() in src/limits.js).
// pricing.html also gets {{SELLER_BKASH}} (Siam's public bKash number).
app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path === '/dashboard.html' || req.path === '/admin.html' || req.path === '/enroll.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'public', req.path), 'utf8');
      return res.type('html').send(html
        .split('{{BRAND}}').join(escapeHtml(getBrand()))
        .split('{{SELLER_BKASH}}').join(escapeHtml(SELLER_BKASH_NUMBER)));
    } catch (_e) {
      return next();
    }
  }
  return next();
});
// Landing page (v1.3): root / serves public/index.html — TakaTick's
// website (hero, features, how-it-works, pricing, FAQ, enroll flow),
// with brand + seller bKash number injected. These routes MUST be defined
// BEFORE express.static, which would otherwise serve index.html raw.
// /pricing.html redirects to the pricing section of the landing page.
app.get('/', (_req, res) => {
  try {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    return res.type('html').send(html
      .split('{{BRAND}}').join(escapeHtml(getBrand()))
      .split('{{SELLER_BKASH}}').join(escapeHtml(SELLER_BKASH_NUMBER)));
  } catch (_e) {
    return res.redirect('/login.html');
  }
});
app.get('/pricing.html', (_req, res) => res.redirect('/#pricing'));

// WooCommerce plugin zip (v2.2): gated like the APK — active merchants
// only. MUST be defined BEFORE express.static, which would otherwise
// serve public/downloads/ to anyone without an account.
app.get('/downloads/takatick-woocommerce-plugin.zip', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  const zipPath = path.join(__dirname, 'public', 'downloads', 'takatick-woocommerce-plugin.zip');
  if (!fs.existsSync(zipPath)) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.download(zipPath, 'takatick-woocommerce-plugin.zip');
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function maskSender(sender) {
  if (!sender) return null;
  const s = String(sender);
  if (s.length <= 5) return s;
  return s.slice(0, 3) + '******' + s.slice(-2);
}

function maskKey(key) {
  if (!key) return null;
  return key.slice(0, 8) + '...' + key.slice(-4);
}

function toPoisha(amountBdt) {
  const n = typeof amountBdt === 'string' ? parseFloat(amountBdt) : amountBdt;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toBdt(poisha) {
  return poisha / 100;
}

function getMerchantById(id) {
  return db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
}

function getActiveApiKeyRow(key) {
  return db.prepare('SELECT * FROM api_keys WHERE key = ? AND revoked = 0').get(key);
}

// v2.2: keys are issued ONLY on activation (admin approves an order or
// activates the merchant) — never at signup. Signup stores a 'pending_'
// placeholder pay_key (the column is NOT NULL, so it cannot be empty);
// activation replaces it with a real 'pay_' key and creates the API +
// app keys. Merchants that already have keys are left untouched, so
// renewal/reactivation reuses the same keys.
function ensureMerchantKeys(merchantId) {
  const merchant = getMerchantById(merchantId);
  if (!merchant) return { issued: false };
  let issued = false;
  if (!merchant.pay_key || String(merchant.pay_key).startsWith('pending_')) {
    const payKey = 'pay_' + crypto.randomBytes(16).toString('hex');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('UPDATE merchants SET pay_key = ?, webhook_secret = ? WHERE id = ?')
      .run(payKey, webhookSecret, merchantId);
    issued = true;
  }
  const apiRow = db.prepare(
    'SELECT id FROM api_keys WHERE merchant_id = ? AND revoked = 0'
  ).get(merchantId);
  if (!apiRow) {
    const apiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO api_keys (merchant_id, key, label, created_at) VALUES (?, ?, ?, ?)')
      .run(merchantId, apiKey, 'default', nowIso());
    issued = true;
  }
  const appRow = db.prepare('SELECT id FROM app_keys WHERE merchant_id = ?').get(merchantId);
  if (!appRow) {
    const appKey = 'app_' + crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO app_keys (merchant_id, key, created_at) VALUES (?, ?, ?)')
      .run(merchantId, appKey, nowIso());
    issued = true;
  }
  return { issued };
}

function verificationsUsedThisMonth(merchantId) {
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM verifications WHERE merchant_id = ? AND substr(created_at, 1, 7) = ?"
  ).get(merchantId, currentMonthPrefix());
  return row ? row.c : 0;
}

function publicMerchant(m) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone || null,
    package: m.package,
    package_expires_at: m.package_expires_at || null,
    status: m.status || 'active',
    webhook_url: m.webhook_url || null,
    success_url: m.success_url || null,
    fail_url: m.fail_url || null,
    pay_key: m.pay_key,
    created_at: m.created_at,
  };
}

// ---------- admin seeding (v1.3) ----------
// If ADMIN_EMAIL + ADMIN_PASSWORD are set, create that admin account on
// first boot (bcrypt hash in DB). Never overwrites an existing admin.
// If the env vars are unset, no admin exists and /api/admin/login
// answers ADMIN_NOT_CONFIGURED.
function ensureAdminSeeded() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  try {
    const existing = db.prepare('SELECT id FROM admins WHERE email = ?')
      .get(ADMIN_EMAIL.toLowerCase());
    if (existing) return;
    db.prepare('INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(ADMIN_PASSWORD, 10), nowIso());
  } catch (_e) {
    // Seeding must never break boot.
  }
}
ensureAdminSeeded();

// ---------- package expiry / grace (v1.3) ----------
// package_expires_at NULL = no expiry (grandfathered accounts).
// Otherwise: active until expires_at, then a grace period of
// config graceDays during which everything still works, then expired.
// status 'pending' = signed up but never approved (no service yet).
// status 'deactivated' = admin turned the account off.
function expiryState(merchant) {
  if (merchant.status === 'pending') {
    return { state: 'pending', daysLeft: null, graceDaysLeft: null, expiresAt: null };
  }
  if (merchant.status === 'deactivated') {
    return { state: 'deactivated', daysLeft: null, graceDaysLeft: null, expiresAt: null };
  }
  const exp = merchant.package_expires_at;
  if (!exp) return { state: 'active', daysLeft: null, graceDaysLeft: null, expiresAt: null };
  const expMs = new Date(exp).getTime();
  const now = Date.now();
  const graceMs = getGraceDays() * DAY_MS;
  if (now < expMs) {
    return { state: 'active', daysLeft: Math.ceil((expMs - now) / DAY_MS), graceDaysLeft: null, expiresAt: exp };
  }
  if (now < expMs + graceMs) {
    return { state: 'grace', daysLeft: 0, graceDaysLeft: Math.ceil((expMs + graceMs - now) / DAY_MS), expiresAt: exp };
  }
  return { state: 'expired', daysLeft: 0, graceDaysLeft: 0, expiresAt: exp };
}

// Returns { error, status } when the merchant may not verify/confirm
// (never approved, deactivated, or expired past the grace period),
// else null. Grace-period merchants are NOT blocked.
function merchantBlocked(merchant) {
  if (!merchant) return { error: 'INVALID_API_KEY', status: 401 };
  if (merchant.status === 'deactivated') return { error: 'ACCOUNT_DEACTIVATED', status: 403 };
  const st = expiryState(merchant).state;
  if (st === 'pending') return { error: 'PACKAGE_NOT_ACTIVE', status: 403 };
  if (st === 'expired') return { error: 'PACKAGE_EXPIRED', status: 403 };
  return null;
}

// Plan-deactivated merchants may still read their dashboard and buy/renew
// (POST /api/me/orders stays open so they can come back), but they may not
// change anything: no numbers/websites, no deletes, no settings, no key
// regeneration. Verify/confirm/pay are already blocked by merchantBlocked.
function blockIfPlanOff(merchant, res) {
  if (merchant && merchant.status === 'deactivated') {
    res.status(403).json({ ok: false, error: 'ACCOUNT_DEACTIVATED' });
    return true;
  }
  // v2.5: expired merchants cannot change numbers/websites/settings or
  // regenerate keys either — nothing works after expiry until renewal.
  // (Grace is NOT blocked; pending keeps its existing behaviour.)
  if (merchant && merchantBlocked(merchant)?.error === 'PACKAGE_EXPIRED') {
    res.status(403).json({ ok: false, error: 'PACKAGE_EXPIRED' });
    return true;
  }
  return false;
}

// JWT auth middleware: Authorization: Bearer <jwt> -> req.merchantId
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.merchantId = payload.merchantId;
    return next();
  } catch (_e) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
}

// Shared verify/confirm checks (without creating rows).
// Returns { merchant, sms, amountPoisha } or { error }.
function lookupAndCheck(apiKey, amountBdt, transactionId) {
  if (!apiKey || !transactionId || amountBdt === undefined || amountBdt === null || amountBdt === '') {
    return { error: 'INVALID_REQUEST', status: 400 };
  }
  const keyRow = getActiveApiKeyRow(apiKey);
  if (!keyRow) return { error: 'INVALID_API_KEY', status: 401 };
  const merchant = getMerchantById(keyRow.merchant_id);
  if (!merchant) return { error: 'INVALID_API_KEY', status: 401 };
  // Deactivated merchants and merchants past their grace period cannot
  // verify or confirm. Grace-period merchants still work normally.
  const blocked = merchantBlocked(merchant);
  if (blocked) return { error: blocked.error, status: blocked.status };
  const amountPoisha = toPoisha(amountBdt);
  if (amountPoisha === null || amountPoisha <= 0) {
    return { error: 'INVALID_AMOUNT', status: 400 };
  }
  const sms = db.prepare(
    'SELECT * FROM sms_transactions WHERE trxid = ? AND merchant_id = ?'
  ).get(String(transactionId).trim(), merchant.id);
  if (!sms) return { error: 'TRANSACTION_NOT_FOUND', status: 404 };
  if (sms.status === 'used') return { error: 'ALREADY_USED', status: 409 };
  if (sms.amount_poisha !== amountPoisha) return { error: 'AMOUNT_MISMATCH', status: 409 };
  return { merchant, sms, amountPoisha };
}

// ---------- public pricing (landing page data) ----------

app.get('/api/public/pricing', (_req, res) => {
  const packages = Object.entries(config.packages).map(([id, p]) => ({
    id,
    name: p.name,
    priceBDT: p.priceBDT,
    numbers: p.numbers,
    websites: p.websites,
    verificationsPerMonth: p.verificationsPerMonth,
    webhook: !!p.webhook,
    methods: p.methods,
    woocommerce: !!p.woocommerce,
    prioritySupport: !!p.prioritySupport,
  }));
  return res.json({
    ok: true,
    brand: getBrand(),
    sellerBkash: SELLER_BKASH_NUMBER,
    graceDays: getGraceDays(),
    packages,
  });
});

// ---------- package orders (v1.3) ----------

app.get('/api/me/orders', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE merchant_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.merchantId);
  return res.json({ ok: true, orders: rows });
});

app.post('/api/me/orders', auth, (req, res) => {
  const { package: pkgId, trxid, sender, amount } = req.body || {};
  const pkg = config.packages[pkgId];
  if (!pkg) return res.status(400).json({ ok: false, error: 'INVALID_PACKAGE' });
  const trx = String(trxid || '').trim();
  if (!trx) return res.status(400).json({ ok: false, error: 'INVALID_TRXID' });
  if (!sender || !/^01[3-9]\d{8}$/.test(String(sender).trim())) {
    return res.status(400).json({ ok: false, error: 'INVALID_SENDER' });
  }
  const amountPoisha = toPoisha(amount);
  if (amountPoisha === null || amountPoisha !== pkg.priceBDT * 100) {
    return res.status(400).json({ ok: false, error: 'AMOUNT_MISMATCH', expectedBDT: pkg.priceBDT });
  }
  const dup = db.prepare('SELECT id FROM orders WHERE trxid = ?').get(trx);
  if (dup) return res.status(409).json({ ok: false, error: 'DUPLICATE_TRXID' });
  try {
    const info = db.prepare(
      `INSERT INTO orders (merchant_id, package, amount_poisha, trxid, sender, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).run(req.merchantId, pkgId, amountPoisha, trx, String(sender).trim(), nowIso());
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
    // v2.9 auto-approve: the payment SMS may already be here (it arrived
    // before the customer submitted the order) — approve at once.
    const approved = tryAutoApprove(trx, amountPoisha);
    if (approved) {
      return res.status(201).json({ ok: true, order: approved, autoApproved: true });
    }
    return res.status(201).json({ ok: true, order: row });
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'DUPLICATE_TRXID' });
    }
    return res.status(500).json({ ok: false, error: 'ORDER_FAILED' });
  }
});

// ---------- admin (v1.3) ----------

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email).toLowerCase());
  if (!admin) {
    // No admin configured at all vs wrong credentials — different error.
    const anyAdmin = db.prepare('SELECT id FROM admins LIMIT 1').get();
    if (!anyAdmin) {
      return res.status(503).json({
        ok: false,
        error: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin account is not set up yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment and restart the server.',
      });
    }
    return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
  }
  if (!bcrypt.compareSync(String(password), admin.password_hash)) {
    return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
  }
  const token = jwt.sign({ role: 'admin', adminId: admin.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ ok: true, token });
});

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin' || !payload.adminId) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    req.adminId = payload.adminId;
    return next();
  } catch (_e) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
}

function adminMerchantRow(m) {
  const exp = expiryState(m);
  const used = verificationsUsedThisMonth(m.id);
  const pkg = getPackage(m.package);
  let state = exp.state;
  if (state === 'active' && !m.package_expires_at) state = 'no-expiry';
  else if (state === 'active' && exp.daysLeft !== null && exp.daysLeft <= 3) state = 'expiring-soon';
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone || null,
    package: m.package,
    status: m.status || 'active',
    package_expires_at: m.package_expires_at || null,
    expiry_state: state,
    days_left: exp.daysLeft,
    grace_days_left: exp.graceDaysLeft,
    verifications_used_this_month: used,
    verifications_limit: pkg.verificationsPerMonth,
    created_at: m.created_at,
  };
}

app.get('/api/admin/stats', adminAuth, (_req, res) => {
  const merchants = db.prepare('SELECT COUNT(*) AS c FROM merchants').get().c;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'").get().c;
  // Status counts straight from the merchants table (pending/active/deactivated).
  const byStatus = { active: 0, pending: 0, deactivated: 0 };
  for (const r of db.prepare('SELECT status, COUNT(*) AS c FROM merchants GROUP BY status').all()) {
    byStatus[r.status] = r.c;
  }
  // Merchants per package (Basic/Standard/Premium).
  const byPackage = {};
  for (const r of db.prepare('SELECT package, COUNT(*) AS c FROM merchants GROUP BY package').all()) {
    byPackage[r.package] = r.c;
  }
  // Expiry-state counts need the JS expiryState logic (grace/expiring-soon
  // are computed from package_expires_at, not stored).
  const byExpiryState = {};
  for (const m of db.prepare('SELECT * FROM merchants').all()) {
    const st = adminMerchantRow(m).expiry_state;
    byExpiryState[st] = (byExpiryState[st] || 0) + 1;
  }
  const month = currentMonthPrefix();
  const verificationsThisMonth = db.prepare(
    'SELECT COUNT(*) AS c FROM verifications WHERE substr(created_at, 1, 7) = ?'
  ).get(month).c;
  // Approved revenue this month = sum of approved orders (package fees
  // paid to Siam's bKash). In poisha in the DB; reported in ৳.
  const revenuePoisha = db.prepare(
    "SELECT COALESCE(SUM(amount_poisha), 0) AS s FROM orders WHERE status = 'approved' AND substr(created_at, 1, 7) = ?"
  ).get(month).s;
  return res.json({
    ok: true,
    stats: {
      merchants,
      pendingOrders: pending,
      graceDays: getGraceDays(),
      byStatus,
      byPackage,
      byExpiryState,
      verificationsThisMonth,
      revenueThisMonthBDT: revenuePoisha / 100,
    },
  });
});

app.get('/api/admin/merchants/:id', adminAuth, (req, res) => {
  const merchant = getMerchantById(req.params.id);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const numbers = db.prepare('SELECT * FROM numbers WHERE merchant_id = ? ORDER BY id').all(merchant.id);
  const orders = db.prepare('SELECT * FROM orders WHERE merchant_id = ? ORDER BY id DESC LIMIT 20').all(merchant.id);
  const verifs = db.prepare('SELECT * FROM verifications WHERE merchant_id = ? ORDER BY id DESC LIMIT 20').all(merchant.id);
  const apiRow = db.prepare('SELECT key FROM api_keys WHERE merchant_id = ? AND revoked = 0 ORDER BY id DESC LIMIT 1').get(merchant.id);
  return res.json({
    ok: true,
    merchant: adminMerchantRow(merchant),
    websites: getWebsites(merchant),
    numbers,
    orders,
    verifications: verifs,
    apiKeyMasked: maskKey(apiRow?.key),
    verificationsUsedThisMonth: verificationsUsedThisMonth(merchant.id),
  });
});

app.get('/api/admin/transactions', adminAuth, (_req, res) => {
  const sms = db.prepare(
    `SELECT s.*, m.name AS merchant_name, m.email AS merchant_email
     FROM sms_transactions s JOIN merchants m ON m.id = s.merchant_id
     ORDER BY s.id DESC LIMIT 100`
  ).all();
  const verifs = db.prepare(
    `SELECT v.*, m.name AS merchant_name, m.email AS merchant_email
     FROM verifications v JOIN merchants m ON m.id = v.merchant_id
     ORDER BY v.id DESC LIMIT 100`
  ).all();
  return res.json({ ok: true, smsTransactions: sms, verifications: verifs });
});

// ---------- admin package editing (v1.8) ----------
// Writes config/packages.json and reloads the in-memory config in place,
// so the change applies without a restart. The config object is shared
// (src/limits.js getConfig returns the same object every module holds),
// so mutating it in place keeps every route on the new values.
const CONFIG_PATH = path.join(__dirname, 'config', 'packages.json');
function reloadConfig(newConfig) {
  for (const k of Object.keys(config)) delete config[k];
  Object.assign(config, newConfig);
}
app.post('/api/admin/packages/:id', adminAuth, (req, res) => {
  const id = req.params.id;
  const existing = config.packages[id];
  if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const b = req.body || {};
  const next = { ...existing };
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) return res.status(400).json({ ok: false, error: 'INVALID_NAME' });
    next.name = b.name.trim();
  }
  if (b.priceBDT !== undefined) {
    const n = Number(b.priceBDT);
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) return res.status(400).json({ ok: false, error: 'INVALID_PRICE' });
    next.priceBDT = n;
  }
  for (const field of ['numbers', 'websites', 'verificationsPerMonth']) {
    if (b[field] !== undefined) {
      if (b[field] === null) { next[field] = null; continue; }
      const n = Number(b[field]);
      if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
        return res.status(400).json({ ok: false, error: 'INVALID_' + field.toUpperCase() });
      }
      next[field] = n;
    }
  }
  if (b.methods !== undefined) {
    if (!Array.isArray(b.methods) || b.methods.length === 0 || !b.methods.every((m) => ALL_METHODS.includes(m))) {
      return res.status(400).json({ ok: false, error: 'INVALID_METHODS' });
    }
    next.methods = [...new Set(b.methods)];
  }
  for (const field of ['webhook', 'woocommerce', 'prioritySupport']) {
    if (b[field] !== undefined) next[field] = !!b[field];
  }
  const newConfig = { ...config, packages: { ...config.packages, [id]: next } };
  if (b.graceDays !== undefined) {
    const n = Number(b.graceDays);
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) return res.status(400).json({ ok: false, error: 'INVALID_GRACE_DAYS' });
    newConfig.graceDays = n;
  }
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2) + '\n');
  } catch (_e) {
    return res.status(500).json({ ok: false, error: 'CONFIG_SAVE_FAILED' });
  }
  reloadConfig(newConfig);
  return res.json({ ok: true, package: { id, ...next }, graceDays: getGraceDays() });
});

app.get('/api/admin/merchants', adminAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM merchants ORDER BY id DESC').all();
  return res.json({ ok: true, merchants: rows.map(adminMerchantRow) });
});

app.get('/api/admin/orders', adminAuth, (_req, res) => {
  const rows = db.prepare(
    `SELECT o.*, m.name AS merchant_name, m.email AS merchant_email
     FROM orders o JOIN merchants m ON m.id = o.merchant_id
     ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC, o.id DESC`
  ).all();
  return res.json({ ok: true, orders: rows });
});

// ---------- auto-approve (v2.9, dogfooding) ----------
// The storefront sells TakaTick itself: a customer pays bKash Send Money
// to the seller number, the SMS lands on the seller's phone, and the
// server matches it to the pending order — no admin step. The FIRST order
// of a merchant still needs a manual admin approval (that is how the
// merchant gets their app key in the first place); every order after
// that approves itself the moment its payment SMS arrives.
function approveOrder(order, decidedBy) {
  const merchant = getMerchantById(order.merchant_id);
  if (!merchant) return null;
  // Fresh 30 days from approval — never stacked on the old expiry.
  // Same for new buys, renewals and upgrades (incl. renewal during grace).
  const expiresAt = new Date(Date.now() + PACKAGE_DAYS * DAY_MS).toISOString();
  const decidedAt = nowIso();
  db.prepare("UPDATE orders SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?")
    .run(decidedAt, String(decidedBy), order.id);
  db.prepare("UPDATE merchants SET package = ?, package_expires_at = ?, status = 'active' WHERE id = ?")
    .run(order.package, expiresAt, merchant.id);
  // v2.2: approval issues the keys — first time the merchant ever sees them.
  const keys = ensureMerchantKeys(merchant.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  return { order: updated, merchant: publicMerchant(getMerchantById(merchant.id)), keysIssued: keys.issued };
}

// Match a payment SMS (TrxID + exact amount ONLY — sender is not
// checked) to a pending order, GLOBALLY across merchants: the SMS
// arrives via the seller's phone app key, but the paying customer is a
// different merchant. Marks the SMS 'used' first (only if a 'received'
// row was actually changed), then approves. Returns the approved order
// row, or null when nothing matched.
function tryAutoApprove(trxid, amountPoisha) {
  const order = db.prepare(
    "SELECT * FROM orders WHERE trxid = ? AND amount_poisha = ? AND status = 'pending' ORDER BY id ASC LIMIT 1"
  ).get(trxid, amountPoisha);
  if (!order) return null;
  if (!getMerchantById(order.merchant_id)) return null;
  const marked = db.prepare(
    "UPDATE sms_transactions SET status = 'used', used_at = ? WHERE trxid = ? AND status = 'received'"
  ).run(nowIso(), trxid);
  if (marked.changes === 0) return null;
  const result = approveOrder(order, 'auto');
  return result ? result.order : null;
}

app.post('/api/admin/orders/:id/approve', adminAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  if (order.status !== 'pending') return res.status(409).json({ ok: false, error: 'ORDER_ALREADY_DECIDED' });
  const merchant = getMerchantById(order.merchant_id);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const result = approveOrder(order, String(req.adminId));
  return res.json({ ok: true, order: result.order, merchant: result.merchant, keysIssued: result.keysIssued });
});

app.post('/api/admin/orders/:id/reject', adminAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  if (order.status !== 'pending') return res.status(409).json({ ok: false, error: 'ORDER_ALREADY_DECIDED' });
  db.prepare("UPDATE orders SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ?")
    .run(nowIso(), String(req.adminId), order.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  return res.json({ ok: true, order: updated });
});

app.post('/api/admin/merchants/:id/package', adminAuth, (req, res) => {
  const pkgId = req.body?.package;
  if (!config.packages[pkgId]) return res.status(400).json({ ok: false, error: 'INVALID_PACKAGE' });
  const merchant = getMerchantById(req.params.id);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  // Admin action = activation: a pending merchant becomes active with a
  // fresh 30 days; an active/expired merchant gets the same fresh window.
  const expiresAt = new Date(Date.now() + PACKAGE_DAYS * DAY_MS).toISOString();
  db.prepare("UPDATE merchants SET package = ?, package_expires_at = ?, status = 'active' WHERE id = ?")
    .run(pkgId, expiresAt, merchant.id);
  // v2.2: activation issues the keys if this merchant never had any.
  const keys = ensureMerchantKeys(merchant.id);
  return res.json({ ok: true, merchant: adminMerchantRow(getMerchantById(merchant.id)), keysIssued: keys.issued });
});

// v2.7: admin sets a merchant's expiry date directly (ISO string, or null
// to clear = no expiry). Past dates are allowed on purpose — that is how an
// expiry demo (or a correction) is staged. Status is untouched; the state
// (active/grace/expired) is always derived from the date.
app.post('/api/admin/merchants/:id/expiry', adminAuth, (req, res) => {
  const merchant = getMerchantById(req.params.id);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const raw = req.body?.expiresAt ?? null;
  if (raw === null || raw === '') {
    db.prepare('UPDATE merchants SET package_expires_at = NULL WHERE id = ?').run(merchant.id);
  } else {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return res.status(400).json({ ok: false, error: 'INVALID_DATE' });
    db.prepare('UPDATE merchants SET package_expires_at = ? WHERE id = ?').run(d.toISOString(), merchant.id);
  }
  return res.json({ ok: true, merchant: adminMerchantRow(getMerchantById(merchant.id)) });
});

app.post('/api/admin/merchants/:id/status', adminAuth, (req, res) => {
  const status = req.body?.status;
  if (status !== 'active' && status !== 'deactivated' && status !== 'pending') {
    return res.status(400).json({ ok: false, error: 'INVALID_STATUS' });
  }
  const merchant = getMerchantById(req.params.id);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  db.prepare('UPDATE merchants SET status = ? WHERE id = ?').run(status, merchant.id);
  // v2.2: flipping a never-activated merchant straight to active also
  // issues their keys; reactivation reuses existing keys.
  if (status === 'active') ensureMerchantKeys(merchant.id);
  return res.json({ ok: true, merchant: adminMerchantRow(getMerchantById(merchant.id)) });
});

// APK download (single source: android-app/TakaTickSMS-v1.5.apk).
// v2.2: active merchants only — a pending merchant must not get the app
// before paying. The dashboard fetches it with its JWT (blob download).
app.get('/download/app.apk', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  const apkPath = path.join(__dirname, 'android-app', 'TakaTickSMS-v1.5.apk');
  if (!fs.existsSync(apkPath)) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.download(apkPath, 'TakaTickSMS-v1.5.apk');
});

// ---------- public routes ----------

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const phone = String(req.body?.phone || '').trim();
  const pkg = req.body?.package || 'basic';
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'INVALID_NAME' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ ok: false, error: 'INVALID_EMAIL' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ ok: false, error: 'PASSWORD_TOO_SHORT' });
  }
  // v2.4: phone is required — Siam contacts clients on it when there is a
  // problem, and it shows on the admin dashboard.
  if (!/^01[3-9]\d{8}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PHONE' });
  }
  if (!config.packages[pkg]) {
    return res.status(400).json({ ok: false, error: 'INVALID_PACKAGE' });
  }
  const existing = db.prepare('SELECT id FROM merchants WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ ok: false, error: 'EMAIL_EXISTS' });

  const passwordHash = bcrypt.hashSync(String(password), 10);
  // v2.2: NO usable keys at signup — pay_key is a 'pending_' placeholder
  // (the column is NOT NULL) and no api/app key rows are created. Real
  // keys are issued only on activation (ensureMerchantKeys), i.e. after
  // the admin approves the package order.
  const payKey = 'pending_' + crypto.randomBytes(16).toString('hex');
  const webhookSecret = crypto.randomBytes(32).toString('hex');
  const createdAt = nowIso();
  // New accounts start PENDING — no package access until an order is
  // approved by the admin (approval sets status='active' + expiry =
  // approval + 30 days). The chosen package is only the REQUESTED
  // package. v1.3 briefly gave a free 30-day trial at signup — removed
  // in v1.5: Siam reported merchants got everything without paying or
  // approval. Accounts created before v1.3 have NULL expiry and status
  // 'active', and stay grandfathered.
  try {
    const info = db.prepare(
      `INSERT INTO merchants (name, email, phone, password_hash, package, package_expires_at, status, webhook_secret, pay_key, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?)`
    ).run(name.trim(), String(email).toLowerCase(), phone, passwordHash, pkg, webhookSecret, payKey, createdAt);
    const merchantId = info.lastInsertRowid;
    const merchant = getMerchantById(merchantId);
    return res.status(201).json({
      ok: true,
      merchant: publicMerchant(merchant),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'SIGNUP_FAILED' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
  const merchant = db.prepare('SELECT * FROM merchants WHERE email = ?')
    .get(String(email).toLowerCase());
  if (!merchant || !bcrypt.compareSync(String(password), merchant.password_hash)) {
    return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
  }
  const token = jwt.sign({ merchantId: merchant.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ ok: true, token });
});

// ---------- authenticated merchant routes (/api/me/*) ----------

app.get('/api/me/profile', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const pkg = getPackage(merchant.package);
  const apiRow = db.prepare(
    'SELECT key FROM api_keys WHERE merchant_id = ? AND revoked = 0 ORDER BY id DESC LIMIT 1'
  ).get(merchant.id);
  const appRow = db.prepare('SELECT key FROM app_keys WHERE merchant_id = ? ORDER BY id DESC LIMIT 1')
    .get(merchant.id);
  const used = verificationsUsedThisMonth(merchant.id);
  const exp = expiryState(merchant);
  // v2.6: what is "waiting" comes from the pending order, not from the
  // signup-time default package (which is 'basic' even when the merchant
  // bought nothing). Null when no order exists.
  const pendingOrder = db.prepare(
    "SELECT * FROM orders WHERE merchant_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
  ).get(merchant.id);
  // v2.2.2: the webhook secret is generated at signup, but its masked form
  // must not leak to a blocked (pending/expired) merchant — same rule as
  // the other keys: nothing key-like before activation.
  const blocked = merchantBlocked(merchant);
  return res.json({
    ok: true,
    merchant: publicMerchant(merchant),
    package: pkg,
    packageExpiresAt: merchant.package_expires_at || null,
    expiryState: exp.state,
    daysLeft: exp.daysLeft,
    graceDaysLeft: exp.graceDaysLeft,
    graceDays: getGraceDays(),
    apiKeyMasked: maskKey(apiRow?.key),
    appKeyMasked: maskKey(appRow?.key),
    webhookSecretMasked: blocked ? null : maskKey(merchant.webhook_secret),
    waitingPackage: pendingOrder ? getPackage(pendingOrder.package) : null,
    usage: {
      verificationsUsedThisMonth: used,
      verificationsLimit: pkg.verificationsPerMonth,
    },
  });
});

app.post('/api/me/api-key/regenerate', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  // v2.2: pending/expired merchants have no usable key to regenerate.
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  if (blockIfPlanOff(merchant, res)) return;
  db.prepare('UPDATE api_keys SET revoked = 1 WHERE merchant_id = ? AND revoked = 0')
    .run(merchant.id);
  const apiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO api_keys (merchant_id, key, label, created_at) VALUES (?, ?, ?, ?)')
    .run(merchant.id, apiKey, 'default', nowIso());
  return res.json({ ok: true, apiKey });
});

// v2.2: reveal the full API key (dashboard "Show API key") — active
// merchants only; pending merchants have no key yet.
app.get('/api/me/api-key', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  const row = db.prepare(
    'SELECT key FROM api_keys WHERE merchant_id = ? AND revoked = 0 ORDER BY id DESC LIMIT 1'
  ).get(req.merchantId);
  if (!row) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, apiKey: row.key });
});

app.get('/api/me/app-key', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  // v2.2: pending/expired merchants have no app key yet.
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  const row = db.prepare('SELECT key FROM app_keys WHERE merchant_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.merchantId);
  if (!row) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, appKey: row.key });
});

// v2.2.2: webhook secret on demand — masked in profile, full value only here.
// Same gate as the other key endpoints: pending/expired merchants get 403.
app.get('/api/me/webhook-secret', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const blocked = merchantBlocked(merchant);
  if (blocked) return res.status(blocked.status).json({ ok: false, error: blocked.error });
  if (!merchant.webhook_secret) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, webhookSecret: merchant.webhook_secret });
});

// Numbers
app.get('/api/me/numbers', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM numbers WHERE merchant_id = ? ORDER BY id DESC')
    .all(req.merchantId);
  return res.json({ ok: true, numbers: rows });
});

app.post('/api/me/numbers', auth, (req, res) => {
  const { method, number, label } = req.body || {};
  if (!ALL_METHODS.includes(method)) {
    return res.status(400).json({ ok: false, error: 'INVALID_METHOD' });
  }
  if (!number || !/^01[3-9]\d{8}$/.test(String(number).trim())) {
    return res.status(400).json({ ok: false, error: 'INVALID_NUMBER' });
  }
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const pkg = getPackage(merchant.package);
  // Tier gate: Rocket + Upay are Premium-only (Basic/Standard = bkash/nagad).
  if (!methodAllowedForPackage(pkg, method)) {
    return res.status(403).json({
      ok: false,
      error: 'METHOD_NOT_ALLOWED_FOR_PACKAGE',
      message: `${method} is only available on the Premium package. Your ${pkg.name} package includes: ${pkg.methods.join(', ')}.`,
    });
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM numbers WHERE merchant_id = ?')
    .get(merchant.id).c;
  if (pkg.numbers !== null && count >= pkg.numbers) {
    return res.status(403).json({ ok: false, error: 'LIMIT_EXCEEDED' });
  }
  const info = db.prepare(
    'INSERT INTO numbers (merchant_id, method, number, label, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(merchant.id, method, String(number).trim(), label || null, nowIso());
  const row = db.prepare('SELECT * FROM numbers WHERE id = ?').get(info.lastInsertRowid);
  return res.status(201).json({ ok: true, number: row });
});

app.delete('/api/me/numbers/:id', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const info = db.prepare('DELETE FROM numbers WHERE id = ? AND merchant_id = ?')
    .run(req.params.id, req.merchantId);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true });
});

app.delete('/api/me/numbers', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const id = req.body?.id;
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
  const info = db.prepare('DELETE FROM numbers WHERE id = ? AND merchant_id = ?')
    .run(id, req.merchantId);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true });
});

// Websites (stored as a JSON array on the merchant row — simple by design)
function getWebsites(merchant) {
  try {
    const arr = JSON.parse(merchant.websites || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_e) {
    return [];
  }
}

app.get('/api/me/websites', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, websites: getWebsites(merchant) });
});

app.post('/api/me/websites', auth, (req, res) => {
  const domain = String(req.body?.domain || req.body?.website || req.body?.url || '').trim().toLowerCase();
  if (!domain || !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ ok: false, error: 'INVALID_DOMAIN' });
  }
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const pkg = getPackage(merchant.package);
  const sites = getWebsites(merchant);
  if (sites.includes(domain)) return res.json({ ok: true, websites: sites });
  if (pkg.websites !== null && sites.length >= pkg.websites) {
    return res.status(403).json({ ok: false, error: 'LIMIT_EXCEEDED' });
  }
  sites.push(domain);
  db.prepare('UPDATE merchants SET websites = ? WHERE id = ?').run(JSON.stringify(sites), merchant.id);
  return res.status(201).json({ ok: true, websites: sites });
});

app.delete('/api/me/websites/:domain', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const sites = getWebsites(merchant).filter((d) => d !== req.params.domain.toLowerCase());
  db.prepare('UPDATE merchants SET websites = ? WHERE id = ?').run(JSON.stringify(sites), merchant.id);
  return res.json({ ok: true, websites: sites });
});

app.delete('/api/me/websites', auth, (req, res) => {
  const domain = String(req.body?.domain || '').trim().toLowerCase();
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const sites = getWebsites(merchant).filter((d) => d !== domain);
  db.prepare('UPDATE merchants SET websites = ? WHERE id = ?').run(JSON.stringify(sites), merchant.id);
  return res.json({ ok: true, websites: sites });
});

app.post('/api/me/settings', auth, (req, res) => {
  const merchant0 = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant0, res)) return;
  const { webhook_url, success_url, fail_url } = req.body || {};
  db.prepare('UPDATE merchants SET webhook_url = ?, success_url = ?, fail_url = ? WHERE id = ?')
    .run(webhook_url || null, success_url || null, fail_url || null, req.merchantId);
  const merchant = getMerchantById(req.merchantId);
  return res.json({ ok: true, merchant: publicMerchant(merchant) });
});

app.get('/api/me/transactions', auth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM sms_transactions WHERE merchant_id = ? ORDER BY id DESC LIMIT 100'
  ).all(req.merchantId);
  return res.json({ ok: true, transactions: rows });
});

app.get('/api/me/verifications', auth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM verifications WHERE merchant_id = ? ORDER BY id DESC LIMIT 100'
  ).all(req.merchantId);
  return res.json({ ok: true, verifications: rows });
});

// ---------- SMS ingestion (Android app) ----------

app.post('/api/sms', (req, res) => {
  const appKey = req.headers['x-app-key'];
  if (!appKey) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  const keyRow = db.prepare('SELECT * FROM app_keys WHERE key = ?').get(String(appKey));
  if (!keyRow) return res.status(401).json({ ok: false, error: 'INVALID_APP_KEY' });
  const merchantId = keyRow.merchant_id;
  const { sender, text, receivedAt } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
  }
  const parsed = parseSms(text, sender);
  if (parsed.error) {
    db.prepare(
      'INSERT INTO sms_unparsed (merchant_id, sender, raw_text, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(merchantId, sender || null, text, parsed.reason || parsed.error, nowIso());
    return res.status(422).json({ ok: false, error: 'UNPARSEABLE', reason: parsed.reason });
  }
  const received = receivedAt || nowIso();
  const result = db.prepare(
    `INSERT OR IGNORE INTO sms_transactions
     (merchant_id, trxid, method, sender, amount_poisha, received_at, raw_text, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?)`
  ).run(merchantId, parsed.trxid, parsed.method, parsed.senderNumber, parsed.amountPoisha, received, text, nowIso());
  if (result.changes === 0) {
    return res.json({ ok: true, duplicate: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha) });
  }
  // v2.9 auto-approve: a storefront order may be waiting for this payment.
  const approved = tryAutoApprove(parsed.trxid, parsed.amountPoisha);
  if (approved) {
    return res.json({ ok: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha), autoApproved: true, orderId: approved.id });
  }
  return res.json({ ok: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha) });
});

// ---------- Paste an SMS (no-app fallback, v2.8) ----------
// Merchant nijer messaging app theke payment SMS copy kore dashboard-e
// paste korle server seta parse kore transaction hisebe rakhe — app,
// permission, Play Protect — kichui lage na. Consent app-eo sender
// thake na, tai parseSms ekhane sender null diye daka hoy.
app.post('/api/me/sms-paste', auth, (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' });
  }
  const merchant = getMerchantById(req.merchantId);
  if (blockIfPlanOff(merchant, res)) return;
  const parsed = parseSms(text, null);
  if (parsed.error) {
    db.prepare(
      'INSERT INTO sms_unparsed (merchant_id, sender, raw_text, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(merchant.id, null, text, parsed.reason || parsed.error, nowIso());
    return res.status(422).json({ ok: false, error: 'UNPARSEABLE', reason: parsed.reason });
  }
  const result = db.prepare(
    `INSERT OR IGNORE INTO sms_transactions
     (merchant_id, trxid, method, sender, amount_poisha, received_at, raw_text, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?)`
  ).run(merchant.id, parsed.trxid, parsed.method, parsed.senderNumber, parsed.amountPoisha, nowIso(), text, nowIso());
  if (result.changes === 0) {
    return res.json({ ok: true, duplicate: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha) });
  }
  // v2.9 auto-approve: same as the app ingest — a storefront order may be
  // waiting for this pasted payment SMS.
  const approved = tryAutoApprove(parsed.trxid, parsed.amountPoisha);
  if (approved) {
    return res.json({ ok: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha), autoApproved: true, orderId: approved.id });
  }
  return res.json({ ok: true, trxid: parsed.trxid, method: parsed.method, amount: toBdt(parsed.amountPoisha) });
});

// ---------- Public verification API (v1, key-authenticated) ----------

app.post('/api/v1/verify', (req, res) => {
  const { apiKey, amount, transactionId, order_id, orderId } = req.body || {};
  const checked = lookupAndCheck(apiKey, amount, transactionId);
  if (checked.error) return res.status(checked.status || 400).json({ ok: false, error: checked.error });
  const { merchant, sms, amountPoisha } = checked;
  const pkg = getPackage(merchant.package);
  if (verificationLimitReached(pkg, verificationsUsedThisMonth(merchant.id))) {
    return res.status(403).json({ ok: false, error: 'LIMIT_EXCEEDED' });
  }
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const info = db.prepare(
    `INSERT INTO verifications (merchant_id, order_id, amount_poisha, transaction_id, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).run(merchant.id, order_id || orderId || null, amountPoisha, sms.trxid, expiresAt, nowIso());
  return res.json({
    ok: true,
    id: Number(info.lastInsertRowid),
    method: sms.method,
    amount: toBdt(amountPoisha),
    senderMasked: maskSender(sms.sender),
    receivedAt: sms.received_at,
  });
});

app.post('/api/v1/confirm', (req, res) => {
  const { apiKey, amount, transactionId, id } = req.body || {};
  // Re-validate the same checks as verify (not-found / used / amount).
  const checked = lookupAndCheck(apiKey, amount, transactionId);
  if (checked.error) return res.status(checked.status || 400).json({ ok: false, error: checked.error });
  const { merchant, sms, amountPoisha } = checked;
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  const verification = db.prepare('SELECT * FROM verifications WHERE id = ? AND merchant_id = ?')
    .get(id, merchant.id);
  if (!verification) return res.status(404).json({ ok: false, error: 'INVALID_ID' });
  if (verification.status === 'confirmed') {
    return res.status(409).json({ ok: false, error: 'ALREADY_USED' });
  }
  if (verification.expires_at && new Date(verification.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ ok: false, error: 'EXPIRED' });
  }
  if (verification.status !== 'pending') {
    return res.status(409).json({ ok: false, error: 'INVALID_ID' });
  }
  if (verification.transaction_id !== sms.trxid || verification.amount_poisha !== amountPoisha) {
    return res.status(409).json({ ok: false, error: 'AMOUNT_MISMATCH' });
  }
  // Atomic mark-used: only succeeds if the SMS is still 'received'.
  const marked = db.prepare(
    "UPDATE sms_transactions SET status = 'used', used_at = ? WHERE trxid = ? AND merchant_id = ? AND status = 'received'"
  ).run(nowIso(), sms.trxid, merchant.id);
  if (marked.changes === 0) return res.status(409).json({ ok: false, error: 'ALREADY_USED' });
  db.prepare("UPDATE verifications SET status = 'confirmed' WHERE id = ?").run(id);
  const payload = {
    event: 'payment.confirmed',
    order_id: verification.order_id || null,
    transactionId: sms.trxid,
    method: sms.method,
    amount: toBdt(amountPoisha),
    sender: sms.sender,
    confirmedAt: nowIso(),
  };
  // Fire webhook async — never block the response.
  fireWebhook(merchant, payload).catch(() => {});
  return res.json({
    ok: true,
    transactionId: sms.trxid,
    method: sms.method,
    amount: toBdt(amountPoisha),
    sender: sms.sender,
    receivedAt: sms.received_at,
  });
});

// ---------- Hosted pay page ----------

function payPageHtml(brand, merchant, numbers, amount, orderId, notice) {
  const amountText = amount ? `৳${escapeHtml(amount)}` : '';
  // Group the merchant's numbers by method (only registered numbers shown).
  const methodLabels = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', upay: 'Upay' };
  const groups = ALL_METHODS.filter((m) => numbers.some((n) => n.method === m)).map((m) => {
    const rows = numbers.filter((n) => n.method === m).map((n) => `
    <div class="num">
      <div><strong>${escapeHtml(methodLabels[m])}</strong> — ${escapeHtml(n.number)}
      ${n.label ? `<span class="label">${escapeHtml(n.label)}</span>` : ''}</div>
      <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(n.number)}');this.textContent='Copied!';">Copy</button>
    </div>`).join('');
    return `<h4>${escapeHtml(methodLabels[m])}</h4>${rows}`;
  }).join('');
  const rows = groups || '<p>No payment numbers added yet.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pay — ${escapeHtml(brand)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f7f7f7;color:#222}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.num{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee}
.label{color:#666;font-size:13px}button{padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#111;color:#fff;cursor:pointer}
input,select{width:100%;padding:10px;margin:6px 0 12px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box}
h1{font-size:22px}.muted{color:#666;font-size:14px}.notice{background:#fff7e6;border:1px solid #f0c36d;border-radius:8px;padding:10px;font-size:14px}</style></head><body>
<div class="card"><h1>Pay ${escapeHtml(brand)}</h1>
${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ''}
<p class="muted">Pay to ${escapeHtml(merchant.name)} using bKash, Nagad, Rocket or Upay, then enter your TrxID below.</p>
${amountText ? `<p><strong>Amount:</strong> ${amountText}</p>` : ''}
${orderId ? `<p><strong>Order:</strong> ${escapeHtml(orderId)}</p>` : ''}
<h3>Payment numbers</h3>${rows}
<form method="POST" action="/pay/${escapeHtml(merchant.pay_key)}/claim">
<input type="hidden" name="amount" value="${escapeHtml(amount || '')}">
<input type="hidden" name="order_id" value="${escapeHtml(orderId || '')}">
<label>Method</label><select name="method"><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="upay">Upay</option></select>
<label>TrxID</label><input name="transactionId" required placeholder="e.g. 9AB12CD34E">
<button type="submit" style="width:100%">I have paid — Confirm</button></form>
<p class="muted">Money goes directly to the seller's own bKash / Nagad / Rocket / Upay number. ${escapeHtml(brand)} only verifies the payment.</p>
</div></body></html>`;
}

function resultPageHtml(brand, title, message, linkUrl, linkText) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — ${escapeHtml(brand)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f7f7f7}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
a{color:#0b5fff}</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
${linkUrl ? `<p><a href="${escapeHtml(linkUrl)}">${escapeHtml(linkText || 'Continue')}</a></p>` : ''}
</div></body></html>`;
}

app.get('/pay/:payKey', (req, res) => {
  const merchant = db.prepare('SELECT * FROM merchants WHERE pay_key = ?').get(req.params.payKey);
  if (!merchant) return res.status(404).send(resultPageHtml(getBrand(), 'Not found', 'This payment link is invalid.', null, null));
  const blocked = merchantBlocked(merchant);
  if (blocked) {
    if (blocked.error === 'PACKAGE_NOT_ACTIVE') {
      return res.status(403).send(resultPageHtml(getBrand(),
        'Payment link not active yet',
        'This seller’s package is waiting for approval. Please try again later or contact the seller.',
        null, null));
    }
    const expired = blocked.error === 'PACKAGE_EXPIRED';
    return res.status(403).send(resultPageHtml(getBrand(),
      expired ? 'Payment link expired' : 'Payment link disabled',
      expired
        ? 'This seller’s package has expired. Please contact the seller to renew.'
        : 'This payment link is currently disabled. Please contact the seller.',
      null, null));
  }
  const numbers = db.prepare('SELECT * FROM numbers WHERE merchant_id = ? ORDER BY id').all(merchant.id);
  const exp = expiryState(merchant);
  const notice = exp.state === 'grace'
    ? `Note: this seller’s package is in its ${getGraceDays()}-day grace period (renewal pending) — payments still work normally.`
    : null;
  return res.send(payPageHtml(getBrand(), merchant, numbers, req.query.amount, req.query.order_id, notice));
});

app.post('/pay/:payKey/claim', (req, res) => {
  const merchant = db.prepare('SELECT * FROM merchants WHERE pay_key = ?').get(req.params.payKey);
  const brand = getBrand();
  if (!merchant) return res.status(404).send(resultPageHtml(brand, 'Not found', 'This payment link is invalid.', null, null));
  const blocked = merchantBlocked(merchant);
  if (blocked) {
    if (blocked.error === 'PACKAGE_NOT_ACTIVE') {
      return res.status(403).send(resultPageHtml(brand,
        'Payment not active yet',
        'This seller’s package is waiting for approval. Please try again later or contact the seller.',
        merchant.fail_url, 'Return to store'));
    }
    return res.status(403).send(resultPageHtml(brand,
      blocked.error === 'PACKAGE_EXPIRED' ? 'Payment expired' : 'Payment disabled',
      blocked.error === 'PACKAGE_EXPIRED'
        ? 'This seller’s package has expired. Please contact the seller to renew.'
        : 'This payment link is currently disabled. Please contact the seller.',
      merchant.fail_url, 'Return to store'));
  }
  const method = req.body?.method;
  const amount = req.body?.amount;
  const orderId = req.body?.order_id || req.body?.orderId || null;
  const transactionId = req.body?.transactionId || req.body?.transaction_id || req.body?.trxid;
  const amountPoisha = toPoisha(amount);
  if (!transactionId || !amountPoisha || amountPoisha <= 0) {
    return res.status(400).send(resultPageHtml(brand, 'Payment failed',
      'Please provide a valid amount and TrxID.', merchant.fail_url, 'Return to store'));
  }
  const sms = db.prepare('SELECT * FROM sms_transactions WHERE trxid = ? AND merchant_id = ?')
    .get(String(transactionId).trim(), merchant.id);
  let reason = null;
  if (!sms) reason = 'Unknown TrxID — no payment with this transaction ID was received. Please check the TrxID and try again.';
  else if (method && sms.method !== method) reason = `Method mismatch — this TrxID was a ${sms.method} payment, not ${method}.`;
  else if (sms.status === 'used') reason = 'Already used — this TrxID has already been used for a payment.';
  else if (sms.amount_poisha !== amountPoisha) reason = `Wrong amount — this TrxID was for ৳${toBdt(sms.amount_poisha)}, not ৳${toBdt(amountPoisha)}.`;
  else {
    const pkg = getPackage(merchant.package);
    if (verificationLimitReached(pkg, verificationsUsedThisMonth(merchant.id))) {
      reason = 'Verification limit reached for this merchant this month. Please contact the seller.';
    }
  }
  if (reason) {
    return res.status(409).send(resultPageHtml(brand, 'Payment failed', reason,
      merchant.fail_url, merchant.fail_url ? 'Return to store' : null));
  }
  // Internally verify + confirm: mark used, record a confirmed verification.
  const marked = db.prepare(
    "UPDATE sms_transactions SET status = 'used', used_at = ? WHERE trxid = ? AND merchant_id = ? AND status = 'received'"
  ).run(nowIso(), sms.trxid, merchant.id);
  if (marked.changes === 0) {
    return res.status(409).send(resultPageHtml(brand, 'Payment failed',
      'Already used — this TrxID has already been used for a payment.', merchant.fail_url, 'Return to store'));
  }
  db.prepare(
    `INSERT INTO verifications (merchant_id, order_id, amount_poisha, transaction_id, status, created_at)
     VALUES (?, ?, ?, ?, 'confirmed', ?)`
  ).run(merchant.id, orderId, amountPoisha, sms.trxid, nowIso());
  const payload = {
    event: 'payment.confirmed',
    order_id: orderId,
    transactionId: sms.trxid,
    method: sms.method,
    amount: toBdt(amountPoisha),
    sender: sms.sender,
    confirmedAt: nowIso(),
  };
  fireWebhook(merchant, payload).catch(() => {});
  if (merchant.success_url) {
    const sep = merchant.success_url.includes('?') ? '&' : '?';
    const url = `${merchant.success_url}${sep}order_id=${encodeURIComponent(orderId || '')}&status=confirmed`;
    return res.redirect(url);
  }
  return res.send(resultPageHtml(brand, 'Payment confirmed',
    `Your payment of ৳${toBdt(amountPoisha)} (TrxID ${sms.trxid}) has been confirmed. Thank you!`, null, null));
});

// JSON parse errors -> clean JSON response
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'INVALID_JSON' });
  }
  return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
});

function startServer(port) {
  const listenPort = port ?? PORT;
  return new Promise((resolve) => {
    const server = app.listen(listenPort, () => resolve(server));
  });
}

if (require.main === module) {
  startServer().then((server) => {
    // eslint-disable-next-line no-console
    console.log(`Payment MVP listening on http://localhost:${server.address().port} (brand: ${getBrand()})`);
  });
}

module.exports = { app, db, startServer };
