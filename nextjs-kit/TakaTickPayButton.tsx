// ============================================================
// TakaTick — Plug & Play Checkout Button (Next.js)
// FILE 1 of 2 — sudhu ei 2-ta file-i lagbe, ar kichu na
// ============================================================
// KOTHAI RAKHBEN:
//   Apnar Next.js site-er folder-e:  components/TakaTickPayButton.tsx
//
// KI KORTE HOBE (sudhu 2-ta step):
//   1) Niche TAKATICK_PAY_KEY-er jaygay dashboard theke pay key bosan.
//      (TakaTick dashboard → "Keys & pay link" → pay link-er /pay/-er
//      porer ongsho tai pay key, jemon: pay_09e2d6183c70f810e57ffba56bc37852)
//   2) Checkout page-e button-ta use korun:
//        <TakaTickPayButton amount={total} orderId={order.id} />
//      amount = TAKA-y (jemon ৳1500 hole amount={1500})
//      orderId = apnar order-er ID
//
// TARPOR KI HOBE:
//   Customer button-e click korlei TakaTick pay page-e jabe,
//   bKash/Nagad/Rocket/Upay diye pay kore TrxID verify korbe.
//   Payment confirm hole FILE 2 (webhook route) apnar order paid mark korbe.
// ============================================================

'use client';

const TAKATICK_PAY_KEY = 'pay_XXXX'; // 👉 EKHANE APNAR PAY KEY BOSAN
const TAKATICK_PAY_URL = 'https://takatick.onrender.com';

// Pay link banay — amount TAKA-y, orderId apnar order-er ID.
export function getTakaTickPayUrl(amount: number, orderId: string): string {
  return `${TAKATICK_PAY_URL}/pay/${TAKATICK_PAY_KEY}?amount=${amount}&order_id=${encodeURIComponent(orderId)}`;
}

type Props = {
  amount: number; // TAKA-y, jemon 1500
  orderId: string; // apnar order ID
  label?: string;
  className?: string;
};

export default function TakaTickPayButton({
  amount,
  orderId,
  label = 'bKash / Nagad / Rocket / Upay diye Pay korun',
  className,
}: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.location.href = getTakaTickPayUrl(amount, orderId);
      }}
    >
      {label}
    </button>
  );
}
