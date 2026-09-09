import type { MedicaoServico } from "@/contexts/MedicoesContext";
import type { Cliente } from "@/contexts/ClientesContext";
import type { Empresa } from "@/contexts/EmpresaContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

interface ExportRow {
  chavePix: string;
  razaoSocial: string;
  cnpj: string;
  valor: number;
  dataPagamento: string;
  descricao: string;
  identificacaoInterna: string;
  agenciaOrigem: string;
  contaOrigem: string;
}

function buildRows(
  medicoesSelecionadas: MedicaoServico[],
  fornecedores: Cliente[],
  empresa: Empresa
): ExportRow[] {
  return medicoesSelecionadas.map((m) => {
    const fornecedor = fornecedores.find(
      (f) => f.id === (m as any).fornecedor_id
    );
    const chavePix =
      fornecedor?.informacoesFinanceiras?.[0]?.chavePix ?? "";
    const razaoSocial = fornecedor?.nome ?? "";
    const cnpj = fornecedor?.cnpj ?? "";
    const dataPag = (m as any).data_pagamento
      ? new Date((m as any).data_pagamento + "T00:00:00")
          .toLocaleDateString("pt-BR")
      : "";

    return {
      chavePix,
      razaoSocial,
      cnpj,
      valor: m.valor_total_medido || 0,
      dataPagamento: dataPag,
      descricao: m.descricao || "",
      identificacaoInterna: m.descricao || "",
      agenciaOrigem: empresa.agencia || "",
      contaOrigem: empresa.conta || "",
    };
  });
}

export async function downloadExcelPagamento(
  medicoesSelecionadas: MedicaoServico[],
  fornecedores: Cliente[],
  empresa: Empresa
) {
  const rows = buildRows(medicoesSelecionadas, fornecedores, empresa);

  const wb = (await getXLSX()).utils.book_new();

  // Sheet 1 – Transferencias Chave PIX
  const pixData = rows.map((r) => ({
    "Chave PIX ou Copia e Cola": r.chavePix,
    "Nome / Razão Social do Favorecido": r.razaoSocial,
    "CPF/CNPJ do Favorecido": r.cnpj,
    Valor: r.valor,
    "Data de Pagamento (dd/mm/aaaa)": r.dataPagamento,
    "Descrição (Opcional)": r.descricao,
    "Identificação Interna (Opcional)": r.identificacaoInterna,
    "Agência de Origem": r.agenciaOrigem,
    "Conta de Origem": r.contaOrigem,
  }));
  const ws1 = (await getXLSX()).utils.json_to_sheet(pixData);
  (await getXLSX()).utils.book_append_sheet(wb, ws1, "Transferencias Chave PIX");

  // Sheet 2 – Transferencias Dados da Conta
  const contaData = rows.map((r) => {
    const fornecedor = fornecedores.find(
      (f) => f.nome === r.razaoSocial
    );
    const fin = fornecedor?.informacoesFinanceiras?.[0];
    return {
      "Banco do Favorecido": fin?.banco ?? "",
      "Agência do Favorecido": fin?.agencia ?? "",
      "Conta do Favorecido": fin?.conta ?? "",
      "Tipo de Conta do Favorecido": "Corrente",
      "Nome / Razão Social do Favorecido": r.razaoSocial,
      "CPF/CNPJ do Favorecido": r.cnpj,
      "Tipo de Transferência": "PIX",
      Valor: r.valor,
      "Data de Pagamento (dd/mm/aaaa)": r.dataPagamento,
      "Descrição (Opcional)": r.descricao,
      "Identificação Interna (Opcional)": r.identificacaoInterna,
      "Agência de Origem": r.agenciaOrigem,
      "Conta de Origem": r.contaOrigem,
    };
  });
  const ws2 = (await getXLSX()).utils.json_to_sheet(contaData);
  (await getXLSX()).utils.book_append_sheet(wb, ws2, "Transferencias Dados da Conta");

  // Sheet 3 – Pagamentos Boletos e Tributos (empty template)
  const ws3 = (await getXLSX()).utils.aoa_to_sheet([
    [
      "Código de Barras",
      "Valor",
      "Data de Pagamento (dd/mm/aaaa)",
      "Identificação Interna (Opcional)",
      "Agência de Origem",
      "Conta de Origem",
    ],
  ]);
  (await getXLSX()).utils.book_append_sheet(wb, ws3, "Pagamentos Boletos e Tributos");

  (await getXLSX()).writeFile(wb, "Consolidado_Pagamentos.xlsx", { compression: true });
}
