package com.takatick.sms;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

// NOTE: AndroidX use kora hoyni — Activity-er nijer requestPermissions /
// checkSelfPermission (API 23+) use kora hoyeche, jate manual build-e
// kono extra library na lage.

/**
 * Setup screen: merchant server URL + appKey bosabe, permission dibe,
 * ar Test button diye ekta sample SMS server-e pathiye check korbe.
 * (UI code-e banano — kono layout XML file lage na.)
 */
public class MainActivity extends Activity {

    private EditText urlInput;
    private EditText keyInput;
    private TextView statusText;

    private static final int REQ_SMS = 1001;

    // SMS permission chaowa — RECEIVE_SMS (live broadcast) + READ_SMS
    // (inbox safety net) — duita ek sathe chaowa hoy. Sideload kora app-e
    // Android 13+ SMS-ke "restricted permission" dhore: ekbar deny hole
    // system ar Allow/Deny dialog dekhay na, "App was denied access"
    // dekhay. Tokhon button chupchap kichu na kore boshe thakle cholbe
    // na — App info khule "Allow restricted settings" ON korte hoy,
    // tobei SMS Allow kora jay.
    private void requestSmsPermission() {
        boolean recvGranted = checkSelfPermission(Manifest.permission.RECEIVE_SMS)
                == PackageManager.PERMISSION_GRANTED;
        boolean readGranted = checkSelfPermission(Manifest.permission.READ_SMS)
                == PackageManager.PERMISSION_GRANTED;
        if (recvGranted && readGranted) {
            statusText.setText("Status: SMS permission deoa ache ✅ (live scan 2s + inbox scan chalu)");
            return;
        }
        boolean askedBefore = getSharedPreferences("takatick", MODE_PRIVATE)
                .getBoolean("perm_asked", false);
        if (askedBefore
                && !shouldShowRequestPermissionRationale(Manifest.permission.RECEIVE_SMS)
                && !shouldShowRequestPermissionRationale(Manifest.permission.READ_SMS)) {
            // Restricted ba permanently denied — system dialog ar dibe na.
            statusText.setText("Status: SMS permission restricted — Settings → Apps → TakaTick SMS → ⋮ → Allow restricted settings ON koro, tarpor SMS Allow koro");
            Toast.makeText(this, "App info khulche — ⋮ theke Allow restricted settings ON koro", Toast.LENGTH_LONG).show();
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + getPackageName()));
            startActivity(i);
            return;
        }
        getSharedPreferences("takatick", MODE_PRIVATE).edit()
                .putBoolean("perm_asked", true).apply();
        requestPermissions(new String[]{
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS}, REQ_SMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_SMS) return;
        boolean recvGranted = false;
        boolean readGranted = false;
        for (int i = 0; i < permissions.length && i < grantResults.length; i++) {
            if (Manifest.permission.RECEIVE_SMS.equals(permissions[i])
                    && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                recvGranted = true;
            }
            if (Manifest.permission.READ_SMS.equals(permissions[i])
                    && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                readGranted = true;
            }
        }
        if (recvGranted && readGranted) {
            statusText.setText("Status: SMS permission deoa ache ✅ (live scan 2s + inbox scan chalu)");
            Toast.makeText(this, "SMS permission deoa hoyeche ✅", Toast.LENGTH_SHORT).show();
            runInboxScan();
            startScanService();
        } else if (recvGranted) {
            statusText.setText("Status: SMS forward chalu ✅ — inbox scan-er jonno READ_SMS deoa hoy ni (miss kora SMS app khulle asbe na)");
        } else {
            statusText.setText("Status: SMS permission deoa hoy ni — abar chaple App info khulbe, okhane ⋮ → Allow restricted settings ON koro");
        }
    }

    // Live scan service (v1.5): foreground service + proti 2s inbox scan.
    // Setup save kora thaklei start hoy. AndroidX nei — framework-er
    // Context.startForegroundService (API 26+) use kora hoyeche.
    // Start fail holeo app cholbe — broadcast receiver ar khulle inbox
    // scan backup hisebe ache.
    private void startScanService() {
        String[] settings = ApiClient.getSettings(this);
        if (settings[0].isEmpty() || settings[1].isEmpty()) {
            return;
        }
        try {
            startForegroundService(new Intent(this, ScanService.class));
        } catch (Exception e) {
            // Foreground service start holo na — chupchap cholbe.
        }
    }

    // Inbox safety net: app khulle / Save-er por miss kora payment SMS
    // khuje server-e pathano. Permission na thakle scanner nijei skip kore.
    private void runInboxScan() {
        new Thread(() -> InboxScanner.scanAndForward(this)).start();
    }

    // Battery whitelist (v1.5): recents theke kete dileo / phone idle
    // thakleo foreground service chalu rakhte system-ke bola hoy
    // app-tar battery optimization bondho rakhte. Button chaple system
    // dialog khole ("Let app always run in background?" — Allow);
    // kono phone-e ei intent na thakle App info khole, okhane
    // Battery → Unrestricted korte hoy.
    private void requestBatteryWhitelist() {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        i.setData(Uri.parse("package:" + getPackageName()));
        if (i.resolveActivity(getPackageManager()) == null) {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + getPackageName()));
        }
        try {
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Settings khola jayni — manually Apps → TakaTick SMS → Battery → Unrestricted koro", Toast.LENGTH_LONG).show();
        }
    }

    private boolean isBatteryExempt() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    // Status line-er sheshe background state dekhano. Purono suffix
    // (thakle) age kete notun-ta bosano hoy — bar bar onResume holeo
    // ekbar-i thake.
    private void refreshBackgroundStatus() {
        if (statusText == null) return;
        String cur = statusText.getText().toString();
        int idx = cur.indexOf(" • Background");
        if (idx >= 0) cur = cur.substring(0, idx);
        statusText.setText(cur + (isBatteryExempt()
                ? " • Background chalu ✅"
                : " • Background off — 'BACKGROUND CHALU RAKHO' button ta chap diye chalu koro"));
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshBackgroundStatus();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 48, 48, 48);

        TextView title = new TextView(this);
        title.setText("TakaTick SMS — Setup");
        title.setTextSize(22f);

        urlInput = new EditText(this);
        urlInput.setHint("Server URL (jemon https://pay.apnar-domain.com)");

        keyInput = new EditText(this);
        keyInput.setHint("App Key (dashboard theke)");

        Button saveBtn = new Button(this);
        saveBtn.setText("Save");

        Button permBtn = new Button(this);
        permBtn.setText("SMS permission din");

        Button testBtn = new Button(this);
        testBtn.setText("Test SMS pathan");

        Button bgBtn = new Button(this);
        bgBtn.setText("BACKGROUND CHALU RAKHO");

        statusText = new TextView(this);
        statusText.setText("Status: setup baki");

        // Age save kora thakle dekhano.
        String[] saved = ApiClient.getSettings(this);
        urlInput.setText(saved[0]);
        keyInput.setText(saved[1]);
        if (!saved[0].isEmpty() && !saved[1].isEmpty()) {
            statusText.setText("Status: setup kora ache");
        }

        saveBtn.setOnClickListener(v -> {
            getSharedPreferences("takatick", MODE_PRIVATE).edit()
                    .putString("server_url", urlInput.getText().toString().trim().replaceAll("/+$", ""))
                    .putString("app_key", keyInput.getText().toString().trim())
                    .apply();
            statusText.setText("Status: save hoyeche");
            Toast.makeText(this, "Save hoyeche", Toast.LENGTH_SHORT).show();
            runInboxScan();
            startScanService();
        });

        permBtn.setOnClickListener(v -> requestSmsPermission());

        bgBtn.setOnClickListener(v -> requestBatteryWhitelist());

        testBtn.setOnClickListener(v -> {
            String[] settings = ApiClient.getSettings(this);
            String url = settings[0];
            String key = settings[1];
            if (url.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "Age Server URL ar App Key boshan", Toast.LENGTH_SHORT).show();
                return;
            }
            statusText.setText("Status: test SMS pathano hocche…");
            new Thread(() -> {
                boolean ok = ApiClient.postSmsTo(
                        url, key, "bKash",
                        "You have received Tk 100.00 from 01XXXXXXXXX. TrxID TEST123456 at 09:00 08/11/2026"
                );
                runOnUiThread(() -> statusText.setText(ok
                        ? "Status: test SMS geche ✅ — dashboard-e check korun"
                        : "Status: test SMS jayni ❌ — URL/key/server check korun"));
            }).start();
        });

        layout.addView(title);
        layout.addView(urlInput);
        layout.addView(keyInput);
        layout.addView(saveBtn);
        layout.addView(permBtn);
        layout.addView(testBtn);
        layout.addView(bgBtn);
        layout.addView(statusText);
        setContentView(layout);

        // Kholar somoy permission na thakle chaowa — ar permission thakle
        // inbox safety net: miss kora payment SMS khuje pathano.
        // Setup thakle live scan service-o chalu hoy (foreground, 2s scan).
        requestSmsPermission();
        runInboxScan();
        startScanService();
        refreshBackgroundStatus();
    }
}
