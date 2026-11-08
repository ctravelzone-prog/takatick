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

    // SMS permission chaowa — sideload kora app-e Android 13+ SMS-ke
    // "restricted permission" dhore: ekbar deny hole system ar Allow/Deny
    // dialog dekhay na, "App was denied access" dekhay. Tokhon button
    // chupchap kichu na kore boshe thakle cholbe na — App info khule
    // "Allow restricted settings" ON korte hoy, tobei SMS Allow kora jay.
    private void requestSmsPermission() {
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS)
                == PackageManager.PERMISSION_GRANTED) {
            statusText.setText("Status: SMS permission deoa ache ✅");
            return;
        }
        boolean askedBefore = getSharedPreferences("takatick", MODE_PRIVATE)
                .getBoolean("perm_asked", false);
        if (askedBefore
                && !shouldShowRequestPermissionRationale(Manifest.permission.RECEIVE_SMS)) {
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
        requestPermissions(new String[]{Manifest.permission.RECEIVE_SMS}, REQ_SMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_SMS) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            statusText.setText("Status: SMS permission deoa ache ✅");
            Toast.makeText(this, "SMS permission deoa hoyeche ✅", Toast.LENGTH_SHORT).show();
        } else {
            statusText.setText("Status: SMS permission deoa hoy ni — abar chaple App info khulbe, okhane ⋮ → Allow restricted settings ON koro");
        }
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

        // Kholar somoy permission na thakle chaowa.
        requestSmsPermission();
    }
}
