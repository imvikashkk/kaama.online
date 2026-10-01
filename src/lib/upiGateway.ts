// Server-only client for the UPI gateway — URL comes from env and is never exposed to the browser
const baseUrl = () => (process.env.PAYMENT_GATEWAY_URL ?? '').replace(/\/+$/, '');

export interface UpiOrder {
  orderId: string;
  amount: number;
  payeeName: string;
  vpa: string;
  upiLink: string;
  qrCode: string;
  expiresAt: string | null;
}

export async function createUpiOrder(amount: number, note: string): Promise<UpiOrder | { error: string }> {
  try {
    const res = await fetch(`${baseUrl()}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.data?.orderId || !data.data?.upiLink) {
      return { error: data.message ?? 'Payment init failed' };
    }
    const d = data.data;
    return {
      orderId: String(d.orderId),
      amount: parseFloat(d.amount) || amount,
      payeeName: d.payeeName ?? '',
      vpa: d.vpa ?? '',
      upiLink: d.upiLink,
      qrCode: d.qrCode ?? '',
      expiresAt: d.expiresAt ?? null,
    };
  } catch (err) {
    console.error('UPI gateway create error:', err);
    return { error: 'Payment init failed' };
  }
}

const PAID_STATUSES = ['SUCCESS', 'PAID', 'COMPLETED', 'CAPTURED'];
const FAILED_STATUSES = ['FAILED', 'FAILURE', 'EXPIRED', 'CANCELLED', 'CANCELED', 'REJECTED'];

// Gateway status is the source of truth
export async function getUpiOrderStatus(orderId: string): Promise<{
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number;
  raw: object;
} | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/payment/status/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success || !data.data) return null;
    const d = data.data;
    const status = String(d.status ?? '').toUpperCase();
    return {
      paid: PAID_STATUSES.includes(status),
      failed: FAILED_STATUSES.includes(status),
      status,
      gatewayTxnId: d.bankTxnId ?? d.txnId ?? null,
      amount: parseFloat(d.amount ?? '0') || 0,
      raw: d,
    };
  } catch (err) {
    console.error('UPI gateway status error:', err);
    return null;
  }
}
