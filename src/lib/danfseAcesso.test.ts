import { describe, expect, it, vi } from "vitest";
import { exigirAcessoDanfse } from "./danfseAcesso.server";

describe("autorização do download oficial", () => {
  it.each(["financeiro.nfes_recebidas", "faturamentos"])("aceita autorização de %s pela sessão validada", async (modulo) => {
    const rpc = vi.fn().mockImplementation(async (_nome, { _prefixo }) => ({ data: _prefixo === modulo, error: null }));
    await expect(exigirAcessoDanfse({ rpc } as unknown as Parameters<typeof exigirAcessoDanfse>[0])).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("has_module_prefix", { _prefixo: modulo });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("recusa usuário sem autorização nos dois módulos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(exigirAcessoDanfse({ rpc } as unknown as Parameters<typeof exigirAcessoDanfse>[0])).rejects.toThrow("não possui permissão");
  });
  it("não transforma falha de consulta em falta de permissão nem libera o PDF", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "indisponível" } });
    await expect(exigirAcessoDanfse({ rpc } as unknown as Parameters<typeof exigirAcessoDanfse>[0])).rejects.toThrow("Não foi possível conferir");
  });
});