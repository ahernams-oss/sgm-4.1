import type { CronogramaAtividade } from "@/contexts/CronogramasContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const HEAD = ["Descrição", "Unidade", "Quantidade", "Valor Total", "Modo Financeiro"];

const parseNum = (v: any) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const parseModo = (v: any): "distribuido" | "manual" => {
  const s = String(v ?? "").trim().toLowerCase();
  return s.startsWith("m") ? "manual" : "distribuido";
};

/** Baixa a planilha modelo para importação de atividades. */
export async function baixarModeloAtividades() {
  const ws = (await getXLSX()).utils.aoa_to_sheet([
    HEAD,
    ["Recomposição de piso", "m²", 300, 2500, "Distribuído"],
    ["Instalação de divisória", "m", 500, 65000, "Manual"],
  ]);
  ws["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Atividades");
  (await getXLSX()).writeFile(wb, "Modelo_Atividades_Cronograma.xlsx", { compression: true });
}

/** Exporta as atividades atuais do cronograma para Excel. */
export async function exportarAtividadesExcel(atividades: CronogramaAtividade[], nome = "Atividades_Cronograma") {
  const ws = (await getXLSX()).utils.aoa_to_sheet([
    HEAD,
    ...atividades.map((a) => [
      a.descricao || "",
      a.unidade || "",
      Number(a.quantidade) || 0,
      Number(a.valor_total) || 0,
      a.modo_financeiro === "manual" ? "Manual" : "Distribuído",
    ]),
  ]);
  ws["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Atividades");
  (await getXLSX()).writeFile(wb, `${nome}.xlsx`, { compression: true });
}

/** Lê um arquivo Excel e devolve as atividades importadas. */
export async function importarAtividadesExcel(file: File, ordemInicial = 1): Promise<CronogramaAtividade[]> {
  const buf = await file.arrayBuffer();
  const wb = (await getXLSX()).read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = (await getXLSX()).utils.sheet_to_json<any>(ws, { defval: "" });
  const out: CronogramaAtividade[] = [];
  rows.forEach((r) => {
    const key = (name: string) =>
      Object.keys(r).find((k) => k.trim().toLowerCase().startsWith(name)) || "";
    const descricao = String(r[key("desc")] ?? "").trim();
    if (!descricao) return;
    out.push({
      id: crypto.randomUUID(),
      ordem: ordemInicial + out.length,
      descricao,
      unidade: String(r[key("unid")] ?? "").trim(),
      quantidade: parseNum(r[key("quant")] ?? r[key("qtd")]),
      peso: 0,
      valor_total: parseNum(r[key("valor")]),
      modo_financeiro: parseModo(r[key("modo")]),
      valores: {},
      vincular_rdo: true,
    });
  });
  return out;
}
