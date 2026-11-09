import { describe, expect, it } from "vitest";
import type { OrdemServico } from "@/contexts/OrdensServicoContext";
import { somarOrdensSelecionadas } from "./faturamentoClientes";

const ordens = [
  { id: "os-1", materiais: [{ valorTotal: 100 }], materiaisEstoque: [{ valorTotal: 50 }], bdi: 10 },
  { id: "os-2", materiais: [{ valorTotal: 200 }], materiaisEstoque: [], bdi: 0 },
  { id: "os-3", materiais: [{ valorTotal: 500 }], materiaisEstoque: [], bdi: 0 },
] as OrdemServico[];

describe("somatório de O.S. selecionadas", () => {
  it("soma somente as marcadas incluindo materiais, estoque e BDI", () => {
    expect(somarOrdensSelecionadas(ordens, new Set(["os-1", "os-2"]))).toBe(365);
  });
  it("atualiza ao desmarcar uma O.S. e ao limpar a seleção", () => {
    const selecionadas = new Set(["os-1", "os-2"]);
    selecionadas.delete("os-1");
    expect(somarOrdensSelecionadas(ordens, selecionadas)).toBe(200);
    selecionadas.clear();
    expect(somarOrdensSelecionadas(ordens, selecionadas)).toBe(0);
  });
  it("inclui seleções de outras páginas sem somar registros inexistentes", () => {
    expect(somarOrdensSelecionadas(ordens, new Set(["os-1", "os-3", "ausente"]))).toBe(665);
  });
});