// ============================================================
// TakaTick — Plug & Play Webhook Route (Next.js App Router)
// FILE 2 of 2 — sudhu ei 2-ta file-i lagbe, ar kichu na
// ============================================================
// KOTHAI RAKHBEN:
//   Apnar Next.js site-er folder-e:  app/api/takatick-webhook/route.ts
//   (route.ts naam-ei thakte hobe, ar folder-ta hubhu ei naam-e hobe)
//
// KI KORTE HOBE (sudhu 3-ta step):
//   1) Niche TAKATICK_WEBHOOK_SECRET-er jaygay dashboard theke webhook
//      secret bosan.
//      (TakaTick dashboard → "Keys & pay link" → Show webhook secret)
//   2) TakaTick dashboard-e (Settings → webhook URL) bosan:
//        https://apnar-site.com/api/takatick-webhook
//   3) Niche markOrderPaid() function-er vitore TODO jaygay apnar order
//      PAID korar code likhun. Prottek site-er database alada, tai oi
//      ekta jayga sudhu apnar moto kore likhte hobe — baki sob ready.
//
// TARPOR KI HOBE:
//   Payment confirm holei TakaTick ei route-e janabe (payment.confirmed),
//   route signature check kore (fake webhook dhora pore jabe) apnar
//   markOrderPaid() chalabe — order auto paid hoye jabe.
//   ⚠️ API key ekhane lage na — webhook secret-i enough.
// ============================================================

import crypto from 'node:crypto';

const TAKATICK_WEBHOOK_SECRET = 'XXXX'; // 👉 EKHANE APNAR WEBHOOK SECRET BOSAN

type PaymentConfirmed = {
  event: 'payment.confirmed';
  order_id: string | null;
  transactionId: string; // TrxID
  method: string; // bkash | nagad | rocket | upay
  amount: number; // TAKA-y
  sender: string | null;
  confirmedAt: string;
};

// 👉 TODO: ekhane apnar order PAID korar code likhun.
// Payload theke paben: payload.order_id, payload.amount (taka),
// payload.transactionId (TrxID), payload.method.
// Example (apnar database onujayi bodle nin):
//   await db.orders.update({ id: payload.order_id }, { status: 'paid' });
async function markOrderPaid(payload: PaymentConfirmed): Promise<void> {
  console.log(
    '[TakaTick] payment confirmed:',
    payload.order_id,
    payload.amount,
    payload.transactionId,
  );
  // TODO: apnar database-e order paid korun
}

// TakaTick webhook-er signature check — HMAC-SHA256, header X-Signature.
// Raw body diyei check korte hoy (JSON parse kore abar stringify korle
// signature milbe na), tai age req.text() newa hoyeche.
function signatureIsValid(
  secret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!signatureIsValid(TAKATICK_WEBHOOK_SECRET, rawBody, signature)) {
    return Response.json({ ok: false, error: 'BAD_SIGNATURE' }, { status: 401 });
  }

  let payload: PaymentConfirmed;
  try {
    payload = JSON.parse(rawBody) as PaymentConfirmed;
  } catch {
    return Response.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
  }

  if (payload.event === 'payment.confirmed') {
    await markOrderPaid(payload);
  }

  return Response.json({ ok: true, received: true });
}
