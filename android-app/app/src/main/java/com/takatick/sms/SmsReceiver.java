package com.takatick.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import java.util.regex.Pattern;

/**
 * Payment SMS dhore server-e forward kore.
 *
 * SCOPE (ichchakrito choto rakha): sudhu 4 MFS sender-er SMS forward hoy —
 * bKash (16247), Nagad (16167), Rocket (16216), Upay (16268).
 * v1.4 fallback: sender ochena holeo body-r BHASHA diye payment SMS
 * chena hoy — sender ID ja-i hok na keno. Payment pattern:
 * "received" + "Tk" + amount + "TrxID", ba bKash/Nagad/Rocket/Upay-er
 * naam thakleo payment hisebe dhora hoy. (Inbox pora hoy na — manifest
 * receiver protita SMS live-ei dhore, tai notun payment SMS sobsomoy
 * paoa jay; READ_SMS anle Play Protect block fire asbe.)
 * Onno kono SMS (OTP, bank, personal) pora ba pathano hoy na.
 * SMS jay shudhu merchant-er nijer configure kora server-e (MainActivity-te bosano URL).
 */
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "TakaTickSms";

    // Sender match: naam ba short code — case-insensitive, substring match.
    private static final String[][] MFS_SENDERS = {
            {"bkash", "16247"},
            {"nagad", "16167"},
            {"rocket", "16216"},
            {"upay", "16268"}
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        // Broadcast sesh howar age network call sesh korte goAsync() lage.
        final PendingResult pending = goAsync();

        new Thread(() -> {
            try {
                SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                if (messages != null) {
                    for (SmsMessage msg : messages) {
                        String sender = msg.getOriginatingAddress();
                        String body = msg.getMessageBody();
                        if (sender == null || body == null) {
                            continue;
                        }
                        if (!isMfsSender(sender) && !looksLikePaymentSms(body)) {
                            continue; // MFS SMS na, payment-er moto-o na — chupchap ignore.
                        }
                        if (!isMfsSender(sender)) {
                            Log.i(TAG, "Payment-er moto SMS, sender ochena (" + sender + ") — tobuo forward kora hocche");
                        }
                        Log.i(TAG, "MFS SMS from " + sender + ", forwarding…");
                        boolean ok = ApiClient.postSms(context, sender, body);
                        Log.i(TAG, "Forward result for " + sender + ": " + ok);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "SMS forward failed", e);
            } finally {
                pending.finish();
            }
        }).start();
    }

    private boolean isMfsSender(String sender) {
        String s = sender.toLowerCase();
        for (String[] pair : MFS_SENDERS) {
            if (s.contains(pair[0]) || s.contains(pair[1])) {
                return true;
            }
        }
        return false;
    }

    // v1.4: sender ochena holeo body-r bhasha diye payment SMS chena hoy.
    // (bKash-er asol SMS-ei dekha geche — sender list-e na thakle ager
    // version chupchap fele dito, tai server-e kichui jayni.)
    // Payment pattern: "received" + "Tk" + amount (Tk 10.00) + "TrxID",
    // ba bKash/Nagad/Rocket/Upay-er naam thakleo payment hisebe dhora hoy.
    // Server-e parse na hole (TrxID/amount na thakle) 422 hoye
    // sms_unparsed-e jabe — transaction banbe na, tai vul forward-eo khoti nei.
    private boolean looksLikePaymentSms(String body) {
        String b = body.toLowerCase();
        if (b.contains("bkash") || b.contains("nagad")
                || b.contains("rocket") || b.contains("upay")) {
            return true;
        }
        if (!b.contains("received") || !b.contains("tk") || !b.contains("trxid")) {
            return false;
        }
        return Pattern.compile("tk\\s*[\\d,]+\\.\\d{2}").matcher(b).find();
    }
}
