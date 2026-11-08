<?php
/**
 * TakaTick WooCommerce gateway — customer-ke hosted payment page-e pathay,
 * TakaTick verify + confirm kore, webhook-e order paid hoy.
 * Kokhono redirect theke order paid mark kora hoy na (Golden Rule) —
 * order paid hoy shudhu signed webhook-e (takatick-gateway.php) ba
 * thankyou page-er server-side re-check-e.
 */

defined( 'ABSPATH' ) || exit;

class WC_Gateway_TakaTick extends WC_Payment_Gateway {

	public function __construct() {
		$this->id                 = 'takatick';
		$this->icon               = '';
		$this->has_fields         = false;
		$this->method_title       = 'TakaTick (bKash / Nagad / Rocket / Upay)';
		$this->method_description = 'Customer apnar personal bKash, Nagad, Rocket ba Upay number-e pay korbe — TakaTick TrxID verify kore order auto paid korbe. Taka kokhono TakaTick-er kache jay na.';

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title', 'bKash / Nagad / Rocket / Upay (TakaTick)' );
		$this->description = $this->get_option( 'description', 'Pay korun bKash, Nagad, Rocket ba Upay-te — payment auto verify hobe.' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		// Thankyou page-e order ekhono on-hold thakle verify-status dekhano.
		add_action( 'woocommerce_thankyou_' . $this->id, array( $this, 'thankyou_verify_note' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'        => array(
				'title'   => 'Enable / Disable',
				'type'    => 'checkbox',
				'label'   => 'TakaTick payment chalu korun',
				'default' => 'yes',
			),
			'title'          => array(
				'title'       => 'Title',
				'type'        => 'text',
				'description' => 'Checkout-e customer ja dekhbe.',
				'default'     => 'bKash / Nagad / Rocket / Upay (TakaTick)',
			),
			'description'    => array(
				'title'       => 'Description',
				'type'        => 'textarea',
				'description' => 'Checkout-e title-er niche ja dekhabe.',
				'default'     => 'Pay korun bKash, Nagad, Rocket ba Upay-te — payment auto verify hobe.',
			),
			'base_url'       => array(
				'title'       => 'TakaTick server URL',
				'type'        => 'text',
				'description' => 'Apnar TakaTick server-er address, jemon https://pay.apnar-domain.com — seshe / diben na.',
				'default'     => '',
			),
			'api_key'        => array(
				'title'       => 'API key',
				'type'        => 'password',
				'description' => 'TakaTick dashboard theke neoa apiKey. Kokhono public jaygay share korben na.',
				'default'     => '',
			),
			'pay_key'        => array(
				'title'       => 'Pay key',
				'type'        => 'password',
				'description' => 'TakaTick dashboard theke neoa payKey — hosted payment link-er jonno.',
				'default'     => '',
			),
			'webhook_secret' => array(
				'title'       => 'Webhook secret',
				'type'        => 'password',
				'description' => 'TakaTick dashboard theke neoa webhookSecret — webhook signature check-er jonno. Ei secret TakaTick dashboard-er Settings-eo boshan.',
				'default'     => '',
			),
		);
	}

	/**
	 * Checkout-e "Place order" chaple: order on-hold kore hosted payment
	 * page-e redirect korun. TakaTick oikhanei verify + confirm korbe,
	 * ar webhook-e order paid hobe.
	 */
	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );

		if ( 'BDT' !== $order->get_currency() ) {
			wc_add_notice( 'TakaTick shudhu BDT (taka) payment support kore.', 'error' );
			return array( 'result' => 'failure' );
		}

		$base_url = rtrim( $this->get_option( 'base_url' ), '/' );
		$pay_key  = $this->get_option( 'pay_key' );
		if ( '' === $base_url || '' === $pay_key ) {
			wc_add_notice( 'TakaTick setup incomplete — dokan malik-er sathe jogajog korun.', 'error' );
			return array( 'result' => 'failure' );
		}

		$amount = $order->get_total();

		$pay_url = add_query_arg(
			array(
				'amount'   => $amount,
				'order_id' => $order->get_id(),
			),
			$base_url . '/pay/' . rawurlencode( $pay_key )
		);

		$order->update_status( 'on-hold', 'TakaTick payment-er opekkhay — customer hosted page-e pay korche.' );

		return array(
			'result'   => 'success',
			'redirect' => $pay_url,
		);
	}

	/**
	 * Thankyou page: order ekhono paid na hole customer-ke janano je
	 * verification cholche — webhook aslei order paid hobe.
	 */
	public function thankyou_verify_note( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order && ! $order->is_paid() ) {
			echo '<p><strong>TakaTick:</strong> Apnar payment verify hocche — SMS server-e asha matroi order confirm hobe. Ektu wait korun, ar TrxID thik moto diyechen kina check korun.</p>';
		}
	}
}
