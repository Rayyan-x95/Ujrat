// Pure Stripe helpers shared by stripe-checkout / stripe-webhook.
// No Deno imports: the unit suite exercises the real signature and amount
// logic (Web Crypto is available in both Deno and Node 20+).

export const SIGNATURE_TOLERANCE_SECONDS = 300

async function hmacHex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]
// The signed payload is "<t>.<raw body>", HMAC-SHA256 with the endpoint secret.
export async function verifyStripeSignature(
  rawBody: string,
  secret: string,
  header: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === 't') timestamp = value
    else if (key === 'v1') signatures.push(value.toLowerCase())
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || signatures.length === 0) return false
  if (Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = await hmacHex(`${timestamp}.${rawBody}`, secret)
  return signatures.some((signature) => timingSafeEqualHex(expected, signature))
}

// The charge is always derived server-side from the invoice's outstanding
// balance (rupees → integer paise). Never from a client-supplied amount.
export function invoiceAmountPaise(invoice: {
  outstanding_balance?: number | string | null
  total?: number | string | null
}): number {
  const amount = Number(invoice.outstanding_balance ?? invoice.total)
  return Math.round(amount * 100)
}
