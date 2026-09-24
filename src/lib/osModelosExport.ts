import type { OsModelo } from "@/contexts/OsModelosContext";

const getXLSX = async () => await import("xlsx");

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportarModelosJson(modelos: OsModelo[]) {
  const payload = {
    formato: "sgm.os_modelos",
    versao: 1,
    exportado_em: new Date().toISOString(),
    total: modelos.length,
    modelos: modelos.map((m) => ({ nome: m.nome, descricao: m.descricao || "" })),
  };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `modelos_os_${stamp()}.json`);
}

export async function exportarModelosExcel(modelos: OsModelo[]) {
  const X = await getXLSX();
  const ws = X.utils.aoa_to_sheet([["Nome", "Descrição"], ...modelos.map((m) => [m.nome, m.descricao || ""])]);
  ws["!cols"] = [{ wch: 35 }, { wch: 70 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Modelos_OS");
  X.writeFile(wb, `modelos_os_${stamp()}.xlsx`, { compression: true });
}

export async function exportarModelosCsv(modelos: OsModelo[]) {
  const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = ["nome;descricao", ...modelos.map((m) => `${esc(m.nome)};${esc(m.descricao)}`)].join("\r\n");
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `modelos_os_${stamp()}.csv`);
}

/** Lê JSON (formato SGM ou array simples), XLSX ou CSV. */
export async function lerArquivoModelos(file: File): Promise<{ nome: string; descricao: string }[]> {
  const norm = (r: any) => {
    const k = (n: string) => Object.keys(r).find((x) => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").startsWith(n));
    const nome = String(r[k("nome") || k("name") || ""] ?? "").trim();
    const descricao = String(r[k("desc") || ""] ?? "").trim();
    return { nome, descricao };
  };
  if (file.name.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data.modelos ?? data.items ?? [];
    return arr.map(norm).filter((m: any) => m.nome);
  }
  const X = await getXLSX();
  const wb = X.read(await file.arrayBuffer(), { type: "array" });
  const rows = X.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  return rows.map(norm).filter((m) => m.nome);
}
