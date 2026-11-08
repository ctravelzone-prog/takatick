# CHANGES — v2.9.6 (ZiniPay-style two-step pay flow)

Siam-er nirdesh (9 Nov ~1:23 AM, 4-ta screenshot soho): "jokhon select korbe tokhon NOTUN PAGE open hoye number dekhabe — merchant jeitar jonno jei number diyeche tai dekhabe" — sample ZiniPay (secure.zinipay.com, Devine Store)। Ager v2.9.4-e eki page-e method bodle number dekhano hoto — eita bodle ZiniPay-er moto 2-step kora hoyeche।

## Ki bodlo

- **Hosted pay page (`/pay/<payKey>`) — Step 1 (method list):** store naam + amount + order, tarpor method card (logo + "Bkash SendMoney" / "Nagad SendMoney" ...) — sudhu merchant-er register kora method। Card-e click korle NOTUN page khole।
- **Method page (`/pay/<payKey>/<method>`) — Step 2 (notun page):** back link (← merchant naam), upore method logo + amount, holud note ("নোট: টাকা পাঠানোর ৫-১০ সেকেন্ড পর ভেরিফাই করবেন।"), tarpor METHOD-ER BRAND COLOR-er panel (bKash golapi #e2136e, Nagad lal #ed1c24, Rocket beguni #8c3494, Upay kalo) — vitore "ট্রানজেকশন আইডি দিন" input + Bangla INSTRUCTIONS (`*247#` / `*167#` / `*322#` / `*268#` dial, "Send Money", number + Copy, amount, Transaction ID) + niche boro **VERIFY TRANSACTION** button (brand color)। Form ager motoi `/pay/<payKey>/claim`-e jay (TrxID + amount match, method mismatch check, webhook)।
- **Enroll Step 3 + embed widget — eki 2-step:** method list → brand panel (Bangla instruction + number + Copy) + TrxID → submit/VERIFY। Enroll-er submit button-o method-er brand color-e hoy।
- Register na kora method-er page khulle 404 ("Method not available")।
- Tabs ("সব পদ্ধতি" / "মোবাইল ব্যাংকিং") rakha hoy ni — TakaTick-er sob method-i mobile banking, duita tab-e eki jinis ashto।

## Deploy note

- Kono notun env var lage na।
- ⚠️ Free-tier DB ephemeral — deploy-er por sob account muche jabe; demo + Md Siam + admin merchant abar banate hobe, app-e notun app key bosate hobe।

## Tests

- `test/api.test.js`: pay page list (card link, register na kora method nei, number list page-e nei) + method page (number, USSD, Bangla heading, VERIFY, brand color, unregistered 404) + v2.9.2 settings test ekhon pricing endpoint diye check kore (number ar enroll HTML-e baked thake na)।
- `test/storefront.test.js`: enroll HTML-e number na thakleo pricing theke ashe — oi 2-ta test pricing endpoint diye check kore; enroll-e detail view + back link ache।
- 80/80 pass।
