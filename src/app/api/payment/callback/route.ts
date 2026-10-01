import { NextResponse } from 'next/server';

// Legacy route — the UPI gateway has no redirect/webhook; /payment/status polls /api/payment/verify
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  return NextResponse.redirect(`${appUrl}/subscription`, 303);
}
