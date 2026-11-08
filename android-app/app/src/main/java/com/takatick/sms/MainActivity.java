package com.takatick.sms;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
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

        permBtn.setOnClickListener(v -> requestPermissions(
                new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS},
                1001
        ));

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
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS},
                    1001
            );
        }
    }
}
