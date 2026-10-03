'use client';

import { useEffect } from 'react';

// SabPaisa checkout's returnUrl. Inside the pay sheet's iframe it pings the parent to verify right away;
// opened full screen (the "Full screen me kholo" fallback) it hands over to /payment/status, which verifies itself.
export default function PaymentReturnPage() {
  useEffect(() => {
    const txnId = new URLSearchParams(window.location.search).get('merchantTxnId') ?? '';
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'kaama-payment-return', txnId }, window.location.origin);
      return;
    }
    window.location.replace(txnId ? `/payment/status?txnId=${encodeURIComponent(txnId)}` : '/subscription');
  }, []);

  return (
    <div className="k-body flex flex-col items-center justify-center gap-4 min-h-[100dvh] bg-white">
      <div className="w-10 h-10 border-[3px] border-[#FACC15]/25 border-t-[#FACC15] rounded-full animate-spin" />
      <p className="m-0 text-sm text-black/60">Payment verify ho raha hai...</p>
    </div>
  );
}
