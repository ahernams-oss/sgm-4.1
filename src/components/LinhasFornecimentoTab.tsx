import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import type { LinhaFornecimento } from "@/contexts/ClientesContext";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Props {
  linhas: LinhaFornecimento[];
  onChange: (linhas: LinhaFornecimento[]) => void;
}

export default function LinhasFornecimentoTab({ linhas, onChange }: Props) {
  const { grupos } = useCategoriasCompras();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [observacao, setObservacao] = useState("");

  const selecionados = useMemo(() => new Set(linhas.map((l) => l.materialId)), [linhas]);

  const opcoes = useMemo(() => {
    const term = norm(search.trim());
    const list = grupos.filter((g) => !selecionados.has(g.id));
    if (!term) return list.slice(0, 50);
    return list
      .filter((g) => norm(`${g.codigo} ${g.nome}`).includes(term))
      .slice(0, 50);
  }, [grupos, search, selecionados]);

  const grupoSelecionado = grupos.find((g) => g.id === grupoId);

  const adicionar = () => {
    if (!grupoId) {
      toast.error("Selecione um grupo de compras.");
      return;
    }
    if (selecionados.has(grupoId)) {
      toast.error("Este grupo já está na linha de fornecimento.");
      return;
    }
    const g = grupos.find((x) => x.id === grupoId);
    if (!g) return;
    onChange([
      ...linhas,
      {
        id: crypto.randomUUID(),
        materialId: g.id,
        codigo: g.codigo,
        descricao: g.nome,
        tipo: "Grupo de Compras",
        unidadeMedida: "",
        observacao: observacao.trim(),
      },
    ]);
    setGrupoId("");
    setObservacao("");
    setSearch("");
    toast.success("Linha de fornecimento adicionada.");
  };

  const remover = (id: string) => onChange(linhas.filter((l) => l.id !== id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto] gap-3 items-end">
        <div>
          <label className="field-label">Grupo de Compras</label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !grupoSelecionado && "text-muted-foreground")}>
                  {grupoSelecionado
                    ? `${grupoSelecionado.codigo} — ${grupoSelecionado.nome}`
                    : "Selecione um grupo de compras..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Buscar por código ou nome do grupo..." value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {opcoes.map((g) => (
                      <CommandItem
                        key={g.id}
                        value={g.id}
                        onSelect={() => {
                          setGrupoId(g.id);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", grupoId === g.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">
                          <span className="tabular-nums text-muted-foreground mr-2">{g.codigo}</span>
                          {g.nome}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="field-label">Observação (opcional)</label>
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: prazo de entrega, marca, condição"
          />
        </div>
        <Button type="button" onClick={adicionar} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Portfólio de Fornecimento</h3>
          <Badge variant="secondary">{linhas.length} item(ns)</Badge>
        </div>
        {linhas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10 border border-dashed border-border rounded-lg">
            Nenhuma linha de fornecimento cadastrada.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg">
            {linhas.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold text-primary tabular-nums">{l.codigo || "—"}</p>
                  <p className="text-sm text-foreground truncate sm:col-span-2">{l.descricao}</p>
                  <p className="text-sm text-muted-foreground truncate">{l.tipo}</p>
                  <p className="text-sm text-muted-foreground truncate">{l.observacao || "—"}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remover(l.id)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
