package com.takatick.sms;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * Foreground service: phone chalu thakle sobsomoy payment SMS-er jonno
 * consent listener chalu rakhe. Notification-e sobsomoy dekhabe je
 * TakaTick shunchhe. App khule "Shona bondho korun" chaple service
 * theme jabe; phone restart hole BootReceiver abar chalu korbe.
 */
public class SmsListenerService extends Service {
    private static final String TAG = "TakaTickListen";
    private static final String CHANNEL_ID = "takatick-listen";
    private static final int NOTIF_ID = 1001;

    private ConsentReceiver receiver;
    private boolean receiverRegistered;

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "TakaTick SMS listener", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Payment SMS asle janabe");
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
        Notification notif = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("TakaTick SMS")
                .setContentText("Payment SMS-er jonno shunchi — SMS asle ekbar Allow chaplei hobe")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build();
        startForeground(NOTIF_ID, notif);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (receiver == null) {
            receiver = new ConsentReceiver();
            IntentFilter filter = new IntentFilter(SmsConsent.SMS_RETRIEVED_ACTION);
            if (Build.VERSION.SDK_INT >= 33) {
                registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(receiver, filter);
            }
            receiverRegistered = true;
        }
        if (!SmsConsent.startConsent(this)) {
            Log.w(TAG, "Play Services nei — consent shuru holo na");
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (receiverRegistered) {
            try { unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiverRegistered = false;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
