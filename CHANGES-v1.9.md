# TakaTick v1.9 — unique plan-choose cards (Step 2)

Siam-er screenshot feedback: enroll wizard-er Step 2 "Choose your plan" chilo plain
stacked radio row (choto circle + naam + ek line limits) — aro sundor + unique korte
hobe. Shudhu Step 2 redesign kora hoyeche; Step 1, Step 3, pricing section, header/nav,
onno kono page touch kora hoyni.

## Ki bodleche (`public/index.html` — shudhu Step 2)

- **3-card plan picker:** desktop-e 3 card ek row-e (Basic → Standard → Premium),
  mobile-e stacked. Enroll box Step 2-te `wide` hoy (max-width 980px), onno step-e
  ager 560px-i thake.
- **Prottek card-e:** plan naam, BORO price (৳300/mo), "per month" choto line,
  divider, ✓ feature line (MFS numbers, Websites, Verifications), method gulo
  choto teal chip (bKash / Nagad / Rocket / Upay), Webhook / WooCommerce plugin /
  Priority support — thakle ✓, na thakle muted "—".
- **Premium featured:** dark navy background + teal accent, ektu lomba (upore tola),
  upore "★ Most Popular" ribbon.
- **Selection:** puro card clickable; selected card-e teal ring + soft glow +
  upore dan dike "✓ Selected" badge; unselected card sada + halka border, hover-e
  ektu uthe.
- **Radio input DOM-ei ache** (visually hidden, `name="plan"`) — ager selection
  logic (`selectedPackage`, `onchange` → `renderPlanOptions();updatePayStep();`)
  ekdom ager motoi kaj kore. Pre-selection-o ager motoi (pricing theke je plan
  choose kora hoyeche setai selected thake) — sudhu layout bodleche.
- Card order fixed: Basic → Standard → Premium (API alphabetical order —
  basic, premium, standard — er upor nirbhor kore na).

## Test

- `npm test`: **48/48 pass** (v1.8-er 47 + 1 notun v1.9 test: 3-card picker,
  Premium featured + Most Popular badge, hidden radio `name="plan"`, card order,
  wizard contract intact).
- Local smoke (`/tmp/takatick-v19-smoke.js`): **24/24 pass** — asol landing
  script DOM stub diye chaliye `renderPlanOptions()`-er output verify kora:
  card order, Premium featured + ribbon, Selected badge + checked radio shudhu
  ektai, Basic select korle badge sore jay kintu Premium featured-i thake,
  chip + feature line, onchange contract.

## Deploy

GitHub main-e push kora (commit `TakaTick v1.9 — unique plan-choose cards`).
Render-e manual deploy korte hobe (auto-deploy OFF) — ager moto dashboard theke
Manual Deploy → Deploy latest commit. Live verify: Choose plan → Step 2-te
3-ta card dekhabe, Premium navy + Most Popular, click korle Selected badge asbe.
