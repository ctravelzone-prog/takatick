TakaTick — Next.js Kit (Must Read)
====================================
Vitorer file 2-ta:
1) TakaTickPayButton.tsx
2) takatick-webhook-route.ts

KOTHAI DIBEN:
- TakaTickPayButton.tsx → apnar site-er components/ folder-e
- takatick-webhook-route.ts → apnar site-er app/api/takatick-webhook/route.ts naam-e rakhun

KEY KOTHAI BOSABEN:
- TakaTickPayButton.tsx-er upore TAKATICK_PAY_KEY-er jaygay dashboard theke pay key bosan
  (Dashboard → Keys & pay link → pay link-er /pay/-er porer ongsho)
- takatick-webhook-route.ts-er upore TAKATICK_WEBHOOK_SECRET-er jaygay dashboard theke webhook secret bosan
  (Dashboard → Keys & pay link → Show webhook secret)

WEBHOOK URL:
- TakaTick dashboard-e (Settings → webhook URL) bosan:
  https://apnar-site.com/api/takatick-webhook

CHECKOUT-E BUTTON:
- <TakaTickPayButton amount={total} orderId={order.id} />
- amount = TAKA-y (jemon 1500)

ORDER PAID:
- takatick-webhook-route.ts-er markOrderPaid() function-er TODO jaygay apnar order paid korar code likhun.
- Payment confirm holei TakaTick webhook pathabe, ar apnar order auto paid hobe.
