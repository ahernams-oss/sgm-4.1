import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Search, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Cliente } from "@/contexts/ClientesContext";

interface Props {
  /** Só os clientes já liberados na aba "Acessos por Cliente". */
  clientes: Cliente[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Locais que o usuário pode acessar, agrupados por cliente.
 * Regra: cliente sem nenhum local marcado = acesso a todos os locais dele.
 */
export default function AcessosPorLocal({ clientes, selecionados, onChange }: Props) {
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const sel = useMemo(() => new Set(selecionados), [selecionados]);

  const term = busca.trim().toLowerCase();
  const grupos = useMemo(
    () =>
      clientes
        .map((c) => {
          const locais = c.locais ?? [];
          const casaCliente = !term || c.nome.toLowerCase().includes(term);
          const visiveis = casaCliente
            ? locais
            : locais.filter((l) =>
                `${l.descricao} ${l.cidade} ${l.bairro}`.toLowerCase().includes(term),
              );
          return { cliente: c, locais, visiveis };
        })
        .filter((g) => !term || g.visiveis.length > 0 || g.cliente.nome.toLowerCase().includes(term)),
    [clientes, term],
  );

  const setMany = (ids: string[], add: boolean) => {
    const s = new Set(selecionados);
    ids.forEach((id) => (add ? s.add(id) : s.delete(id)));
    onChange(Array.from(s));
  };

  if (clientes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
        Marque primeiro os clientes na aba <strong>Acessos por Cliente</strong>. Os locais deles aparecem aqui.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Escolha os locais de cada cliente que este usuário poderá acessar. Cliente sem nenhum local marcado
          continua com acesso a <strong>todos os locais</strong>.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou local..." className="pl-8 h-8 text-xs" />
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8"
            onClick={() => setAbertos(Object.fromEntries(clientes.map((c) => [c.id, true])))}>Expandir</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setAbertos({})}>Recolher</Button>
        </div>
      </div>

      <div className="space-y-2">
        {grupos.map(({ cliente, locais, visiveis }) => {
          const ids = locais.map((l) => l.id);
          const marcados = ids.filter((id) => sel.has(id)).length;
          const aberto = !!abertos[cliente.id] || !!term;
          return (
            <div key={cliente.id} className={`rounded-lg border ${marcados ? "border-primary/60" : "border-border"} bg-card`}>
              <button type="button" onClick={() => setAbertos((p) => ({ ...p, [cliente.id]: !p[cliente.id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{cliente.nome}</p>
                  {cliente.cnpj && <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>}
                </div>
                {locais.length === 0 ? (
                  <Badge variant="outline" className="text-xs">Sem locais cadastrados</Badge>
                ) : marcados === 0 ? (
                  <Badge variant="secondary" className="text-xs">Todos os locais ({locais.length})</Badge>
                ) : (
                  <Badge className="text-xs">{marcados}/{locais.length} locais</Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
              </button>

              {aberto && locais.length > 0 && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMany(ids, true)}>Marcar todos</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMany(ids, false)}>Limpar (libera todos)</Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {visiveis.map((l) => {
                      const checked = sel.has(l.id);
                      return (
                        <label key={l.id} className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                          <Checkbox checked={checked} onCheckedChange={() => setMany([l.id], !checked)} className="mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{l.descricao || "Sem nome"}
                            </p>
                            {(l.bairro || l.cidade) && (
                              <p className="text-xs text-muted-foreground truncate">{[l.bairro, l.cidade, l.uf].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}
      </div>
    </div>
  );
}
