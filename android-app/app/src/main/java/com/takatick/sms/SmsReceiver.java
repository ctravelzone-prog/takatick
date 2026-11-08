package com.takatick.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * Payment SMS dhore server-e forward kore.
 *
 * SCOPE (ichchakrito choto rakha): sudhu 4 MFS sender-er SMS forward hoy —
 * bKash (16247), Nagad (16167), Rocket (16216), Upay (16268).
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
                        if (!isMfsSender(sender)) {
                            continue; // MFS SMS na — chupchap ignore.
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
}
