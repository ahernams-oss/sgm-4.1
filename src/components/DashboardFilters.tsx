import { useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface DashboardFiltersState {
  dateFrom?: Date;
  dateTo?: Date;
  clienteId: string; // "todos" ou id
  status: string; // "todos" ou valor
}

export const EMPTY_FILTERS: DashboardFiltersState = {
  dateFrom: undefined,
  dateTo: undefined,
  clienteId: "todos",
  status: "todos",
};

interface Option { value: string; label: string }

interface Props {
  storageKey: string;
  value: DashboardFiltersState;
  onChange: (v: DashboardFiltersState) => void;
  clienteOptions?: Option[];
  clienteLabel?: string;
  statusOptions?: Option[];
  showCliente?: boolean;
  showStatus?: boolean;
  showPeriod?: boolean;
}

// Carrega filtros do localStorage
export function loadDashboardFilters(storageKey: string): DashboardFiltersState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...EMPTY_FILTERS };
    const p = JSON.parse(raw);
    return {
      dateFrom: p.dateFrom ? new Date(p.dateFrom) : undefined,
      dateTo: p.dateTo ? new Date(p.dateTo) : undefined,
      clienteId: p.clienteId || "todos",
      status: p.status || "todos",
    };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

export default function DashboardFilters({
  storageKey, value, onChange,
  clienteOptions = [], clienteLabel = "Cliente",
  statusOptions = [],
  showCliente = true, showStatus = true, showPeriod = true,
}: Props) {
  // Persistência
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        dateFrom: value.dateFrom?.toISOString(),
        dateTo: value.dateTo?.toISOString(),
        clienteId: value.clienteId,
        status: value.status,
      }));
    } catch { /* ignore */ }
  }, [storageKey, value]);

  const setPreset = (preset: "hoje" | "7d" | "30d" | "mes" | "ano") => {
    const now = new Date();
    let from = new Date();
    const to = new Date();
    if (preset === "hoje") from = new Date();
    else if (preset === "7d") from.setDate(now.getDate() - 7);
    else if (preset === "30d") from.setDate(now.getDate() - 30);
    else if (preset === "mes") from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (preset === "ano") from = new Date(now.getFullYear(), 0, 1);
    onChange({ ...value, dateFrom: from, dateTo: to });
  };

  const clear = () => onChange({ ...EMPTY_FILTERS });

  const hasFilter =
    value.dateFrom || value.dateTo ||
    (showCliente && value.clienteId !== "todos") ||
    (showStatus && value.status !== "todos");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <Filter className="h-3.5 w-3.5" /> Filtros:
      </div>

      {showPeriod && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-2 text-xs", !value.dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {value.dateFrom ? format(value.dateFrom, "dd/MM/yyyy") : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={value.dateFrom} onSelect={(d) => onChange({ ...value, dateFrom: d })} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-2 text-xs", !value.dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {value.dateTo ? format(value.dateTo, "dd/MM/yyyy") : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={value.dateTo} onSelect={(d) => onChange({ ...value, dateTo: d })} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <div className="flex gap-1">
            {[
              { k: "hoje", label: "Hoje" },
              { k: "7d", label: "7d" },
              { k: "30d", label: "30d" },
              { k: "mes", label: "Mês" },
              { k: "ano", label: "Ano" },
            ].map(p => (
              <Button key={p.k} variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setPreset(p.k as any)}>
                {p.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {showCliente && clienteOptions.length > 0 && (
        <Select value={value.clienteId} onValueChange={(v) => onChange({ ...value, clienteId: v })}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue placeholder={clienteLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos — {clienteLabel}</SelectItem>
            {clienteOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showStatus && statusOptions.length > 0 && (
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v })}>
          <SelectTrigger className="h-9 w-[170px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilter && (
        <>
          <Badge variant="secondary" className="text-[10px]">Filtros ativos</Badge>
          <Button variant="ghost" size="sm" onClick={clear} className="h-9 gap-1 text-xs text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        </>
      )}
    </div>
  );
}
