package com.takatick.sms;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

/**
 * Live scan service (v1.5): foreground service hisebe chole, tai Android
 * process-ta background-e mere fele na — SMS broadcast-o tokhon thik
 * moto deliver hoy. Tar upore proti 2 second-e inbox safety net
 * (InboxScanner) chalano hoy, jate broadcast kono karone miss korleo
 * payment SMS 2s-er moddhei server-e chole jay.
 *
 * NO WAKE LOCK (ichchakrito): wake lock battery khabe ar phone ghumaleo
 * CPU jagai rakhbe — dorkar nei. Foreground service process-ta jibito
 * rakhe, tai SMS broadcast deliver hoy; 2s loop device jege thakle
 * chole; deep Doze-e loop batch hote pare — tokhon broadcast-i instant
 * poth thakbe. Notification-e shesh payment dekhano hoy.
 *
 * Scan network I/O kore — tai kokhono main thread-e chalano hoy na;
 * proti tick-e background thread-e ekbar scan, ager scan cholte
 * thakle oi tick skip hoy (thread jomte deoa hoy na).
 * START_STICKY: system service mere felle abar chalu kore.
 * Start idempotent: onStartCommand duibar asleo loop ekbar-i chole.
 */
public class ScanService extends Service {

    private static final String TAG = "TakaTickScan";
    private static final String CHANNEL_ID = "takatick_scan";
    private static final int NOTIF_ID = 1001;
    private static final long SCAN_INTERVAL_MS = 2000;

    private Handler handler;
    private Runnable scanRunnable;
    private boolean loopStarted = false;
    private boolean scanInProgress = false;
    private String lastPayment = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIF_ID, buildNotification(null));
        handler = new Handler(Looper.getMainLooper());
        scanRunnable = new Runnable() {
            @Override
            public void run() {
                runScanOnce();
                handler.postDelayed(this, SCAN_INTERVAL_MS);
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!loopStarted) {
            loopStarted = true;
            handler.post(scanRunnable);
            Log.i(TAG, "Live scan loop chalu (2s)");
        }
        return START_STICKY;
    }

    private void runScanOnce() {
        if (scanInProgress) {
            return; // Ager scan ekhono cholche (network slow) — ei tick skip.
        }
        scanInProgress = true;
        new Thread(() -> {
            String found = null;
            try {
                found = InboxScanner.scanAndForward(ScanService.this);
            } catch (Exception e) {
                Log.e(TAG, "Scan failed", e);
            } finally {
                scanInProgress = false;
            }
            if (found != null) {
                lastPayment = found;
                NotificationManager nm =
                        (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.notify(NOTIF_ID, buildNotification(found));
                }
            }
        }).start();
    }

    private Notification buildNotification(String last) {
        String text = last == null
                ? "TakaTick SMS — payment SMS shunchi (live scan 2s)"
                : "Last payment: " + last + " • live scan 2s";
        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("TakaTick SMS")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .build();
    }

    private void createChannel() {
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "TakaTick SMS scan", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Payment SMS-er live scan — broadcast miss korleo 2s-e inbox check");
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public void onDestroy() {
        if (handler != null && scanRunnable != null) {
            handler.removeCallbacks(scanRunnable);
        }
        loopStarted = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
