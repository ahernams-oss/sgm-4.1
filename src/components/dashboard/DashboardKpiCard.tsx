import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, Download, FileDown, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { exportarKpiCardJpg, exportarKpiCardPdf } from "@/lib/exportKpiCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export const DASHBOARD_KPI_VARIANTS = [
  { ring: "from-primary to-indigo-600", chip: "bg-primary/10", icon: "text-primary" },
  { ring: "from-emerald-500 to-teal-600", chip: "bg-emerald-500/10", icon: "text-emerald-600" },
  { ring: "from-amber-500 to-orange-600", chip: "bg-amber-500/10", icon: "text-amber-600" },
  { ring: "from-rose-500 to-red-600", chip: "bg-rose-500/10", icon: "text-rose-600" },
  { ring: "from-purple-500 to-fuchsia-600", chip: "bg-purple-500/10", icon: "text-purple-600" },
  { ring: "from-cyan-500 to-sky-600", chip: "bg-cyan-500/10", icon: "text-cyan-600" },
];

export interface DashboardKpiCardProps {
  icon: any;
  label: string;
  value: number | string;
  subtitle?: string;
  /** variação percentual vs. período anterior */
  trend?: number | null;
  trendLabel?: string;
  gradientIdx?: number;
  valueClassName?: string;
  valueColor?: string;
  onClick?: () => void;
  className?: string;
}

export default function DashboardKpiCard({
  icon: Icon, label, value, subtitle, trend, trendLabel,
  gradientIdx = 0, valueClassName, valueColor, onClick, className,
}: DashboardKpiCardProps) {
  const v = DASHBOARD_KPI_VARIANTS[gradientIdx % DASHBOARD_KPI_VARIANTS.length];
  const hasTrend = trend !== undefined && trend !== null && Number.isFinite(trend);
  const TrendIcon = !hasTrend ? Minus : (trend as number) > 0 ? TrendingUp : (trend as number) < 0 ? TrendingDown : Minus;
  const cardRef = useRef<HTMLDivElement>(null);

  const exportar = async (tipo: "pdf" | "jpg") => {
    if (!cardRef.current) return;
    try {
      if (tipo === "jpg") await exportarKpiCardJpg(cardRef.current, label);
      else await exportarKpiCardPdf(cardRef.current, label);
      toast.success(`Indicador exportado em ${tipo.toUpperCase()}`);
    } catch (err) {
      console.error("Erro ao exportar indicador:", err);
      toast.error("Falha ao exportar indicador");
    }
  };

  return (
    <Card
      ref={cardRef}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden border border-border/60 transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", v.ring)} />
      <div
        className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        data-export-ignore="true"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Exportar indicador"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => exportar("pdf")}>
              <FileDown className="h-3.5 w-3.5 mr-2" /> Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportar("jpg")}>
              <ImageDown className="h-3.5 w-3.5 mr-2" /> Exportar JPG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-normal break-words">{label}</p>
            <p
              className={cn("text-xl font-bold text-foreground mt-1.5 truncate tabular-nums", valueClassName)}
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </p>
            {subtitle && <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{subtitle}</p>}
            {hasTrend && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 mt-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  (trend as number) > 0 && "bg-emerald-500/10 text-emerald-600",
                  (trend as number) < 0 && "bg-rose-500/10 text-rose-600",
                  (trend as number) === 0 && "bg-muted text-muted-foreground",
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {(trend as number) > 0 ? "+" : ""}{(trend as number).toFixed(1)}%
                {trendLabel && <span className="font-normal opacity-80">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className={cn("rounded-xl p-2.5 shrink-0 transition-transform group-hover:scale-110", v.chip)}>
            <Icon className={cn("h-4 w-4", v.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
