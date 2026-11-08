/* TakaTick embed checkout (v2.9.5) — paste this into any web page, no server
 * code needed on the merchant's side:
 *
 *   <div id="takatick-checkout" data-pay-key="pay_..."
 *        data-amount="750" data-order-id="ORD-123"
 *        data-success-url="https://yourstore.com/thank-you"></div>
 *   <script src="https://takatick.onrender.com/takatick-embed.js"></script>
 *
 * data-pay-key: your pay key (dashboard -> Pay link). Required.
 * data-amount: amount in BDT. If left out, the buyer types the amount.
 * data-order-id: your order id (optional — sent to the webhook).
 * data-success-url: where to send the buyer after a confirmed payment
 *   (optional — the order id + status are added to the URL).
 *
 * The widget loads your payment methods (logo + number) from TakaTick,
 * the buyer pays with their own bKash/Nagad/Rocket/Upay app, submits the
 * TrxID, and TakaTick verifies it automatically. The webhook
 * (payment.confirmed) still fires, so your server can mark the order paid.
 */
(function () {
  'use strict';
  var el = document.getElementById('takatick-checkout');
  if (!el) return;
  var base = 'https://takatick.onrender.com';
  try {
    var src = (document.currentScript && document.currentScript.src) || '';
    if (src) base = new URL(src).origin;
  } catch (_e) { /* keep default */ }
  var payKey = el.getAttribute('data-pay-key') || '';
  var amountAttr = el.getAttribute('data-amount') || '';
  var orderId = el.getAttribute('data-order-id') || '';
  var successUrl = el.getAttribute('data-success-url') || '';
  var LABELS = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', upay: 'Upay' };
  var FRIENDLY = {
    NOT_FOUND: 'This payment link is invalid.',
    PACKAGE_NOT_ACTIVE: 'This seller\u2019s package is waiting for approval. Please try again later.',
    PACKAGE_EXPIRED: 'This seller\u2019s package has expired. Please contact the seller to renew.',
    ACCOUNT_DEACTIVATED: 'This payment link is currently disabled. Please contact the seller.'
  };
  var methods = [];
  var selected = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function show(html) { el.innerHTML = css + '<div class="ttk">' + html + '</div>'; }
  var css = '<style>'
    + '.ttk{font-family:system-ui,-apple-system,sans-serif;color:#222;max-width:520px}'
    + '.ttk .ttk-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,.08)}'
    + '.ttk h3{margin:0 0 4px;font-size:20px}'
    + '.ttk .ttk-muted{color:#666;font-size:14px}'
    + '.ttk .ttk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin:12px 0}'
    + '.ttk .ttk-opt{border:2px solid #e5e5e5;border-radius:12px;padding:10px 6px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:#222}'
    + '.ttk .ttk-opt.ttk-sel{border-color:#0f766e;background:#f0fdfa}'
    + '.ttk .ttk-opt img{height:36px;max-width:90%;object-fit:contain}'
    + '.ttk .ttk-opt span{font-size:13px;font-weight:700}'
    + '.ttk .ttk-num{font-size:22px;font-weight:800;letter-spacing:1px;color:#0f766e}'
    + '.ttk .ttk-label{color:#666;font-size:13px}'
    + '.ttk button.ttk-copy{padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#111;color:#fff;cursor:pointer}'
    + '.ttk input{width:100%;padding:10px;margin:6px 0 12px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;font-size:15px}'
    + '.ttk label{font-size:14px;font-weight:600}'
    + '.ttk button.ttk-submit{width:100%;padding:12px;border-radius:8px;border:0;background:#0f766e;color:#fff;font-size:16px;font-weight:700;cursor:pointer}'
    + '.ttk .ttk-ok{background:#e9f7ee;border:1px solid #7cc79a;border-radius:8px;padding:12px;font-size:15px}'
    + '.ttk .ttk-err{background:#fdecea;border:1px solid #f5a9a0;border-radius:8px;padding:12px;font-size:15px}'
    + '</style>';

  function methodNumbers(m) {
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].method === m) return methods[i].numbers || [];
    }
    return [];
  }
  function render() {
    if (!methods.length) {
      show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">No payment numbers added yet. Please contact the seller.</p></div>');
      return;
    }
    if (!selected || !methodNumbers(selected).length) selected = methods[0].method;
    var opts = methods.map(function (m) {
      return '<button type="button" class="ttk-opt' + (m.method === selected ? ' ttk-sel' : '') + '" data-m="' + m.method + '">'
        + '<img src="' + base + '/mfs/' + m.method + '.png" alt="' + esc(LABELS[m.method] || m.method) + '">'
        + '<span>' + esc(LABELS[m.method] || m.method) + '</span></button>';
    }).join('');
    var nums = methodNumbers(selected).map(function (n) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee">'
        + '<div><span class="ttk-num">' + esc(n.number) + '</span>'
        + (n.label ? ' <span class="ttk-label">' + esc(n.label) + '</span>' : '') + '</div>'
        + '<button type="button" class="ttk-copy" data-copy="' + esc(n.number) + '">Copy</button></div>';
    }).join('');
    var amountRow = amountAttr
      ? '<p><strong>Amount:</strong> \u09f3' + esc(amountAttr) + '</p>'
      : '<label>Amount (\u09f3)</label><input id="ttk-amount" type="number" min="1" required placeholder="e.g. 750">';
    show('<div class="ttk-card"><h3>Pay with bKash / Nagad / Rocket / Upay</h3>'
      + '<p class="ttk-muted">Choose a method, send the exact amount to that number, then enter your TrxID.</p>'
      + '<div class="ttk-grid">' + opts + '</div>'
      + nums
      + '<form id="ttk-form">' + amountRow
      + '<label>TrxID (from your ' + esc(LABELS[selected] || selected) + ' payment)</label>'
      + '<input id="ttk-trxid" required placeholder="e.g. 9AB12CD34E">'
      + '<button type="submit" class="ttk-submit">I have paid \u2014 Confirm</button></form>'
      + '<div id="ttk-msg" style="margin-top:12px"></div>'
      + '<p class="ttk-muted">Money goes directly to the seller\u2019s own number. TakaTick only verifies the payment.</p></div>');
    el.querySelectorAll('.ttk-opt').forEach(function (b) {
      b.addEventListener('click', function () { selected = b.getAttribute('data-m'); render(); });
    });
    el.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute('data-copy'));
        b.textContent = 'Copied!';
      });
    });
    el.querySelector('#ttk-form').addEventListener('submit', submit);
  }
  function msg(html, ok) {
    var m = el.querySelector('#ttk-msg');
    if (m) m.innerHTML = '<div class="' + (ok ? 'ttk-ok' : 'ttk-err') + '">' + html + '</div>';
  }
  function submit(e) {
    e.preventDefault();
    var amount = amountAttr || (el.querySelector('#ttk-amount') || {}).value || '';
    var trxid = (el.querySelector('#ttk-trxid') || {}).value || '';
    if (!amount || !trxid.trim()) { msg('Please enter the amount and TrxID.'); return; }
    var btn = el.querySelector('.ttk-submit');
    btn.disabled = true;
    btn.textContent = 'Verifying\u2026';
    fetch(base + '/pay/' + encodeURIComponent(payKey) + '/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ method: selected, amount: amount, order_id: orderId, transactionId: trxid.trim() })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
      .then(function (out) {
        if (out.json && out.json.ok) {
          msg('<strong>Payment confirmed!</strong><br>Your payment of \u09f3' + esc(out.json.amount) + ' (TrxID ' + esc(out.json.transactionId) + ') has been confirmed. Thank you!', true);
          if (successUrl) {
            setTimeout(function () {
              var sep = successUrl.indexOf('?') === -1 ? '?' : '&';
              location.href = successUrl + sep + 'order_id=' + encodeURIComponent(orderId) + '&status=confirmed';
            }, 1500);
          }
        } else {
          var m = (out.json && (out.json.message || FRIENDLY[out.json.error])) || 'Payment failed. Please check the TrxID and try again.';
          msg(esc(m));
          btn.disabled = false;
          btn.textContent = 'I have paid \u2014 Confirm';
        }
      })
      .catch(function () {
        msg('Could not reach the payment server. Please check your connection and try again.');
        btn.disabled = false;
        btn.textContent = 'I have paid \u2014 Confirm';
      });
  }
  if (!payKey) {
    show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">TakaTick checkout is not set up on this page yet (missing pay key).</p></div>');
    return;
  }
  show('<div class="ttk-card"><p class="ttk-muted">Loading payment methods\u2026</p></div>');
  fetch(base + '/pay/' + encodeURIComponent(payKey) + '/methods')
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
    .then(function (out) {
      if (out.json && out.json.ok) {
        methods = out.json.methods || [];
        render();
      } else {
        var m = (out.json && (FRIENDLY[out.json.error] || out.json.message)) || 'Payment link is not available right now.';
        show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">' + esc(m) + '</p></div>');
      }
    })
    .catch(function () {
      show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">Could not load payment methods. Please check your connection and refresh.</p></div>');
    });
})();
