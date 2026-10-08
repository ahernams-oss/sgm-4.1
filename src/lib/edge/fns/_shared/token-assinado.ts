// Tokens curtos assinados pelo servidor (HMAC-SHA256), para portais sem login
// no Supabase (fornecedor, link do candidato). O segredo é derivado da service
// role, que só existe no servidor; o cliente não consegue forjar o token.
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(pad + "===".slice((pad.length + 3) % 4));
}

async function chave(escopo: string): Promise<CryptoKey> {
  const base =
    process.env["PORTAL_TOKEN_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  if (!base) throw new Error("Segredo do servidor ausente");
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`${escopo}:${base}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function assinar(escopo: string, dados: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await chave(escopo), enc.encode(dados));
  return b64url(new Uint8Array(sig));
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Gera token para `sujeito`, válido por `validadeSeg` segundos. */
export async function gerarToken(escopo: string, sujeito: string, validadeSeg: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + validadeSeg;
  const corpo = b64url(enc.encode(JSON.stringify({ s: sujeito, e: exp })));
  return `${corpo}.${await assinar(escopo, corpo)}`;
}

/** Devolve o sujeito do token, ou null se inválido/expirado. */
export async function lerToken(escopo: string, token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [corpo, sig] = token.split(".");
  if (!corpo || !sig) return null;
  try {
    if (!iguais(sig, await assinar(escopo, corpo))) return null;
    const { s, e } = JSON.parse(b64urlDecode(corpo));
    if (typeof s !== "string" || typeof e !== "number" || e < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export const ESCOPO_FORNECEDOR = "portal-fornecedor";
export const ESCOPO_CANDIDATO = "portal-candidato-link";
