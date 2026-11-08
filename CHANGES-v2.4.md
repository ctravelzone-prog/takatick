# TakaTick v2.4 — Signup-e phone number + admin dashboard-e dekha

Siam-er nirdesh: signup page-e phone number-er option chilo na — client-er
number admin dashboard-e dekhate hobe, jeno kono problem-e contact kora jay.

## Ki bodleche
- `src/db.js` — merchants table-e notun `phone` column (migration, purono
  DB-teo jog hobe).
- `server.js` — signup-e phone REQUIRED (Bangladeshi mobile `01[3-9]XXXXXXXX`,
  na dile 400 `INVALID_PHONE`); `publicMerchant` + `adminMerchantRow` — duitai
  `phone` dey.
- `public/signup.html` + `public/enroll.html` (Step 1) — Phone number field
  (tel input, pattern check) + signup request-e phone pathano hoy.
- `public/admin.html` — Merchants table-e notun Phone column (tap korle
  `tel:` link-e call kora jay), search-e phone diyeo khunja jay, merchant
  detail-eo Phone line ache.

## Test
- `npm test` — 57/57 pass (55 + 2 notun v2.4 test: phone na dile/bhul dile
  400, thik dile save + admin list/detail-e dekha jay; signup/enroll page-e
  phone field + admin-e Phone column ache).
