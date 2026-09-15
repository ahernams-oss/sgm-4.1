import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FileText, X } from "lucide-react";

export interface NfeVinculo {
  nfeId?: string;
  nfeNumero?: string;
  nfeChave?: string;
  nfeEmitente?: string;
}

interface NfeRow {
  id: string;
  numero: string | null;
  serie: string | null;
  chave: string;
  emitente_nome: string | null;
  data_emissao: string | null;
  valor_total: number | null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function useNfesRecebidas() {
  return useQuery({
    queryKey: ["nfes_recebidas", "picker"],
    queryFn: async (): Promise<NfeRow[]> => {
      const { data, error } = await (supabase as any)
        .from("nfes_recebidas")
        .select("id,numero,serie,chave,emitente_nome,data_emissao,valor_total")
        .order("data_emissao", { ascending: false })
        .limit(500);
      if (error) {
        console.error("Erro ao carregar notas fiscais:", error);
        return [];
      }
      return (data || []) as NfeRow[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

interface Props {
  value?: NfeVinculo;
  onChange: (v: NfeVinculo) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function NfeOrigemPicker({ value, onChange, disabled, compact = true }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const { data: nfes = [], isLoading } = useNfesRecebidas();

  const filtradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return nfes.slice(0, 50);
    return nfes
      .filter(n => norm(`${n.numero ?? ""}${n.serie ?? ""}${n.chave}${n.emitente_nome ?? ""}`).includes(q))
      .slice(0, 50);
  }, [nfes, busca]);

  const label = value?.nfeId
    ? `NF ${value.nfeNumero || value.nfeChave?.slice(-6) || ""}`.trim()
    : "Vincular NF";

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={value?.nfeId ? "secondary" : "outline"}
            size="sm"
            disabled={disabled}
            className={compact ? "h-8 text-xs max-w-[160px] justify-start" : "justify-start"}
            title={value?.nfeChave ? `Chave: ${value.nfeChave}` : "Vincular nota fiscal de origem"}
          >
            <FileText className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start" onOpenAutoFocus={e => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar por número, chave ou emitente..." value={busca} onValueChange={setBusca} />
            <CommandList>
              <CommandEmpty>{isLoading ? "Carregando notas..." : "Nenhuma nota fiscal encontrada."}</CommandEmpty>
              <CommandGroup>
                {filtradas.map(n => (
                  <CommandItem
                    key={n.id}
                    value={n.id}
                    onSelect={() => {
                      onChange({
                        nfeId: n.id,
                        nfeNumero: n.numero ?? "",
                        nfeChave: n.chave,
                        nfeEmitente: n.emitente_nome ?? "",
                      });
                      setOpen(false);
                      setBusca("");
                    }}
                  >
                    <div className="flex flex-col w-full">
                      <span className="text-xs font-semibold">
                        NF {n.numero || "-"}{n.serie ? `/${n.serie}` : ""} — {n.emitente_nome || "Emitente não informado"}
                      </span>
                      <span className="text-[11px] text-muted-foreground break-all">
                        {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString("pt-BR") : "-"} · {n.chave}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value?.nfeId && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Remover vínculo da nota fiscal"
          onClick={() => onChange({ nfeId: undefined, nfeNumero: undefined, nfeChave: undefined, nfeEmitente: undefined })}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
