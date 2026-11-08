# CHANGES — v2.9.4 (pay page: MFS logo selector)

Siam-er nirdesh (9 Nov ~1:02 AM): final payment link-e click korle customer jeno merchant-er add kora number-gulo **MFS logo soho select option** hisebe dekhe — merchant jegula select (register) korbe, sudhu seguloi asbe. Age pay page-e sob number heading + Copy button hisebe list hoto, kono logo chilo na, ar Method dropdown-e register na kora method-o dekhato.

## Ki bodlo

- **Hosted pay page (`/pay/<payKey>`) ekhon logo selector:** bKash / Nagad / Rocket / Upay — sudhu merchant-er register kora method-gulo logo card hisebe ashe (logo + naam); click korle oi method-er number + Copy button dekhay; TrxID form-er method ekhon hidden input (select kora method-i jay, register na kora method ar option-e nei)।
- **MFS logo (`public/mfs/`):** asol brand logo — bKash, Nagad, Rocket, Upay (PNG, nije download kore verify korechi — prottekta asol logo; Nagad-ta transparent)।
- **Enroll page (v2.9.3-er picker) ekhon logo card:** bKash/Nagad/Upay button-e logo + naam (ager text-only button-er bodle) — enroll ar pay page ek-i UI।
- Claim flow bodlay ni (TrxID + amount match, method mismatch check, webhook) — sudhu UI bodleche।

## Tests

- `test/api.test.js`: ager pay-page test (Rocket + Upay numbers, `name="method"`) ekhono pass; notun test — logo file serve hoy (4-ta PNG 200) + embed widget serve hoy।
- `test/storefront.test.js`: enroll page-e `/mfs/` logo reference ache।
