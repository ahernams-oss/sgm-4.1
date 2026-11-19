// Chaves de acesso (passkeys) no navegador: digital / reconhecimento facial do aparelho.
//
// Nada aqui decide quem entra: o servidor confere a assinatura e devolve o tokenHash
// que abre a sessão do Supabase. Este módulo só conversa com o aparelho.
import { supabase } from "@/integrations/supabase/client";

export type DigitalCadastrada = {
  id: string;
  credential_id?: string;
  nome: string | null;
  device_type: string | null;
  transports: unknown;
  criado_em: string | null;
  ultimo_uso: string | null;
};

export type Disponibilidade = { ok: boolean; motivo: string };

/** A digital funciona aqui? (navegador, endereço seguro e aparelho com leitor) */
export async function disponibilidadeDigital(): Promise<Disponibilidade> {
  if (typeof window === "undefined") {
    return { ok: false, motivo: "A digital só funciona no navegador." };
  }
  const { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } = await import(
    "@simplewebauthn/browser"
  );
  if (!browserSupportsWebAuthn()) {
    return { ok: false, motivo: "Este navegador não suporta acesso com digital." };
  }
  if (!window.isSecureContext) {
    return { ok: false, motivo: "A digital só funciona em endereços seguros (https)." };
  }
  try {
    const temLeitor = await platformAuthenticatorIsAvailable();
    if (!temLeitor) {
      return { ok: false, motivo: "Nenhuma digital encontrada neste aparelho." };
    }
  } catch {
    return { ok: false, motivo: "A digital não está disponível neste aparelho." };
  }
  return { ok: true, motivo: "" };
}

async function chamar(nome: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(nome, { body });
  if (error) {
    let msg = (data as { error?: string } | null)?.error;
    try {
      msg = msg || (await (error as unknown as { context?: Response }).context?.json())?.error;
    } catch {
      /* sem corpo */
    }
    throw new Error(msg || "Não foi possível falar com o servidor.");
  }
  return data as Record<string, unknown>;
}

/** Digitais já cadastradas para o usuário logado. */
export async function listarDigitais(): Promise<DigitalCadastrada[]> {
  const data = await chamar("passkey-portal", { acao: "listar" });
  return (data?.digitais ?? []) as DigitalCadastrada[];
}

/** Cadastro de uma nova digital: abre a janela do aparelho e grava a chave no servidor. */
export async function cadastrarDigital(nome: string): Promise<void> {
  const inicio = await chamar("passkey-portal", { acao: "registrar-inicio" });
  if (!inicio?.opts) throw new Error("O servidor não pôde iniciar o cadastro da digital.");

  const { startRegistration } = await import("@simplewebauthn/browser");
  const resposta = await startRegistration({
    optionsJSON: inicio.opts as never,
  });

  await chamar("passkey-portal", { acao: "registrar-fim", estado: inicio.estado, resposta, nome });
}

/** Remove uma digital cadastrada. */
export async function removerDigital(id: string): Promise<void> {
  await chamar("passkey-portal", { acao: "remover", id });
}

/**
 * Login com digital na tela de entrada. Devolve o tokenHash para o navegador abrir
 * a sessão, ou null quando o aparelho não tem digital cadastrada.
 */
export async function iniciarLoginDigital() {
  const inicio = await chamar("passkey-login", { acao: "inicio" });
  if (!inicio?.opts) throw new Error("O servidor não pôde iniciar o acesso com digital.");
  return inicio as { opts: unknown; estado: string };
}

export async function concluirLoginDigital(
  estado: string,
  resposta: unknown,
): Promise<{ usuario: Record<string, unknown>; tokenHash: string | null; email: string }> {
  const data = await chamar("passkey-login", { acao: "fim", estado, resposta });
  return {
    usuario: (data?.usuario ?? {}) as Record<string, unknown>,
    tokenHash: (data?.tokenHash as string | null) ?? null,
    email: String(data?.email ?? ""),
  };
}
