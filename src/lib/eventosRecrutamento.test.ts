import { describe, it, expect } from "vitest";
import { destinosRequisicao, eventosRecrutamento } from "./eventosRecrutamento";

describe("destinatários das requisições", () => {
  it("inclui Seleção e o telefone do usuário que abriu a RP", () => {
    expect(destinosRequisicao("120363414428403104@g.us", "(21) 97124-4891")).toEqual(["120363414428403104@g.us", "5521971244891"]);
  });
  it("não duplica o mesmo telefone formatado", () => {
    expect(destinosRequisicao("5521971244891", "(21) 97124-4891")).toEqual(["5521971244891"]);
  });
});
describe("etapas persistidas", () => {
  for (const [campo, valor] of Object.entries({ etapaAtual: "contratacao", statusPsicologico: "aprovado", statusTecnico: "reprovado", statusLiberacao: "aprovado", contratacaoFinalizada: true, documentos: [{ entregue: true }], exameAdmissional: { resultado: "apto" }, agendamentoData: "2026-11-13", portalEnviadoEm: "2026-11-13", lgpdAceite: true })) {
    it(`avisa a mudança de ${campo}`, () => expect(eventosRecrutamento({}, { [campo]: valor })).toHaveLength(1));
  }
  it("não avisa novamente sem mudança", () => expect(eventosRecrutamento({ statusTecnico: "aprovado" }, { statusTecnico: "aprovado" })).toEqual([]));
  it("agrupa data, hora e local no mesmo agendamento", () => expect(eventosRecrutamento({}, { agendamentoData: "2026-11-13", agendamentoHora: "10:00", agendamentoLocal: "Lasant" })).toEqual(["Agendamento atualizado"]));
});