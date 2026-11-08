# TakaTick v1.6 — enroll step wizard

Siam's feedback (Nov 8, ~10:17 AM, screenshot): pricing ar signup form — 2-ta section eki page-e dekhachhe keno? Nicher ta uporer tay click korar por asha uchit.

## Flow (ager moto sob ek page-e noy — ekhon step by step)

1. **Pricing** — 3-ta plan card, prottektay "Choose" button. Enroll section prothome **lukano** thake.
2. **Choose click korle** enroll section khole, **Step 1 — Create your account** (naam/email/password + chosen plan dekhay).
3. **Account create korle** **Step 2 — Choose your plan** ashe: 3-ta plan radio option hisebe, chosen plan age thekei select kora; bodlate chaile bodlano jay; "Continue to payment".
4. **Plan confirm korle** **Step 3 — Pay by bKash Send Money** ashe: seller number + exact amount + TrxID form → submit korle pending step ("Order submitted! Admin approve korle package active hobe").

Logged-in merchant: Choose click korle signup skip kore soja **Step 2 (plan)**-e jay. Header-er "Sign up" ar hero button ekhon `#pricing`-e jay (age `#enroll`-e jeto). login.html-e signup-er por auto-login hoye `/#pricing`-e jay (age `/#enroll`).

Step heading prottek step-e bodlay ("Step 1 of 3 / 2 of 3 / 3 of 3"). Purono `/#enroll` link (bookmark) thakle token check-er por thik step-e khole — dead token hole signup step dekhay, plan step noy.

## Tests

- `npm test`: **39/39 pass** (v1.5-er 38 + 1 notun: wizard hidden-by-default + planStep + step labels).
- v1.5-er pending-flow smoke 12/12 ar WooCommerce harness 19/19 oporibortito.
