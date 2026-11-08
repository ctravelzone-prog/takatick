# TakaTick v1.5 — signup approval fix + profile chip

Siam's bug reports (Nov 8, ~10:08–10:14 AM, live testing on takatick.onrender.com):
1. Signup korei user sob peye jeto — admin approve lagto na, "waiting" kichu dekhaito na.
2. Login-er por bujha jeto na user kon page-e ache / logged in kina — home page-e asle abar signup korte bolto.
3. Profile click korle dashboard dekhabe — kon plan kinse, kivabe ache, sob oikhane.

## Root cause

v1.3-er signup-e **free 30-day trial** chilo: signup korlei chosen package + `package_expires_at = now + 30d` set hoye jeto, kono order/approve charai. `merchantBlocked`-e "pending" bole kichu chilo na, dashboard banner-eo pending branch chilo na. Landing page-er header/hero sobsomoy "Sign up / Log in" dekhaito — logged-in state-er kono chinno chilo na.

## Fix

**Approval gating (server.js):**
- Signup ekhon merchant banay `status='pending'`, `package_expires_at=NULL`. Chosen package shudhu *requested* package hisebe save thake.
- `expiryState` ekhon `pending` / `deactivated` state return kore; `merchantBlocked` pending hole `403 PACKAGE_NOT_ACTIVE` dey. Verify/confirm + hosted pay page + pay claim — tin jaygatei ekoi gate (tini `merchantBlocked` use kore).
- Admin approve: `status='active'` + package + expiry = approval + 30 din (ager moto fresh, kokhono stacked noy).
- Admin manual package change: bodlalei active hoye fresh 30 din pabe (admin action = activation).
- Admin status endpoint-e `pending` o allowed ekhon.
- `adminMerchantRow`: `no-expiry` shudhu active + NULL expiry hole; pending/deactivated state ar overwrite hoy na.
- Pay page / claim-e pending-er jonno alada message: "Payment link not active yet — This seller's package is waiting for approval."
- SMS ingest ager motoi ungated (data joma hoy, verify approve-er pore kaj kore).

**Dashboard (public/dashboard.html):**
- `pending` banner: pending order thakle "⏳ Waiting for approval — Order #N (package, ৳X) is pending. Admin approve korle package active hobe (30 din)"; order na thakle "No active package" + Buy a package button.
- `deactivated` banner: "Account deactivated — contact the admin".
- Orders fetch banner-er age kora hoy, jeno pending order banner-e dekhano jay.

**Logged-in state (public/index.html + login.html):**
- Header-e ekhon **profile chip**: avatar circle (namer prothom okkhor) + naam + package/state (e.g. "Basic • Waiting for approval" / "Premium • Active"). Click korle **dashboard** khule — okhane plan, expiry, order, keys, number — sob dekha jay. Pashe Log out link.
- Hero button logged-in hole "Go to dashboard" hoy; enroll heading "Buy a package" hoy.
- Token shudhu thaklei noy — `/api/me/profile` diye validate kora hoy; dead/expired token hole token muche logged-out page dekhay.
- login.html: already logged-in hole dashboard-e redirect; signup-er por auto-login kore `/#enroll`-e (pay step) niye jay — alada kore login korte hoy na.

## Tests

- `npm test`: **38/38 pass** (v1.3-er 36 + 2 notun: pending flow + nav hooks; 'new signup gets a 30-day window' test-ta bug chilo bole replace kora hoyeche).
- v1.5 local E2E smoke (fresh DB, `/tmp/takatick-v15-smoke.js`): **12/12 pass** — signup → pending → number add → verify 403 PACKAGE_NOT_ACTIVE → pay page 403 → order pending → dashboard-e pending → admin approve → active → verify OK → pay page 200.
- v1.4-er feature pictures + WooCommerce harness test (19/19) oporibortito.

## Deploy note

- Render free tier-e DB ephemeral — redeploy-e test data muche jabe (ager motoi). Live-e notun kore signup kore flow-ta check korte hobe.
- Ager live account gulo (v1.3 trial-e banano) redeploy-er por thakbe na; notun signup pending hobe, admin approve korte hobe.
