import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function DataPeriodo({ label, value, onChange }: { label: string; value?: Date; onChange: (date?: Date) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-1">
    <Label>{label}</Label>
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={label} className={cn("flex-1 justify-start font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />{value ? format(value, "dd/MM/yyyy") : "Selecione a data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0 pointer-events-auto">
          <Calendar mode="single" selected={value} defaultMonth={value} onSelect={date => { onChange(date); setOpen(false); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {value && <Button variant="ghost" size="icon" title={`Limpar ${label.toLowerCase()}`} aria-label={`Limpar ${label.toLowerCase()}`} onClick={() => onChange(undefined)}><X className="h-4 w-4" /></Button>}
    </div>
  </div>;
}

export function PeriodoExecucaoNfse({ inicio, fim, onChange }: { inicio?: Date; fim?: Date; onChange: (inicio?: Date, fim?: Date) => void }) {
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">Período de execução</h3>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DataPeriodo label="Início da execução" value={inicio} onChange={date => onChange(date, fim)} />
      <DataPeriodo label="Fim da execução" value={fim} onChange={date => onChange(inicio, date)} />
    </div>
  </section>;
}