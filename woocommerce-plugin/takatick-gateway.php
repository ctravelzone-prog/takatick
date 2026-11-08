<?php
/**
 * Plugin Name: TakaTick Payment Gateway
 * Plugin URI: https://takatick.example
 * Description: Accept bKash, Nagad, Rocket and Upay on your WooCommerce store with automatic TrxID verification via TakaTick. Money goes to YOUR personal number — TakaTick only verifies.
 * Version: 1.0.0
 * Author: TakaTick
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.0
 * Text Domain: takatick
 *
 * Install: WordPress admin -> Plugins -> Add New -> Upload Plugin -> ei folder-er zip
 * upload korun, Activate korun, tarpor WooCommerce -> Settings -> Payments ->
 * TakaTick-e apnar API key, payKey, server URL ar webhook secret boshan.
 * Webhook URL (TakaTick dashboard-er Settings-e boshan):
 *   https://apnar-site.com/?wc-api=takatick
 */

defined( 'ABSPATH' ) || exit;

// Gateway class load korun.
add_action( 'plugins_loaded', 'takatick_init_gateway' );
function takatick_init_gateway() {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		return;
	}
	require_once __DIR__ . '/class-wc-gateway-takatick.php';
	add_filter( 'woocommerce_payment_gateways', 'takatick_add_gateway' );
}

function takatick_add_gateway( $methods ) {
	$methods[] = 'WC_Gateway_TakaTick';
	return $methods;
}

// TakaTick theke asa webhook (payment.confirmed) ekhane asbe:
// POST https://apnar-site.com/?wc-api=takatick  (header: X-Signature)
add_action( 'woocommerce_api_takatick', 'takatick_webhook_handler' );
function takatick_webhook_handler() {
	$raw_body  = file_get_contents( 'php://input' );
	$signature = isset( $_SERVER['HTTP_X_SIGNATURE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_SIGNATURE'] ) ) : '';

	// Webhook secret gateway settings theke nin.
	$settings = get_option( 'woocommerce_takatick_settings', array() );
	$secret   = isset( $settings['webhook_secret'] ) ? $settings['webhook_secret'] : '';

	if ( '' === $secret ) {
		status_header( 500 );
		exit( 'TakaTick webhook secret not configured' );
	}

	// Signature check — na mille fake request, ignore korun.
	$expected = hash_hmac( 'sha256', $raw_body, $secret );
	if ( ! hash_equals( $expected, $signature ) ) {
		status_header( 401 );
		exit( 'Invalid signature' );
	}

	$data = json_decode( $raw_body, true );
	if ( empty( $data['order_id'] ) || 'payment.confirmed' !== ( $data['event'] ?? '' ) ) {
		status_header( 400 );
		exit( 'Bad payload' );
	}

	$order = wc_get_order( $data['order_id'] );
	if ( ! $order ) {
		status_header( 404 );
		exit( 'Order not found' );
	}

	// Idempotent: order age thekei paid hole abar paid mark korben na.
	if ( $order->is_paid() ) {
		status_header( 200 );
		exit( 'Already paid' );
	}

	// Amount miliye nin (1 taka kom/beshi holeo paid mark korben na).
	$order_total = (float) $order->get_total();
	$paid_amount = isset( $data['amount'] ) ? (float) $data['amount'] : 0;
	if ( abs( $order_total - $paid_amount ) > 0.009 ) {
		$order->add_order_note( 'TakaTick: amount mismatch — order ' . $order_total . ', paid ' . $paid_amount . '. Manual check korun.' );
		status_header( 200 );
		exit( 'Amount mismatch noted' );
	}

	$order->payment_complete( isset( $data['transactionId'] ) ? sanitize_text_field( $data['transactionId'] ) : '' );
	$order->add_order_note( sprintf(
		'TakaTick payment confirmed — Method: %s, TrxID: %s, Amount: %s, Sender: %s',
		isset( $data['method'] ) ? sanitize_text_field( $data['method'] ) : '',
		isset( $data['transactionId'] ) ? sanitize_text_field( $data['transactionId'] ) : '',
		$paid_amount,
		isset( $data['sender'] ) ? sanitize_text_field( $data['sender'] ) : ''
	) );

	status_header( 200 );
	exit( 'OK' );
}
