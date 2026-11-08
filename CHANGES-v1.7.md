# TakaTick v1.7 — standard signup flow (no plan at account creation)

Siam's feedback (Nov 8, ~10:19 AM, login page screenshot): account create korar somoy plan/price select korte bola hocche keno — bujhte parchen na. Sob kichu standard maintain kore korte hobe.

## Standard flow (SaaS standard)

- **Account creation = naam/email/password sudhu.** Plan/price kokhono signup form-e thakbe na.
- **Plan select hoy pore:** landing pricing-e "Choose" click → wizard Step 2 (plan select) → Step 3 (payment). Order-i asol package thik kore.
- **Login page = login + signup (naam/email/password sudhu).** Package dropdown tule deoa hoyeche; signup-er por auto-login hoye `/#pricing`-e jay.
- **Landing signup step (Step 1):** package dropdown tule deoa hoyeche; bodle "Selected plan: Premium — ৳900/mo" text dekhay (porer step-e bodlano jay). Signup POST-e age theke choose kora plan-tai jay (`selectedPackage`).

## Tests

- `npm test`: **40/40 pass** (v1.6-er 39 + 1 notun: signup step-e kono package dropdown nei + login page-e kono package field nei).
- Ager sob test oporibortito.
