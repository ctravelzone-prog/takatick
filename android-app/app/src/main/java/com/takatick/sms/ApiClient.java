package com.takatick.sms;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * TakaTick server-er POST /api/sms endpoint-e SMS pathay.
 * Header: x-app-key (merchant-er appKey — kokhono code-e hardcode korben na,
 * MainActivity-te merchant nije bosabe). Kono third-party library lage na —
 * HttpURLConnection (Android-e built-in) use kora hoy.
 */
public class ApiClient {
    private static final String TAG = "TakaTickApi";

    /** Server URL + appKey SharedPreferences theke nin. */
    public static String[] getSettings(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("takatick", Context.MODE_PRIVATE);
        String baseUrl = prefs.getString("server_url", "");
        String appKey = prefs.getString("app_key", "");
        if (baseUrl == null) baseUrl = "";
        if (appKey == null) appKey = "";
        return new String[]{baseUrl.trim().replaceAll("/+$", ""), appKey.trim()};
    }

    /** Ekta SMS server-e pathan. Success hole true. */
    public static boolean postSms(Context context, String sender, String text) {
        String[] settings = getSettings(context);
        String baseUrl = settings[0];
        String appKey = settings[1];
        if (baseUrl.isEmpty() || appKey.isEmpty()) {
            Log.w(TAG, "Server URL / appKey set kora hoyni — SMS pathano holo na");
            return false;
        }
        return postSmsTo(baseUrl, appKey, sender, text);
    }

    /** Test button-er jonno: direct URL + key diye pathano.
     * v1.4: 3 bar chesta — Render free tier ghumale prothom POST
     * connect timeout-e (10s) fail korte pare; ekbar fail manei SMS
     * harano noy, 2s pore abar pathano hoy. Duijon caller-i (SmsReceiver
     * ar Test button) background thread theke dake, tai sleep safe. */
    public static boolean postSmsTo(String baseUrl, String appKey, String sender, String text) {
        return postSmsTo(baseUrl, appKey, sender, text, Instant.now().toString());
    }

    /** Inbox safety net-er jonno: SMS-er asol somoy (receivedAt) diye pathano. */
    public static boolean postSmsTo(String baseUrl, String appKey, String sender, String text,
                                    String receivedAt) {
        for (int attempt = 1; attempt <= 3; attempt++) {
            if (postSmsOnce(baseUrl, appKey, sender, text, receivedAt)) {
                return true;
            }
            if (attempt < 3) {
                Log.w(TAG, "POST /api/sms chesta " + attempt + " fail — 2s pore abar");
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
        return false;
    }

    /** Ekbar POST /api/sms — 2xx hole true. */
    private static boolean postSmsOnce(String baseUrl, String appKey, String sender, String text,
                                       String receivedAt) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("sender", sender);
            payload.put("text", text);
            payload.put("receivedAt", receivedAt);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);

            URL url = new URL(baseUrl + "/api/sms");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("x-app-key", appKey);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, "Server bollo " + code);
            }
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "POST /api/sms failed", e);
            return false;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
