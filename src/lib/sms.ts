// DLT-approved template — text must match the registered template exactly
const OTP_TEMPLATE =
  'Your OTP for verification is {var}. Please do not share this OTP with anyone. - Right Sight Research';

export async function sendOtpSms(mobile: string, otp: string): Promise<boolean> {
  const params = new URLSearchParams({
    apikey: process.env.SMS_API_KEY!,
    senderid: process.env.SMS_SENDER_ID!,
    templateid: process.env.SMS_TEMPLATE_ID!,
    number: mobile,
    // DLT {var} allows up to 30 chars — "123456 (valid for 10 minutes)" is 29
    message: OTP_TEMPLATE.replace('{var}', `${otp} (valid for 10 minutes)`),
  });
  try {
    const res = await fetch(`https://smsfortius.org/V2/apikey.php?${params}`);
    const body = await res.text();
    if (!res.ok) {
      console.error('OTP SMS failed:', res.status, body);
      return false;
    }
    console.log('OTP SMS:', body);
    return true;
  } catch (err) {
    console.error('OTP SMS error:', err);
    return false;
  }
}
