'use client';

import { useEffect } from 'react';

// SabPaisa checkout's returnUrl — hands over to /payment/status, which verifies and activates the subscription
export default function PaymentReturnPage() {
  useEffect(() => {
    const txnId = new URLSearchParams(window.location.search).get('merchantTxnId') ?? '';
    window.location.replace(txnId ? `/payment/status?txnId=${encodeURIComponent(txnId)}` : '/subscription');
  }, []);

  return (
    <div className="k-body flex items-center justify-center min-h-[100dvh]">
      <div className="w-10 h-10 border-[3px] border-[#FACC15]/25 border-t-[#FACC15] rounded-full animate-spin" />
    </div>
  );
}
