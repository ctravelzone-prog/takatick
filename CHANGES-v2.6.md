# TakaTick v2.6 — Kichu na kinle "No package yet" (Basic dekhabe na)

Siam-er report (screenshot): notun account khullei dashboard-e "Basic —
৳300/mo · Waiting for approval" dekhacchilo — kintu se kichui kene ni.

Karon: signup-er somoy package field-er default 'basic' — dashboard setai
package hisebe dekhacchilo, order ache kina na dekhei.

## Ki bodleche
- `server.js` — `/api/me/profile`-e notun field `waitingPackage`: pending
  order thakle oi order-er package, na thakle `null`.
- `public/dashboard.html` — package dekhanor niyom: pending + order ache →
  order-er plan + "Waiting for approval"; pending + order nei → "No
  package yet" (stat card + profile line — duitai); active/grace/expired/
  deactivated → ager motoi asol package.
- `public/index.html` — header profile chip-o eki niyom: order na thakle
  "No package • No package yet", order thakle order-er plan + "Waiting for
  approval". (Enroll-er optimistic chip ager motoi — okhane plan choose
  korai thake.)
- Admin panel bodlano hoy ni — okhane status "pending" + 0 order dekhei
  bojha jay kichu kena hoy ni.

## Test
- `npm test` — 61/61 pass (59 + 2 notun v2.6 test: order chara profile-e
  waitingPackage null, onno package-er order dile waiting package order-er
  tai hoy, approve-er por asol package hoy; dashboard/landing-e "No package
  yet" lekha ache).
