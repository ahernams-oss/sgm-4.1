import { afterEach, describe, expect, it, vi } from "vitest";
import { notificarRpServidor } from "./notificacaoRP.server";

function banco() {
  const linhas: Record<string, unknown> = {
    requisicoes: { solicitante_usuario_id: "usuario-original" },
    empresa: { whatsapp_selecao: "120363414428403104@g.us" },
    usuarios: { telefone: "(21) 97124-4891" },
  };
  const eq = vi.fn();
  const db = { from: (tabela: string) => {
    const cadeia = { select: () => cadeia, limit: () => cadeia, eq: (...args: unknown[]) => { eq(...args); return cadeia; }, maybeSingle: async () => ({ data: linhas[tabela], error: null }) };
    return cadeia;
  } };
  return { db: db as unknown as Parameters<typeof notificarRpServidor>[0], eq };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("envio das etapas de pessoal", () => {
  it("busca o telefone pelo ID original e envia para os dois destinos cadastrados", async () => {
    vi.stubEnv("PLUGSEND_TOKEN", "test-only");
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetch);
    const { db, eq } = banco();
    expect(await notificarRpServidor(db, "rp-1", "Etapa registrada")).toEqual({ success: true, avisos: [] });
    expect(eq).toHaveBeenCalledWith("id", "usuario-original");
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(init.body).number)).toEqual(["120363414428403104@g.us", "5521971244891"]);
  });
  it("uma falha no grupo não impede a tentativa para o solicitante", async () => {
    vi.stubEnv("PLUGSEND_TOKEN", "test-only");
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetch);
    const { db } = banco();
    const resultado = await notificarRpServidor(db, "rp-1", "Contratação finalizada");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(resultado.success).toBe(false);
    expect(resultado.avisos).toHaveLength(1);
  });
});