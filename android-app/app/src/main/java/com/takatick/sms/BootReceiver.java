package com.takatick.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Phone restart hole listening abar chalu koro (settings thakle). */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        String[] s = ApiClient.getSettings(context);
        if (s[0].isEmpty() || s[1].isEmpty()) return;
        Intent svc = new Intent(context, SmsListenerService.class);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(svc);
        else context.startService(svc);
    }
}
