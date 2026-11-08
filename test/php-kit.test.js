// test/php-kit.test.js — PHP plug-and-play kit tests.
// The PHP webhook + pay redirect are tested over REAL HTTP
// (php -S built-in server + fetch): PHP CLI php://input is always
// empty, so a CLI test would prove nothing. Mirrors the Next.js kit
// contract: pay link /pay/<payKey>?amount=<taka>&order_id=<id> and
// webhook payment.confirmed with HMAC-SHA256 / X-Signature.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFile, execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const phpKitDir = path.join(root, 'php-kit');

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

function startPhp(port) {
  return new Promise((resolve, reject) => {
    const proc = execFile('php', ['-S', `127.0.0.1:${port}`, '-t', phpKitDir]);
    const t0 = Date.now();
    const tick = async () => {
      try {
        await fetch(`http://127.0.0.1:${port}/takatick-pay.php?amount=1&order_id=x`, { redirect: 'manual' });
        resolve(proc);
      } catch {
        if (Date.now() - t0 > 10000) reject(new Error('php -S did not start'));
        else setTimeout(tick, 100);
      }
    };
    tick();
  });
}

function sign(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

test('PHP kit files exist with key placeholders and install instructions', () => {
  const pay = fs.readFileSync(path.join(phpKitDir, 'takatick-pay.php'), 'utf8');
  const hook = fs.readFileSync(path.join(phpKitDir, 'takatick-webhook.php'), 'utf8');

  assert.ok(pay.includes("define('TAKATICK_PAY_KEY', 'pay_XXXX')"), 'pay file has pay key placeholder');
  assert.ok(pay.includes("takatick-pay.php?amount="), 'pay file shows the checkout link');
  assert.ok(pay.includes('/pay/'), 'pay file builds the pay link');

  assert.ok(hook.includes("define('TAKATICK_WEBHOOK_SECRET', 'XXXX')"), 'webhook file has secret placeholder');
  assert.ok(hook.includes("$_SERVER['HTTP_X_SIGNATURE']"), 'webhook reads X-Signature');
  assert.ok(hook.includes("hash_hmac('sha256'"), 'webhook uses HMAC-SHA256');
  assert.ok(hook.includes('hash_equals'), 'webhook compares in constant time');
  assert.ok(hook.includes("payment.confirmed"), 'webhook handles payment.confirmed');
  assert.ok(hook.includes('markOrderPaid'), 'webhook has the mark-paid hook');
  assert.ok(hook.includes("file_get_contents('php://input')"), 'webhook reads the raw body');
});

test('kit zips exist with the 2 files + README each', () => {
  for (const [zip, files] of [
    ['takatick-nextjs-kit.zip', ['TakaTickPayButton.tsx', 'takatick-webhook-route.ts', 'README.txt']],
    ['takatick-php-kit.zip', ['takatick-pay.php', 'takatick-webhook.php', 'README.txt']],
  ]) {
    const listing = execSync(`unzip -l ${path.join(root, 'public', 'downloads', zip)}`, { encoding: 'utf8' });
    for (const f of files) assert.ok(listing.includes(f), `${zip} contains ${f}`);
    assert.match(listing, /3 files/, `${zip} has exactly 3 files`);
  }
});

test('dashboard links the kit zips and server serves them (auth-gated)', () => {
  const dash = fs.readFileSync(path.join(root, 'public', 'dashboard.html'), 'utf8');
  assert.ok(dash.includes("downloadFile('/downloads/takatick-nextjs-kit.zip'"), 'dashboard links Next.js kit zip');
  assert.ok(dash.includes("downloadFile('/downloads/takatick-php-kit.zip'"), 'dashboard links PHP kit zip');
  assert.ok(dash.includes('Must read'), 'dashboard has the must-read box');
  assert.ok(dash.includes('components/'), 'must-read says where the button goes');
  assert.ok(dash.includes('app/api/takatick-webhook/route.ts'), 'must-read says where the webhook route goes');
  assert.ok(dash.includes('public_html'), 'must-read says where the PHP files go');

  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(server.includes("app.get('/downloads/takatick-nextjs-kit.zip'"), 'server has Next.js zip route');
  assert.ok(server.includes("app.get('/downloads/takatick-php-kit.zip'"), 'server has PHP zip route');
});

test('PHP pay redirect + webhook verify over real HTTP', async () => {
  const port = await freePort();
  const proc = await startPhp(port);
  try {
    const base = `http://127.0.0.1:${port}`;

    // Pay redirect: taka amount + order id -> 302 to the pay page.
    let r = await fetch(`${base}/takatick-pay.php?amount=1500&order_id=ORD-123`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.equal(
      r.headers.get('location'),
      'https://takatick.onrender.com/pay/pay_XXXX?amount=1500&order_id=ORD-123',
    );

    // Bad amount -> 400.
    r = await fetch(`${base}/takatick-pay.php?amount=abc&order_id=ORD-123`, { redirect: 'manual' });
    assert.equal(r.status, 400);

    // Webhook: the file's placeholder secret is 'XXXX' — sign with it.
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
    const secret = 'XXXX';

    r = await fetch(`${base}/takatick-webhook.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': sign(secret, rawBody) },
      body: rawBody,
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, received: true });

    // Tampered body -> 401.
    r = await fetch(`${base}/takatick-webhook.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': sign(secret, rawBody) },
      body: rawBody + ' ',
    });
    assert.equal(r.status, 401);

    // Missing signature -> 401.
    r = await fetch(`${base}/takatick-webhook.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });
    assert.equal(r.status, 401);
  } finally {
    proc.kill();
  }
});
