import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { cn } from "@/lib/utils";

const porCodigo = (a: { codigo: string }, b: { codigo: string }) =>
  a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });

interface Props { value: string; onChange: (id: string) => void; }

/** Seletor de categoria agrupado por Grupo › SubGrupo, ordenado por código e pesquisável. */
export default function CategoriaComprasSelect({ value, onChange }: Props) {
  const { grupos, subGrupos, classes, getDescricaoCompleta } = useCategoriasCompras();
  const [open, setOpen] = useState(false);

  const secoes = useMemo(() => {
    const out: { chave: string; titulo: string; itens: typeof classes }[] = [];
    for (const g of [...grupos].sort(porCodigo)) {
      for (const s of subGrupos.filter(s => s.grupoId === g.id).sort(porCodigo)) {
        const itens = classes.filter(c => c.subGrupoId === s.id).sort(porCodigo);
        if (itens.length) out.push({ chave: s.id, titulo: `${g.codigo} ${g.nome} › ${s.codigo} ${s.nome}`, itens });
      }
    }
    const usados = new Set(out.flatMap(o => o.itens.map(i => i.id)));
    const resto = classes.filter(c => !usados.has(c.id)).sort(porCodigo);
    if (resto.length) out.push({ chave: "_outros", titulo: "Outras", itens: resto });
    return out;
  }, [grupos, subGrupos, classes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? getDescricaoCompleta(value) : "Selecione..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria por código ou nome..." />
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {secoes.map(s => (
              <CommandGroup key={s.chave} heading={s.titulo}>
                {s.itens.map(c => (
                  <CommandItem key={c.id} value={`${c.codigo} ${c.nome} ${s.titulo}`}
                    onSelect={() => { onChange(c.id); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono text-xs text-muted-foreground mr-2">{c.codigo}</span>
                    {c.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
