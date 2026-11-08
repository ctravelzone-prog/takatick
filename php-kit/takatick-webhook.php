<?php
// ============================================================
// TakaTick — Plug & Play Webhook Receiver (PHP)
// FILE 2 of 2 — sudhu ei 2-ta file-i lagbe, ar kichu na
// ============================================================
// KOTHAI RAKHBEN:
//   Apnar PHP site-er folder-e:  takatick-webhook.php
//   (je kono PHP hosting-e cholbe — shared/cPanel, Laravel-er
//   public/ folder-eo cholbe)
//
// KI KORTE HOBE (sudhu 3-ta step):
//   1) Niche TAKATICK_WEBHOOK_SECRET-er jaygay dashboard theke webhook
//      secret bosan.
//      (TakaTick dashboard → "Keys & pay link" → Show webhook secret)
//   2) TakaTick dashboard-e (Settings → webhook URL) bosan:
//        https://apnar-site.com/takatick-webhook.php
//   3) Niche markOrderPaid() function-er vitore TODO jaygay apnar order
//      PAID korar code likhun. Prottek site-er database alada, tai oi
//      ekta jayga sudhu apnar moto kore likhte hobe — baki sob ready.
//
// TARPOR KI HOBE:
//   Payment confirm holei TakaTick ei file-e janabe (payment.confirmed),
//   file signature check kore (fake webhook dhora pore jabe) apnar
//   markOrderPaid() chalabe — order auto paid hoye jabe.
//   ⚠️ API key ekhane lage na — webhook secret-i enough.
// ============================================================

define('TAKATICK_WEBHOOK_SECRET', 'XXXX'); // 👉 EKHANE APNAR WEBHOOK SECRET BOSAN

// 👉 TODO: ekhane apnar order PAID korar code likhun.
// $payload theke paben: $payload['order_id'], $payload['amount'] (taka),
// $payload['transactionId'] (TrxID), $payload['method'].
// Example (apnar database onujayi bodle nin):
//   $db->query("UPDATE orders SET status='paid' WHERE id='" . $db->real_escape_string($payload['order_id']) . "'");
function markOrderPaid(array $payload) {
    error_log('[TakaTick] payment confirmed: ' . ($payload['order_id'] ?? '') . ' ' . ($payload['amount'] ?? '') . ' ' . ($payload['transactionId'] ?? ''));
    // TODO: apnar database-e order paid korun
}

// TakaTick webhook-er signature check — HMAC-SHA256, header X-Signature.
// Raw body diyei check korte hoy (JSON parse kore abar encode korle
// signature milbe na), tai php://input theke raw body newa hoyeche.
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$expected = hash_hmac('sha256', $rawBody, TAKATICK_WEBHOOK_SECRET);

if ($signature === '' || !hash_equals($expected, $signature)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'BAD_SIGNATURE']);
    exit;
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'BAD_JSON']);
    exit;
}

if (($payload['event'] ?? '') === 'payment.confirmed') {
    markOrderPaid($payload);
}

http_response_code(200);
echo json_encode(['ok' => true, 'received' => true]);
