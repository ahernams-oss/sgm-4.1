import { describe, expect, it } from "vitest";
import { reconcileColumnOrder } from "./useColumnOrder";

const DEFAULTS = [
  "numero", "dataHora", "solicitante", "tipo", "cliente", "local",
  "pavimento", "setor", "equipamento", "descricao", "situacao", "orcamento", "os", "visitado",
];

describe("reconcileColumnOrder", () => {
  it("inserta coluna nova ao lado da vizinha padrão quando o usuário já reordenou", () => {
    // Usuário salvou a ordem sem "orcamento" (coluna que acabou de ser criada).
    const saved = ["numero", "dataHora", "cliente", "descricao", "situacao", "os", "visitado"];
    const order = reconcileColumnOrder(DEFAULTS, saved);
    expect(order[order.indexOf("situacao") + 1]).toBe("orcamento");
  });

  it("mantém a ordem relativa salva do usuário para as colunas existentes", () => {
    const saved = ["cliente", "numero", "situacao", "os"];
    const order = reconcileColumnOrder(DEFAULTS, saved);
    const pos = saved.map(k => order.indexOf(k));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    expect(order).toHaveLength(DEFAULTS.length);
  });

  it("remove colunas que não existem mais e não duplica as existentes", () => {
    const saved = ["numero", "fantasma", "orcamento", "numero"];
    const order = reconcileColumnOrder(DEFAULTS, saved);
    expect(order).not.toContain("fantasma");
    expect(order.filter(k => k === "numero")).toHaveLength(1);
    expect(order).toHaveLength(DEFAULTS.length);
  });

  it("sem ordem salva devolve a ordem padrão", () => {
    expect(reconcileColumnOrder(DEFAULTS, [])).toEqual(DEFAULTS);
  });
});
