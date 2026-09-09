import { useState, useMemo } from "react";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useNavigate } from "@/lib/router-compat";
import { ClipboardCheck, Search, X, SlidersHorizontal, Check, ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProcessoSeletivo } from "@/contexts/ProcessoSeletivoContext";
import { useRequisicoes } from "@/contexts/RequisicaoContext";
import ProcessoSeletivoKPIs from "@/components/ProcessoSeletivoKPIs";

export function formatNumeroPS(p: { numero?: number; dataCriacao?: string }) {
  const ano = (p.dataCriacao || "").split("/")[2] || String(new Date().getFullYear());
  return `${String(p.numero ?? 0).padStart(2, "0")}-${ano}`;
}

function FiltroCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__todos__"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Todos
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


const ProcessosSeletivos = () => {
  const navigate = useNavigate();
  const { processos } = useProcessoSeletivo();
  const { requisicoes } = useRequisicoes();
  const [search, setSearch] = useState("");
  const [cliente, setCliente] = useState("");
  const [cargo, setCargo] = useState("");
  const [status, setStatus] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<"numero" | "dataCriacao" | "cargo" | "unidade" | "status" | "candidatos">("dataCriacao");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");


  const processosComReq = useMemo(() =>
    processos.map((p) => ({
      ...p,
      requisicao: requisicoes.find((r) => r.id === p.requisicaoId),
    })),
    [processos, requisicoes]
  );

  const clientesUnicos = useMemo(
    () =>
      Array.from(
        new Set(processosComReq.map((p) => p.requisicao?.unidade).filter(Boolean))
      ).sort((a, b) => (a as string).localeCompare(b as string)),
    [processosComReq]
  );

  const cargosUnicos = useMemo(
    () =>
      Array.from(
        new Set(processosComReq.map((p) => p.requisicao?.cargoNome).filter(Boolean))
      ).sort((a, b) => (a as string).localeCompare(b as string)),
    [processosComReq]
  );

  const getProcessoStatus = (p: typeof processosComReq[0]) => {
    const total = p.candidatos.length;
    if (total === 0) return "em_andamento";
    // Só é concluído quando a contratação foi efetivamente finalizada
    if (p.candidatos.some((c) => c.contratacaoFinalizada)) return "concluido";
    if (p.candidatos.some((c) => c.etapaAtual === "liberacao")) return "liberacao";
    return "em_andamento";
  };

  const parseData = (s: string) => {
    const [d, m, y] = (s || "").split("/");
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime() || 0;
  };

  const parseInputDate = (s: string) => {
    if (!s) return 0;
    const [y, m, d] = s.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const inicio = parseInputDate(dataInicio);
    const fim = parseInputDate(dataFim);
    const fimAjustado = fim ? fim + 24 * 60 * 60 * 1000 - 1 : 0;

    const base = processosComReq.filter((p) => {
      const dataProc = parseData(p.dataCriacao);
      const matchSearch =
        !term ||
        (p.requisicao?.cargoNome || "").toLowerCase().includes(term) ||
        (p.requisicao?.unidade || "").toLowerCase().includes(term) ||
        p.dataCriacao.toLowerCase().includes(term) ||
        formatNumeroPS(p).toLowerCase().includes(term) ||
        p.candidatos.some((c) => c.nome.toLowerCase().includes(term));
      const matchCliente = !cliente || p.requisicao?.unidade === cliente;
      const matchCargo = !cargo || p.requisicao?.cargoNome === cargo;
      const matchStatus = !status || getProcessoStatus(p) === status;
      const matchPeriodo =
        (!inicio || dataProc >= inicio) &&
        (!fimAjustado || dataProc <= fimAjustado);
      return matchSearch && matchCliente && matchCargo && matchStatus && matchPeriodo;
    });

    return [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "numero": {
          const na = a.numero ?? 0;
          const nb = b.numero ?? 0;
          return (na - nb) * dir;
        }
        case "cargo":
          return ((a.requisicao?.cargoNome || "").localeCompare(b.requisicao?.cargoNome || "")) * dir;
        case "unidade":
          return ((a.requisicao?.unidade || "").localeCompare(b.requisicao?.unidade || "")) * dir;
        case "status":
          return (getProcessoStatus(a).localeCompare(getProcessoStatus(b))) * dir;
        case "candidatos":
          return (a.candidatos.length - b.candidatos.length) * dir;
        case "dataCriacao":
        default:
          return (parseData(a.dataCriacao) - parseData(b.dataCriacao)) * dir;
      }
    });
  }, [processosComReq, search, cliente, cargo, status, dataInicio, dataFim, sortField, sortDir]);


  const limparFiltros = () => {
    setSearch("");
    setCliente("");
    setCargo("");
    setStatus("");
    setDataInicio("");
    setDataFim("");
    setPage(1);
  };

  const filtrosAtivos = search || cliente || cargo || status || dataInicio || dataFim;

  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const periodoPresets = [
    { label: "Hoje", range: () => { const h = toISO(new Date()); return [h, h] as const; } },
    { label: "7 dias", range: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 6); return [toISO(i), toISO(f)] as const; } },
    { label: "30 dias", range: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 29); return [toISO(i), toISO(f)] as const; } },
    { label: "Este mês", range: () => { const n = new Date(); return [toISO(new Date(n.getFullYear(), n.getMonth(), 1)), toISO(n)] as const; } },
    { label: "Este ano", range: () => { const n = new Date(); return [toISO(new Date(n.getFullYear(), 0, 1)), toISO(n)] as const; } },
  ];

  const statusLabels: Record<string, string> = {
    em_andamento: "Em andamento",
    liberacao: "Em liberação",
    concluido: "Concluído",
  };

  const formatBr = (s: string) => (s ? s.split("-").reverse().join("/") : "");

  const chipsAtivos = [
    search && { label: `Busca: ${search}`, clear: () => { setSearch(""); setPage(1); } },
    cliente && { label: `Unidade: ${cliente}`, clear: () => { setCliente(""); setPage(1); } },
    cargo && { label: `Cargo: ${cargo}`, clear: () => { setCargo(""); setPage(1); } },
    status && { label: `Status: ${statusLabels[status] || status}`, clear: () => { setStatus(""); setPage(1); } },
    (dataInicio || dataFim) && {
      label: `Período: ${formatBr(dataInicio) || "…"} → ${formatBr(dataFim) || "…"}`,
      clear: () => { setDataInicio(""); setDataFim(""); setPage(1); },
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];



  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <ClipboardCheck className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Processos Seletivos</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Processos Seletivos</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe os processos seletivos vinculados às requisições aprovadas.
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores consolidados */}
        <ProcessoSeletivoKPIs
          candidatos={filtered.flatMap((p) => p.candidatos)}
          className="mb-6"
        />

        {/* Filtros */}
        <Card className="mb-6 animate-fade-up">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filtros
                {filtrosAtivos && (
                  <Badge variant="secondary" className="ml-1">
                    {filtered.length} de {processosComReq.length}
                  </Badge>
                )}
              </div>
              {filtrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-8 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nº, candidato, cargo, unidade..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9 pr-8 h-9"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => { setSearch(""); setPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cliente / Unidade</Label>
                <FiltroCombobox
                  value={cliente}
                  onChange={(v) => { setCliente(v); setPage(1); }}
                  options={clientesUnicos as string[]}
                  placeholder="Todos"
                  searchPlaceholder="Buscar cliente/unidade..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cargo</Label>
                <FiltroCombobox
                  value={cargo}
                  onChange={(v) => { setCargo(v); setPage(1); }}
                  options={cargosUnicos as string[]}
                  placeholder="Todos"
                  searchPlaceholder="Buscar cargo..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status || " "} onValueChange={(v) => { setStatus(v.trim()); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Todos</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="liberacao">Em liberação</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Período de criação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
                    className="h-9 flex-1"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">→</span>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
                    className="h-9 flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Atalhos de período</Label>
                <div className="flex flex-wrap gap-2">
                  {periodoPresets.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => { const [i, f] = p.range(); setDataInicio(i); setDataFim(f); setPage(1); }}
                    >
                      {p.label}
                    </Button>
                  ))}
                  {(dataInicio || dataFim) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 text-muted-foreground"
                      onClick={() => { setDataInicio(""); setDataFim(""); setPage(1); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Período
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <Label className="text-xs text-muted-foreground">Ordenação</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={sortField}
                    onValueChange={(v) => { setSortField(v as typeof sortField); setPage(1); }}
                  >
                    <SelectTrigger className="h-9 w-[220px]">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numero">Número PS</SelectItem>
                      <SelectItem value="dataCriacao">Data de criação</SelectItem>
                      <SelectItem value="cargo">Cargo</SelectItem>
                      <SelectItem value="unidade">Unidade</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="candidatos">Quantidade de candidatos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => { setSortDir((d) => (d === "asc" ? "desc" : "asc")); setPage(1); }}
                  >
                    {sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {sortDir === "asc" ? "Crescente" : "Decrescente"}
                  </Button>
                </div>
              </div>
            </div>

            {filtrosAtivos && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                {chipsAtivos.map((c) => (
                  <Badge key={c.label} variant="secondary" className="gap-1 font-normal">
                    {c.label}
                    <button type="button" onClick={c.clear} aria-label={`Remover ${c.label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              {processosComReq.length === 0 ? "Nenhum processo seletivo iniciado ainda." : "Nenhum resultado encontrado."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {paginate(filtered, page, pageSize).paginated.map((p, idx) => {
              const total = p.candidatos.length;
              const contratados = p.candidatos.filter((c) => c.etapaAtual === "contratacao").length;
              const reprovados = p.candidatos.filter(
                (c) =>
                  c.statusPsicologico === "reprovado" ||
                  c.statusTecnico === "reprovado" ||
                  c.statusLiberacao === "reprovado"
              ).length;
              const st = getProcessoStatus(p);
              const stLabel = st === "concluido" ? "Concluído" : st === "liberacao" ? "Em liberação" : "Em andamento";
              const stClass =
                st === "concluido"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : st === "liberacao"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-amber-100 text-amber-800 border-amber-200";
              return (
                <Card
                  key={p.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60"}`}
                  onClick={() => navigate(`/processo-seletivo/${p.requisicaoId}`)}
                >
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[11px] border-primary/30 text-primary">
                          PS {formatNumeroPS(p)}
                        </Badge>
                        {p.requisicao?.cargoNome || "Cargo"} — {p.requisicao?.unidade || "Unidade"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {p.dataCriacao} · {total} candidato{total !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={stClass}>{stLabel}</Badge>
                      {reprovados > 0 && (
                        <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200">
                          {reprovados} reprovado{reprovados !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {contratados > 0 && (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          {contratados} liberado{contratados !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">Abrir →</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>
    </div>
  );
};

export default ProcessosSeletivos;
