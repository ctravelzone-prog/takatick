<?php
/**
 * php -S router for TakaTick webhook tests (see test-webhook-http.php).
 *
 * Scenario per request from /tmp/wc-scenario.json:
 *   {"secret": "...", "settings": {"webhook_secret": "..."} | [],
 *    "orders": [{"id":201,"total":1000,"paid":false,"txn":null}]}
 * After the handler exits, state is dumped to /tmp/wc-state.json:
 *   {"http_status": 200, "orders": {"201": {"paid": true, "txn": "TRX1",
 *    "notes": [...], "status": "processing"}}}
 *
 * Run only via the test runner — never on a real site.
 */
require_once __DIR__ . '/test-stubs.php';
require_once __DIR__ . '/takatick-gateway.php';

$scenario = json_decode(@file_get_contents('/tmp/wc-scenario.json'), true);
if (!is_array($scenario)) { $scenario = []; }
$secret   = $scenario['secret'] ?? 'test-webhook-secret';
$settings = $scenario['settings'] ?? ['webhook_secret' => $secret];

$GLOBALS['FAKE_OPTIONS'] = ['woocommerce_takatick_settings' => $settings];
foreach (($scenario['orders'] ?? []) as $o) {
	$ord = new FakeOrder($o['id'], $o['total'], $o['currency'] ?? 'BDT');
	if (!empty($o['paid'])) { $ord->payment_complete($o['txn'] ?? ''); }
	$GLOBALS['FAKE_ORDERS'][$ord->get_id()] = $ord;
}

register_shutdown_function(function () {
	$orders = [];
	foreach (($GLOBALS['FAKE_ORDERS'] ?? []) as $id => $o) {
		$orders[$id] = [
			'paid'   => $o->is_paid(),
			'txn'    => $o->txn,
			'notes'  => $o->notes,
			'status' => $o->status,
		];
	}
	file_put_contents('/tmp/wc-state.json', json_encode([
		'http_status' => $GLOBALS['LAST_STATUS'],
		'orders'      => $orders,
	]));
});

takatick_webhook_handler();
