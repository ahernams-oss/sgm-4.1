

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");
interface ExameData {
  funcionario_nome: string;
  tipo_exame: string;
  data_realizacao: string | null;
  data_vencimento: string;
  resultado: string;
  clinica: string;
  observacoes: string;
}

const getStatusLabel = (dataVencimento: string) => {
  const hoje = new Date();
  const venc = new Date(dataVencimento + "T00:00:00");
  const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Vencido";
  if (diffDays <= 30) return `Próximo (${diffDays}d)`;
  return "Em Dia";
};

const formatDate = (d: string | null) => {
  if (!d) return "";
  return d.split("-").reverse().join("/");
};

export async function gerarExcelExames(exames: ExameData[]) {
  const rows = exames.map((e) => ({
    "Funcionário": e.funcionario_nome,
    "Tipo de Exame": e.tipo_exame,
    "Data Realização": formatDate(e.data_realizacao),
    "Data Vencimento": formatDate(e.data_vencimento),
    "Status": getStatusLabel(e.data_vencimento),
    "Resultado": e.resultado || "",
    "Clínica": e.clinica || "",
    "Observações": e.observacoes || "",
  }));

  const ws = (await getXLSX()).utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 15 },
    { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 30 },
  ];

  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Exames Periódicos");
  (await getXLSX()).writeFile(wb, "relatorio-exames-periodicos.xlsx", { compression: true });
}
