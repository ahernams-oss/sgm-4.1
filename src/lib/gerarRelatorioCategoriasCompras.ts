import { addHeader } from "@/lib/gerarRelatorioEstoque";
import { supabase } from "@/integrations/supabase/client";

const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
const getXLSX = async () => await import("xlsx");

export interface CategoriaGrupo { id: string; codigo: string; nome: string }
export interface CategoriaSubGrupo { id: string; grupoId: string; codigo: string; nome: string }
export interface CategoriaClasse { id: string; subGrupoId: string; codigo: string; nome: string }

export interface DadosRelatorioCategorias {
  grupos: CategoriaGrupo[];
  subGrupos: CategoriaSubGrupo[];
  classes: CategoriaClasse[];
  fabricantesPorGrupo: Record<string, string[]>;
  codigoCompleto: (classeId: string) => string;
  busca?: string;
}

export interface LinhaCategoria {
  nivel: string;
  codigo: string;
  codigoCompleto: string;
  nome: string;
  pertenceA: string;
  fabricantes: string;
}

const filtroTexto = (item: { codigo: string; nome: string }, busca?: string) => {
  if (!busca) return true;
  const s = busca.toLowerCase();
  return item.codigo.toLowerCase().includes(s) || item.nome.toLowerCase().includes(s);
};

/** Busca os fabricantes vinculados a cada grupo (tabela categorias_compras_fabricantes). */
export async function carregarFabricantesPorGrupo(
  nomesFabricantes: Record<string, string>
): Promise<Record<string, string[]>> {
  const { data, error } = await (supabase as any)
    .from("categorias_compras_fabricantes")
    .select("grupo_id, fabricante_id");
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const r of data ?? []) {
    const nome = nomesFabricantes[r.fabricante_id];
    if (!nome) continue;
    (map[r.grupo_id] ||= []).push(nome);
  }
  Object.values(map).forEach((arr) => arr.sort((a, b) => a.localeCompare(b, "pt-BR")));
  return map;
}

/** Monta as linhas hierárquicas do relatório, respeitando o filtro de busca por nível. */
export function montarLinhasCategorias(d: DadosRelatorioCategorias): LinhaCategoria[] {
  const linhas: LinhaCategoria[] = [];
  const grupos = [...d.grupos].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  for (const g of grupos) {
    const subs = d.subGrupos
      .filter((s) => s.grupoId === g.id)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
    const classesDoGrupo = subs.flatMap((s) =>
      d.classes
        .filter((c) => c.subGrupoId === s.id)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }))
    );
    // Grupo entra se o próprio grupo combina com a busca ou tem subgrupo/classe que combina
    const grupoCombina =
      filtroTexto(g, d.busca) ||
      subs.some((s) => filtroTexto(s, d.busca)) ||
      classesDoGrupo.some((c) => filtroTexto(c, d.busca));
    if (!grupoCombina) continue;

    linhas.push({
      nivel: "Grupo",
      codigo: g.codigo,
      codigoCompleto: g.codigo,
      nome: g.nome,
      pertenceA: "-",
      fabricantes: (d.fabricantesPorGrupo[g.id] ?? []).join(", ") || "—",
    });

    for (const s of subs) {
      const classes = d.classes
        .filter((c) => c.subGrupoId === s.id)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
      const subCombina = filtroTexto(s, d.busca) || classes.some((c) => filtroTexto(c, d.busca));
      if (!subCombina) continue;

      linhas.push({
        nivel: "SubGrupo",
        codigo: s.codigo,
        codigoCompleto: `${g.codigo}.${s.codigo}`,
        nome: s.nome,
        pertenceA: `${g.codigo} - ${g.nome}`,
        fabricantes: "—",
      });

      for (const c of classes) {
        if (!filtroTexto(c, d.busca)) continue;
        linhas.push({
          nivel: "Classe",
          codigo: c.codigo,
          codigoCompleto: d.codigoCompleto(c.id) || `${g.codigo}.${s.codigo}.${c.codigo}`,
          nome: c.nome,
          pertenceA: `${g.codigo}.${s.codigo} - ${s.nome}`,
          fabricantes: "—",
        });
      }
    }
  }
  return linhas;
}

export async function gerarPdfCategoriasCompras(d: DadosRelatorioCategorias) {
  const linhas = montarLinhasCategorias(d);
  const doc = new (await getJsPDF())({ compress: true, orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();

  const filtros = d.busca ? `Filtro: "${d.busca}"` : undefined;
  await addHeader(doc, {
    title: "Categorias de Compras",
    subtitle: `Grupos: ${d.grupos.length}  |  SubGrupos: ${d.subGrupos.length}  |  Classes: ${d.classes.length}`,
    filters: filtros,
  });

  const startY = filtros ? 48 : 42;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Total de registros: ${linhas.length}`, 14, startY - 3);

  (await getAutoTable())(doc, {
    startY,
    head: [["Nível", "Código", "Nome", "Pertence a", "Fabricantes"]],
    body: linhas.map((l) => [l.nivel, l.codigoCompleto, l.nome, l.pertenceA, l.fabricantes]),
    columnStyles: {
      0: { cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 26 },
      3: { cellWidth: 42 },
      4: { cellWidth: 52 },
    },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 0) {
        const nivel = String(data.cell.raw ?? "");
        if (nivel === "Grupo") data.cell.styles.fillColor = [222, 231, 244];
      }
    },
  });

  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    doc.text("SGM Lasant - Compras", 14, ph - 8);
  }

  doc.save("categorias_de_compras.pdf");
}

export async function gerarExcelCategoriasCompras(d: DadosRelatorioCategorias) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const grupos = [...d.grupos].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  const subs = [...d.subGrupos].sort(
    (a, b) => a.grupoId.localeCompare(b.grupoId) || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })
  );
  const classes = [...d.classes].sort(
    (a, b) => a.subGrupoId.localeCompare(b.subGrupoId) || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })
  );

  const nomeGrupo = (id: string) => {
    const g = d.grupos.find((x) => x.id === id);
    return g ? `${g.codigo} - ${g.nome}` : "";
  };
  const nomeSub = (id: string) => {
    const s = d.subGrupos.find((x) => x.id === id);
    return s ? `${s.codigo} - ${s.nome}` : "";
  };

  const wsGrupos = XLSX.utils.json_to_sheet(
    grupos.map((g) => ({
      "Código": g.codigo,
      "Nome": g.nome,
      "SubGrupos": d.subGrupos.filter((s) => s.grupoId === g.id).length,
      "Classes": d.classes.filter((c) => subs.some((s) => s.id === c.subGrupoId && s.grupoId === g.id)).length,
      "Fabricantes": (d.fabricantesPorGrupo[g.id] ?? []).join(", "),
    }))
  );
  wsGrupos["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsGrupos, "Grupos");

  const wsSubs = XLSX.utils.json_to_sheet(
    subs.map((s) => ({
      "Código": `${d.grupos.find((g) => g.id === s.grupoId)?.codigo ?? ""}.${s.codigo}`,
      "Nome": s.nome,
      "Grupo": nomeGrupo(s.grupoId),
      "Classes": d.classes.filter((c) => c.subGrupoId === s.id).length,
    }))
  );
  wsSubs["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSubs, "SubGrupos");

  const wsClasses = XLSX.utils.json_to_sheet(
    classes.map((c) => ({
      "Código Completo": d.codigoCompleto(c.id),
      "Nome": c.nome,
      "SubGrupo": nomeSub(c.subGrupoId),
      "Grupo": nomeGrupo(d.subGrupos.find((s) => s.id === c.subGrupoId)?.grupoId ?? ""),
    }))
  );
  wsClasses["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsClasses, "Classes");

  XLSX.writeFile(wb, "categorias_de_compras.xlsx", { compression: true });
}
