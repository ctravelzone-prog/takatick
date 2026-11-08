# TakaTick v2.2 — Keys only after purchase (Siam bug report)

Siam-er report: notun account khullei API key / app key / pay link + APK +
WooCommerce plugin download dekha jeto — purchase-er agei sob kichu hate
pawa jeto. Eta thik kora hoyeche: key + download ekhon sudhu plan
purchase (admin approve)-er PORE pawa jay.

## Ki bodleche
- **Signup-e ar kono key nei.** `POST /api/auth/signup` sudhu merchant
  banay — `apiKey`/`appKey`/`payKey`/`webhookSecret` ar response-e jay na.
  DB-te `pay_key` ekta `pending_...` placeholder thake (column NOT NULL
  bole khali rakha jay na), kono api/app key row toiri hoy na.
- **Activation-e key issue hoy** (`ensureMerchantKeys` helper):
  `POST /api/admin/orders/:id/approve`, `POST /api/admin/merchants/:id/package`
  (manual package change) ar status `active`-e flip — sob jaygatei key na
  thakle banano hoy; thakle ager key-i reuse hoy (renew/reactivate-e notun
  key hoy na). Approve/package response-e `keysIssued: true/false` ache.
- **Key endpoint gate:** `GET /api/me/api-key` (NOTUN — dashboard-e "Show
  API key" button-er jonno), `GET /api/me/app-key`,
  `POST /api/me/api-key/regenerate` — pending/expired merchant hole 403
  `PACKAGE_NOT_ACTIVE` (deactivated hole `ACCOUNT_DEACTIVATED`).
- **Download gate:** `/download/app.apk` age public chilo (keu-i
  namate parto) — ekhon JWT + active merchant lage. WooCommerce plugin zip
  (`/downloads/takatick-woocommerce-plugin.zip`) age `express.static`
  diye public serve hoto — ekhon authed route (static-er AGE define kora),
  active merchant chara 403. Dashboard-e download ekhon JWT diye blob
  download kore (plain link noy).
- **Dashboard UI:** key na thakle (kokhono activate hoy nai) Keys &
  pay link + Downloads card-e 🔒 Locked box dekhay ("admin approve
  korle pabe") + Buy a package button. Active/grace/expired (age
  activate hoyeche) merchant-der ager motoi dekhay — renewal-e same key
  reuse hoy bole expired-der key dekhanoi thik.
- Verify/confirm/pay page age thekei pending-der jonno block chilo
  (`merchantBlocked`) — ekhon key na thakay SMS ingest-o pending
  obosthay 401 (app key nei bole).

## Test
- `npm test` — 52/52 pass (51 + 1 notun v2.2 test: signup-e key nei,
  pending-e app-key/api-key/regenerate 403, APK/zip no-token 401 +
  pending-token 403, approve-e `keysIssued: true` + key dekha jay +
  download 200).
- Ager pending-flow test notun niyome lekha: pending-e ingest 401,
  verify 401, pay page 404; approve-er por key niye ingest + verify kaj kore.
