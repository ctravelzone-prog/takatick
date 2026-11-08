# TakaTick — v1.4 changes (2026-11-08)

## Landing page features section — pictures added
- Siam bolechilo features section-ta emoji icon diye valo lagche na — ekhon prottek card-e picture ache.
- 6-ta notun flat illustration (public/images/): feature-sms.png, feature-api.png,
  feature-paypage.png, feature-webhook.png, feature-woocommerce.png, feature-keys.png.
  - Consistent style: teal + dark navy, light background, text-free (generated text garbled hoy bole kono lekha nei).
  - 800×533 px, moat ~700 KB (original 1920×1280 theke downscale kora — page fast rakhar jonno).
- public/index.html: prottek feature card-er upore picture, title + text ager motoi ache (kono copy change hoyni).

## Verify kora
- `npm test`: 36/36 pass.
- Local server: landing 200 (6-ta image reference ache), 6-ta image-i 200, /api/health {"ok":true}.

## Ekhono baki (age thekei)
- Asol SMS wording (Rocket/Upay) real SMS diye check; WooCommerce plugin live WordPress test; APK asol phone-e test.
