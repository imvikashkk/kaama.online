// Server-only payment gateway switch — PAYMENT_PROVIDER=sabpaisa uses SabPaisa hosted checkout,
// otherwise the UPI gateway at PAYMENT_GATEWAY_URL (never exposed to the browser)
import { createSabpaisaOrder, getSabpaisaOrderStatus } from './sabpaisa';

const baseUrl = () => (process.env.PAYMENT_GATEWAY_URL ?? '').replace(/\/+$/, '');

export interface UpiOrder {
  orderId: string;
  gatewayOrderId?: string;
  amount: number;
  payeeName: string;
  vpa: string;
  upiLink: string;
  qrCode: string;
  // Hosted checkout page (SabPaisa) — the client redirects there instead of showing UPI options
  checkoutUrl?: string;
  expiresAt: string | null;
}

export interface UpiOrderStatus {
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number;
  raw: object;
}

export async function createUpiOrder(
  amount: number,
  note: string,
  customer: { userId: number; mobile: string },
): Promise<UpiOrder | { error: string }> {
  if (process.env.PAYMENT_PROVIDER === 'sabpaisa') return createSabpaisaOrder(amount, note, customer);
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

// Routed by the order id's own prefix, so orders created before a provider switch still settle
export async function getUpiOrderStatus(orderId: string): Promise<UpiOrderStatus | null> {
  if (orderId.startsWith('KAAMA_')) return getSabpaisaOrderStatus(orderId);
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
