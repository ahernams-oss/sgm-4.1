import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportarKpisCsv, exportarKpisPdf, type KpiExportItem } from "@/lib/exportKpis";

interface Props {
  /** Título usado no arquivo e no cabeçalho do relatório. */
  title: string;
  /** Lista de indicadores a exportar (avaliada no clique). */
  kpis: KpiExportItem[] | (() => KpiExportItem[]);
  /** Linha de contexto opcional (filtros aplicados, período etc.). */
  context?: string;
  /** Usa o estilo claro (padrão) ou translúcido para o cabeçalho gradiente. */
  variant?: "default" | "onHeader";
}

export default function DashboardExportButtons({ title, kpis, context, variant = "onHeader" }: Props) {
  const resolve = () => (typeof kpis === "function" ? kpis() : kpis);

  const run = (fn: (t: string, k: KpiExportItem[], c?: string) => void, label: string) => {
    const data = resolve().filter((k) => k && k.label);
    if (data.length === 0) {
      toast.error("Nenhum indicador disponível para exportar.");
      return;
    }
    fn(title, data, context);
    toast.success(`${label} gerado com sucesso.`);
  };

  const cls =
    variant === "onHeader"
      ? "h-9 text-xs gap-1.5 bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm"
      : "h-9 text-xs gap-1.5";

  return (
    <>
      <Button variant="secondary" size="sm" className={cls} onClick={() => run(exportarKpisCsv, "CSV")}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> KPIs CSV
      </Button>
      <Button variant="secondary" size="sm" className={cls} onClick={() => run(exportarKpisPdf, "PDF")}>
        <FileDown className="h-3.5 w-3.5" /> KPIs PDF
      </Button>
    </>
  );
}
