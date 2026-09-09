import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  lastUpdated?: Date;
  isRefreshing?: boolean;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: (v: boolean) => void;
  onRefresh?: () => void;
  className?: string;
}

export default function DashboardHeader({
  title, description, badge, actions, filters,
  lastUpdated, isRefreshing, autoRefresh, onToggleAutoRefresh, onRefresh, className,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary via-primary/90 to-indigo-700 p-6 md:p-8 text-primary-foreground shadow-lg",
        className,
      )}
    >
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          {badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">{badge}</span>
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm md:text-base text-primary-foreground/85 mt-1.5 max-w-2xl">{description}</p>
          )}
          {(lastUpdated || onRefresh) && (
            <div className="flex items-center gap-3 mt-3 text-[11px] text-primary-foreground/80">
              {lastUpdated && (
                <span className="tabular-nums">
                  Atualizado em {lastUpdated.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {onToggleAutoRefresh && (
                <button
                  type="button"
                  onClick={() => onToggleAutoRefresh(!autoRefresh)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-white/20 transition-colors",
                    autoRefresh ? "bg-white/20" : "bg-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <Radio className={cn("h-3 w-3", autoRefresh && "animate-pulse")} />
                  {autoRefresh ? "Auto 300s" : "Auto off"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {actions}
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 text-xs gap-1.5 bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} /> Atualizar
            </Button>
          )}
        </div>
      </div>
      {filters && <div className="relative mt-5">{filters}</div>}
    </div>
  );
}
