# TakaTick v2.2.1 — No flash of keys/downloads on first paint

v2.2 live verify-te ekta choto jinish dhora poreche: dashboard-er prothom
paint-e (JS profile fetch korar AGE) static HTML-e download link + key
button-gulo ek jholok dekha jeto, tarpor 🔒 Locked ashto. Key-er value
kokhono dekhay nai, ar server age thekei sob block kore (403) — tai leak
chilo na, kintu dekhte vul lagto.

## Ki bodleche
- `public/dashboard.html`: `#dlLinks` ar `#keysBtns` static HTML-ei
  `style="display:none"` — `load()` sudhu tokhoni dekhay jokhon merchant-er
  key ache (active/grace/expired). Pending merchant-er khetre prothom
  paint thekei sudhu 🔒 Locked box dekhabe.

## Test
- `npm test` — 53/53 pass (52 + 1 notun: static dashboard HTML-e
  `dlLinks`/`keysBtns` hidden + kono key material nei).
