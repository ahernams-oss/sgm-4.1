import { beforeAll, describe, expect, it } from "vitest";
import { isoCBOR } from "@simplewebauthn/server/helpers";

// O segredo do token assinado só existe no servidor; no teste usamos um valor fixo.
beforeAll(() => {
  process.env.PORTAL_TOKEN_SECRET ??= "segredo-de-teste-passkeys";
});

import {
  contextoRp,
  opcoesRegistro,
  conferirRegistro,
  opcoesLogin,
  conferirLogin,
  desafioDoEstado,
  mensagemDigital,
  type DigitalGuardada,
} from "./passkeys";

// ---------------------------------------------------------------------------
// Autenticador de software: assina os desafios com uma chave P-256 gerada no
// próprio teste, imitando o que o aparelho faz com a digital do usuário.
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(dados: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", dados));
}

function concat(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function cborMap(entradas: [unknown, unknown][]): Uint8Array {
  return isoCBOR.encode(new Map(entradas)) as Uint8Array;
}

// A assinatura sai como r||s; o servidor espera o formato DER padrão do WebAuthn.
function rawParaDer(sig: Uint8Array): Uint8Array {
  const inteiro = (b: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    const t = b.slice(i);
    const corpo = t[0] & 0x80 ? new Uint8Array([0, ...t]) : t;
    return new Uint8Array([0x02, corpo.length, ...corpo]);
  };
  const r = inteiro(sig.slice(0, 32));
  const s = inteiro(sig.slice(32));
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
}

const ORIGEM = "http://localhost:8080";
const RP_ID = "localhost";

function requisicao(): Request {
  return new Request(`${ORIGEM}/api/public/edge/passkey-login`, {
    headers: { origin: ORIGEM },
  });
}

async function criarParDeChaves() {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  return {
    par,
    // COSE key EC2/P-256: kty=2, alg=-7 (ES256), crv=1 (P-256), x, y
    cose: cborMap([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, raw.slice(1, 33)],
      [-3, raw.slice(33, 65)],
    ]),
  };
}

const AAGUID = new Uint8Array(16);

async function montarRespostaRegistro(
  desafio: string,
  credentialId: Uint8Array,
  chave: { par: CryptoKeyPair; cose: Uint8Array },
) {
  const rpIdHash = await sha256(enc.encode(RP_ID));
  // UP | UV | AT
  const flags = new Uint8Array([0x45]);
  const counter = u32(1);
  const authData = concat(
    rpIdHash,
    flags,
    counter,
    AAGUID,
    u16(credentialId.length),
    credentialId,
    chave.cose,
  );
  const attestationObject = cborMap([
    ["fmt", "none"],
    ["attStmt", new Map()],
    ["authData", authData],
  ]);
  const clientData = enc.encode(
    JSON.stringify({ type: "webauthn.create", challenge: desafio, origin: ORIGEM, crossOrigin: false }),
  );
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    type: "public-key" as const,
    clientExtensionResults: {},
    authenticatorAttachment: "platform" as const,
    response: {
      clientDataJSON: b64url(clientData),
      attestationObject: b64url(attestationObject),
      transports: ["internal"],
    },
  };
}

async function montarRespostaLogin(
  desafio: string,
  credentialId: Uint8Array,
  chave: CryptoKeyPair,
  counter: number,
) {
  const rpIdHash = await sha256(enc.encode(RP_ID));
  // UP | UV
  const authData = concat(rpIdHash, new Uint8Array([0x05]), u32(counter));
  const clientData = enc.encode(
    JSON.stringify({ type: "webauthn.get", challenge: desafio, origin: ORIGEM, crossOrigin: false }),
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      chave.privateKey,
      concat(authData, await sha256(clientData)),
    ),
  );
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    type: "public-key" as const,
    clientExtensionResults: {},
    authenticatorAttachment: "platform" as const,
    response: {
      clientDataJSON: b64url(clientData),
      authenticatorData: b64url(authData),
      signature: b64url(rawParaDer(assinatura)),
      userHandle: null,
    },
  };
}

// ---------------------------------------------------------------------------

describe("acesso com digital (passkeys)", () => {
  beforeAll(() => {
    process.env.PORTAL_TOKEN_SECRET ??= "segredo-de-teste-passkeys";
  });

  it("usa o endereço real da chamada como origem e identificador do sistema", () => {
    const ctx = contextoRp(requisicao());
    expect(ctx).toEqual({ origem: ORIGEM, rpID: RP_ID });
  });

  it("recusa uma chamada sem origem nem endereço identificáveis", () => {
    expect(() => contextoRp(new Request("about:blank"))).toThrow();
  });

  it("cadastra a digital e devolve a chave pública para guardar", async () => {
    const ctx = contextoRp(requisicao());
    const usuario = { id: "u-1", nome: "Anselmo", email: "anselmo@lasant.com.br" };
    const { estado } = await opcoesRegistro(ctx, usuario, []);
    const desafio = await desafioDoEstado("reg", estado);

    const credentialId = new Uint8Array(32).map((_, i) => i + 1);
    const chave = await criarParDeChaves();
    const resposta = await montarRespostaRegistro(desafio, credentialId, chave);

    const gravar = await conferirRegistro(ctx, estado, resposta);
    expect(gravar.credential_id).toBe(b64url(credentialId));
    expect(gravar.public_key.length).toBeGreaterThan(20);
    expect(gravar.counter).toBe(1);
    expect(gravar.device_type).toBe("singleDevice");
    expect(JSON.parse(gravar.transports)).toEqual(["internal"]);
  });

  it("não deixa usar duas vezes a mesma etapa do cadastro", async () => {
    const ctx = contextoRp(requisicao());
    const { estado } = await opcoesRegistro(
      ctx,
      { id: "u-2", nome: "Lais", email: "lais@lasant.com.br" },
      [],
    );
    const desafio = await desafioDoEstado("reg", estado);
    const credentialId = new Uint8Array(16).fill(7);
    const chave = await criarParDeChaves();
    const resposta = await montarRespostaRegistro(desafio, credentialId, chave);

    await conferirRegistro(ctx, estado, resposta);
    await expect(conferirRegistro(ctx, estado, resposta)).rejects.toThrow(/já foi usada/i);
  });

  it("conclui o login com a digital cadastrada e atualiza o contador", async () => {
    const ctx = contextoRp(requisicao());
    const usuario = { id: "u-3", nome: "Ana", email: "ana@lasant.com.br" };
    const { estado: estadoReg } = await opcoesRegistro(ctx, usuario, []);
    const desafioReg = await desafioDoEstado("reg", estadoReg);
    const credentialId = new Uint8Array(24).map((_, i) => i + 100);
    const chave = await criarParDeChaves();
    const gravar = await conferirRegistro(
      ctx,
      estadoReg,
      await montarRespostaRegistro(desafioReg, credentialId, chave),
    );

    const digital: DigitalGuardada = {
      credential_id: gravar.credential_id,
      public_key: gravar.public_key,
      counter: gravar.counter,
      transports: gravar.transports,
    };

    const { estado } = await opcoesLogin(ctx);
    const desafio = await desafioDoEstado("auth", estado);
    const resposta = await montarRespostaLogin(desafio, credentialId, chave.par, 2);

    const conferida = await conferirLogin(ctx, estado, resposta, digital);
    expect(conferida.credentialId).toBe(gravar.credential_id);
    expect(conferida.newCounter).toBe(2);
  });

  it("rejeita o login quando a digital não é a desta conta", async () => {
    const ctx = contextoRp(requisicao());
    const { estado } = await opcoesLogin(ctx);
    const desafio = await desafioDoEstado("auth", estado);
    const credentialId = new Uint8Array(8).fill(3);
    const chave = await criarParDeChaves();
    const resposta = await montarRespostaLogin(desafio, credentialId, chave.par, 5);

    // Chave pública de OUTRA digital guardada no lugar da que assinou a resposta.
    const outra = await criarParDeChaves();
    const digital: DigitalGuardada = {
      credential_id: b64url(new Uint8Array(8).fill(9)),
      public_key: b64url(outra.cose),
      counter: 0,
      transports: "[]",
    };

    await expect(conferirLogin(ctx, estado, resposta, digital)).rejects.toThrow(
      /não corresponde/i,
    );
  });

  it("traduz falhas técnicas para o português", () => {
    expect(mensagemDigital(new Error("Challenge did not match"))).toMatch(
      /Não foi possível confirmar a digital/,
    );
    expect(mensagemDigital(new Error("A etapa da digital expirou."))).toMatch(/expirou/);
  });
});
