package com.takatick.sms

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * TakaTick server-er POST /api/sms endpoint-e SMS pathay.
 * Header: x-app-key (merchant-er appKey — kokhono code-e hardcode korben na,
 * MainActivity-te merchant nije bosabe).
 */
object ApiClient {
    private const val TAG = "TakaTickApi"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json; charset=utf-8".toMediaType()

    /** Server URL + appKey SharedPreferences theke nin. */
    fun getSettings(context: Context): Pair<String, String> {
        val prefs = context.getSharedPreferences("takatick", Context.MODE_PRIVATE)
        val baseUrl = prefs.getString("server_url", "")?.trim()?.trimEnd('/') ?: ""
        val appKey = prefs.getString("app_key", "")?.trim() ?: ""
        return baseUrl to appKey
    }

    /** Ekta SMS server-e pathan. Success hole true. */
    fun postSms(context: Context, sender: String, text: String): Boolean {
        val (baseUrl, appKey) = getSettings(context)
        if (baseUrl.isEmpty() || appKey.isEmpty()) {
            Log.w(TAG, "Server URL / appKey set kora hoyni — SMS pathano holo na")
            return false
        }
        return postSmsTo(baseUrl, appKey, sender, text)
    }

    /** Test button-er jonno: direct URL + key diye pathano. */
    fun postSmsTo(baseUrl: String, appKey: String, sender: String, text: String): Boolean {
        return try {
            val payload = JSONObject().apply {
                put("sender", sender)
                put("text", text)
                put("receivedAt", java.time.Instant.now().toString())
            }
            val req = Request.Builder()
                .url("$baseUrl/api/sms")
                .header("x-app-key", appKey)
                .post(payload.toString().toRequestBody(JSON))
                .build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) Log.w(TAG, "Server bollo ${res.code}")
                res.isSuccessful
            }
        } catch (e: Exception) {
            Log.e(TAG, "POST /api/sms failed", e)
            false
        }
    }
}
