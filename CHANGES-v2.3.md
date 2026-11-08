# TakaTick v2.3 — Login ar signup alada page

Siam-er report: header-er "Sign up"-e click korle plan-er kache niye jeto,
ar login page-er vitore login + signup ek sathe dekhte valo lagto na.

## Ki bodleche
- Notun page `public/signup.html` — sudhu account toiri (naam/email/password,
  kono plan dropdown nei). Signup hole auto-login + `/#pricing`-e jay (plan
  choose korar jonno). Ager login.html-er signup form-er alert-e v2.2-er por
  ar na thaka key (`o.apiKey` ityadi) dekhano hoto — "undefined" ashto; notun
  page-e oi vul alert-ta nei.
- `public/login.html` — sudhu login form; signup form + handler sorano;
  niche "Don't have an account? Sign up" link (`/signup.html`). Title-er
  `{{BRAND}}` placeholder-o thik kora hoyeche ("Log in — TakaTick").
- `public/index.html` — header "Sign up" button + hero "Sign up — start
  verifying" ekhon `/signup.html`-e jay (`#pricing` noy); "See pricing"
  ager motoi `#pricing`-e jay. Logged-in hole profile chip ager motoi kaj kore.
- Enroll wizard (`/enroll.html`) ager motoi — logged-in thakle Step 1 skip
  kore Step 2 (plan) theke shuru hoy.

## Test
- `npm test` — 55/55 pass (54 + 1 notun v2.3 test: alada page, header/hero
  link, signup-e kono package field nei).
