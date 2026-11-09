import { describe, it, expect } from "vitest";
import { historicoProntuario, resumoProntuario } from "./prontuarioEquipamento";

const os = (numero: number, equipamento_id: string, data: string, status = "Concluída", evidencias: unknown = []) =>
  ({ id: String(numero), numero, equipamento_id, data_conclusao: data, status, evidencias });

describe("prontuário do equipamento", () => {
  it("inclui só as O.S. do equipamento, em ordem cronológica", () => {
    const h = historicoProntuario([os(3, "A", "2026-03-01"), os(1, "B", "2026-01-01"), os(2, "A", "2026-01-15")], "A");
    expect(h.map((o) => o.numero)).toEqual([2, 3]);
  });

  it("conta intervenções e fotos de todo o histórico", () => {
    const h = historicoProntuario([os(1, "A", "2026-01-01", "Concluída", ["u1", "u2"]), os(2, "A", "2026-02-01", "Aguardando Confirmação", ["u3"])], "A");
    expect(resumoProntuario(h)).toEqual({ total: 2, concluidas: 1, fotos: 3, primeira: "2026-01-01", ultima: "2026-02-01" });
  });
});
