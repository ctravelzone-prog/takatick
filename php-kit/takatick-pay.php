<?php
// ============================================================
// TakaTick — Plug & Play Checkout Redirect (PHP)
// FILE 1 of 2 — sudhu ei 2-ta file-i lagbe, ar kichu na
// ============================================================
// KOTHAI RAKHBEN:
//   Apnar PHP site-er folder-e:  takatick-pay.php
//   (je kono PHP hosting-e cholbe — shared/cPanel, Laravel-er
//   public/ folder-eo cholbe)
//
// KI KORTE HOBE (sudhu 2-ta step):
//   1) Niche TAKATICK_PAY_KEY-er jaygay dashboard theke pay key bosan.
//      (TakaTick dashboard → "Keys & pay link" → pay link-er /pay/-er
//      porer ongsho tai pay key, jemon: pay_09e2d6183c70f810e57ffba56bc37852)
//   2) Checkout page-er Pay button/link theke customer-ke pathan:
//        takatick-pay.php?amount=1500&order_id=ORD-123
//      amount = TAKA-y (jemon ৳1500 hole amount=1500)
//      order_id = apnar order-er ID
//      Example link (apnar checkout page-e):
//        <a href="takatick-pay.php?amount=1500&order_id=ORD-123">bKash / Nagad / Rocket / Upay diye Pay korun</a>
//
// TARPOR KI HOBE:
//   Customer TakaTick pay page-e jabe, bKash/Nagad/Rocket/Upay diye pay
//   kore TrxID verify korbe. Payment confirm hole FILE 2 (webhook)
//   apnar order paid mark korbe.
// ============================================================

define('TAKATICK_PAY_KEY', 'pay_XXXX'); // 👉 EKHANE APNAR PAY KEY BOSAN
define('TAKATICK_PAY_URL', 'https://takatick.onrender.com');

// Pay link banay — amount TAKA-y, order_id apnar order-er ID.
function takatick_pay_url($amount, $orderId) {
    return TAKATICK_PAY_URL . '/pay/' . TAKATICK_PAY_KEY
        . '?amount=' . urlencode((string) $amount)
        . '&order_id=' . urlencode((string) $orderId);
}

$amount = $_GET['amount'] ?? '';
$orderId = $_GET['order_id'] ?? '';

if (!is_numeric($amount) || (float) $amount <= 0 || $orderId === '') {
    http_response_code(400);
    echo 'Payment failed — sothik amount ar order_id din.';
    exit;
}

header('Location: ' . takatick_pay_url($amount, $orderId));
exit;
