import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import CodigoTributacaoSelect from "./CodigoTributacaoSelect";
import { UFS, CODIGOS_TRIB_NACIONAL, CODIGOS_TRIB_MUNICIPAL } from "@/lib/codigosServicoNfse";
import { municipiosPrestacaoContrato, trocarUfPrestacaoContrato, type LocalPrestacaoContrato } from "@/lib/localPrestacaoContrato";
import { cn } from "@/lib/utils";

interface Props {
  value: LocalPrestacaoContrato;
  onChange: (patch: Partial<LocalPrestacaoContrato>) => void;
}

export default function LocalPrestacaoContratoFields({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const municipios = useMemo(() => municipiosPrestacaoContrato(value.ufPrestacao), [value.ufPrestacao]);
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 mb-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Local de prestação e codigo do serviço</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="contrato-uf-prestacao">UF da prestação</Label>
          <Select value={value.ufPrestacao} onValueChange={uf => onChange(trocarUfPrestacaoContrato(uf))}>
            <SelectTrigger id="contrato-uf-prestacao"><SelectValue placeholder="Selecione a UF" /></SelectTrigger>
            <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1 min-w-0">
          <Label>Município de prestação do serviço</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-label="Município de prestação do serviço" aria-expanded={open} disabled={!value.ufPrestacao} className="w-full h-auto min-h-10 justify-between gap-2 font-normal text-left">
                <span className="min-w-0 whitespace-normal break-words">{value.municipioPrestacao ? `${value.municipioPrestacao} (${value.codigoMunicipioPrestacao})` : "Selecione o município..."}</span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
              <Command>
                <CommandInput placeholder="Buscar município ou código IBGE..." />
                <CommandList>
                  <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                  <CommandGroup>{municipios.map(m => (
                    <CommandItem key={m.codigo} value={`${m.nome} ${m.codigo}`} onSelect={() => { onChange({ codigoMunicipioPrestacao: m.codigo, municipioPrestacao: m.nome }); setOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", value.codigoMunicipioPrestacao === m.codigo ? "opacity-100" : "opacity-0")} />
                      {m.nome} <span className="ml-2 text-xs text-muted-foreground">{m.codigo}</span>
                    </CommandItem>
                  ))}</CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Código de Tributação Nacional</Label>
        <CodigoTributacaoSelect value={value.codigoTributacaoNacional} onValueChange={codigo => onChange({ codigoTributacaoNacional: codigo })} options={CODIGOS_TRIB_NACIONAL} label="Código de Tributação Nacional" placeholder="Selecione o código nacional..." />
      </div>
      <div className="space-y-1">
        <Label>Código de Tributação Municipal (LC 116)</Label>
        <CodigoTributacaoSelect value={value.codigoTributacaoMunicipal} onValueChange={codigo => onChange({ codigoTributacaoMunicipal: codigo })} options={CODIGOS_TRIB_MUNICIPAL} label="Código de Tributação Municipal (LC 116)" placeholder="Selecione o código municipal..." />
      </div>
    </div>
  );
}