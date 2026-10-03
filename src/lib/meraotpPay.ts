// Server-only MeraOTP payment links — hosted payment page, verified with the order id + expected amount
import crypto from 'crypto';
import type { UpiOrder, UpiOrderStatus } from './upiGateway';

const BASE_URL = 'https://meraotp.in/api/v1/payments';
// Our own countdown on /payment/status — MeraOTP doesn't report a link expiry
const EXPIRY_MINUTES = 30;
// Order ids carry this prefix so status checks can be routed back here after a provider switch
export const MERAOTP_ORDER_PREFIX = 'MOP';

const cfg = () => ({
  // Same account key as OTP unless a separate payments key is set
  apiKey: process.env.MERAOTP_PAY_API_KEY || process.env.MERAOTP_API_KEY || '',
  payeeName: process.env.PAYTM_PAYEE_NAME ?? 'Kaama OTT',
});

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

export async function createMeraotpOrder(amount: number, note: string): Promise<UpiOrder | { error: string }> {
  const c = cfg();
  if (!c.apiKey) {
    console.error('MeraOTP env missing (MERAOTP_PAY_API_KEY / MERAOTP_API_KEY)');
    return { error: 'Payment init failed' };
  }

  const orderId = `${MERAOTP_ORDER_PREFIX}${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

  try {
    const res = await fetch(`${BASE_URL}/links`, {
      method: 'POST',
      headers: headers(c.apiKey),
      body: JSON.stringify({
        amount: amount.toFixed(2),
        order_id: orderId,
        note: note.slice(0, 100),
        // Our own txnId rides along so /payment/return works whatever MeraOTP appends
        redirect_url: `${appUrl}/payment/return?txnId=${orderId}`,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    const paymentUrl: string | undefined = data?.data?.payment_url;
    if (!res.ok || !paymentUrl) {
      console.error('MeraOTP create failed:', res.status, JSON.stringify(data).slice(0, 500));
      return { error: 'Payment init failed' };
    }

    return {
      orderId,
      amount,
      payeeName: c.payeeName,
      vpa: '',
      upiLink: '',
      qrCode: '',
      checkoutUrl: paymentUrl,
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error('MeraOTP create error:', err);
    return { error: 'Payment init failed' };
  }
}

// Only `verified` is documented; anything clearly terminal-failed is treated as failed, the rest stays pending
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'REJECTED'];

export async function getMeraotpOrderStatus(orderId: string, expectedAmount: number): Promise<UpiOrderStatus | null> {
  const c = cfg();
  try {
    const res = await fetch(`${BASE_URL}/verify`, {
      method: 'POST',
      headers: headers(c.apiKey),
      body: JSON.stringify({ order_id: orderId, expected_amount: expectedAmount.toFixed(2) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => null);
    const d = data?.data;
    if (!d) return null;
    const status = String(d.payment_status ?? '').toUpperCase();
    const paid = res.ok && status === 'VERIFIED';
    return {
      paid,
      failed: FAILED_STATUSES.includes(status),
      status,
      gatewayTxnId: d.utr ?? d.bank_txn_id ?? d.txn_id ?? d.transaction_id ?? null,
      // verify already matched expected_amount server-side; fall back to it when no amount field comes back
      amount: parseFloat(d.amount ?? d.paid_amount ?? '') || (paid ? expectedAmount : 0),
      raw: data,
    };
  } catch (err) {
    console.error('MeraOTP status error:', err);
    return null;
  }
}
