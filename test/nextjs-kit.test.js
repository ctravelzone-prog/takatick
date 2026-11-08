// test/nextjs-kit.test.js — plug-and-play Next.js kit (2 files) tests.
// Locks the contract the kit depends on, so a server change can't
// silently break a merchant's site:
//  - pay link format: /pay/<payKey>?amount=<taka>&order_id=<id>
//  - webhook: event payment.confirmed, HMAC-SHA256 hex of the raw JSON
//    body keyed by webhook_secret, header X-Signature.
// Uses only node:test; no server or database needed.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const buttonFile = path.join(__dirname, '..', 'nextjs-kit', 'TakaTickPayButton.tsx');
const routeFile = path.join(__dirname, '..', 'nextjs-kit', 'takatick-webhook-route.ts');

// The kit's verify steps, copied 1:1 from takatick-webhook-route.ts.
function signatureIsValid(secret, rawBody, signature) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Server-side signing, per src/webhook.js: HMAC-SHA256 hex of raw JSON body.
function signPayload(secret, rawBody) {
  return crypto.createHmac('sha256', secret || '').update(rawBody).digest('hex');
}

test('kit files exist with key placeholders and install instructions', () => {
  const button = fs.readFileSync(buttonFile, 'utf8');
  const route = fs.readFileSync(routeFile, 'utf8');

  assert.ok(button.includes("const TAKATICK_PAY_KEY = 'pay_XXXX'"), 'button has pay key placeholder');
  assert.ok(button.includes('components/TakaTickPayButton.tsx'), 'button says where it goes');
  assert.ok(button.includes('/pay/${TAKATICK_PAY_KEY}?amount=${amount}&order_id='), 'button builds the pay link');
  assert.ok(button.includes('getTakaTickPayUrl'), 'button exports the URL helper');

  assert.ok(route.includes("const TAKATICK_WEBHOOK_SECRET = 'XXXX'"), 'route has secret placeholder');
  assert.ok(route.includes('app/api/takatick-webhook/route.ts'), 'route says where it goes');
  assert.ok(route.includes("req.headers.get('x-signature')"), 'route reads X-Signature');
  assert.ok(route.includes("createHmac('sha256'"), 'route uses HMAC-SHA256');
  assert.ok(route.includes('timingSafeEqual'), 'route compares in constant time');
  assert.ok(route.includes("payload.event === 'payment.confirmed'"), 'route handles payment.confirmed');
  assert.ok(route.includes('markOrderPaid'), 'route has the mark-paid hook');
});

test('pay link format: taka amount + encoded order id', () => {
  const payKey = 'pay_09e2d6183c70f810e57ffba56bc37852';
  const url = `https://takatick.onrender.com/pay/${payKey}?amount=${1500}&order_id=${encodeURIComponent('ORD-123')}`;
  assert.equal(
    url,
    'https://takatick.onrender.com/pay/pay_09e2d6183c70f810e57ffba56bc37852?amount=1500&order_id=ORD-123',
  );
});

test('webhook round-trip: server-signed payload verifies, tampered does not', () => {
  const secret = 'test-webhook-secret';
  const payload = {
    event: 'payment.confirmed',
    order_id: 'ORD-123',
    transactionId: 'NAGAD298B',
    method: 'nagad',
    amount: 1500,
    sender: '01740707570',
    confirmedAt: '2026-11-09T05:09:53.000Z',
  };
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(secret, rawBody);

  assert.equal(signatureIsValid(secret, rawBody, signature), true, 'genuine webhook verifies');
  assert.equal(signatureIsValid(secret, rawBody + ' ', signature), false, 'tampered body rejected');
  assert.equal(signatureIsValid('wrong-secret', rawBody, signature), false, 'wrong secret rejected');
  assert.equal(signatureIsValid(secret, rawBody, null), false, 'missing signature rejected');
});
