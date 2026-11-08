# CHANGES — v2.9.1 (seller bKash number change)

Siam-er nirdesh (9 Nov ~12:37 AM): package-er taka ekhon **01883042132** number-e asbe — 01740707570 (iPhone number) bKash off, tai oi number-e taka pathale Siam pabe na. Ager number-e jara already pay koreche tader order-e kono effect nei (TrxID + amount match-e verify hoy, seller number match hoy na).

## Ki bodlo

- **Seller bKash number: 01740707570 → 01883042132** — ek jayga theke control hoy:
  - `server.js`: fallback default bodleche (`SELLER_BKASH_NUMBER` env na thakle ei number-i use hoy).
  - Render env var `SELLER_BKASH_NUMBER` — dashboard theke `01883042132` korte hobe (deploy-er somoy).
- Enroll page (`/enroll.html`) ekhon **01883042132** dekhay — Copy button, order page, README, INTEGRATION.md — sob jaygay notun number.
- Auto-approve-er jonno eitai bhalo: 01883042132 holo app-er phone — payment SMS oi phone-e aslei app forward korbe, server TrxID + exact amount miliye order nije theke approve kore dibe।

## Deploy note

- Render-e env var bodlate hobe: `SELLER_BKASH_NUMBER=01883042132` (auto-deploy OFF, manual deploy).
- ⚠️ Free-tier DB ephemeral — prottek deploy-e sob account muche jay; deploy-er por demo account (diag-v28) + Siam-er Md Siam account abar banate hobe, app-e notun app key bosate hobe।

## Tests

- `test/storefront.test.js`: seller number constant + enroll-page assertion notun number-e update (73/73 pass)।
