TakaTick — PHP Kit (Must Read)
====================================
Vitorer file 2-ta:
1) takatick-pay.php
2) takatick-webhook.php

KOTHAI DIBEN:
- 2-ta file-i apnar site-er root folder-e rakhun (public_html / public/)
- Laravel hole public/ folder-e rakhun

KEY KOTHAI BOSABEN:
- takatick-pay.php-er upore TAKATICK_PAY_KEY-er jaygay dashboard theke pay key bosan
  (Dashboard → Keys & pay link → pay link-er /pay/-er porer ongsho)
- takatick-webhook.php-er upore TAKATICK_WEBHOOK_SECRET-er jaygay dashboard theke webhook secret bosan
  (Dashboard → Keys & pay link → Show webhook secret)

CHECKOUT LINK:
- <a href="takatick-pay.php?amount=1500&order_id=ORD-123">Pay korun</a>
- amount = TAKA-y (jemon 1500)

WEBHOOK URL:
- TakaTick dashboard-e (Settings → webhook URL) bosan:
  https://apnar-site.com/takatick-webhook.php

ORDER PAID:
- takatick-webhook.php-er markOrderPaid() function-er TODO jaygay apnar order paid korar code likhun.
- Payment confirm holei TakaTick webhook pathabe, ar apnar order auto paid hobe.
