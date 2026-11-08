# CHANGES — v2.9.3 (multi-method enroll: bKash / Nagad / Rocket / Upay)

Siam-er live report (9 Nov ~12:57 AM, screenshot): enroll Step 3-e sudhu bKash dekhay — admin merchant-e Nagad + Upay number add kora sotteo. Karon: storefront-er payment chilo ekta number-e hardcode (seller bKash); merchant-er add kora number-gulo sudhu tar nijer pay page-er jonno chilo, enroll-er jonno noy.

## Ki bodlo

- **Enroll Step 3-e ekhon method picker:** buyer bKash / Nagad / Rocket / Upay — je method-er seller number set ache, sudhu seguloi button hisebe ashe (default bKash)। Method bodle number, heading ("Pay by Nagad Send Money"), TrxID label ar sender label — sob bodle jay; Copy number button ekhon je method select ache tar number copy kore।
- **Seller number ekhon proti method-e alada** (v2.9.2-er Settings pattern-e):
  - DB settings: `seller_bkash_number` / `seller_nagad_number` / `seller_rocket_number` / `seller_upay_number` — Admin → Settings-e 4-ta input + ek Save / Reset to env।
  - Env fallback: `SELLER_BKASH_NUMBER` (01883042132) + `SELLER_NAGAD_NUMBER` / `SELLER_ROCKET_NUMBER` / `SELLER_UPAY_NUMBER` (na thakle oi method offer hoy na)।
  - Precedence (proti method-e): DB (admin panel) > env > fallback (sudhu bKash-er fallback ache)।
- **API:** `/api/public/pricing`-e ekhon `sellerNumbers: {bkash, nagad, ...}` (sudhu set kora method-gulo); `sellerBkash` ager motoi ache। `/api/admin/settings` GET/POST ekhon 4-ta number-i ney/dey (khali string = oi method clear)।
- **Order submit bodlay ni:** TrxID + exact amount diyei match hoy (method nirbisheshe) — SMS-er method parser theke record hoy।

## Deploy note

- Render-e env var bosate hobe: `SELLER_NAGAD_NUMBER=01883042132`, `SELLER_UPAY_NUMBER=01883042132` (Rocket Siam-er nei, tai unset thakbe)।
- ⚠️ Free-tier DB ephemeral — deploy-er por sob account muche jabe; demo + Md Siam + admin merchant abar banate hobe, app-e notun app key bosate hobe।

## Caveat

- bKash SMS wording asol payment diye promanito (auto-approve kaj kore)। Nagad/Upay SMS-er wording ekhono asol SMS diye verify hoyni — kono Nagad/Upay payment auto-approve na hole order pending thakbe, admin theke manual approve korte hobe, ar asol SMS text-ti pathale parser-e miliye nebo।

## Tests

- `test/storefront.test.js`: pricing sellerNumbers {bkash, nagad, upay} (Rocket nei) + enroll page-e method picker markup (75/75 pass)।
- `test/api.test.js`: admin settings-e Nagad/Upay add (invalid 400), pricing-e reflect, clear-e abar sudhu bKash।
