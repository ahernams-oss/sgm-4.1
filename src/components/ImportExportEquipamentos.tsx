import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { useClientes } from "@/contexts/ClientesContext";

import type * as XLSXTypes from "xlsx";
let _xlsxCache: typeof XLSXTypes | null = null;
const getXLSX = async () => { if (!_xlsxCache) _xlsxCache = await import("xlsx"); return _xlsxCache; };

/** Colunas da planilha modelo (mesma ordem na exportação e na importação). */
const COLUNAS = [
  "Cod. Lasant",
  "Situação",
  "Cliente",
  "Local",
  "Pavimento",
  "Setor",
  "TAG / Patrimônio",
  "Equipamento",
  "Série",
  "Grupo",
  "Subgrupo",
  "Modelo",
  "Valor (R$)",
  "Fabricante",
  "Data de Aquisição",
  "Nível de Risco",
  "Nível de Manutenção",
  "Expectativa de Vida",
  "Data de Garantia",
  "Tensão (V)",
  "Corrente (A)",
  "Potência (W)",
  "Capacidade (BTU)",
  "Contrato",
  "Nº ANVISA",
  "Requer Calibração (Sim/Não)",
  "Data de Calibração",
  "Validade da Calibração",
  "Frequência Calibração (meses)",
  "Laboratório de Calibração",
  "Nº Certificado de Calibração",
] as const;

const EXEMPLO: (string | number)[] = [
  "(gerado pelo sistema)",
  "Ativo",
  "Hospital Exemplo",
  "Prédio Principal",
  "2º Pavimento",
  "UTI",
  "PAT-0001",
  "Ar Condicionado Split",
  "SN123456",
  "Climatização",
  "Split",
  "Inverter 12k",
  4500,
  "Fabricante Exemplo",
  "2024-01-15",
  "Médio",
  "Preventiva",
  "10 anos",
  "2026-01-15",
  "220",
  "5",
  "1200",
  "12000",
  "Contrato 001/2024",
  "80123456789",
  "Não",
  "",
  "",
  12,
  "",
  "",
];

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toDate = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = _xlsxCache!.SSF.parse_date_code(v);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

async function baixarPlanilha(nome: string, aoa: (string | number)[][]) {
  const ws = (await getXLSX()).utils.aoa_to_sheet(aoa);
  ws["!cols"] = (aoa[0] || []).map(() => ({ wch: 22 }));
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Equipamentos");
  (await getXLSX()).writeFile(wb, nome, { compression: true });
}

export default function ImportExportEquipamentos() {
  const { equipamentos, addEquipamento } = useEquipamentos();
  const { clientes } = useClientes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  const baixarModelo = () => {
    baixarPlanilha("modelo_inventario_equipamentos.xlsx", [[...COLUNAS], EXEMPLO]);
    toast.success("Planilha modelo baixada.");
  };

  const exportar = () => {
    if (equipamentos.length === 0) {
      toast.error("Nenhum equipamento para exportar.");
      return;
    }
    const linhas = equipamentos.map((e) => [
      e.codLasant || "",
      e.situacao,
      e.clienteNome,
      e.localDescricao,
      e.pavimentoDescricao,
      e.setorDescricao,
      e.tag,
      e.equipamento,
      e.serie,
      e.grupo,
      e.subgrupo,
      e.modelo,
      e.valor || 0,
      e.fabricante,
      e.dataAquisicao,
      e.nivelRisco,
      e.nivelManutencao,
      e.expectativaVida,
      e.dataGarantia,
      e.tensao,
      e.corrente,
      e.potencia,
      e.capacidadeBtu,
      e.contrato,
      e.numeroAnvisa,
      e.requerCalibracao ? "Sim" : "Não",
      e.dataCalibracao,
      e.validadeCalibracao,
      e.frequenciaCalibracaoMeses || 12,
      e.laboratorioCalibracao,
      e.numeroCertificadoCalibracao,
    ]);
    baixarPlanilha("inventario_equipamentos.xlsx", [[...COLUNAS], ...linhas]);
    toast.success(`${linhas.length} equipamentos exportados.`);
  };

  const importar = async (file: File) => {
    setImportando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = (await getXLSX()).read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = (await getXLSX()).utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      let ok = 0;
      const erros: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const linha = i + 2;
        const nomeEquip = String(r["Equipamento"] ?? "").trim();
        const nomeCliente = String(r["Cliente"] ?? "").trim();
        if (!nomeEquip && !nomeCliente) continue;
        if (nomeCliente.toLowerCase().includes("exemplo") && nomeEquip.toLowerCase().includes("exemplo")) continue;

        if (!nomeEquip) { erros.push(`Linha ${linha}: "Equipamento" é obrigatório.`); continue; }

        const cliente = clientes.find((c) => norm(c.nome) === norm(nomeCliente));
        if (!cliente) { erros.push(`Linha ${linha}: cliente "${nomeCliente}" não encontrado.`); continue; }

        const local = (cliente.locais || []).find((l) => norm(l.descricao) === norm(r["Local"]));
        const pavimento = (local?.pavimentos || []).find((p) => norm(p.descricao) === norm(r["Pavimento"]));
        const setor = (pavimento?.setores || []).find((s) => norm(s.descricao) === norm(r["Setor"]));

        await addEquipamento({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          localId: local?.id ?? "",
          localDescricao: local?.descricao ?? String(r["Local"] ?? ""),
          pavimentoId: pavimento?.id ?? "",
          pavimentoDescricao: pavimento?.descricao ?? String(r["Pavimento"] ?? ""),
          setorId: setor?.id ?? "",
          setorDescricao: setor?.descricao ?? String(r["Setor"] ?? ""),
          situacao: String(r["Situação"] ?? "Ativo") || "Ativo",
          tag: String(r["TAG / Patrimônio"] ?? ""),
          equipamento: nomeEquip,
          serie: String(r["Série"] ?? ""),
          grupo: String(r["Grupo"] ?? ""),
          subgrupo: String(r["Subgrupo"] ?? ""),
          modelo: String(r["Modelo"] ?? ""),
          valor: toNumber(r["Valor (R$)"]),
          fabricante: String(r["Fabricante"] ?? ""),
          dataAquisicao: toDate(r["Data de Aquisição"]),
          nivelRisco: String(r["Nível de Risco"] ?? ""),
          nivelManutencao: String(r["Nível de Manutenção"] ?? ""),
          expectativaVida: String(r["Expectativa de Vida"] ?? ""),
          dataGarantia: toDate(r["Data de Garantia"]),
          tensao: String(r["Tensão (V)"] ?? ""),
          corrente: String(r["Corrente (A)"] ?? ""),
          potencia: String(r["Potência (W)"] ?? ""),
          capacidadeBtu: String(r["Capacidade (BTU)"] ?? ""),
          contrato: String(r["Contrato"] ?? ""),
          planoManutencao: "",
          numeroAnvisa: String(r["Nº ANVISA"] ?? ""),
          fotoUrl: "",
          manualUrl: "",
          fotos: [],
          requerCalibracao: norm(r["Requer Calibração (Sim/Não)"]) === "sim",
          dataCalibracao: toDate(r["Data de Calibração"]),
          validadeCalibracao: toDate(r["Validade da Calibração"]),
          frequenciaCalibracaoMeses: toNumber(r["Frequência Calibração (meses)"]) || 12,
          certificadoCalibracaoUrl: "",
          laboratorioCalibracao: String(r["Laboratório de Calibração"] ?? ""),
          numeroCertificadoCalibracao: String(r["Nº Certificado de Calibração"] ?? ""),
          observacoesCalibracao: "",
          responsavelCalibracao: "",
          telefoneResponsavelCalibracao: "",
          emailResponsavelCalibracao: "",
        });
        ok++;
      }

      if (ok > 0) toast.success(`${ok} equipamento(s) importado(s). Cod. Lasant gerado automaticamente.`);
      if (erros.length > 0) toast.error(`${erros.length} linha(s) ignorada(s). ${erros.slice(0, 3).join(" ")}`);
      if (ok === 0 && erros.length === 0) toast.error("Nenhuma linha válida encontrada na planilha.");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ler a planilha. Use o modelo disponibilizado.");
    } finally {
      setImportando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={baixarModelo}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />Modelo
      </Button>
      <Button variant="outline" onClick={exportar}>
        <Download className="h-4 w-4 mr-1" />Exportar
      </Button>
      <Button variant="outline" disabled={importando} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4 mr-1" />{importando ? "Importando..." : "Importar"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importar(f);
        }}
      />
    </div>
  );
}
