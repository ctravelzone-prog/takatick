<?php
/**
 * Shared WP/WC stubs for the TakaTick plugin test tools.
 * Required by test-harness.php and test-webhook-server.php (php -S router).
 * CLI + built-in server only — never load this in real WordPress.
 */

// ---------------------------------------------------------------------------
// WordPress / WooCommerce stubs
// ---------------------------------------------------------------------------
define('ABSPATH', __DIR__ . '/');

$GLOBALS['wp_actions']  = [];
$GLOBALS['wp_filters']  = [];
$GLOBALS['FAKE_OPTIONS'] = [];
$GLOBALS['FAKE_ORDERS'] = [];
$GLOBALS['FAKE_GATEWAY_SETTINGS'] = [];
$GLOBALS['LAST_STATUS'] = null;
$GLOBALS['LAST_NOTICE'] = null;

function add_action($hook, $cb, $pri = 10, $n = 1) {
	$GLOBALS['wp_actions'][$hook][] = $cb;
}
function add_filter($hook, $cb, $pri = 10, $n = 1) {
	$GLOBALS['wp_filters'][$hook][] = $cb;
}
function get_option($k, $d = false) {
	return $GLOBALS['FAKE_OPTIONS'][$k] ?? $d;
}
function sanitize_text_field($s) {
	return is_string($s) ? trim(strip_tags($s)) : $s;
}
function wp_unslash($v) {
	return is_string($v) ? stripslashes($v) : $v;
}
function status_header($c) {
	$GLOBALS['LAST_STATUS'] = $c;
}
function wc_get_order($id) {
	return $GLOBALS['FAKE_ORDERS'][$id] ?? false;
}
function wc_add_notice($m, $t = 'notice') {
	$GLOBALS['LAST_NOTICE'] = [$m, $t];
}
function add_query_arg($args, $url) {
	$sep = strpos($url, '?') === false ? '?' : '&';
	return $url . $sep . http_build_query($args);
}

class FakeOrder {
	public $id;
	public $total;
	public $currency;
	public $paid = false;
	public $status = 'pending';
	public $notes = [];
	public $txn = null;

	public function __construct($id, $total, $currency = 'BDT') {
		$this->id       = $id;
		$this->total    = $total;
		$this->currency = $currency;
	}
	public function get_id() { return $this->id; }
	public function get_total() { return $this->total; }
	public function get_currency() { return $this->currency; }
	public function is_paid() { return $this->paid; }
	public function payment_complete($txn = '') {
		$this->paid   = true;
		$this->txn    = $txn;
		$this->status = 'processing';
		return true;
	}
	public function update_status($s, $note = '') {
		$this->status = $s;
		if ($note) { $this->notes[] = $note; }
	}
	public function add_order_note($n) { $this->notes[] = $n; }
}

class WC_Payment_Gateway {
	public $id;
	public $icon;
	public $has_fields;
	public $method_title;
	public $method_description;
	public $form_fields = [];
	public $settings = [];

	public function init_form_fields() {}
	public function init_settings() {
		$this->settings = $GLOBALS['FAKE_GATEWAY_SETTINGS'];
	}
	public function get_option($k, $d = '') {
		return $this->settings[$k] ?? $d;
	}
	public function process_admin_options() {}
}

