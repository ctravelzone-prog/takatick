# INTEGRATION.md — TakaTick Payment Verification

> Website owner-der jonno integration guide. Banglish-e lekha, code sample English-e.
> **Money kokhono ei system diye jay na.** Taka jay customer-er bKash, Nagad, Rocket ba Upay theke **apnar nijer personal number-e**. Ei system shudhu verify kore je payment ta asholei esheche.

---

## 1. Eta ki, ar kivabe kaj kore

TakaTick ekta payment-verification service — ZiniPay-er moto. Apnar website-e customer bKash, Nagad, Rocket ba Upay-te pay korbe, ar system ta automatically check korbe je TrxID + amount thik ache kina.

**5-step flow:**

1. **Customer pay kore** — apnar hosted payment page-e dekhano number-e, nijer MFS app theke.
2. **SMS ashe apnar phone-e** — bKash, Nagad, Rocket ba Upay theke payment confirmation SMS apnar phone-e ashe.
3. **Android app SMS ta server-e pathay** — apnar phone-e install kora TakaTick SMS app SMS ta pore server-e forward kore (`POST /api/sms`).
4. **Apnar website verify kore** — customer TrxID dile apnar server `POST /api/v1/verify` call kore: TrxID ache? Amount mile? Age use hoyni?
5. **Confirm korle order paid** — `POST /api/v1/confirm` call korle TrxID permanently "used" hoye jay, ar apnar webhook-e `payment.confirmed` event jay. Tarpor apni order deliver korben.

---

## 2. Packages

| Feature | Basic — ৳300/month | Standard — ৳600/month | Premium — ৳900/month |
|---|---|---|---|
| MFS number | 1 ta | 3 ta | Unlimited |
| Methods | bKash + Nagad | bKash + Nagad | All 4 — bKash, Nagad, Rocket, Upay |
| Website | 1 ta | 3 ta | Unlimited |
| Verification / month | 500 | 2,000 | Unlimited |
| Webhook | ❌ Na | ✅ Ha | ✅ Ha |
| WooCommerce plugin | ❌ Na | ❌ Na | ✅ Ha |
| Priority support | ❌ Na | ❌ Na | ✅ Ha |

Package change kora jay dashboard theke. Limit sesh hole verify call `LIMIT_EXCEEDED` error dibe — tokhon upgrade korte hobe. Basic/Standard-e Rocket ba Upay number add korle `403 METHOD_NOT_ALLOWED_FOR_PACKAGE` asbe — Rocket + Upay shudhu Premium-e.

---

## 2A. Package kena / renew kora (landing page) + admin panel

**Kinben kivabe (buyer):**
1. Website-er root page (`/`) theke package choose korun → signup (naam/email/password). **Signup-er por account `pending` thake — approve na howa porjonto verify/confirm ar pay page bondho; dashboard-e 'Waiting for approval' dekhabe.**
2. **Send Money** korun exact package amount — method picker theke bKash/Nagad/Rocket/Upay beche nin (je method-er seller number set ache, sudhu seguloi dekhabe), oi method-er number-e pay korun (page-e dekhano thake, copy button ache).
3. TrxID + je number theke pay korechen (sender) form-e bosiye submit korun — order `pending` hobe.
4. Admin manually check kore approve korle package **30 din-er jonno active** hobe — dashboard-e package + expiry date dekhte paben.

**Renew:** package sesh howar age ba pore dashboard-er "Upgrade / Renew package" button theke eki flow (notun order → approve → approval theke fresh 30 din, ager expiry-er sathe jog hoy na). API key ar data same thake — renew korle kichu bodlate hoy na.

**Expiry + 3 din grace:** 30 din sesh hole 3 din grace period — ei somoy verify/confirm ar pay page normal cholbe, dashboard-e "Grace period — X din baki, renew koro" banner dekhabe. Grace sesh hole verify `403 PACKAGE_EXPIRED` dibe ar pay page-e expired notice dekhabe — renew korlei abar cholbe.

**Admin panel (`/admin.html`):** admin login (env `ADMIN_EMAIL` / `ADMIN_PASSWORD` diye banano account) → sob merchant-er list (package, status, expiry date, expiry state: pending / active / expiring-soon / grace / expired / no-expiry, usage), order list (pending age) — approve korle package + 30-day expiry set hoy, reject korle purono package-i thake. Admin chaile merchant-er package manually bodlate pare (bodlalei active hoye fresh 30 din pabe), ar merchant deactivate/activate korte pare (deactivated merchant-er verify/confirm bondho hoye jay).

---

---

## 3. Getting started (4 ta step)

1. **Sign up korun** — naam, email, **phone number** ar password diye account khulun (phone lagbe — kono problem hole admin oi number-e contact korbe). Account approve howar por dashboard-er Keys card theke `apiKey`, `appKey`, `payKey`, `webhookSecret` paben.
2. **Apnar number add korun (bKash, Nagad, Rocket, Upay)** — dashboard-er Numbers section-e apnar personal number (bKash, Nagad, Rocket ba Upay — je number-e taka asbe) add korun. Tier limit onujayi number add kora jabe (Basic: 1, Standard: 3, Premium: unlimited).
3. **Android SMS app install korun** — je phone-e payment SMS ashe, oi phone-e TakaTick Android app install kore apnar `appKey` diye login korun. App-er source `android-app/` folder-e ache — Android Studio-te khule APK banan (oi folder-er README dekhun), ba dashboard-er Downloads section theke toiri APK-ta naman (`/download/app.apk`). App na thakle kono SMS server-e jabe na, ar verify kaj korbe na.
4. **API key copy korun** — dashboard theke `apiKey` copy kore apnar website-er server-side code-e boshan. **API key kokhono browser-er JavaScript-e ba public jaygay rakhben na** — shudhu server-side.

---

## 4. Option A — Hosted payment link (sobcheye shohoj)

Kono code lekha lagbe na. Apnar `payKey` diye ekta link banan:

```
https://<apnar-domain>/pay/<payKey>?amount=500&order_id=ORD-1234
```

**Query params:**

| Param | Required? | Kaj |
|---|---|---|
| `amount` | Ha | Koto taka pay korte hobe (exact amount) |
| `order_id` | Ha | Apnar order-er ID — webhook-e ar redirect-e fire asbe |

**Customer ja dekhbe:**

- Apnar brand naam, amount, ar order ID
- Apnar number gulo (bKash, Nagad, Rocket, Upay) — protitar pashe **Copy button**
- Customer number copy kore nijer bKash/Nagad/Rocket/Upay app-e giye taka pathabe, tarpor TrxID ta page-e bosiye submit korbe

**Success hole ja hobe:**

1. Server TrxID verify + confirm korbe
2. Success page dekhabe
3. Apnar webhook-e (Standard/Premium) `payment.confirmed` event jabe
4. Customer-ke apnar `success_url`-e redirect kora hobe (dashboard-er Settings-e set korte hoy)

> ⚠️ Redirect-e asha manei payment confirm na — **Section 7 (Golden Rule) porun.**

---

## 5. Option B — Direct API (nijer checkout-e)

Apnar nijer checkout page thakle API diye verify korun. **Dui-step: age verify, tarpor confirm.**

### Step 1 — Verify

```bash
curl -X POST https://<apnar-domain>/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "amount": 500,
    "transactionId": "9HX7K2M4P1"
  }'
```

**Success response:**

```json
{
  "ok": true,
  "id": 12,
  "method": "bkash",
  "amount": 500,
  "senderMasked": "017******78",
  "receivedAt": "2026-11-08T08:30:00.000Z"
}
```

`id` ta (ekta number) dhore rakhun — confirm-er somoy lagbe. `senderMasked` mane je number theke taka esheche, tar masked form (privacy-er jonno puro number dekhano hoy na). `method` holo `bkash` / `nagad` / `rocket` / `upay` (choto hater).

**Error response:**

```json
{
  "ok": false,
  "error": "AMOUNT_MISMATCH"
}
```

### Step 2 — Confirm

Verify success hole, order deliver korar age confirm korun:

```bash
curl -X POST https://<apnar-domain>/api/v1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "amount": 500,
    "transactionId": "9HX7K2M4P1",
    "id": 12
  }'
```

**Success response:**

```json
{
  "ok": true,
  "transactionId": "9HX7K2M4P1",
  "method": "bkash",
  "amount": 500,
  "sender": "01XXXXXXXXX",
  "receivedAt": "2026-11-08T08:30:00.000Z"
}
```

Confirm korlei TrxID permanently "used" hoye jay, ar webhook fire hoy. **Verify chara confirm korben na, ar ekbar confirm kora TrxID diye ar kokhono verify hobe na.**

### Error codes

| Error | Mane | Ki korben |
|---|---|---|
| `TRANSACTION_NOT_FOUND` | Ei TrxID-er SMS server-e asheni | Customer-ke bolun SMS asha porjonto ektu wait korte, ar TrxID thik ache kina check korte |
| `AMOUNT_MISMATCH` | TrxID ache, kintu amount mile nai | Exact amount-e pay korte bolun — 1 taka kom/beshi holeo hobe na |
| `ALREADY_USED` | Ei TrxID diye age ekta order confirm hoye geche | Notun payment korte bolun — ek TrxID ekbar-i use kora jay |
| `LIMIT_EXCEEDED` | Ei month-er verification limit sesh | Package upgrade korun |
| `PACKAGE_EXPIRED` | Package-er meyad + 3 din grace sesh | Renew korun (dashboard theke) |
| `ACCOUNT_DEACTIVATED` | Admin apnar account deactivate koreche | Admin-er sathe jogajog korun |
| `DUPLICATE_TRXID` | Ei TrxID diye age ekta order deoa hoyeche | Notun payment-er TrxID din |

### PHP example

```php
<?php
$apiKey = getenv('TAKATICK_API_KEY'); // kokhono code-e hardcode korben na
$base = 'https://<apnar-domain>';

function callApi($base, $path, $data) {
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($data),
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true);
}

// Step 1: verify
$verify = callApi($base, '/api/v1/verify', [
    'apiKey' => $apiKey,
    'amount' => 500,
    'transactionId' => $_POST['trx_id'],
]);

if (empty($verify['ok'])) {
    die('Payment verify hoyni: ' . $verify['error']);
}

// Step 2: confirm (order deliver korar age)
$confirm = callApi($base, '/api/v1/confirm', [
    'apiKey' => $apiKey,
    'amount' => 500,
    'transactionId' => $_POST['trx_id'],
    'id' => $verify['id'],
]);

if (!empty($confirm['ok'])) {
    // ekhanei order paid mark korun + deliver korun
    echo 'Payment confirmed!';
}
```

### JavaScript / Node example

```js
const API_KEY = process.env.TAKATICK_API_KEY;
const BASE = 'https://<apnar-domain>';

async function callApi(path, data) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Step 1: verify
const verify = await callApi('/api/v1/verify', {
  apiKey: API_KEY,
  amount: 500,
  transactionId: req.body.trx_id,
});
if (!verify.ok) throw new Error('Verify failed: ' + verify.error);

// Step 2: confirm — order deliver korar age
const confirm = await callApi('/api/v1/confirm', {
  apiKey: API_KEY,
  amount: 500,
  transactionId: req.body.trx_id,
  id: verify.id,
});
if (confirm.ok) {
  // ekhanei order paid mark korun + deliver korun
}
```

---

## 6. Webhook (Standard / Premium)

Confirm hole apnar `webhook_url`-e (dashboard Settings-e set kora) ekta POST request jabe:

**Payload:**

```json
{
  "event": "payment.confirmed",
  "order_id": "ORD-1234",
  "transactionId": "9HX7K2M4P1",
  "method": "bkash",
  "amount": 500,
  "sender": "01XXXXXXXXX",
  "confirmedAt": "2026-11-08T08:30:00.000Z"
}
```

**Signature check (IMPORTANT):** Prottek webhook-er header-e thake `X-Signature` — eta raw request body-r HMAC-SHA256 hex, key holo apnar `webhookSecret`. Signature na mille request ta ignore korun — keu fake webhook pathate pare.

**PHP — signature verify:**

```php
<?php
$secret = getenv('TAKATICK_WEBHOOK_SECRET');
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

$expected = hash_hmac('sha256', $rawBody, $secret);
if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}

$data = json_decode($rawBody, true);
// ekhane order paid mark korun (order_id diye)
http_response_code(200);
```

**Node — signature verify:**

```js
import crypto from 'node:crypto';

app.post('/webhook/takatick', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.TAKATICK_WEBHOOK_SECRET;
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  const signature = req.headers['x-signature'] || '';
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.sendStatus(401);

  const data = JSON.parse(req.body.toString());
  // ekhane order paid mark korun (data.order_id diye)
  res.sendStatus(200);
});
```

> ⚠️ Node-e `express.raw()` use korte hobe — JSON parse korar age raw body lagbe, na hole signature milbe na.

**Retry note:** Webhook ekbar-i pathano hoy (5 second timeout). Delivery fail hole (apnar server down thakle ba 2xx response na dile) **automatic retry hoy na** — prottek attempt `webhook_deliveries` table-e log thake, ar dashboard-er transactions/verifications list theke apni nije reconcile korte parben. Tai apnar webhook handler **idempotent** rakhun — same `transactionId` diye duibar paid mark korleo jeno double delivery na hoy.

---

## 7. ⭐ THE GOLDEN RULE

> **Kokhono browser redirect theke order paid mark korben na. Order deliver korar age obosshoi server-side-e `/api/v1/verify` + `/api/v1/confirm` diye verify korun, ba webhook-er signature check kore validate korun.**
>
> Success page-e redirect howa manei taka asheni — redirect URL je keu baniye browser-e khulte pare. Shudhu server-side verification (ba signed webhook) bishwasjoggo.

---

## 8. WooCommerce

Premium package-e WooCommerce plugin thake — file ache: `woocommerce-plugin/takatick-gateway.php` + `woocommerce-plugin/class-wc-gateway-takatick.php`.

**Install:**
1. `woocommerce-plugin/` folder-ta zip korun, WordPress admin → Plugins → Add New → Upload Plugin → zip upload → Activate.
2. WooCommerce → Settings → Payments → TakaTick → apnar `base_url` (server URL), `api_key`, `pay_key`, `webhook_secret` boshan.
3. TakaTick dashboard-er Settings-e webhook URL boshan: `https://apnar-site.com/?wc-api=takatick`

**Plugin ja kore:**
- Checkout-e "bKash / Nagad / Rocket / Upay" payment method hisebe dekhay
- Customer-ke hosted payment page-e pathay, TrxID niye server-side verify + confirm kore
- Confirm hole signed webhook-e WooCommerce order auto "Processing/Completed" hoy
- Webhook signature (HMAC-SHA256) check kore — fake webhook-e order paid hobe na; amount-o miliye dekhe

> ⚠️ Plugin-er PHP syntax check kora hoyeche (`php -l` pass), kintu WordPress + WooCommerce-e live test kora hoyni — install kore ekta test order diye check korun (Section 9). Dashboard-er Downloads section theke plugin zip-tao nama jay (`/downloads/takatick-woocommerce-plugin.zip`).

---

## 9. Testing (end-to-end)

Production-e jaoar age evabe test korun:

1. **Signup korun** — dashboard-e account khulun, `apiKey` + `appKey` + `payKey` save korun.
2. **Number add korun** — dashboard-e apnar number (bKash, Nagad, Rocket ba Upay) add korun.
3. **Sample SMS pathan** — Android app-er **test button** diye ekta sample SMS (je kono method-er) server-e pathan; app na thakle curl diyeo kora jay:
   ```bash
   curl -X POST https://<apnar-domain>/api/sms \
     -H "Content-Type: application/json" \
     -H "x-app-key: YOUR_APP_KEY" \
     -d '{
       "sender": "bKash",
       "text": "You have received Tk 500.00 from 01XXXXXXXXX. TrxID 9HX7K2M4P1 at 08:30 08/11/2026",
       "receivedAt": "2026-11-08T08:30:00.000Z"
     }'
   ```
   > ⚠️ Uporer SMS text ta **sample format**. Asol SMS-er wording (bKash, Nagad, Rocket, Upay) alada hote pare — production-e jaoar age asol SMS diye parse kora check korte hobe (FAQ dekhun).
4. **Verify korun** — Section 5-er curl diye `/api/v1/verify` call korun, `ok: true` asha korun.
5. **Confirm korun** — `/api/v1/confirm` call korun, `ok: true` + webhook (thakle) asha korun.
6. **Abar verify korun** — same TrxID diye abar verify korle `ALREADY_USED` asha korun. Eta na ashle system-e bug ache.

---

## 10. FAQ + limits

**Q: Amount ki exact hotei hobe?**
Ha. 500 takar order-e 499 ba 501 taka pathale `AMOUNT_MISMATCH` asbe. Customer-ke exact amount-e pay korte bolun.

**Q: Ek TrxID diye ki duita order pay kora jabe?**
Na. Ek TrxID = ekbar use. Confirm howar por oi TrxID ar kokhono verify hobe na (`ALREADY_USED`).

**Q: SMS ashte deri hole ki hobe?**
Payment SMS aste sadharonoto koyek second lage. SMS server-e na asha porjonto verify `TRANSACTION_NOT_FOUND` dibe. Customer-ke ektu wait kore abar try korte bolun. SMS adou na ashle phone-e app ta thik moto cholche kina check korun.

**Q: Hosted payment page-e kar number dekhabe?**
Apnar number — dashboard-e add kora apnar number. Customer oi number-ei taka pathabe.

**Q: Taka ki TakaTick-er kache jay?**
Na, kokhono na. Taka sorasori apnar personal number-e (bKash, Nagad, Rocket ba Upay) jay. TakaTick shudhu SMS pore verify kore.

**Q: Asol SMS-er wording niye kono sotorkota ache?**
Ha — **production-e jaoar age asol SMS (4 method-er je kono ta) diye parse kora obosshoi check korte hobe.** SMS-er format bodle gele TrxID/amount parse na-ao hote pare. Sample SMS diye test kora mane production ready na.

**Q: Webhook na pele ki korbo?**
Dashboard-er Settings-e `webhook_url` thik ache kina check korun, ar apnar server `X-Signature` verify kore 200 response dicche kina dekhun. Webhook shudhu Standard/Premium-e ache.

**Q: API key harale / leak hole ki korbo?**
Dashboard theke API key regenerate korun — purono key sathe sathe kaj kora bondho kore dibe. `appKey` ar `webhookSecret`-er khetreo eki niyom.
