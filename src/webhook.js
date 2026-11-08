// src/webhook.js — deliver a signed webhook to a merchant's URL.
// Signature: HMAC-SHA256 hex of the raw JSON body, keyed by the merchant's
// webhook_secret, sent as header X-Signature. 5s timeout. Every attempt is
// logged in webhook_deliveries. Never throws — failures are logged only.
'use strict';

const crypto = require('node:crypto');
const { db, nowIso } = require('./db');

function signPayload(secret, rawBody) {
  return crypto.createHmac('sha256', secret || '').update(rawBody).digest('hex');
}

async function fireWebhook(merchant, payload) {
  if (!merchant || !merchant.webhook_url) return false;
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(merchant.webhook_secret, rawBody);
  let statusCode = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(merchant.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
        body: rawBody,
        signal: controller.signal,
      });
      statusCode = res.status;
    } finally {
      clearTimeout(timer);
    }
  } catch (_err) {
    // Network error / timeout / abort: status stays null, logged below.
    statusCode = null;
  }
  try {
    db.prepare(
      `INSERT INTO webhook_deliveries (merchant_id, event, payload, url, status_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(merchant.id, payload.event || '', rawBody, merchant.webhook_url, statusCode, nowIso());
  } catch (_err) {
    // Logging must never break the caller.
  }
  return statusCode !== null && statusCode >= 200 && statusCode < 300;
}

module.exports = { fireWebhook, signPayload };
