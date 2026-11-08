# TakaTick v2.5 — Expiry reminder + expired hole sob bondho (bujhe jawa)

Siam-er 2-ta proshno: (1) date sesh howar 1 din age theke user-ke auto
kivabe janano hobe, (2) date sesh howar por site-er kichui kaj korbe na —
user eita kivabe bujhbe?

## Ki bodleche
- `public/dashboard.html` — **reminder (1 din age):** meyad sesh howar
  sesh 24 ghontay dashboard-e holud warning box: "⚠️ Tomar package kal
  sesh hobe — {date}. Renew na korle kal theke verify, confirm, pay link —
  sob bondho hoye jabe." + Renew now button. Login korlei auto dekhabe.
- `public/dashboard.html` — **expired box:** choto "Expired — Renew koro"
  lekhar bodle boro lal box: "⛔ Package-er meyad sesh" + ki ki bondho
  (verify, confirm, pay link, API key dekha, download — kichui kaj korbe
  na; SMS asleo confirm hobe na) + renew korlei abar cholbe, ager key-i
  thakbe + Renew now button. Expired hole keys/downloads card-o Locked
  dekhay, ar number/website/settings form disable thake (deactivated-er
  motoi).
- `server.js` — `blockIfPlanOff` ekhon expired merchant-er number/website/
  settings change + API key regenerate-o 403 `PACKAGE_EXPIRED` diye atkay
  (grace period atkano hoy na; renewal order khola thake, ager motoi).
- Stat line: expired hole "0 day(s) left"-er bodle "Expired — renew koro".

## Test
- `npm test` — 59/59 pass (57 + 2 notun v2.5 test: expired merchant-er
  write route 403 + renewal order khola; dashboard-e reminder/expired box-er
  lekha ache).
