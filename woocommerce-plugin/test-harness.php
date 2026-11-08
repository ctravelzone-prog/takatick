<?php
/**
 * TakaTick WooCommerce plugin — WP/WC stub test harness (CLI only).
 *
 * Asol WordPress + WooCommerce charai plugin-er code path-gulo test kore:
 * gateway register, process_payment (BDT / non-BDT / missing settings),
 * thankyou note, ar webhook handler (signature, idempotency, amount match).
 *
 * Run:  php woocommerce-plugin/test-harness.php
 * Exit: 0 = sob pass, 1 = kono fail.
 *
 * NOTE: eta asol WordPress test na — webhook/redirect logic-er test.
 * Asol WP site-e install kore ekta test order diye check kora ekhono baki.
 */

if (PHP_SAPI !== 'cli') {
	exit("CLI only\n");
}

require_once __DIR__ . '/test-stubs.php';

// Plugin load korun (add_action register hobe).
require_once __DIR__ . '/takatick-gateway.php';

// ---------------------------------------------------------------------------
// Parent mode: gateway checks + webhook sub-process spawn.
// ---------------------------------------------------------------------------
$passed = 0;
$failed = 0;
function check($name, $ok, $detail = '') {
	global $passed, $failed;
	if ($ok) { $passed++; echo "PASS: $name\n"; }
	else { $failed++; echo "FAIL: $name" . ($detail ? " — $detail" : '') . "\n"; }
}

// G1: plugins_loaded-e gateway class load + filter-e add hoy.
foreach (($GLOBALS['wp_actions']['plugins_loaded'] ?? []) as $cb) { $cb(); }
check('G1 gateway class loads on plugins_loaded', class_exists('WC_Gateway_TakaTick'));
$methods = [];
foreach (($GLOBALS['wp_filters']['woocommerce_payment_gateways'] ?? []) as $cb) { $methods = $cb($methods); }
check('G1 gateway added to payment methods', in_array('WC_Gateway_TakaTick', $methods, true));

// G2: settings + form fields.
$GLOBALS['FAKE_GATEWAY_SETTINGS'] = [
	'enabled' => 'yes', 'title' => 'bKash / Nagad / Rocket / Upay (TakaTick)',
	'description' => 'Pay korun', 'base_url' => 'https://pay.example.com',
	'api_key' => 'sk_live_test', 'pay_key' => 'payKey123', 'webhook_secret' => 'test-webhook-secret',
];
$gw = new WC_Gateway_TakaTick();
check('G2 gateway id = takatick', $gw->id === 'takatick');
$need = ['enabled', 'title', 'description', 'base_url', 'api_key', 'pay_key', 'webhook_secret'];
$missing = array_diff($need, array_keys($gw->form_fields));
check('G2 all 7 settings fields present', empty($missing), 'missing: ' . implode(',', $missing));

// G3: BDT order -> success + pay URL + on-hold.
$o101 = new FakeOrder(101, 1000, 'BDT');
$GLOBALS['FAKE_ORDERS'][101] = $o101;
$r = $gw->process_payment(101);
check('G3 BDT process_payment success', ($r['result'] ?? '') === 'success', json_encode($r));
check('G3 redirect = hosted pay URL', str_contains($r['redirect'] ?? '', 'https://pay.example.com/pay/payKey123')
	&& str_contains($r['redirect'] ?? '', 'amount=1000') && str_contains($r['redirect'] ?? '', 'order_id=101'), $r['redirect'] ?? '');
check('G3 order on-hold', $o101->status === 'on-hold', $o101->status);

// G4: non-BDT -> failure + error notice.
$o102 = new FakeOrder(102, 50, 'USD');
$GLOBALS['FAKE_ORDERS'][102] = $o102;
$GLOBALS['LAST_NOTICE'] = null;
$r = $gw->process_payment(102);
check('G4 non-BDT process_payment failure', ($r['result'] ?? '') === 'failure');
check('G4 non-BDT error notice', ($GLOBALS['LAST_NOTICE'][1] ?? '') === 'error');

// G5: pay_key missing -> failure.
$GLOBALS['FAKE_GATEWAY_SETTINGS']['pay_key'] = '';
$gw2 = new WC_Gateway_TakaTick();
$o103 = new FakeOrder(103, 500, 'BDT');
$GLOBALS['FAKE_ORDERS'][103] = $o103;
$r = $gw2->process_payment(103);
check('G5 missing pay_key failure', ($r['result'] ?? '') === 'failure');
$GLOBALS['FAKE_GATEWAY_SETTINGS']['pay_key'] = 'payKey123';

// G6: thankyou note — unpaid-e dekhay, paid-e dekhay na.
ob_start(); $gw->thankyou_verify_note(101); $outUnpaid = ob_get_clean();
$o101->payment_complete('TRX1');
ob_start(); $gw->thankyou_verify_note(101); $outPaid = ob_get_clean();
check('G6 thankyou note on unpaid order', str_contains($outUnpaid, 'verify hocche'), $outUnpaid);
check('G6 thankyou note hidden on paid order', trim($outPaid) === '', $outPaid);

// Webhook tests over real HTTP (php -S) — CLI php://input is always empty,
// so the handler must be exercised through a real POST (see test-webhook-http.php).
$httpOut = shell_exec('php ' . escapeshellarg(__DIR__ . '/test-webhook-http.php') . ' 2>&1');
foreach (explode("\n", trim($httpOut ?? '')) as $line) {
	if (str_starts_with($line, 'PASS:')) { $passed++; echo $line . "\n"; }
	elseif (str_starts_with($line, 'FAIL:')) { $failed++; echo $line . "\n"; }
	elseif (str_starts_with($line, 'HTTP-WEBHOOK:')) { echo $line . "\n"; }
}

echo "\n$passed passed, $failed failed.\n";
exit($failed === 0 ? 0 : 1);
