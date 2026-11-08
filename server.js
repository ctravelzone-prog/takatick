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
const { getConfig, getBrand, getPackage, verificationLimitReached, ALL_METHODS, methodAllowedForPackage } = require('./src/limits');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const PORT = parseInt(process.env.PORT || '3000', 10);
const config = getConfig();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Brand injection for static pages: login.html / dashboard.html carry the
// {{BRAND}} placeholder (no hardcoded brand string in the pages). The brand
// comes from the single config value — config/packages.json `brand`, or
// BRAND_NAME env which overrides it (see getBrand() in src/limits.js).
app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path === '/dashboard.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'public', req.path), 'utf8');
      return res.type('html').send(html.split('{{BRAND}}').join(escapeHtml(getBrand())));
    } catch (_e) {
      return next();
    }
  }
  return next();
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
    package: m.package,
    webhook_url: m.webhook_url || null,
    success_url: m.success_url || null,
    fail_url: m.fail_url || null,
    pay_key: m.pay_key,
    created_at: m.created_at,
  };
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

// ---------- public routes ----------

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/', (_req, res) => res.redirect('/login.html'));

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
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
  if (!config.packages[pkg]) {
    return res.status(400).json({ ok: false, error: 'INVALID_PACKAGE' });
  }
  const existing = db.prepare('SELECT id FROM merchants WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ ok: false, error: 'EMAIL_EXISTS' });

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const webhookSecret = crypto.randomBytes(32).toString('hex');
  const payKey = 'pay_' + crypto.randomBytes(16).toString('hex');
  const apiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
  const appKey = 'app_' + crypto.randomBytes(24).toString('hex');
  const createdAt = nowIso();
  try {
    const info = db.prepare(
      `INSERT INTO merchants (name, email, password_hash, package, webhook_secret, pay_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(name.trim(), String(email).toLowerCase(), passwordHash, pkg, webhookSecret, payKey, createdAt);
    const merchantId = info.lastInsertRowid;
    db.prepare('INSERT INTO api_keys (merchant_id, key, label, created_at) VALUES (?, ?, ?, ?)')
      .run(merchantId, apiKey, 'default', createdAt);
    db.prepare('INSERT INTO app_keys (merchant_id, key, created_at) VALUES (?, ?, ?)')
      .run(merchantId, appKey, createdAt);
    const merchant = getMerchantById(merchantId);
    return res.status(201).json({
      ok: true,
      merchant: publicMerchant(merchant),
      apiKey,
      appKey,
      payKey,
      webhookSecret,
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
  return res.json({
    ok: true,
    merchant: publicMerchant(merchant),
    package: pkg,
    apiKeyMasked: maskKey(apiRow?.key),
    appKeyMasked: maskKey(appRow?.key),
    usage: {
      verificationsUsedThisMonth: used,
      verificationsLimit: pkg.verificationsPerMonth,
    },
  });
});

app.post('/api/me/api-key/regenerate', auth, (req, res) => {
  const merchant = getMerchantById(req.merchantId);
  if (!merchant) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  db.prepare('UPDATE api_keys SET revoked = 1 WHERE merchant_id = ? AND revoked = 0')
    .run(merchant.id);
  const apiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO api_keys (merchant_id, key, label, created_at) VALUES (?, ?, ?, ?)')
    .run(merchant.id, apiKey, 'default', nowIso());
  return res.json({ ok: true, apiKey });
});

app.get('/api/me/app-key', auth, (req, res) => {
  const row = db.prepare('SELECT key FROM app_keys WHERE merchant_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.merchantId);
  if (!row) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, appKey: row.key });
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
  const info = db.prepare('DELETE FROM numbers WHERE id = ? AND merchant_id = ?')
    .run(req.params.id, req.merchantId);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true });
});

app.delete('/api/me/numbers', auth, (req, res) => {
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
  const sites = getWebsites(merchant).filter((d) => d !== req.params.domain.toLowerCase());
  db.prepare('UPDATE merchants SET websites = ? WHERE id = ?').run(JSON.stringify(sites), merchant.id);
  return res.json({ ok: true, websites: sites });
});

app.delete('/api/me/websites', auth, (req, res) => {
  const domain = String(req.body?.domain || '').trim().toLowerCase();
  const merchant = getMerchantById(req.merchantId);
  const sites = getWebsites(merchant).filter((d) => d !== domain);
  db.prepare('UPDATE merchants SET websites = ? WHERE id = ?').run(JSON.stringify(sites), merchant.id);
  return res.json({ ok: true, websites: sites });
});

app.post('/api/me/settings', auth, (req, res) => {
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

function payPageHtml(brand, merchant, numbers, amount, orderId) {
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
h1{font-size:22px}.muted{color:#666;font-size:14px}</style></head><body>
<div class="card"><h1>Pay ${escapeHtml(brand)}</h1>
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
  const numbers = db.prepare('SELECT * FROM numbers WHERE merchant_id = ? ORDER BY id').all(merchant.id);
  return res.send(payPageHtml(getBrand(), merchant, numbers, req.query.amount, req.query.order_id));
});

app.post('/pay/:payKey/claim', (req, res) => {
  const merchant = db.prepare('SELECT * FROM merchants WHERE pay_key = ?').get(req.params.payKey);
  const brand = getBrand();
  if (!merchant) return res.status(404).send(resultPageHtml(brand, 'Not found', 'This payment link is invalid.', null, null));
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
