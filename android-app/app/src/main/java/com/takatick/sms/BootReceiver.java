package com.takatick.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Phone restart-er por live scan abar chalu kore (v1.5).
 * Setup (server URL + appKey) save kora na thakle service start hoy na —
 * age merchant-ke MainActivity-te setup korte hobe.
 *
 * NOTE: AndroidX nei (manual build, kono library na) — tai framework-er
 * Context.startForegroundService (API 26+) use kora hoyeche, ja
 * ContextCompat.startForegroundService-er eki kaj kore.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "TakaTickBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }
        String[] settings = ApiClient.getSettings(context);
        if (settings[0].isEmpty() || settings[1].isEmpty()) {
            Log.i(TAG, "Setup kora hoyni — live scan start holo na");
            return;
        }
        try {
            context.startForegroundService(new Intent(context, ScanService.class));
            Log.i(TAG, "Boot-er por live scan service start holo");
        } catch (Exception e) {
            Log.e(TAG, "Live scan service start holo na", e);
        }
    }
}
