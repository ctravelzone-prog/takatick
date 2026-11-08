# TakaTick v2.7 — Admin expiry date bosate parbe (expiry demo-r jonno)

Siam live-e merchant hoye expiry demo dekhte chay — kintu package 30
diner, asol expiry dekhte 30 din lagto.

## Ki bodleche
- `server.js` — notun admin endpoint `POST /api/admin/merchants/:id/expiry`
  (`expiresAt` ISO date, ba `null` = expiry clear / no expiry). Otit-er
  date ichha korei allowed — expiry demo ba correction-er jonno. Status
  bodlay na; state (active/grace/expired) sobsomoy date thekei hiseb hoy.
  Vul date → 400, merchant token → 403, ochena merchant → 404.
- `public/admin.html` — merchant detail-e "Expiry date" control
  (datetime-local input + Set expiry + Clear expiry button).
- Admin-er package change ager motoi 30 diner fresh window dey — expiry
  control alada, sudhu date bodlay.

## Demo-r rasta (Siam-er jonno)
1. Siam signup + Basic order (TrxID) → admin approve → active, key issue.
2. Admin expiry kalke bosay → dashboard-e 1-din-age reminder.
3. Admin expiry 4 din age bosay → boro lal expired box + verify/pay/key/
   download sob 403 (Siam nije try kore dekhte parbe).
4. Siam renew (notun order → approve) → abar active, ager key-i.

## Test
- `npm test` — 63/63 pass (61 + 2 notun v2.7 test: past expiry → expired
  + verify 403 PACKAGE_EXPIRED, future expiry → active + verify gate khole;
  400/403/404; admin.html-e control ache).
