# TakaTick v2.2.2 — Webhook secret dashboard-e

Siam-er proshno ("kothay kon key pabe?") theke dhora porlo: webhook secret
ekhon dashboard-e kothao dekha jeto na — sudhu database-e thakto. Kintu
WooCommerce plugin-er setting-e ei secret-ta lage, tai merchant-er pawar
upay chilo na.

## Ki bodleche
- `server.js` — notun endpoint `GET /api/me/webhook-secret` (auth + ager
  key endpoint-gulor motoi `merchantBlocked` gate: pending/expired hole 403).
  Profile response-e notun field `webhookSecretMasked` — blocked merchant-er
  khetre `null` (secret signup-e toiri hoy, tai mask-tao gate kora hoyeche).
- `public/dashboard.html` — Keys card-e "Webhook secret: `xxxxxxxx...xxxx`"
  line + "Show webhook secret" button (click korle puro 64-hex secret dekhay,
  API/app key-er motoi). Button-ta prothom paint-e lukano thake (v2.2.1-er
  niyom), sudhu active merchant-er khetrei dekhay.

## Test
- `npm test` — 54/54 pass (53 + 1 notun: pending-e profile null + endpoint
  403, approve-er por mask thik + 64-hex secret + dashboard-e button ache).
