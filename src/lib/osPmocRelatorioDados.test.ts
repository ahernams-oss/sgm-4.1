import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dadosOsPmoc, formatNumeroOsPmoc } from "./osPmocRelatorioDados";
import type { OsPmocRow } from "./gerarPdfOsPmoc";

describe("identificação do relatório combinado PMOC", () => {
  it("adota OS-PMOC-0009 para a ordem número 9", () => {
    assert.equal(formatNumeroOsPmoc(9), "OS-PMOC-0009");
  });
  it("mantém o número da ordem selecionada independentemente das demais ordens do equipamento", () => {
    const ordem: OsPmocRow = {
      id: "selecionada", numero: 9, plano_id: "plano", atividade_id: "atividade",
      equipamento_id: "equipamento", equipamento_nome: "Split", unidade: "Unidade",
      local_descricao: "Recepção", descricao: "Limpeza", tipo: "Preventiva", status: "Concluída",
      data_abertura: "2026-09-01", data_conclusao: "2026-09-28", tecnico_responsavel: "Técnico",
      evidencias: [], observacoes: "", aprovado_por: "",
    };
    assert.equal(dadosOsPmoc(ordem).numero, 9);
    assert.equal(dadosOsPmoc(ordem).id, "selecionada");
  });
});