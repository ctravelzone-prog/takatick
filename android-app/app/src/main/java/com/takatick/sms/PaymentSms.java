package com.takatick.sms;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Payment SMS chenar shared niyom — SmsReceiver (live broadcast) ar
 * InboxScanner (inbox safety net) — duijonei eki rule use kore, jate
 * ek jaygay fix korle duijon-ei thik hoy.
 *
 * Payment pattern: "received" + amount (Tk/BDT 10.00) + "TrxID"/"TxnID",
 * ba bKash/Nagad/Rocket/Upay-er naam thakleo payment hisebe dhora hoy.
 * v2.9.8: Nagad "TxnID" + "Tk.", Upay "BDT", Rocket "TxnID" — sob chole.
 * Sender ID ja-i hok na keno — bKash-er asol SMS-ei dekha geche sender
 * list-e na thakle purono code SMS-ta chupchap fele dito.
 * Server-e parse na hole (TrxID/amount na thakle) 422 UNPARSEABLE hoye
 * sms_unparsed-e jabe — transaction banbe na, tai vul forward-eo khoti nei.
 */
public final class PaymentSms {

    private PaymentSms() {}

    // v2.9.8: tolerant — Nagad "TxnID" + "Tk." (dot), Upay "BDT",
    // Rocket "TxnID"; amount-e decimal-o na thakte pare ("Tk 10").
    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("(?:tk|bdt|৳)\\.?\\s*[\\d,]+(?:\\.\\d{1,2})?",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern TRXID_PATTERN =
            Pattern.compile("(?:trx\\.?\\s*id|txn\\.?\\s*id|transaction\\s*id|tx\\.?\\s*id)\\s*:?\\s*([A-Za-z0-9]{6,})",
                    Pattern.CASE_INSENSITIVE);

    public static boolean looksLikePaymentSms(String body) {
        if (body == null) return false;
        String b = body.toLowerCase();
        if (b.contains("bkash") || b.contains("nagad")
                || b.contains("rocket") || b.contains("upay")
                || b.contains("dbbl") || b.contains("dutch-bangla")) {
            return true;
        }
        boolean moneyWord = b.contains("received") || b.contains("credited")
                || b.contains("cash in");
        return moneyWord && AMOUNT_PATTERN.matcher(b).find()
                && TRXID_PATTERN.matcher(b).find();
    }

    /** Body theke TrxID ber kora — na pele null (server-e pathanor age dedup-er jonno). */
    public static String extractTrxId(String body) {
        if (body == null) return null;
        Matcher m = TRXID_PATTERN.matcher(body);
        return m.find() ? m.group(1).trim() : null;
    }
}
