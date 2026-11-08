package com.takatick.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/**
 * Payment SMS dhore server-e forward kore.
 *
 * SCOPE (ichchakrito choto rakha): sudhu 4 MFS sender-er SMS forward hoy —
 * bKash (16247), Nagad (16167), Rocket (16216), Upay (16268).
 * Onno kono SMS (OTP, bank, personal) pora ba pathano hoy na.
 * SMS jay shudhu merchant-er nijer configure kora server-e (MainActivity-te bosano URL).
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "TakaTickSms"

        // Sender match: naam ba short code — case-insensitive, substring match.
        private val MFS_SENDERS = listOf(
            "bkash" to "16247",
            "nagad" to "16167",
            "rocket" to "16216",
            "upay" to "16268"
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        // Broadcast sesh howar age network call sesh korte goAsync() lage.
        val pending = goAsync()

        Thread {
            try {
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                for (msg in messages) {
                    val sender = msg.originatingAddress ?: continue
                    val body = msg.messageBody ?: continue
                    if (!isMfsSender(sender)) {
                        continue // MFS SMS na — chupchap ignore.
                    }
                    Log.i(TAG, "MFS SMS from $sender, forwarding…")
                    val ok = ApiClient.postSms(context, sender, body)
                    Log.i(TAG, "Forward result for $sender: $ok")
                }
            } catch (e: Exception) {
                Log.e(TAG, "SMS forward failed", e)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun isMfsSender(sender: String): Boolean {
        val s = sender.lowercase()
        return MFS_SENDERS.any { (name, code) -> s.contains(name) || s.contains(code) }
    }
}
