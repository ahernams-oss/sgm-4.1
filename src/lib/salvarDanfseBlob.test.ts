import { afterEach, describe, expect, it, vi } from "vitest";
import { salvarDanfseBlob } from "./danfseOficial";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function ambiente(touch: boolean, share?: ReturnType<typeof vi.fn>) {
  const click = vi.fn();
  const revoke = vi.fn();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: touch }) });
  vi.stubGlobal("navigator", { canShare: () => Boolean(share), share });
  vi.stubGlobal("document", {
    createElement: () => ({ click, remove: vi.fn() }),
    body: { appendChild: vi.fn() },
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pdf-oficial");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
  vi.spyOn(globalThis, "setTimeout").mockImplementation((() => 1) as typeof setTimeout);
  return { click, revoke };
}

describe("entrega do DANFSe preparado", () => {
  const blob = new Blob(["%PDF-1.4\noriginal\n%%EOF"], { type: "application/pdf" });
  it("baixa no computador sem revogar a URL antes do download", async () => {
    const { click, revoke } = ambiente(false);
    await salvarDanfseBlob(blob, "danfse-590.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });
  it("entrega no celular o arquivo original com o nome e tipo PDF", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const { click } = ambiente(true, share);
    await salvarDanfseBlob(blob, "danfse-590.pdf");
    const arquivo = share.mock.calls[0][0].files[0] as File;
    expect(arquivo.name).toBe("danfse-590.pdf");
    expect(arquivo.type).toBe("application/pdf");
    expect(await arquivo.text()).toBe(await blob.text());
    expect(click).not.toHaveBeenCalled();
  });
  it("não inicia outro download quando o usuário cancela o compartilhamento", async () => {
    const { click } = ambiente(true, vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError")));
    await salvarDanfseBlob(blob, "danfse-590.pdf");
    expect(click).not.toHaveBeenCalled();
  });
  it("usa download quando o compartilhamento não está disponível", async () => {
    const { click } = ambiente(true, vi.fn().mockRejectedValue(new Error("Indisponível")));
    await salvarDanfseBlob(blob, "danfse-590.pdf");
    expect(click).toHaveBeenCalledOnce();
  });
});