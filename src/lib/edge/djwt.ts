// Equivalente do djwt (Deno) usando as APIs WebCrypto disponíveis no runtime.
type Payload = Record<string, unknown>;

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 ? '='.repeat(4 - (input.length % 4)) : '';
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function getNumericDate(exp: number | Date): number {
  return Math.round(
    (exp instanceof Date ? exp.getTime() : Date.now() + exp * 1000) / 1000,
  );
}

export async function create(
  header: { alg: string; typ?: string },
  payload: Payload,
  key: CryptoKey,
): Promise<string> {
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  );
  return `${data}.${b64url(sig)}`;
}

export async function verify(token: string, key: CryptoKey): Promise<Payload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const data = `${parts[0]}.${parts[1]}`;
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(parts[2] as string) as any,
    new TextEncoder().encode(data),
  );
  if (!ok) throw new Error('Assinatura inválida');
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1] as string))) as Payload;
  const exp = payload['exp'];
  if (typeof exp === 'number' && exp * 1000 < Date.now()) throw new Error('Token expirado');
  return payload;
}
