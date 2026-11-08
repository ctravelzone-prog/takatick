package com.takatick.sms;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.util.Log;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Inbox safety net (v1.4): broadcast receiver kono karone payment SMS
 * miss korle (receiver fire koreni, network fail, sender ochena — age
 * DK848KW31K-er khetre etai hoyeche), app khulle inbox scan kore
 * miss kora payment SMS server-e pathano hoy.
 *
 * SCOPE: sudhu payment-pattern SMS-i forward hoy (PaymentSms-er eki
 * rule — "received" + "Tk" + amount + "TrxID", ba MFS naam).
 * Onno kono SMS (OTP, bank, personal) pora ba pathano hoy na.
 * Scan bounded: shesh 7 din + notun 50-ta message-er moddhe.
 * Agge pathano TrxID SharedPreferences-e rakha hoy — server
 * INSERT OR IGNORE diyeo dedup kore, tai duplicate pathaleo khoti nei.
 * READ_SMS na thakle scan chupchap skip hoy. Broadcast receiver-i
 * primary (instant) poth thakbe — eta sudhu safety net.
 */
public final class InboxScanner {

    private static final String TAG = "TakaTickInbox";
    private static final int MAX_MESSAGES = 50;
    private static final long WINDOW_MS = 7L * 24 * 60 * 60 * 1000;
    private static final String PREFS = "takatick";
    private static final String KEY_FORWARDED = "inbox_forwarded_trxids";
    private static final int MAX_TRACKED = 500;

    private InboxScanner() {}

    /** App khulle / Save-er por background thread theke dakte hoy. */
    public static void scanAndForward(Context context) {
        if (context.checkSelfPermission(Manifest.permission.READ_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            Log.i(TAG, "READ_SMS nei — inbox scan skip");
            return;
        }
        String[] settings = ApiClient.getSettings(context);
        if (settings[0].isEmpty() || settings[1].isEmpty()) {
            Log.i(TAG, "Server URL / appKey set kora hoyni — inbox scan skip");
            return;
        }
        String baseUrl = settings[0];
        String appKey = settings[1];

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> forwarded = new HashSet<>(prefs.getStringSet(KEY_FORWARDED, new HashSet<>()));
        boolean changed = false;
        int forwardedNow = 0;

        Uri uri = Telephony.Sms.Inbox.CONTENT_URI;
        String[] projection = new String[]{"address", "body", "date"};
        long since = System.currentTimeMillis() - WINDOW_MS;
        String selection = "date >= ?";
        String[] selectionArgs = new String[]{String.valueOf(since)};
        String sortOrder = "date DESC LIMIT " + MAX_MESSAGES;

        try (Cursor cursor = context.getContentResolver().query(
                uri, projection, selection, selectionArgs, sortOrder)) {
            if (cursor == null) {
                Log.w(TAG, "Inbox query null — scan bondho");
                return;
            }
            int addressIdx = cursor.getColumnIndex("address");
            int bodyIdx = cursor.getColumnIndex("body");
            int dateIdx = cursor.getColumnIndex("date");
            while (cursor.moveToNext()) {
                String sender = addressIdx >= 0 ? cursor.getString(addressIdx) : null;
                String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : null;
                long date = dateIdx >= 0 ? cursor.getLong(dateIdx) : 0;
                if (body == null || !PaymentSms.looksLikePaymentSms(body)) {
                    continue;
                }
                String trxid = PaymentSms.extractTrxId(body);
                if (trxid == null) {
                    continue; // TrxID chara server-e pathale 422 hobe — skip.
                }
                if (forwarded.contains(trxid)) {
                    continue; // Agei pathano hoyeche.
                }
                String receivedAt = date > 0
                        ? Instant.ofEpochMilli(date).toString()
                        : Instant.now().toString();
                boolean ok = ApiClient.postSmsTo(
                        baseUrl, appKey, sender == null ? "" : sender, body, receivedAt);
                Log.i(TAG, "Inbox catch-up " + trxid + ": " + ok);
                if (ok) {
                    forwarded.add(trxid);
                    forwardedNow++;
                    changed = true;
                    if (forwarded.size() > MAX_TRACKED) {
                        forwarded.clear();
                        forwarded.add(trxid);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Inbox scan failed", e);
            return;
        }

        if (changed) {
            prefs.edit().putStringSet(KEY_FORWARDED, forwarded).apply();
        }
        Log.i(TAG, "Inbox scan sesh — notun forward: " + forwardedNow);
    }
}
