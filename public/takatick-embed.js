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
  var BRAND = {
    bkash: { ussd: '*247#', color: '#e2136e' },
    nagad: { ussd: '*167#', color: '#ed1c24' },
    rocket: { ussd: '*322#', color: '#8c3494' },
    upay: { ussd: '*268#', color: '#111111' }
  };
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
    + '.ttk .ttk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:12px 0}'
    + '.ttk .ttk-opt{border:1px solid #e5e5e5;border-radius:16px;padding:22px 10px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:14px;color:#222}'
    + '.ttk .ttk-opt img{height:44px;max-width:80%;object-fit:contain}'
    + '.ttk .ttk-opt span{font-size:15px;font-weight:600;color:#333}'
    + '.ttk .ttk-back{color:#333;text-decoration:none;font-size:15px;font-weight:600;cursor:pointer}'
    + '.ttk .ttk-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:16px 0}'
    + '.ttk .ttk-top img{height:52px;max-width:45%;object-fit:contain}'
    + '.ttk .ttk-amt{font-size:24px;font-weight:800;color:#333}'
    + '.ttk .ttk-note{background:#fff7e6;border:1px solid #f0c36d;border-radius:8px;padding:10px;font-size:14px;text-align:center;color:#8a6d00}'
    + '.ttk .ttk-panel{border-radius:16px;padding:22px;color:#fff;margin:14px 0}'
    + '.ttk .ttk-panel h2{text-align:center;margin:0 0 14px;font-size:22px}'
    + '.ttk .ttk-panel input{width:100%;padding:12px;border:0;border-radius:10px;font-size:16px;text-align:center;box-sizing:border-box}'
    + '.ttk .ttk-panel h3{margin:18px 0 6px;font-size:15px;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,.35);padding-bottom:8px}'
    + '.ttk .ttk-panel ul{list-style:none;margin:0;padding:0}'
    + '.ttk .ttk-panel li{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.25);font-size:15px;line-height:1.5}'
    + '.ttk .ttk-panel li:last-child{border-bottom:0}'
    + '.ttk .ttk-panel li::before{content:"\\2022";flex:none}'
    + '.ttk .ttk-hl{color:#ffe600}'
    + '.ttk .ttk-numrow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.25)}'
    + '.ttk .ttk-paynum{font-size:22px;font-weight:800;color:#ffe600}'
    + '.ttk button.ttk-copy{padding:8px 12px;border-radius:8px;border:0;background:rgba(0,0,0,.35);color:#fff;cursor:pointer;font-weight:700}'
    + '.ttk button.ttk-verify{width:100%;padding:16px;border:0;border-radius:16px;color:#fff;font-size:18px;font-weight:800;cursor:pointer;letter-spacing:.5px}'
    + '.ttk .ttk-ok{background:#e9f7ee;border:1px solid #7cc79a;border-radius:8px;padding:12px;font-size:15px}'
    + '.ttk .ttk-err{background:#fdecea;border:1px solid #f5a9a0;border-radius:8px;padding:12px;font-size:15px}'
    + '</style>';

  function methodNumbers(m) {
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].method === m) return methods[i].numbers || [];
    }
    return [];
  }
  function renderList() {
    if (!methods.length) {
      show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">No payment numbers added yet. Please contact the seller.</p></div>');
      return;
    }
    var opts = methods.map(function (m) {
      return '<button type="button" class="ttk-opt" data-m="' + m.method + '">'
        + '<img src="' + base + '/mfs/' + m.method + '.png" alt="' + esc(LABELS[m.method] || m.method) + '">'
        + '<span>' + esc(LABELS[m.method] || m.method) + ' SendMoney</span></button>';
    }).join('');
    show('<div class="ttk-card"><h3>Pay with bKash / Nagad / Rocket / Upay</h3>'
      + '<p class="ttk-muted">Choose a method to see the number and pay.</p>'
      + '<div class="ttk-grid">' + opts + '</div>'
      + '<p class="ttk-muted">Money goes directly to the seller\u2019s own number. TakaTick only verifies the payment.</p></div>');
    el.querySelectorAll('.ttk-opt').forEach(function (b) {
      b.addEventListener('click', function () { selected = b.getAttribute('data-m'); renderDetail(); });
    });
  }
  function renderDetail() {
    if (!selected || !methodNumbers(selected).length) selected = methods[0].method;
    var b = BRAND[selected] || { ussd: '', color: '#0f766e' };
    var label = LABELS[selected] || selected;
    var nums = methodNumbers(selected).map(function (n) {
      return '<div class="ttk-numrow">'
        + '<div><span class="ttk-paynum">' + esc(n.number) + '</span>'
        + (n.label ? ' <span style="color:rgba(255,255,255,.8);font-size:13px">' + esc(n.label) + '</span>' : '') + '</div>'
        + '<button type="button" class="ttk-copy" data-copy="' + esc(n.number) + '">Copy</button></div>';
    }).join('');
    var amt = amountAttr || '';
    var amtLine = amt
      ? '\u09aa\u09b0\u09bf\u09ae\u09be\u09a3: <b class="ttk-hl">' + esc(amt) + ' \u099f\u09be\u0995\u09be</b> \u09a6\u09bf\u09df\u09c7 <b class="ttk-hl">SUBMIT</b> \u0995\u09b0\u09c1\u09a8\u0964'
      : '\u09aa\u09b0\u09bf\u09ae\u09be\u09a3: \u0986\u09aa\u09a8\u09be\u09b0 \u0985\u09b0\u09cd\u09a1\u09be\u09b0\u09c7\u09b0 \u099f\u09be\u0995\u09be \u09a6\u09bf\u09df\u09c7 <b class="ttk-hl">SUBMIT</b> \u0995\u09b0\u09c1\u09a8\u0964';
    var amountRow = amt
      ? ''
      : '<label style="font-size:14px;font-weight:600">Amount (\u09f3)</label><input id="ttk-amount" type="number" min="1" required placeholder="e.g. 750" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;font-size:15px">';
    show('<div class="ttk-card"><a class="ttk-back" id="ttk-back">\u2190 Choose another method</a>'
      + '<div class="ttk-top"><img src="' + base + '/mfs/' + selected + '.png" alt="' + esc(label) + '"><span class="ttk-amt">' + (amt ? '\u09f3' + esc(amt) : '') + '</span></div>'
      + '<p class="ttk-note">\u09a8\u09cb\u099f: \u099f\u09be\u0995\u09be \u09aa\u09be\u09a0\u09be\u09a8\u09cb\u09b0 \u09eb-\u09e7\u09e6 \u09b8\u09c7\u0995\u09c7\u09a8\u09cd\u09a1 \u09aa\u09b0 \u09ad\u09c7\u09b0\u09bf\u09ab\u09be\u0987 \u0995\u09b0\u09ac\u09c7\u09a8\u0964</p>'
      + '<form id="ttk-form">' + amountRow
      + '<div class="ttk-panel" style="background:' + b.color + '"><h2>\u099f\u09cd\u09b0\u09be\u09a8\u099c\u09c7\u0995\u09b6\u09a8 \u0986\u0987\u09a1\u09bf \u09a6\u09bf\u09a8</h2>'
      + '<input id="ttk-trxid" required placeholder="\u099f\u09cd\u09b0\u09be\u09a8\u099c\u09c7\u0995\u09b6\u09a8 \u0986\u0987\u09a1\u09bf \u09a6\u09bf\u09a8">'
      + '<h3>INSTRUCTIONS</h3><ul>'
      + '<li><span><b class="ttk-hl">' + b.ussd + '</b> \u09a1\u09be\u09df\u09be\u09b2 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 <b class="ttk-hl">' + label.toUpperCase() + '</b> \u09ae\u09cb\u09ac\u09be\u0987\u09b2 \u09ae\u09c7\u09a8\u09c1\u09a4\u09c7 \u09af\u09be\u09a8 \u0985\u09a5\u09ac\u09be <b class="ttk-hl">' + label.toUpperCase() + '</b> \u0985\u09cd\u09af\u09be\u09aa\u09c7 \u09af\u09be\u09a8\u0964</span></li>'
      + '<li><span>"<b class="ttk-hl">Send Money</b>"-\u098f \u0995\u09cd\u09b2\u09bf\u0995 \u0995\u09b0\u09c1\u09a8\u0964</span></li>'
      + '<li><span>\u09aa\u09cd\u09b0\u09be\u09aa\u0995 \u09a8\u09ae\u09cd\u09ac\u09b0 \u09b9\u09bf\u09b8\u09c7\u09ac\u09c7 \u098f\u0987 \u09a8\u09ae\u09cd\u09ac\u09b0\u099f\u09bf \u09b2\u09bf\u0996\u09c1\u09a8:</span></li>'
      + '</ul>' + nums
      + '<ul><li><span>' + amtLine + '</span></li>'
      + '<li><span>\u098f\u0996\u09a8 \u0989\u09aa\u09b0\u09c7\u09b0 \u09ac\u0995\u09cd\u09b8\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 <b class="ttk-hl">Transaction ID</b> \u09a6\u09bf\u09a8 \u098f\u09ac\u0982 <b class="ttk-hl">VERIFY</b> \u0995\u09b0\u09c1\u09a8\u0964</span></li></ul></div>'
      + '<button type="submit" class="ttk-verify" style="background:' + b.color + '">VERIFY TRANSACTION</button></form>'
      + '<div id="ttk-msg" style="margin-top:12px"></div></div>');
    el.querySelector('#ttk-back').addEventListener('click', function () { renderList(); });
    el.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(btn.getAttribute('data-copy'));
        btn.textContent = 'Copied!';
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
    var btn = el.querySelector('.ttk-verify');
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
          btn.textContent = 'VERIFY TRANSACTION';
        }
      })
      .catch(function () {
        msg('Could not reach the payment server. Please check your connection and try again.');
        btn.disabled = false;
        btn.textContent = 'VERIFY TRANSACTION';
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
        renderList();
      } else {
        var m = (out.json && (FRIENDLY[out.json.error] || out.json.message)) || 'Payment link is not available right now.';
        show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">' + esc(m) + '</p></div>');
      }
    })
    .catch(function () {
      show('<div class="ttk-card"><h3>Payment</h3><p class="ttk-muted">Could not load payment methods. Please check your connection and refresh.</p></div>');
    });
})();
