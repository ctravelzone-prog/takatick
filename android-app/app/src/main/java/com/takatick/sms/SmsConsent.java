package com.takatick.sms;

import android.content.Context;
import android.util.Log;

/**
 * SMS User Consent API — Google Play Services-er SmsRetriever.
 *
 * KONO SMS PERMISSION LAGE NA: SMS asle Android nije ekta dialog dekhay
 * ("Allow TakaTick SMS to read this message?"), merchant ekbar tap korlei
 * oi SMS-ta app pay. Tai Play Protect-er SMS block, "restricted
 * permission", "Allow restricted settings" — kichui lage na; install hoy
 * sadharon app-er moto.
 *
 * Play Services library compile-e lage na — reflection-e daka hoy, jate
 * manual aapt2/d8 build-e kono extra AAR na lage. Phone-e Play Services
 * na thakle startConsent false dey (tokhon dashboard-e SMS paste korte
 * hobe).
 */
public final class SmsConsent {
    private static final String TAG = "TakaTickConsent";

    public static final String SMS_RETRIEVED_ACTION =
            "com.google.android.gms.auth.api.phone.SMS_RETRIEVED";
    public static final String EXTRA_STATUS =
            "com.google.android.gms.auth.api.phone.EXTRA_STATUS";
    public static final String EXTRA_SMS_MESSAGE =
            "com.google.android.gms.auth.api.phone.EXTRA_SMS_MESSAGE";
    // CommonStatusCodes.SUCCESS = 0, TIMEOUT = 15.
    public static final int STATUS_SUCCESS = 0;
    public static final int STATUS_TIMEOUT = 15;

    private SmsConsent() {}

    /** Consent listener chalu koro (5 min window; timeout hole abar dakte hoy). */
    public static boolean startConsent(Context context) {
        try {
            Class<?> retriever = Class.forName(
                    "com.google.android.gms.auth.api.phone.SmsRetriever");
            Object client = retriever.getMethod("getClient", Context.class)
                    .invoke(null, context);
            // null sender = jekono sender-er SMS (bKash/Nagad/Rocket/Upay).
            client.getClass().getMethod("startSmsUserConsent", String.class)
                    .invoke(client, new Object[]{null});
            Log.i(TAG, "SMS user consent listening shuru");
            return true;
        } catch (Exception e) {
            Log.w(TAG, "SmsRetriever pawa jayni (Play Services nei?)", e);
            return false;
        }
    }

    /** Broadcast-er Status parcelable theke status code ber koro. */
    public static int statusCode(Object status) {
        try {
            return (int) status.getClass().getMethod("getStatusCode").invoke(status);
        } catch (Exception e) {
            return -1;
        }
    }
}
