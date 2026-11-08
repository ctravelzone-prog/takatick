# CHANGES — v2.9.2 (admin-editable seller bKash number)

Siam-er nirdesh (9 Nov ~12:36 AM): "admin theke ami edit korte pari na kn, setting ta amr jonno editable kore dew admin e" — seller bKash number ekhon admin panel thekei change kora jay, Render dashboard-e jete hoy na, deploy-o lage na.

## Ki bodlo

- **Admin → Settings section-e ekhon editable field:** Seller bKash number (input + Save + "Reset to env") — sathe source dekhay: `admin panel theke set` / `Render env var theke` / `default`।
- **Notun API (master admin only):**
  - `GET /api/admin/settings` → `{ sellerBkash, sellerBkashSource }`
  - `POST /api/admin/settings` `{ sellerBkash }` → save kore, sathe sathe enroll page + `/api/public/pricing`-e notun number dekhay। Khali string pathale DB override muche jay (Reset)।
- **Validation:** number 11 digit, `01` diye shuru hote hobe (`/^01[3-9]\d{8}$/`) — na hole `400 INVALID_NUMBER`, ager value bodlay na।
- **Precedence:** DB (admin panel) > Render env `SELLER_BKASH_NUMBER` > fallback `01883042132` (v2.9.1)।
- **Deploy note:** free-tier DB ephemeral — deploy-er por DB muche gele env-er number-ta abar karjokor hobe; admin panel theke abar save korlei hobe।

## Tests

- `test/api.test.js`: notun test — no-token 401, invalid number 400 (value unchanged), valid change enroll + pricing-e sathe sathe reflect, reset-e ager value-e fire asa (74/74 pass)।
