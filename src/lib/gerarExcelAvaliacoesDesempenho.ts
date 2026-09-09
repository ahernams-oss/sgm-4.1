import { AvaliacaoDesempenho, QUESITOS_AVALIACAO } from "@/contexts/AvaliacoesDesempenhoContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const PONTUACAO_MAXIMA = QUESITOS_AVALIACAO.length * 10;
const fmtData = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "";

export async function gerarExcelAvaliacoesDesempenho(
  avaliacoes: AvaliacaoDesempenho[],
  funcMap: Record<string, string>,
) {
  const rows = avaliacoes.map((a) => {
    const base: Record<string, any> = {
      "Funcionário": funcMap[a.funcionarioId] || "",
      "Data da Avaliação": fmtData(a.dataAvaliacao),
      "Período de Referência": a.periodoReferencia || "",
      "Avaliador": a.avaliadorNome || "",
    };
    QUESITOS_AVALIACAO.forEach((q) => {
      base[q.label] = Number(a.notas[q.key] ?? 0);
    });
    base["Pontuação Total"] = Number(a.pontuacaoTotal.toFixed(1));
    base["Pontuação Máxima"] = PONTUACAO_MAXIMA;
    base["Média Ponderada"] = Number(a.mediaPonderada.toFixed(2));
    base["Observações"] = a.observacoes || "";
    return base;
  });

  const ws = (await getXLSX()).utils.json_to_sheet(rows);
  const cols: any[] = [
    { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 25 },
    ...QUESITOS_AVALIACAO.map(() => ({ wch: 18 })),
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 40 },
  ];
  ws["!cols"] = cols;

  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Avaliações");
  (await getXLSX()).writeFile(wb, "relatorio-avaliacoes-desempenho.xlsx", { compression: true });
}
