import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), storage: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, storage: { from: mocks.storage } } }));
import { carregarDadosImpressaoOs, escolherMemoriaImpressao, resolverImagemImpressaoOs } from "./dadosImpressaoOs";

describe("anexos da impressão de OS", () => {
  beforeEach(() => vi.resetAllMocks());
  it("carrega fotos e memória atuais mesmo que a grade esteja vazia ou desatualizada", async () => {
    const memoria = [{ titulo: "Fechaduras" }];
    const eq = vi.fn((campo, id) => campo === "id"
      ? { single: async () => ({ data: { fotos: [{ url: "foto-atual" }], solicitacao_id: "ss-4" } }) }
      : Promise.resolve({ data: [{ status: "Aprovado", memoria_calculo: memoria }] }));
    mocks.from.mockReturnValue({ select: () => ({ eq }) });
    const result = await carregarDadosImpressaoOs({ os: { id: "os-5", fotos: [], solicitacaoId: "ss-4" } as any, memoriaCalculo: [] }, true);
    expect(result.os.fotos).toEqual([{ id: "foto-atual", url: "foto-atual", observacao: undefined }]);
    expect(result.memoriaCalculo).toEqual(memoria);
    expect(eq).toHaveBeenCalledWith("solicitacao_id", "ss-4");
  });
  it("prefere a memória aprovada em vez de revisão pendente", () => {
    expect(escolherMemoriaImpressao([
      { status: "Pendente", created_at: "2026-10-23", memoria_calculo: ["pendente"] },
      { status: "Aprovado", created_at: "2026-10-22", memoria_calculo: ["aprovada"] },
    ])).toEqual(["aprovada"]);
  });
  it("não gera silenciosamente um relatório vazio quando a consulta falha", async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ error: { message: "Negado" } }) }) }) });
    await expect(carregarDadosImpressaoOs({ os: { id: "os-5" } as any }, true)).rejects.toThrow("Negado");
  });
  it("assina a URL antiga de foto em bucket privado", async () => {
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://sgm.test/foto-assinada" } }));
    mocks.storage.mockReturnValue({ getPublicUrl: () => ({ data: { publicUrl: "https://sgm.test/storage/v1/object/public/evidencias-anexos/_" } }), createSignedUrl });
    expect(await resolverImagemImpressaoOs("https://sgm.test/storage/v1/object/public/evidencias-anexos/os/foto.png")).toBe("https://sgm.test/foto-assinada");
    expect(createSignedUrl).toHaveBeenCalledWith("os/foto.png", 3600);
  });
});