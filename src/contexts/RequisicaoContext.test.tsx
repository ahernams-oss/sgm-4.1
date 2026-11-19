import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/providerGate", () => ({
  useProviderGate: () => false,
  useActivateProvider: vi.fn(),
}));
vi.mock("@/lib/supabaseHelper", () => ({
  fetchAll: vi.fn(), insertRow: vi.fn(), updateRow: vi.fn(),
}));
vi.mock("@/lib/notificacaoRP", () => ({ enviarNotificacaoRP: vi.fn() }));

describe("identidade do contexto de requisições", () => {
  it("mantém o Provider montado ligado aos consumidores após atualizar o módulo", async () => {
    const { RequisicaoProvider } = await import("./RequisicaoContext");
    vi.resetModules();
    const { useRequisicoes } = await import("./RequisicaoContext");
    function ConsumidorAtualizado() {
      return String(useRequisicoes().requisicoes.length);
    }
    expect(renderToStaticMarkup(createElement(
      RequisicaoProvider, { children: createElement(ConsumidorAtualizado) },
    ))).toBe("0");
  });

  it("continua rejeitando consumidores realmente fora do Provider", async () => {
    const { useRequisicoes } = await import("./RequisicaoContext");
    function SemProvider() {
      useRequisicoes();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(SemProvider)))
      .toThrow("useRequisicoes must be used within RequisicaoProvider");
  });
});