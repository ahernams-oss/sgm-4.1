import { describe, it, expect } from "vitest";
import { mensagemAtualizacaoStatus, mensagemNovaRequisicao } from "./mensagensRequisicao";

const base = { numero: 42, cargoNome: "Técnico de Enfermagem", unidade: "UPA VILA KENNEDY", status: "Aprovada", agora: "13/11/2026 09:00:00" };

describe("mensagem de aprovação da requisição de pessoal", () => {
  it("mostra a unidade aprovada", () => {
    expect(mensagemAtualizacaoStatus({ ...base, aprovadoPor: "Anselmo Hernams" })).toContain("Unidade: UPA VILA KENNEDY");
  });
  it("mostra a unidade antes do status", () => {
    const msg = mensagemAtualizacaoStatus(base);
    expect(msg.indexOf("Unidade:")).toBeGreaterThan(-1);
    expect(msg.indexOf("Unidade:")).toBeLessThan(msg.indexOf("Status:"));
  });
  it("não deixa a unidade em branco quando o cadastro não tem unidade", () => {
    expect(mensagemAtualizacaoStatus({ ...base, unidade: "" })).toContain("Unidade: -");
  });
  it("mantém cargo, aprovador e justificativa", () => {
    const msg = mensagemAtualizacaoStatus({ ...base, aprovadoPor: "Anselmo", observacao: "Vaga autorizada" });
    expect(msg).toContain("Cargo: Técnico de Enfermagem");
    expect(msg).toContain("Por: Anselmo");
    expect(msg).toContain("Justificativa: Vaga autorizada");
  });
});

describe("mensagem de abertura da requisição de pessoal", () => {
  it("continua mostrando a unidade e o solicitante", () => {
    const msg = mensagemNovaRequisicao({ ...base, status: "Pendente", solicitante: "Ana" });
    expect(msg).toContain("Unidade: UPA VILA KENNEDY");
    expect(msg).toContain("Solicitante: Ana");
  });
});
