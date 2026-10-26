import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { normalizarClassificacaoEpi } from "@/lib/epiClassificacao";
import { cn } from "@/lib/utils";

export default function EpiClassificacaoSelect({ id, label, value, options, onChange, onCreate, canCreate }: {
  id: string; label: string; value: string; options: string[];
  onChange: (value: string) => void; onCreate: (value: string) => void; canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [novo, setNovo] = useState("");
  const query = normalizarClassificacaoEpi(search);
  const filtered = options.filter(option => normalizarClassificacaoEpi(option).includes(query));
  const novoNormalizado = normalizarClassificacaoEpi(novo);
  const podeCadastrar = canCreate && novoNormalizado && !options.some(option => normalizarClassificacaoEpi(option) === novoNormalizado);
  const cadastrar = () => {
    if (!podeCadastrar) return;
    const nome = novo.trim();
    onCreate(nome);
    onChange(nome);
    setNovo("");
    setSearch("");
    setOpen(false);
  };
  const select = (next: string) => { onChange(next); setOpen(false); setSearch(""); };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="w-full min-w-0 justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || `Selecione ${label.toLowerCase()}`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map(option => <CommandItem key={option} value={option} onSelect={() => select(option)}>
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === option ? "opacity-100" : "opacity-0")} />
                <span className="break-words">{option}</span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
          {(canCreate || value) && <div className="border-t border-border p-1">
            {canCreate && (
              <div className="flex items-center gap-1 px-1 pb-1">
                <Input
                  value={novo}
                  onChange={e => setNovo(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); cadastrar(); } }}
                  placeholder={`Novo ${label.toLowerCase()}`}
                  className="h-8 flex-1 min-w-0"
                />
                <Button type="button" size="sm" variant="outline" className="gap-1 h-8 shrink-0" disabled={!podeCadastrar} onClick={cadastrar}>
                  <Plus className="h-4 w-4 shrink-0" />Cadastrar
                </Button>
              </div>
            )}
            {value && <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={() => select("")}><X className="h-4 w-4" />Limpar seleção</Button>}
          </div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
