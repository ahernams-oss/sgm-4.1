import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entrouEmAprovacaoEmergencial } from "./notificacaoSSEmergencial";
import { avisarSSEmergencial } from "./notificacaoSSEmergencial.server";

afterEach(() => vi.unstubAllGlobals());

describe("aprovação emergencial", () => {
  it("avisa quando a SS passa a Aprovada com prioridade Emergencial", () => {
    expect(entrouEmAprovacaoEmergencial({ situacao: "Aguardando aprovação", prioridade: "" }, {
      situacao: "Aprovada", prioridade: "Emergencial",
    })).toBe(true);
  });
  it("avisa na aprovação por orçamento preservando prioridade emergencial", () => {
    expect(entrouEmAprovacaoEmergencial({ situacao: "Orçamento Disponível", prioridade: "Emergencial" }, {
      situacao: "Aprovada",
    })).toBe(true);
  });
  it.each(["Normal", "Urgente"])("não avisa aprovação %s", prioridade => {
    expect(entrouEmAprovacaoEmergencial(undefined, { situacao: "Aprovada", prioridade })).toBe(false);
  });
  it("não avisa edição comum ou aprovação já emergencial", () => {
    const anterior = { situacao: "Aprovada", prioridade: "Emergencial" };
    expect(entrouEmAprovacaoEmergencial(anterior, {})).toBe(false);
    expect(entrouEmAprovacaoEmergencial(anterior, { situacao: "Aprovada" })).toBe(false);
  });
});

function banco(situacao = "Aprovada", prioridade = "Emergencial", jid = "120363123456789@g.us") {
  const dados = {
    solicitacoes_servicos: { numero: 42, created_at: "2026-11-27", cliente_id: "cliente-correto", situacao, prioridade, descricao_servicos: "Vazamento", local_descricao: "Prédio A" },
    clientes: { nome: "Cliente correto", grupo_whatsapp_emergencia: jid, grupo_whatsapp: "120363999999999@g.us" },
  };
  const eq = vi.fn();
  const from = vi.fn((tabela: string) => ({ select: () => ({
    eq: (chave: string, valor: string) => {
      eq(tabela, chave, valor);
      return { maybeSingle: async () => ({ data: dados[tabela as keyof typeof dados], error: null }) };
    },
  }) }));
  return { db: { from } as unknown as SupabaseClient, eq };
}

it("envia só para o JID de emergência do cliente vinculado, não para o grupo normal", async () => {
  const { db, eq } = banco();
  const enviar = vi.fn(async () => Response.json({ success: true }));
  vi.stubGlobal("fetch", enviar);
  expect(await avisarSSEmergencial(db, "ss-42", "segredo-teste")).toEqual({ success: true });
  expect(eq).toHaveBeenCalledWith("clientes", "id", "cliente-correto");
  const chamada = enviar.mock.calls[0] as unknown as [string, RequestInit] | undefined;
  expect(chamada).toBeDefined();
  if (!chamada) throw new Error("Aviso não enviado");
  const body = JSON.parse(String(chamada[1].body));
  expect(body.number).toBe("120363123456789@g.us");
});

it.each([["Aguardando aprovação", "Emergencial"], ["Aprovada", "Normal"]])("servidor rejeita SS %s/%s", async (situacao, prioridade) => {
  const enviar = vi.fn();
  vi.stubGlobal("fetch", enviar);
  await expect(avisarSSEmergencial(banco(situacao, prioridade).db, "ss-42", "teste")).rejects.toThrow("aprovada como Emergencial");
  expect(enviar).not.toHaveBeenCalled();
});

it("não substitui grupo de emergência ausente pelo grupo normal", async () => {
  const enviar = vi.fn();
  vi.stubGlobal("fetch", enviar);
  await expect(avisarSSEmergencial(banco("Aprovada", "Emergencial", "").db, "ss-42", "teste")).rejects.toThrow("não cadastrado");
  expect(enviar).not.toHaveBeenCalled();
});

it("recusa do provedor não é tratada como envio confirmado", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false, error: "desconectado" })));
  await expect(avisarSSEmergencial(banco().db, "ss-42", "teste")).rejects.toThrow("desconectado");
});