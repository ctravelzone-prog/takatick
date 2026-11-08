package com.takatick.sms;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
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
            statusText.setText("Status: SMS permission deoa ache ✅ (inbox scan-o chalu)");
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
            statusText.setText("Status: SMS permission deoa ache ✅ (inbox scan-o chalu)");
            Toast.makeText(this, "SMS permission deoa hoyeche ✅", Toast.LENGTH_SHORT).show();
            runInboxScan();
        } else if (recvGranted) {
            statusText.setText("Status: SMS forward chalu ✅ — inbox scan-er jonno READ_SMS deoa hoy ni (miss kora SMS app khulle asbe na)");
        } else {
            statusText.setText("Status: SMS permission deoa hoy ni — abar chaple App info khulbe, okhane ⋮ → Allow restricted settings ON koro");
        }
    }

    // Inbox safety net: app khulle / Save-er por miss kora payment SMS
    // khuje server-e pathano. Permission na thakle scanner nijei skip kore.
    private void runInboxScan() {
        new Thread(() -> InboxScanner.scanAndForward(this)).start();
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
        });

        permBtn.setOnClickListener(v -> requestSmsPermission());

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
        layout.addView(statusText);
        setContentView(layout);

        // Kholar somoy permission na thakle chaowa — ar permission thakle
        // inbox safety net: miss kora payment SMS khuje pathano.
        requestSmsPermission();
        runInboxScan();
    }
}
