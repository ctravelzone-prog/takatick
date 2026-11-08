# CHANGES — v2.9.5 (embed checkout: one file, paste into raw code)

Siam-er nirdesh (9 Nov ~1:08 AM): "amon ekta file banao jeikhane amar merchant-er kichu korte hobe na — oi file-ta se tar raw code-e paste kore dibe, kothay korbe README-te bole diba, ar oikhanei user purchase kore ja ja lage bosiye dibe, payment-er somoy TakaTick auto kaj korbe।"

## Ki bodlo

- **`public/takatick-embed.js` — ekta file, paste korlei checkout:** merchant tar page-e ei 2 line bosay (div jekhane checkout dekhabe, script `</body>`-er age):
  ```html
  <div id="takatick-checkout" data-pay-key="pay_..." data-amount="750" data-order-id="ORD-123" data-success-url="https://yourstore.com/thank-you"></div>
  <script src="https://takatick.onrender.com/takatick-embed.js"></script>
  ```
  `data-pay-key` (dashboard → Pay link) chara kichu lage na; `data-amount` na dile buyer amount type kore; `data-success-url` thakle confirm-er por okhane pathay (order_id + status soho)।
- **Widget nije theke:** merchant-er method-gulo logo + number soho dekhay, buyer pay kore TrxID dey, TakaTick auto verify kore — inline success/error dekhay, page charte hoy na।
- **Notun public API:** `GET /pay/:payKey/methods` → merchant-er registered method + number (pay page-e ja public-e dekhay, tai) — 404 (vul key) / 403 (pending/expired) JSON-e।
- **JSON claim:** `POST /pay/:payKey/claim` ekhon `Accept: application/json` hole JSON-e uttor dey (`{ok, event:'payment.confirmed', ...}` / `{ok:false, error, message}`) — HTML form-er behaviour ager motoi ache (redirect + HTML page)।
- **CORS:** `/pay/:payKey/*`-e `Access-Control-Allow-Origin: *` (pay key public bolei) — widget onno site theke call korte pare।
- **Demo page:** `/embed-demo.html` — pay key + amount bosiye live test kora jay।
- **Webhook:** `payment.confirmed` ager motoi fire hoy — merchant-er server order paid mark korte pare।

## Deploy note

- Kono notun env var lage na।
- ⚠️ Free-tier DB ephemeral — deploy-er por sob account muche jabe; demo + Md Siam + admin merchant abar banate hobe, app-e notun app key bosate hobe।

## Tests

- `test/api.test.js`: methods endpoint (registered method-i ashe, 404, CORS header), JSON claim (confirm + unknown TrxID 409 JSON), embed.js + 4-ta logo serve hoy (79/79 pass)।
