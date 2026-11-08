package com.takatick.sms;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Payment SMS chenar shared niyom — SmsReceiver (live broadcast) ar
 * InboxScanner (inbox safety net) — duijonei eki rule use kore, jate
 * ek jaygay fix korle duijon-ei thik hoy.
 *
 * Payment pattern: "received" + "Tk" + amount (Tk 10.00) + "TrxID",
 * ba bKash/Nagad/Rocket/Upay-er naam thakleo payment hisebe dhora hoy.
 * Sender ID ja-i hok na keno — bKash-er asol SMS-ei dekha geche sender
 * list-e na thakle purono code SMS-ta chupchap fele dito.
 * Server-e parse na hole (TrxID/amount na thakle) 422 UNPARSEABLE hoye
 * sms_unparsed-e jabe — transaction banbe na, tai vul forward-eo khoti nei.
 */
public final class PaymentSms {

    private PaymentSms() {}

    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("tk\\s*[\\d,]+\\.\\d{2}");

    private static final Pattern TRXID_PATTERN =
            Pattern.compile("(?:trxid|trx id|transaction id)\\s*:?\\s*([A-Za-z0-9]{8,})",
                    Pattern.CASE_INSENSITIVE);

    public static boolean looksLikePaymentSms(String body) {
        if (body == null) return false;
        String b = body.toLowerCase();
        if (b.contains("bkash") || b.contains("nagad")
                || b.contains("rocket") || b.contains("upay")) {
            return true;
        }
        if (!b.contains("received") || !b.contains("tk") || !b.contains("trxid")) {
            return false;
        }
        return AMOUNT_PATTERN.matcher(b).find();
    }

    /** Body theke TrxID ber kora — na pele null (server-e pathanor age dedup-er jonno). */
    public static String extractTrxId(String body) {
        if (body == null) return null;
        Matcher m = TRXID_PATTERN.matcher(body);
        return m.find() ? m.group(1).trim() : null;
    }
}
