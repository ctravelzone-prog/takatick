<?php
/**
 * TakaTick webhook tests over real HTTP (php -S + curl).
 *
 * CLI php://input is always empty, so the webhook handler (which reads
 * php://input) can only be tested through a real POST. This script starts
 * a PHP built-in server with test-webhook-server.php as router, POSTs each
 * case with curl, and checks the response body + dumped state.
 *
 * Run:  php woocommerce-plugin/test-webhook-http.php
 * Exit: 0 = sob pass, 1 = kono fail. Called by test-harness.php too.
 */
if (PHP_SAPI !== 'cli') { exit("CLI only\n"); }

$dir  = __DIR__;
$port = 18765;
$base = "http://127.0.0.1:$port/";
$secret = 'test-webhook-secret';

$passed = 0;
$failed = 0;
function wcheck($name, $ok, $detail = '') {
	global $passed, $failed;
	if ($ok) { $passed++; echo "PASS: webhook: $name\n"; }
	else { $failed++; echo "FAIL: webhook: $name" . ($detail ? " — $detail" : '') . "\n"; }
}

// Start dev server.
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", 'test-webhook-server.php'], $descriptors, $pipes, $dir);
if (!is_resource($proc)) { echo "FAIL: webhook: could not start php -S\n"; exit(1); }
$ready = false;
for ($i = 0; $i < 50; $i++) {
	$fp = @fsockopen('127.0.0.1', $port, $e, $s, 0.2);
	if ($fp) { fclose($fp); $ready = true; break; }
	usleep(100000);
}
if (!$ready) {
	echo "FAIL: webhook: dev server did not start\n";
	proc_terminate($proc); proc_close($proc); exit(1);
}

function run_case($name, $payload, $scenario, $sigOverride = null) {
	global $base, $secret;
	file_put_contents('/tmp/wc-scenario.json', json_encode($scenario));
	@unlink('/tmp/wc-state.json');
	$body = json_encode($payload);
	$sig  = $sigOverride ?? hash_hmac('sha256', $body, $secret);
	$cmd  = 'curl -s -X POST'
		. ' -H ' . escapeshellarg('X-Signature: ' . $sig)
		. ' -H ' . escapeshellarg('Content-Type: application/json')
		. ' --data ' . escapeshellarg($body)
		. ' ' . escapeshellarg($base);
	$resp = shell_exec($cmd);
	$state = json_decode(@file_get_contents('/tmp/wc-state.json'), true);
	return ['body' => trim($resp ?? ''), 'state' => $state];
}

function order_state($r, $id) {
	return ($r['state']['orders'][(string) $id] ?? $r['state']['orders'][$id] ?? null);
}
function notes_contain($r, $id, $needle) {
	$o = order_state($r, $id);
	if (!$o) { return false; }
	foreach (($o['notes'] ?? []) as $n) {
		if (stripos($n, $needle) !== false) { return true; }
	}
	return false;
}

// 1. valid — paid hoy, note-e TrxID.
$r = run_case('valid',
	['event' => 'payment.confirmed', 'order_id' => 201, 'transactionId' => 'TRX1', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000]]]);
$o = order_state($r, 201);
wcheck('valid', $r['body'] === 'OK' && ($r['state']['http_status'] ?? null) === 200
	&& ($o['paid'] ?? false) === true && ($o['txn'] ?? '') === 'TRX1'
	&& notes_contain($r, 201, 'TrxID: TRX1'),
	'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 2. bad signature — 401, paid hoy na.
$r = run_case('bad-signature',
	['event' => 'payment.confirmed', 'order_id' => 201, 'transactionId' => 'TRX1', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000]]], 'deadbeef');
$o = order_state($r, 201);
wcheck('bad-signature', $r['body'] === 'Invalid signature' && ($r['state']['http_status'] ?? null) === 401
	&& ($o['paid'] ?? null) === false, 'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 3. missing secret — 500.
$r = run_case('missing-secret',
	['event' => 'payment.confirmed', 'order_id' => 201, 'transactionId' => 'TRX1', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'settings' => [], 'orders' => [['id' => 201, 'total' => 1000]]]);
$o = order_state($r, 201);
wcheck('missing-secret', ($r['state']['http_status'] ?? null) === 500 && ($o['paid'] ?? null) === false,
	'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 4. amount mismatch — 200, note hoy, paid hoy na.
$r = run_case('amount-mismatch',
	['event' => 'payment.confirmed', 'order_id' => 201, 'transactionId' => 'TRX2', 'method' => 'bkash', 'amount' => 999, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000]]]);
$o = order_state($r, 201);
wcheck('amount-mismatch', ($r['state']['http_status'] ?? null) === 200 && ($o['paid'] ?? null) === false
	&& notes_contain($r, 201, 'mismatch'), 'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 5. already paid — 200, txn bodlay na.
$r = run_case('already-paid',
	['event' => 'payment.confirmed', 'order_id' => 201, 'transactionId' => 'TRX9', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000, 'paid' => true, 'txn' => 'TRX-OLD']]]);
$o = order_state($r, 201);
wcheck('already-paid', ($r['state']['http_status'] ?? null) === 200 && ($o['paid'] ?? null) === true
	&& ($o['txn'] ?? '') === 'TRX-OLD', 'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 6. unknown order — 404.
$r = run_case('unknown-order',
	['event' => 'payment.confirmed', 'order_id' => 999, 'transactionId' => 'TRX1', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000]]]);
wcheck('unknown-order', ($r['state']['http_status'] ?? null) === 404, 'body=' . $r['body'] . ' state=' . json_encode($r['state']));

// 7. bad payload — 400.
$r = run_case('bad-payload',
	['event' => 'payment.failed', 'order_id' => 201, 'transactionId' => 'TRX1', 'method' => 'bkash', 'amount' => 1000, 'sender' => '01712345678'],
	['secret' => $secret, 'orders' => [['id' => 201, 'total' => 1000]]]);
$o = order_state($r, 201);
wcheck('bad-payload', ($r['state']['http_status'] ?? null) === 400 && ($o['paid'] ?? null) === false,
	'body=' . $r['body'] . ' state=' . json_encode($r['state']));

proc_terminate($proc);
proc_close($proc);

echo "HTTP-WEBHOOK: $passed passed, $failed failed.\n";
exit($failed === 0 ? 0 : 1);
