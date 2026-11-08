# TakaTick v2.9 — auto-approve (dogfooding)

## Ki bodleche
- Storefront order ekhon nije theke approve hoy: customer bKash Send Money kore (seller number 01740707570-te), payment SMS seller-er phone-e aslei server TrxID + exact amount miliye order approve kore dey — admin-er kichu korte hoy na।
- Shared `approveOrder(order, decidedBy)` helper — admin-approve route ekhon etai dake (ager behavior/response/guard ekdom eki); auto-approve-o eki helper dake (`decided_by='auto'`)।
- Matcher chole 3 jaygay: (a) SMS ingest `POST /api/sms` — notun SMS insert-er por; (b) order create `POST /api/me/orders` — SMS age eshe thakle order toiri howar sathe sathe approve (201 + `autoApproved: true`); (c) paste fallback `POST /api/me/sms-paste` — eki niyom। Ingest response-e auto-approve hole `autoApproved: true` + `orderId` thake।
- Match = TrxID + exact amount SUDHU (sender milano hoy na), ar GLOBAL — SMS seller-er app key diye asleo paying customer onno merchant holeo mile। Match hole SMS row `status='used'` hoy (verify/confirm-e ar use hobe na), tarpor approve।
- `public/enroll.html`: order response-e `autoApproved:true` (ba order approved) thakle pending message-er bodle success dekhay — "payment verified! Package active hoye geche (30 din)"।

## Chicken-and-egg
- Prothom order-e ekhono manual admin approval lage — oi approval-ei merchant app key pay (key chara phone-e app setup kora jay na)। Tarpor theke sob order automatic।

## Ki bodlay ni
- Order validation (package, TrxID, sender BD mobile, exact amount, duplicate TrxID → 409), verify/confirm flow, webhook, expiry/grace, admin panel, dashboard — sob ager motoi।

## Buyer copy (owner's rule)
- Buyer jeno system-ta kivabe kaj kore bujhte na pare: enroll-er pending/success copy sudhu plain buyer language — "payment verify hocche" / "payment confirm hoyeche, package active" — SMS, phone app, server matching, auto-approve, TrxID+amount rule-er kono ullekh nei (page-er JS comment-eo nei — served file-er comment buyer view-source-e dekhte pay)।
- Order error-e API code bodlay ni, kintu buyer-ke raw code (`AMOUNT_MISMATCH`, `DUPLICATE_TRXID`...) ar dekhano hoy na — `FRIENDLY_ERRORS` map-e generic friendly Banglish dekhay (map-er key code, value sudhu buyer-ke ki korte hobe)।
- v2.9-e buyer-facing kothao mechanism-er kono explanation jog hoy ni। Test-e guard ache: enroll.html-e 'Admin'/'SMS'/'payment verified'/raw-code display thakle test fail kore।
- Landing page-eo (hero, How-it-works, FAQ) mechanism-er bhasha sorano hoyeche — 'forwarded SMS', 'TrxID + exact amount', 'manual approval', 'Admin approves', 'reads the payment SMS', raw code `ALREADY_USED` ar nei; 'Who approves my package' FAQ ekhon plain language-e ('Payment confirm howar sathe sathe package active'), ar stale 'manual' dabio nei। Test-e guard ache: landing-e oi shobdo thakle test fail kore।

## Tests
- 8-ta notun test (73/73 pass): SMS pore asle approve + SMS used; SMS age asle order toiri howar sathe sathe approve; vul amount-e pending thake; ochena TrxID-e kichu approve hoy na, SMS received thake; paste-eo auto-approve; admin approve ager motoi kaj kore (409 ORDER_ALREADY_DECIDED soho); buyer-copy guard (enroll + landing)!

## Deploy note
- Deploy-e Render-er ephemeral DB muche jay (ager motoi) — demo account notun kore banate hobe, app key bodle jabe, app-e notun key bosate hobe।
