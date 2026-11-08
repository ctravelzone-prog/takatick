// src/smsParser.js — parse bKash / Nagad / Rocket / Upay received-money SMS.
//
// NOTE: Exact real SMS wordings vary by operator / over time and MUST be
// re-checked against a real SMS before production. The regexes below are
// deliberately tolerant (optional spaces/colons, comma-grouped amounts,
// "TrxID" / "Trx ID" / "Transaction ID") so minor wording drift still
// parses, but they are NOT a substitute for testing with genuine messages.
// This warning applies equally to Rocket and Upay: their exact SMS wording
// and sender IDs MUST be re-checked against a real Rocket / Upay SMS
// before production — the values below are the ones Siam supplied
// (Rocket 'Rocket' / '16216', Upay 'Upay' / '16268') and are unconfirmed
// against a live message.
//
// Supported senders:
//   bKash  — sender id "bKash"  or short code "16247"
//   Nagad  — sender id "Nagad"  or short code "16167"
//   Rocket — sender id "Rocket" or short code "16216"
//   Upay   — sender id "Upay"   or short code "16268"
//
// Returns { method, trxid, amountPoisha, senderNumber } on success,
// or { error, reason } when the message cannot be parsed.
'use strict';

const AMOUNT_RE = /Tk\s*([\d,]+\.\d{2})/;
const TRXID_RE = /(?:TrxID|Trx ID|Transaction ID)\s*:?\s*([A-Za-z0-9]{8,})/i;
const SENDER_NUMBER_RE = /from\s+(01[3-9]\d{8})/i;

function detectMethod(sender, text) {
  const s = String(sender || '').trim().toLowerCase();
  if (s === 'bkash' || s === '16247') return 'bkash';
  if (s === 'nagad' || s === '16167') return 'nagad';
  if (s === 'rocket' || s === '16216') return 'rocket';
  if (s === 'upay' || s === '16268') return 'upay';
  // Fallback: infer from the message body itself.
  if (/bkash/i.test(text)) return 'bkash';
  if (/nagad/i.test(text)) return 'nagad';
  if (/rocket/i.test(text)) return 'rocket';
  if (/upay/i.test(text)) return 'upay';
  return null;
}

function parseSms(text, sender) {
  const raw = String(text || '');
  if (!raw.trim()) return { error: 'UNPARSEABLE', reason: 'empty SMS text' };

  const amountMatch = raw.match(AMOUNT_RE);
  if (!amountMatch) return { error: 'UNPARSEABLE', reason: 'amount not found' };
  const amountPoisha = Math.round(parseFloat(amountMatch[1].replace(/,/g, '')) * 100);
  if (!Number.isFinite(amountPoisha) || amountPoisha <= 0) {
    return { error: 'UNPARSEABLE', reason: 'invalid amount' };
  }

  const trxMatch = raw.match(TRXID_RE);
  if (!trxMatch) return { error: 'UNPARSEABLE', reason: 'TrxID not found' };
  const trxid = trxMatch[1].trim();

  // v2.8: method na bojha geleo (jemon Consent API-te sender thake na)
  // amount + TrxID thik thakle SMS-ta rakha hoy — method 'unknown'.
  // Verify TrxID + amount diyei hoy, method sudhu display/record-er jonno.
  const method = detectMethod(sender, raw) || 'unknown';

  const senderMatch = raw.match(SENDER_NUMBER_RE);
  // Sender number is useful but not always present in every wording;
  // keep it null rather than failing the whole parse when absent.
  const senderNumber = senderMatch ? senderMatch[1] : null;

  return { method, trxid, amountPoisha, senderNumber };
}

module.exports = { parseSms };
