import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Search, FileText, Calculator, Download, Filter, Building2, MapPin, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSolicitacoesServicos } from "@/contexts/SolicitacoesServicosContext";
import { useOrcamentos } from "@/contexts/OrcamentosContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatNumeroAno } from "@/lib/formatNumero";
import { useModuleManifest } from "@/hooks/useModuleManifest";
import OrcamentoDialog from "@/components/OrcamentoDialog";

const STATUS_COLORS: Record<string, string> = {
  Aprovado: "bg-green-600 text-white border-green-600",
  Enviado: "bg-blue-600 text-white border-blue-600",
  Revisão: "bg-destructive text-destructive-foreground border-destructive",
  Pendente: "bg-amber-500 text-white border-amber-500",
};

export default function OrcamentosMobile() {
  useModuleManifest({
    manifest: "/manifest-orcamentos.json",
    appleTitle: "Orçamentos",
    appleTouchIcon: "/icon-orcamentos-192.png",
  });

  const { solicitacoes, updateSolicitacao } = useSolicitacoesServicos();
  const { orcamentos } = useOrcamentos();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [target, setTarget] = useState<{ id: string; numero: number; clienteId: string; clienteNome: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const orcamentoDaSS = (ssId: string) => orcamentos.find((o) => o.solicitacaoId === ssId) || null;

  const clientes = useMemo(() => {
    const set = new Map<string, string>();
    solicitacoes.forEach((s) => { if (s.clienteId) set.set(s.clienteId, s.clienteNome); });
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [solicitacoes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return solicitacoes
      .filter((s) => {
        const orc = orcamentoDaSS(s.id);
        const statusOrc = orc?.status || "Sem orçamento";
        if (filtroStatus !== "todos" && statusOrc !== filtroStatus) return false;
        if (filtroCliente !== "todos" && s.clienteId !== filtroCliente) return false;
        if (!q) return true;
        return (
          String(s.numero).includes(q) ||
          s.clienteNome?.toLowerCase().includes(q) ||
          s.setorDescricao?.toLowerCase().includes(q) ||
          s.descricaoServicos?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.numero - a.numero);
  }, [solicitacoes, orcamentos, busca, filtroStatus, filtroCliente]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const abrir = (s: any) => {
    setTarget({ id: s.id, numero: s.numero, clienteId: s.clienteId, clienteNome: s.clienteNome });
    setDialogOpen(true);
  };

  const handleSent = async () => {
    if (!target) return;
    const full = solicitacoes.find((x) => x.id === target.id);
    const historico = [
      ...(full?.historico || []),
      { situacao: "Orçamento Disponível", data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema" },
    ];
    await updateSolicitacao(target.id, { situacao: "Orçamento Disponível", historico });
    toast({ title: "Orçamento enviado", description: `SS nº ${formatNumeroAno(target.numero, full?.createdAt)}` });
  };

  return (
    <div className="min-h-[100dvh] bg-muted/30 pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-md">
        <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <img src="/icon-orcamentos-192.png" alt="" className="w-9 h-9 rounded-lg" width={36} height={36} />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-tight truncate">Orçamentos</h1>
            <p className="text-[11px] opacity-80 truncate">Memória de Cálculo · {usuarioLogado?.nome || ""}</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-8 px-2">
            <Link to="/app/orcamentos/instalar" aria-label="Instalar app">
              <Download className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar SS, cliente, setor..."
              className="pl-9 bg-background text-foreground h-10"
              inputMode="search"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="bg-background text-foreground h-9 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Sem orçamento">Sem orçamento</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Revisão">Revisão</SelectItem>
                <SelectItem value="Enviado">Enviado</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCliente} onValueChange={setFiltroCliente}>
              <SelectTrigger className="bg-background text-foreground h-9 text-xs">
                <Building2 className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Lista */}
      <main className="p-3 sm:p-4">
        <p className="text-xs text-muted-foreground mb-2 px-1">{lista.length} solicitação(ões)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-16">
              Nenhuma solicitação encontrada.
            </div>
          )}
          {lista.map((s) => {
            const orc = orcamentoDaSS(s.id);
            const status = orc?.status || "Sem orçamento";
            return (
              <button
                key={s.id}
                onClick={() => abrir(s)}
                className="text-left w-full bg-card border rounded-xl p-3 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-bold text-sm">SS nº {formatNumeroAno(s.numero, s.createdAt)}</span>
                  </div>
                  <Badge className={`text-[10px] ${STATUS_COLORS[status] || "bg-muted text-muted-foreground border-muted"}`}>
                    {status}
                  </Badge>
                </div>

                <p className="mt-2 text-sm font-medium truncate">{s.clienteNome || "—"}</p>
                {(s.setorDescricao || s.localDescricao) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {[s.localDescricao, s.setorDescricao].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.descricaoServicos}</p>

                <div className="mt-3 flex items-center justify-between border-t pt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5" />
                    {orc ? `${(orc.memoriaCalculo?.length || 0)} grupo(s)` : "Novo orçamento"}
                  </span>
                  <span className="text-sm font-bold text-primary flex items-center gap-1">
                    {orc ? fmt(orc.valorTotal) : "Orçar"}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <OrcamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        solicitacao={target}
        existingOrcamento={target ? orcamentoDaSS(target.id) : null}
        onSent={handleSent}
      />
    </div>
  );
}
