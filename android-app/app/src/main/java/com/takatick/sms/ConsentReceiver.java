package com.takatick.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

/**
 * Consent broadcast shune: payment SMS asle merchant-er Allow tap-er por
 * puro SMS text ase — MFS SMS hole server-e forward kore, tarpor abar
 * shona shuru kore. Timeout holeo abar shona shuru kore (5 min window).
 *
 * NOTE: Consent API SMS-er sender address dey na, sudhu puro text dey.
 * Tai server-e sender null jay — server body theke method bojhar chesta
 * kore, na parle method 'unknown' hisebe rakhe (TrxID + amount diye
 * verify tao chole).
 */
public class ConsentReceiver extends BroadcastReceiver {
    private static final String TAG = "TakaTickConsent";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SmsConsent.SMS_RETRIEVED_ACTION.equals(intent.getAction())) return;
        Bundle extras = intent.getExtras();
        if (extras == null) {
            SmsConsent.startConsent(context);
            return;
        }
        Object status = extras.getParcelable(SmsConsent.EXTRA_STATUS);
        int code = status != null ? SmsConsent.statusCode(status) : -1;
        if (code == SmsConsent.STATUS_SUCCESS) {
            String message = extras.getString(SmsConsent.EXTRA_SMS_MESSAGE);
            if (message != null && isMfsLike(message)) {
                Log.i(TAG, "MFS SMS pawa geche, forward korchi…");
                final Context appCtx = context.getApplicationContext();
                new Thread(() -> ApiClient.postSms(appCtx, null, message)).start();
            } else {
                Log.i(TAG, "SMS MFS-er moto na — ignore");
            }
        } else {
            Log.i(TAG, "Consent timeout / not success (" + code + ") — abar shunchi");
        }
        // Porer SMS-er jonno abar listening chalu.
        SmsConsent.startConsent(context);
    }

    // MFS payment SMS-er chena chinhho: Taka amount + TrxID.
    private static boolean isMfsLike(String text) {
        return text.contains("Tk") && (text.contains("TrxID") || text.contains("Trx ID"));
    }
}
