import type { BoletimMedicao } from "@/contexts/BoletinsMedicaoContext";
import type { Empresa } from "@/contexts/EmpresaContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const fmtDate = (s?: string) => {
  if (!s) return "";
  const [y, m, d] = String(s).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(s);
};

export async function downloadExcelBoletimMedicao(boletim: BoletimMedicao, empresa?: Empresa) {
  const wb = (await getXLSX()).utils.book_new();
  const frentes = boletim.frentes || [];
  const totalContrato =
    Number(boletim.valor_total_contrato) || frentes.reduce((s, f) => s + (Number(f.valor_contrato) || 0), 0);

  const cabecalho: any[][] = [
    [(empresa?.nomeFantasia || empresa?.razaoSocial || "LASANT CONSTRUÇÕES").toUpperCase()],
    [(boletim.cliente_nome || "").toUpperCase()],
    [`Objeto: ${boletim.objeto || "-"}`],
    [`Contrato N.º ${boletim.contrato_numero || "-"}    |    Processo N.º ${boletim.processo_numero || "-"}`],
    [`Responsável Técnico: ${boletim.responsavel_tecnico || "-"}`],
    [
      `Boletim de Medição N.º ${String(boletim.numero || "").padStart(2, "0")}/${boletim.ano || ""}    |    Emissão: ${fmtDate(
        boletim.data_emissao,
      )}`,
    ],
    ["Valor total do contrato:", totalContrato],
    [],
  ];

  const rows: any[][] = [...cabecalho];

  const bloco = (titulo: string, linhas: { label: string; periodo: string; valor: number }[], contrato: number) => {
    const faturado = linhas.reduce((s, l) => s + (l.valor || 0), 0);
    rows.push([titulo]);
    rows.push(["MEDIÇÃO", "PERÍODO", "VALOR (R$)", "PORC (%)"]);
    linhas.forEach((l) =>
      rows.push([l.label, l.periodo, l.valor, contrato > 0 ? l.valor / contrato : 0]),
    );
    rows.push(["VALOR TOTAL FATURADO", "", faturado, contrato > 0 ? faturado / contrato : 0]);
    rows.push(["VALOR CONTRATO", "", contrato, contrato > 0 ? 1 : 0]);
    rows.push([
      "SALDO A FATURAR",
      "",
      contrato - faturado,
      contrato > 0 ? (contrato - faturado) / contrato : 0,
    ]);
    rows.push([]);
  };

  frentes.forEach((f) => {
    const meds = [...(f.medicoes || [])].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    bloco(
      `Obra: ${f.nome || "-"}`,
      meds.map((m) => ({
        label: `${m.numero}ª MEDIÇÃO`,
        periodo:
          m.periodo_inicio || m.periodo_fim ? `${fmtDate(m.periodo_inicio)} A ${fmtDate(m.periodo_fim)}` : "",
        valor: Number(m.valor) || 0,
      })),
      Number(f.valor_contrato) || 0,
    );
  });

  // Sintético — apenas medições existentes
  const numeros = Array.from(
    new Set(frentes.flatMap((f) => (f.medicoes || []).map((m) => Number(m.numero) || 0))),
  ).sort((a, b) => a - b);
  const sint = numeros.map((n) => {
    let soma = 0;
    let periodo = "";
    frentes.forEach((f) => {
      const m = (f.medicoes || []).find((x) => Number(x.numero) === n);
      if (m) {
        soma += Number(m.valor) || 0;
        if (!periodo && (m.periodo_inicio || m.periodo_fim))
          periodo = `${fmtDate(m.periodo_inicio)} A ${fmtDate(m.periodo_fim)}`;
      }
    });
    return { label: `${n}ª MEDIÇÃO`, periodo, valor: soma };
  });
  bloco("SINTÉTICO", sint, totalContrato);

  if (boletim.observacoes) rows.push(["Observações:", boletim.observacoes]);

  const ws = (await getXLSX()).utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 18 }, { wch: 12 }];
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Boletim");
  (await getXLSX()).writeFile(
    wb,
    `Boletim_Medicao_${String(boletim.numero || "").padStart(2, "0")}-${boletim.ano || ""}.xlsx`,
    { compression: true },
  );
}
