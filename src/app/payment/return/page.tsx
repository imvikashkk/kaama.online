'use client';

import { useEffect } from 'react';

// Hosted checkout returnUrl (SabPaisa / MeraOTP) — hands over to /payment/status, which verifies and activates the subscription
export default function PaymentReturnPage() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const txnId = sp.get('txnId') ?? sp.get('merchantTxnId') ?? '';
    window.location.replace(txnId ? `/payment/status?txnId=${encodeURIComponent(txnId)}` : '/subscription');
  }, []);

  return (
    <div className="k-body flex items-center justify-center min-h-[100dvh]">
      <div className="w-10 h-10 border-[3px] border-[#FACC15]/25 border-t-[#FACC15] rounded-full animate-spin" />
    </div>
  );
}
