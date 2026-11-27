import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SolicitacoesServicosProvider, useSolicitacoesServicos } from "./SolicitacoesServicosContext";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), notify: vi.fn(), cache: undefined as QueryClient | undefined,
}));
vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: mocks.cache?.getQueryData(["solicitacoes_servicos"]) ?? [] }),
  useQueryClient: () => mocks.cache,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notificacaoSSEmergencial.functions", () => ({
  notificarSSSetorCritico: (...args: unknown[]) => mocks.notify(...args),
  notificarSSEmergencial: vi.fn(),
}));
vi.mock("@/lib/supabaseHelper", () => ({ insertRow: (...args: unknown[]) => mocks.insert(...args), fetchAll: vi.fn(), updateRow: vi.fn(), deleteRow: vi.fn() }));
vi.mock("@/lib/providerGate", () => ({ useProviderGate: () => false, useLoadGateAllowed: () => false, useActivateProvider: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ clientesPermitidosIds: ["cliente-hmaf"] }) }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

const salva = { id: "ss-91", numero: 91, cliente_id: "cliente-hmaf", cliente_nome: "HMAF", situacao: "Aguardando aprovação", prioridade: null, created_at: "2026-11-27T18:54:38Z" };

function consumidor() {
  let contexto: ReturnType<typeof useSolicitacoesServicos> | undefined;
  function Lista() {
    contexto = useSolicitacoesServicos();
    return contexto.solicitacoes.map(s => String(s.numero)).join(",");
  }
  const render = () => renderToStaticMarkup(createElement(SolicitacoesServicosProvider, { children: createElement(Lista) }));
  render();
  if (!contexto) throw new Error("Contexto não capturado");
  return { contexto, render };
}

beforeEach(() => {
  mocks.cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.insert.mockResolvedValue(salva);
  mocks.notify.mockResolvedValue({ success: true });
});
afterEach(() => { mocks.cache?.clear(); vi.clearAllMocks(); });

it("SS 91 aparece na lista sem depender de refetch com carregamento desativado", async () => {
  const { contexto, render } = consumidor();
  const result = await contexto.addSolicitacao({ cliente_id: "cliente-hmaf" });
  expect(result.numero).toBe(91);
  expect(render()).toBe("91");
  expect(mocks.notify).toHaveBeenCalledTimes(1);
});

it("a linha já está disponível enquanto o aviso WhatsApp ainda está pendente", async () => {
  let concluir: ((result: { success: boolean }) => void) | undefined;
  mocks.notify.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  const { contexto, render } = consumidor();
  const pendente = contexto.addSolicitacao({ cliente_id: "cliente-hmaf" });
  await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(1));
  expect(render()).toBe("91");
  if (!concluir) throw new Error("Aviso não iniciado");
  concluir({ success: true });
  await pendente;
});

it("falha do WhatsApp não remove a solicitação salva da lista", async () => {
  mocks.notify.mockRejectedValue(new Error("Desconectado"));
  const { contexto, render } = consumidor();
  await contexto.addSolicitacao({ cliente_id: "cliente-hmaf" });
  expect(render()).toBe("91");
});

it("falha ao gravar não insere linha nem envia aviso", async () => {
  mocks.insert.mockResolvedValue(null);
  const { contexto, render } = consumidor();
  await expect(contexto.addSolicitacao({})).rejects.toThrow("Não foi possível salvar");
  expect(render()).toBe("");
  expect(mocks.notify).not.toHaveBeenCalled();
});

it("atualização de cache mantém a restrição de clientes selecionados", async () => {
  mocks.insert.mockResolvedValue({ ...salva, cliente_id: "outro-cliente" });
  const { contexto, render } = consumidor();
  await contexto.addSolicitacao({});
  expect(render()).toBe("");
});