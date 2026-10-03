// Server-only Paytm Business UPI — builds the upi:// link + QR locally and checks status with Paytm's MID-only API.
// Replaces the separate pp-kaama gateway; order ids keep its ORD… format so its pending orders still settle here.
import crypto from 'crypto';
import QRCode from 'qrcode';
import type { UpiOrder, UpiOrderStatus } from './upiGateway';

const STATUS_URL = 'https://securegw.paytm.in/order/status';

const cfg = () => ({
  mid: process.env.PAYTM_MID ?? '',
  vpa: process.env.PAYTM_VPA ?? '',
  payeeName: process.env.PAYTM_PAYEE_NAME ?? 'Kaama OTT',
  // What goes inside the upi:// link itself — Paytm's own merchant QR uses pn=Paytm & tn=Verified Paytm Merchant,
  // and mirroring it may keep GPay from flagging the payment as risky. Empty → payee name / order note.
  linkName: process.env.PAYTM_UPI_PN ?? '',
  linkNote: process.env.PAYTM_UPI_TN ?? '',
  // Optional merchant category code — matching the Paytm-registered one can calm GPay's risk warning
  mc: process.env.PAYTM_MC ?? '',
  expiryMs: (Number(process.env.PAYTM_ORDER_EXPIRY_MINUTES) || 10) * 60 * 1000,
});

// `tr` carries our order id — that's how Paytm's status API ties the payment back to the order
function buildUpiLink(c: ReturnType<typeof cfg>, orderId: string, amount: string, note: string) {
  const params = new URLSearchParams({
    pa: c.vpa,
    pn: c.linkName || c.payeeName,
    tr: orderId,
    am: amount,
    cu: 'INR',
    tn: c.linkNote || note,
  });
  if (c.mc) params.set('mc', c.mc);
  return `upi://pay?${params.toString().replace(/\+/g, '%20').replace(/%40/g, '@')}`;
}

export async function createPaytmOrder(amount: number, note: string): Promise<UpiOrder | { error: string }> {
  const c = cfg();
  if (!c.mid || !c.vpa) {
    console.error('Paytm env missing (PAYTM_MID / PAYTM_VPA)');
    return { error: 'Payment init failed' };
  }
  try {
    // Paytm order ids: alphanumeric only, max 50 chars
    const orderId = `ORD${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const amt = amount.toFixed(2);
    const upiLink = buildUpiLink(c, orderId, amt, note.slice(0, 50) || `Payment for ${orderId}`);
    return {
      orderId,
      amount,
      payeeName: c.payeeName,
      vpa: c.vpa,
      upiLink,
      qrCode: await QRCode.toDataURL(upiLink, { width: 300, margin: 1 }),
      expiresAt: new Date(Date.now() + c.expiryMs).toISOString(),
    };
  } catch (err) {
    console.error('Paytm create error:', err);
    return { error: 'Payment init failed' };
  }
}

export async function getPaytmOrderStatus(orderId: string): Promise<UpiOrderStatus | null> {
  const c = cfg();
  try {
    const jsonData = JSON.stringify({ MID: c.mid, ORDERID: orderId });
    const res = await fetch(`${STATUS_URL}?JsonData=${encodeURIComponent(jsonData)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d?.STATUS) return null;
    const status = String(d.STATUS).toUpperCase(); // TXN_SUCCESS | PENDING | TXN_FAILURE
    return {
      paid: status === 'TXN_SUCCESS',
      // An unpaid order also reports TXN_FAILURE ("Invalid Order Id") — only a real txn id means it actually failed
      failed: status === 'TXN_FAILURE' && !!d.TXNID,
      status,
      gatewayTxnId: d.BANKTXNID || d.TXNID || null,
      amount: parseFloat(d.TXNAMOUNT ?? '0') || 0,
      raw: d,
    };
  } catch (err) {
    console.error('Paytm status error:', err);
    return null;
  }
}
