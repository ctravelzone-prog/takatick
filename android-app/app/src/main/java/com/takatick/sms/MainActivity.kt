package com.takatick.sms

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Setup screen: merchant server URL + appKey bosabe, permission dibe,
 * ar Test button diye ekta sample SMS server-e pathiye check korbe.
 * (UI code-e banano — kono layout XML file lage na.)
 */
class MainActivity : Activity() {

    private lateinit var urlInput: EditText
    private lateinit var keyInput: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply { text = "TakaTick SMS — Setup"; textSize = 22f }
        urlInput = EditText(this).apply { hint = "Server URL (jemon https://pay.apnar-domain.com)" }
        keyInput = EditText(this).apply { hint = "App Key (dashboard theke)" }
        val saveBtn = Button(this).apply { text = "Save" }
        val permBtn = Button(this).apply { text = "SMS permission din" }
        val testBtn = Button(this).apply { text = "Test SMS pathan" }
        statusText = TextView(this).apply { text = "Status: setup baki" }

        // Age save kora thakle dekhano.
        val (savedUrl, savedKey) = ApiClient.getSettings(this)
        urlInput.setText(savedUrl)
        keyInput.setText(savedKey)
        if (savedUrl.isNotEmpty() && savedKey.isNotEmpty()) {
            statusText.text = "Status: setup kora ache"
        }

        saveBtn.setOnClickListener {
            getSharedPreferences("takatick", MODE_PRIVATE).edit()
                .putString("server_url", urlInput.text.toString().trim().trimEnd('/'))
                .putString("app_key", keyInput.text.toString().trim())
                .apply()
            statusText.text = "Status: save hoyeche"
            Toast.makeText(this, "Save hoyeche", Toast.LENGTH_SHORT).show()
        }

        permBtn.setOnClickListener {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
                1001
            )
        }

        testBtn.setOnClickListener {
            val (url, key) = ApiClient.getSettings(this)
            if (url.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "Age Server URL ar App Key boshan", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            statusText.text = "Status: test SMS pathano hocche…"
            Thread {
                val ok = ApiClient.postSmsTo(
                    url, key, "bKash",
                    "You have received Tk 100.00 from 01XXXXXXXXX. TrxID TEST123456 at 09:00 08/11/2026"
                )
                runOnUiThread {
                    statusText.text = if (ok) "Status: test SMS geche ✅ — dashboard-e check korun"
                    else "Status: test SMS jayni ❌ — URL/key/server check korun"
                }
            }.start()
        }

        layout.addView(title)
        layout.addView(urlInput)
        layout.addView(keyInput)
        layout.addView(saveBtn)
        layout.addView(permBtn)
        layout.addView(testBtn)
        layout.addView(statusText)
        setContentView(layout)

        // Kholar somoy permission na thakle chaowa.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
                1001
            )
        }
    }
}
