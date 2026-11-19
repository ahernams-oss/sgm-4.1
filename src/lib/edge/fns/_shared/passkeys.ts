// Chaves de acesso (passkeys) do SGM: cadastro e login com digital / reconhecimento
// facial do próprio aparelho.
//
// O desafio do WebAuthn não fica em tabela: ele é devolvido ao navegador dentro de um
// token assinado (token-assinado), com um identificador de uso único, e só o servidor
// consegue forjá-lo. Assim a conferência continua válida mesmo com várias instâncias.
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type WebAuthnCredential,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { gerarToken, lerToken } from "./token-assinado";

export const ESCOPO_PASSKEY = "passkey";
export const NOME_RP = "SGM Lasant";
/** Janela, em segundos, para concluir a digital depois de abrir a janela do aparelho. */
const VALIDADE_ESTADO = 180;

export type ContextoRp = { origem: string; rpID: string };

/** Origem e RP ID reais da chamada: a digital só vale para este endereço. */
export function contextoRp(req: Request): ContextoRp {
  const cabecalho = (req.headers.get("origin") || "").trim();
  let origem = /^https?:\/\//i.test(cabecalho) ? cabecalho : "";
  if (!origem) {
    try {
      origem = new URL(req.url).origin;
    } catch {
      origem = "";
    }
  }
  let rpID = "";
  try {
    rpID = new URL(origem).hostname;
  } catch {
    rpID = "";
  }
  if (!origem || !rpID) throw new Error("Não foi possível identificar o endereço do acesso.");
  return { origem, rpID };
}

/** Mensagem em português para qualquer falha de conferência da digital. */
export function mensagemDigital(e: unknown): string {
  const bruto = e instanceof Error ? e.message : "";
  if (/digital|etapa|desafio/i.test(bruto)) return bruto;
  return "Não foi possível confirmar a digital neste aparelho. Tente de novo ou entre com a senha.";
}

/** Transports guardados como texto JSON na tabela. */
export function transportes(texto: unknown): string[] {
  if (typeof texto !== "string" || !texto) return [];
  try {
    const v = JSON.parse(texto);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Estado (desafio) assinado e de uso único
// ---------------------------------------------------------------------------

const jaUsados = new Map<string, number>();

function marcarComoUsado(jti: string): void {
  const agora = Date.now();
  for (const [chave, ate] of jaUsados) if (ate < agora) jaUsados.delete(chave);
  if (jaUsados.has(jti)) throw new Error("Esta etapa da digital já foi usada. Comece de novo.");
  jaUsados.set(jti, agora + (VALIDADE_ESTADO + 120) * 1000);
}

async function criarEstado(tipo: "reg" | "auth", desafio: string): Promise<string> {
  return gerarToken(
    ESCOPO_PASSKEY,
    JSON.stringify({ t: tipo, c: desafio, j: crypto.randomUUID() }),
    VALIDADE_ESTADO,
  );
}

/** Confere a assinatura e devolve o desafio, sem consumir o estado (uso em testes). */
export async function desafioDoEstado(
  tipo: "reg" | "auth",
  estado: unknown,
): Promise<string> {
  const bruto = await lerToken(ESCOPO_PASSKEY, estado);
  if (!bruto) throw new Error("A etapa da digital expirou. Tente de novo.");
  let dados: { t?: unknown; c?: unknown; j?: unknown };
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new Error("A etapa da digital é inválida.");
  }
  if (dados.t !== tipo || typeof dados.c !== "string" || typeof dados.j !== "string") {
    throw new Error("A etapa da digital é inválida.");
  }
  return dados.c;
}

/** Como `desafioDoEstado`, mas queima o estado para que ele não possa ser reutilizado. */
async function consumirEstado(tipo: "reg" | "auth", estado: unknown): Promise<string> {
  const desafio = await desafioDoEstado(tipo, estado);
  const bruto = await lerToken(ESCOPO_PASSKEY, estado);
  const jti = String(JSON.parse(bruto as string).j);
  marcarComoUsado(jti);
  return desafio;
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export type DigitalCadastrada = { credential_id: string; transports: unknown };

export type UsuarioParaRegistro = {
  id: string;
  nome?: string | null;
  email?: string | null;
};

export async function opcoesRegistro(
  ctx: ContextoRp,
  usuario: UsuarioParaRegistro,
  jaCadastradas: DigitalCadastrada[],
) {
  const opts = await generateRegistrationOptions({
    rpName: NOME_RP,
    rpID: ctx.rpID,
    userName: usuario.email || usuario.id,
    userDisplayName: usuario.nome || usuario.email || usuario.id,
    userID: new TextEncoder().encode(usuario.id),
    attestationType: "none",
    timeout: 60_000,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: jaCadastradas.map((k) => ({
      id: k.credential_id,
      transports: transportes(k.transports) as never,
    })),
  });
  return { opts, estado: await criarEstado("reg", opts.challenge) };
}

export type DigitalParaGravar = {
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  transports: string;
};

export async function conferirRegistro(
  ctx: ContextoRp,
  estado: unknown,
  resposta: RegistrationResponseJSON,
): Promise<DigitalParaGravar> {
  const desafio = await consumirEstado("reg", estado);
  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response: resposta,
    expectedChallenge: desafio,
    expectedOrigin: ctx.origem,
    expectedRPID: ctx.rpID,
    requireUserVerification: true,
  });
  if (!verified || !registrationInfo) throw new Error("A digital não pôde ser confirmada.");
  return {
    credential_id: registrationInfo.credential.id,
    public_key: isoBase64URL.fromBuffer(registrationInfo.credential.publicKey),
    counter: Number(registrationInfo.credential.counter ?? 0),
    device_type: registrationInfo.credentialDeviceType ?? "singleDevice",
    transports: JSON.stringify(resposta.response.transports ?? []),
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function opcoesLogin(ctx: ContextoRp) {
  const opts = await generateAuthenticationOptions({
    rpID: ctx.rpID,
    userVerification: "preferred",
    timeout: 60_000,
  });
  return { opts, estado: await criarEstado("auth", opts.challenge) };
}

export type DigitalGuardada = {
  credential_id: string;
  public_key: string;
  counter: unknown;
  transports: unknown;
};

export async function conferirLogin(
  ctx: ContextoRp,
  estado: unknown,
  resposta: AuthenticationResponseJSON,
  digital: DigitalGuardada,
): Promise<{ credentialId: string; newCounter: number }> {
  const desafio = await consumirEstado("auth", estado);
  if (resposta.id !== digital.credential_id) {
    throw new Error("A digital informada não corresponde à desta conta.");
  }
  const credential: WebAuthnCredential = {
    id: digital.credential_id,
    publicKey: isoBase64URL.toBuffer(digital.public_key),
    counter: Number(digital.counter ?? 0),
    transports: transportes(digital.transports) as never,
  };
  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response: resposta,
    expectedChallenge: desafio,
    expectedOrigin: ctx.origem,
    expectedRPID: ctx.rpID,
    credential,
    requireUserVerification: true,
  });
  if (!verified) throw new Error("A digital não pôde ser confirmada.");
  return {
    credentialId: authenticationInfo.credentialID,
    newCounter: Number(authenticationInfo.newCounter ?? 0),
  };
}
