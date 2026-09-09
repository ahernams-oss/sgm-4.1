import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FileText, Plus, Eye, Download, XCircle, Loader2, Receipt, Check, ChevronsUpDown } from "lucide-react";
import { useNfses, ModeloEmissaoNfse, NfseEmitida } from "@/contexts/NfsesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useObras } from "@/contexts/ObrasContext";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CODIGOS_TRIB_NACIONAL: { codigo: string; descricao: string }[] = [
  { codigo: "07.05.01", descricao: "Reparação, conservação e reforma de edifícios e congêneres (exceto o fornecimento de mercadorias produzidas pelo prestador dos serviços, fora do local da prestação dos serviços, que fica sujeito ao ICMS)." },
  { codigo: "14.01.01", descricao: "Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto (exceto peças e partes empregadas, que ficam sujeitas ao ICMS)." },
];

const CODIGOS_TRIB_MUNICIPAL: { codigo: string; descricao: string }[] = [
  { codigo: "07.05.01", descricao: "Reparação de edifícios e congêneres" },
  { codigo: "07.05.02", descricao: "Reparação de estradas e congêneres" },
  { codigo: "07.05.03", descricao: "Reparação de pontes e congêneres" },
  { codigo: "07.05.04", descricao: "Reparação de portos e congêneres" },
  { codigo: "07.05.05", descricao: "Reparação de imóveis em geral" },
  { codigo: "07.05.06", descricao: "Reparação de edifícios/congêneres componente de obra licenciada (hotelaria)" },
  { codigo: "07.05.07", descricao: "Conservação de edifícios e congêneres" },
  { codigo: "07.05.08", descricao: "Conservação de estradas e congêneres" },
  { codigo: "07.05.09", descricao: "Conservação de pontes e congêneres" },
  { codigo: "07.05.10", descricao: "Conservação de portos e congêneres" },
  { codigo: "07.05.11", descricao: "Conservação de imóveis em geral" },
  { codigo: "07.05.12", descricao: "Conservação de edifícios/congêneres componente de obra licenciada (hotelaria)" },
  { codigo: "07.05.13", descricao: "Reforma de edifícios e congêneres" },
  { codigo: "07.05.14", descricao: "Reforma de estradas e congêneres" },
  { codigo: "07.05.15", descricao: "Reforma de pontes e congêneres" },
  { codigo: "07.05.16", descricao: "Reforma de portos e congêneres" },
  { codigo: "07.05.17", descricao: "Reforma de imóveis em geral" },
  { codigo: "07.05.18", descricao: "Reforma de edifícios/congêneres componente de obra licenciada (hotelaria)" },
  { codigo: "14.01.01", descricao: "Lubrificação de máquinas" },
  { codigo: "14.01.02", descricao: "Limpeza ou lustração de máquinas" },
  { codigo: "14.01.03", descricao: "Revisão de máquinas" },
  { codigo: "14.01.04", descricao: "Carga e recarga de máquinas" },
  { codigo: "14.01.05", descricao: "Conserto de máquinas" },
  { codigo: "14.01.06", descricao: "Restauração de máquinas" },
  { codigo: "14.01.07", descricao: "Manutenção de máquinas" },
  { codigo: "14.01.08", descricao: "Conservação de máquinas" },
  { codigo: "14.01.09", descricao: "Lubrificação de aparelhos" },
  { codigo: "14.01.10", descricao: "Limpeza ou lustração de aparelhos" },
  { codigo: "14.01.11", descricao: "Revisão de aparelhos" },
  { codigo: "14.01.12", descricao: "Carga e recarga de aparelhos" },
  { codigo: "14.01.13", descricao: "Conserto de aparelhos" },
  { codigo: "14.01.14", descricao: "Restauração de aparelhos" },
  { codigo: "14.01.15", descricao: "Manutenção de aparelhos" },
  { codigo: "14.01.16", descricao: "Conservação de aparelhos" },
  { codigo: "14.01.17", descricao: "Conservação de veículos" },
  { codigo: "14.01.18", descricao: "Lubrificação de veículos" },
  { codigo: "14.01.19", descricao: "Limpeza de veículos" },
  { codigo: "14.01.20", descricao: "Revisão de veículos" },
  { codigo: "14.01.22", descricao: "Conserto de veículos" },
  { codigo: "14.01.23", descricao: "Restauração de veículos" },
  { codigo: "14.01.24", descricao: "Manutenção de veículos" },
  { codigo: "14.01.25", descricao: "Blindagem de veículos" },
  { codigo: "14.01.26", descricao: "Lustração de veículos" },
  { codigo: "14.01.27", descricao: "Lubrificação de equipamentos" },
  { codigo: "14.01.28", descricao: "Limpeza de equipamentos" },
  { codigo: "14.01.29", descricao: "Revisão de equipamentos" },
  { codigo: "14.01.30", descricao: "Conserto de equipamentos" },
];


const formatBRL = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  processando: "bg-blue-100 text-blue-800",
  emitida: "bg-green-100 text-green-800",
  rejeitada: "bg-red-100 text-red-800",
  cancelada: "bg-orange-100 text-orange-800",
};

export default function NfseEmitir() {
  const { nfses, config, loading, emitir, cancelar, remover } = useNfses();
  const { empresa } = useEmpresa();
  const { clientes } = useClientes();

  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [openEmit, setOpenEmit] = useState(false);
  const [viewNfse, setViewNfse] = useState<NfseEmitida | null>(null);
  const [cancelTarget, setCancelTarget] = useState<NfseEmitida | null>(null);
  const [motivoCancel, setMotivoCancel] = useState("");

  const filtrados = useMemo(() => {
    let lista = nfses;
    if (filtroStatus !== "todos") lista = lista.filter((n) => n.status === filtroStatus);
    if (filtroCliente) lista = lista.filter((n) => n.cliente_id === filtroCliente);
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      lista = lista.filter((n) =>
        String(n.numero_dps).includes(q) ||
        (n.tomador?.razaoSocial || "").toLowerCase().includes(q) ||
        (n.chave_acesso || "").includes(q)
      );
    }
    return lista;
  }, [nfses, filtroStatus, filtroCliente, filtroBusca]);

  const { paginated: pageItems } = paginate(filtrados, page, perPage);

  const kpis = useMemo(() => {
    const mes = new Date().getMonth(), ano = new Date().getFullYear();
    const noMes = nfses.filter((n) => {
      const d = n.data_emissao ? new Date(n.data_emissao) : null;
      return d && d.getMonth() === mes && d.getFullYear() === ano;
    });
    return {
      emitidas: noMes.filter((n) => n.status === "emitida").length,
      rejeitadas: nfses.filter((n) => n.status === "rejeitada").length,
      canceladas: nfses.filter((n) => n.status === "cancelada").length,
      totalIss: noMes.filter((n) => n.status === "emitida").reduce((s, n) => s + Number(n.valor_iss || 0), 0),
    };
  }, [nfses]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold">NFS-e Nacional</h1>
        <Button onClick={() => setOpenEmit(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Emitir NFS-e
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Emitidas no mês" value={String(kpis.emitidas)} icon={<Receipt className="w-5 h-5" />} />
        <KpiCard label="Rejeitadas" value={String(kpis.rejeitadas)} icon={<XCircle className="w-5 h-5" />} />
        <KpiCard label="Canceladas" value={String(kpis.canceladas)} icon={<XCircle className="w-5 h-5" />} />
        <KpiCard label="ISS no mês" value={formatBRL(kpis.totalIss)} icon={<FileText className="w-5 h-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NFS-e emitidas</CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Input placeholder="Buscar por número, tomador, chave..." value={filtroBusca}
              onChange={(e) => { setFiltroBusca(e.target.value); setPage(1); }} className="w-72" />
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="processando">Processando</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="rejeitada">Rejeitada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCliente || "todos"} onValueChange={(v) => { setFiltroCliente(v === "todos" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número/Série</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead className="text-right">Valor Serviço</TableHead>
                <TableHead className="text-right">ISS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="w-4 h-4 animate-spin inline" /></TableCell></TableRow>}
              {!loading && pageItems.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma NFS-e emitida</TableCell></TableRow>
              )}
              {pageItems.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono">{n.numero_dps}/{n.serie}</TableCell>
                  <TableCell>{formatDate(n.data_emissao || n.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{n.tomador?.razaoSocial || "—"}</span>
                      <span className="text-xs text-muted-foreground">{n.tomador?.documento}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(n.valor_servico)}</TableCell>
                  <TableCell className="text-right">{formatBRL(n.valor_iss)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[n.status] || ""}>{n.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{n.ambiente === 1 ? "Produção" : "Homologação"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewNfse(n)} title="Ver detalhes"><Eye className="w-4 h-4" /></Button>
                      {n.xml_nfse && (
                        <Button size="icon" variant="ghost" title="Baixar XML"
                          onClick={() => downloadText(`nfse-${n.numero_dps}.xml`, n.xml_nfse!)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {n.status === "emitida" && (
                        <Button size="icon" variant="ghost" title="Cancelar"
                          onClick={() => { setCancelTarget(n); setMotivoCancel(""); }}>
                          <XCircle className="w-4 h-4 text-orange-600" />
                        </Button>
                      )}
                      {(n.status === "rejeitada" || n.status === "rascunho") && (
                        <Button size="icon" variant="ghost" title="Remover"
                          onClick={() => { if (confirm("Remover este rascunho?")) remover(n.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={filtrados.length} onPageChange={setPage} pageSize={perPage} onPageSizeChange={setPerPage} />
        </CardContent>
      </Card>

      <EmitirDialog open={openEmit} onClose={() => setOpenEmit(false)} />

      {/* Visualização */}
      <Dialog open={!!viewNfse} onOpenChange={(o) => !o && setViewNfse(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>NFS-e {viewNfse?.numero_dps}/{viewNfse?.serie}</DialogTitle></DialogHeader>
          {viewNfse && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Status" value={viewNfse.status} />
                <Info label="Ambiente" value={viewNfse.ambiente === 1 ? "Produção" : "Homologação"} />
                <Info label="Chave de acesso" value={viewNfse.chave_acesso || "—"} />
                <Info label="Protocolo" value={viewNfse.protocolo || "—"} />
                <Info label="Data emissão" value={formatDate(viewNfse.data_emissao)} />
                <Info label="Competência" value={viewNfse.data_competencia || "—"} />
              </div>
              <div>
                <h4 className="font-semibold mt-2">Tomador</h4>
                <p>{viewNfse.tomador?.razaoSocial} — {viewNfse.tomador?.documento}</p>
              </div>
              <div>
                <h4 className="font-semibold mt-2">Serviço</h4>
                <p className="whitespace-pre-wrap">{viewNfse.servico?.descricao}</p>
                <p className="text-xs text-muted-foreground">Cód. trib. municipal: {viewNfse.servico?.codigoTributacaoMunicipio}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <Info label="Valor serviço" value={formatBRL(viewNfse.valor_servico)} />
                <Info label="ISS" value={formatBRL(viewNfse.valor_iss)} />
                <Info label="Líquido" value={formatBRL(viewNfse.valor_liquido)} />
              </div>
              {viewNfse.mensagem_retorno && (
                <div className="bg-muted p-3 rounded text-xs">
                  <strong>Retorno:</strong>
                  <p className="whitespace-pre-wrap">{viewNfse.mensagem_retorno}</p>
                </div>
              )}
              {viewNfse.xml_dps && (
                <details className="text-xs">
                  <summary className="cursor-pointer">Ver XML DPS assinado</summary>
                  <pre className="bg-muted p-2 rounded mt-2 overflow-auto max-h-80">{viewNfse.xml_dps}</pre>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar NFS-e {cancelTarget?.numero_dps}</DialogTitle></DialogHeader>
          <Label>Motivo do cancelamento</Label>
          <Textarea value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button onClick={async () => {
              if (motivoCancel.length < 15) return toast.error("Motivo deve ter ao menos 15 caracteres");
              await cancelar(cancelTarget!.id, motivoCancel);
              toast.success("NFS-e cancelada");
              setCancelTarget(null);
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ====================== Dialog de Emissão ======================
function EmitirDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Partial<ModeloEmissaoNfse> }) {
  const { empresa } = useEmpresa();
  const { clientes } = useClientes();
  const { obras, porCliente } = useObras();
  const { emitir, config } = useNfses();

  const [submitting, setSubmitting] = useState(false);
  const [clienteId, setClienteId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [codigoTrib, setCodigoTrib] = useState<string>(config?.codigo_servico_padrao || "");
  const [codigoTribNacional, setCodigoTribNacional] = useState<string>("");
  const [codigoNbs, setCodigoNbs] = useState<string>(config?.codigo_nbs || "");
  const [valorServico, setValorServico] = useState<string>("0,00");
  const [deducoes, setDeducoes] = useState<string>("0,00");
  const [obraId, setObraId] = useState<string>("");
  const [codigoObraTexto, setCodigoObraTexto] = useState<string>("COI");
  const [tipoInfoObra, setTipoInfoObra] = useState<"codigo" | "cib" | "endBR" | "endEX">("codigo");
  const [obraCib, setObraCib] = useState<string>("");
  const [obraEndCep, setObraEndCep] = useState<string>("");
  const [obraEndLogradouro, setObraEndLogradouro] = useState<string>("");
  const [obraEndNumero, setObraEndNumero] = useState<string>("");
  const [obraEndComplemento, setObraEndComplemento] = useState<string>("");
  const [obraEndBairro, setObraEndBairro] = useState<string>("");
  const [obraEndMunicipio, setObraEndMunicipio] = useState<string>("");
  const [obraEndUf, setObraEndUf] = useState<string>("");
  const [obraEndPais, setObraEndPais] = useState<string>("");
  const [obraEndExterior, setObraEndExterior] = useState<string>("");
  const [obraInscMobiliaria, setObraInscMobiliaria] = useState<string>("");
  const [aliquotaIss, setAliquotaIss] = useState<string>(String(config?.aliquota_iss_padrao || "5"));
  const [issRetido, setIssRetido] = useState<boolean>(!!config?.iss_retido_padrao);

  // Tributação Federal
  const [pisCofinsSituacao, setPisCofinsSituacao] = useState<string>("1");
  const [basePisCofins, setBasePisCofins] = useState<string>("0,00");
  const [aliquotaPis, setAliquotaPis] = useState<string>("0,65");
  const [pisDebito, setPisDebito] = useState<string>("0,00");
  const [aliquotaCofins, setAliquotaCofins] = useState<string>("3,00");
  const [cofinsDebito, setCofinsDebito] = useState<string>("0,00");
  const [descContribRetidas, setDescContribRetidas] = useState<string>("0");
  const [irrf, setIrrf] = useState<string>("0,00");
  const [contribSociaisRetidas, setContribSociaisRetidas] = useState<string>("0,00");
  const [contribPrevidRetida, setContribPrevidRetida] = useState<string>("0,00");
  const [baseInss, setBaseInss] = useState<string>("0,00");

  // Total dos tributos
  const [totalFederal, setTotalFederal] = useState<string>("0,00");
  const [totalEstadual, setTotalEstadual] = useState<string>("0,00");
  const [totalMunicipal, setTotalMunicipal] = useState<string>("0,00");
  const [senhaCert, setSenhaCert] = useState("");
  const [ufPrest, setUfPrest] = useState<string>("");
  const [municipioPrest, setMunicipioPrest] = useState<{ id: string; nome: string } | null>(null);
  const [municipios, setMunicipios] = useState<{ id: string; nome: string }[]>([]);
  const [openMun, setOpenMun] = useState(false);

  useEffect(() => {
    if (!ufPrest) { setMunicipios([]); return; }
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufPrest}/municipios`)
      .then((r) => r.json())
      .then((rows: any[]) => setMunicipios(rows.map((m) => ({ id: String(m.id), nome: m.nome }))))
      .catch(() => setMunicipios([]));
  }, [ufPrest]);

  const cliente = clientes.find((c) => c.id === clienteId);

  const parseNum = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
  const fmt2 = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Auto: base PIS/COFINS = valor do serviço
  useEffect(() => {
    setBasePisCofins(fmt2(parseNum(valorServico)));
  }, [valorServico]);

  // Auto: PIS débito = base × alíquota PIS
  useEffect(() => {
    setPisDebito(fmt2(parseNum(basePisCofins) * parseNum(aliquotaPis) / 100));
  }, [basePisCofins, aliquotaPis]);

  // Auto: COFINS débito = base × alíquota COFINS
  useEffect(() => {
    setCofinsDebito(fmt2(parseNum(basePisCofins) * parseNum(aliquotaCofins) / 100));
  }, [basePisCofins, aliquotaCofins]);

  // Auto: Total Federal % = (PIS + COFINS + IRRF + Contrib. Sociais + Contrib. Prev.) / valor × 100
  useEffect(() => {
    const v = parseNum(valorServico);
    if (v <= 0) { setTotalFederal("0,00"); return; }
    const total = parseNum(pisDebito) + parseNum(cofinsDebito) + parseNum(irrf) + parseNum(contribSociaisRetidas) + parseNum(contribPrevidRetida);
    setTotalFederal(fmt2(total / v * 100));
  }, [pisDebito, cofinsDebito, irrf, contribSociaisRetidas, contribPrevidRetida, valorServico]);

  // Auto: Total Municipal % = alíquota ISS
  useEffect(() => { setTotalMunicipal(fmt2(parseNum(aliquotaIss))); }, [aliquotaIss]);

  // Auto: IRRF = base × 1,5% e Contribuições Sociais Retidas = base × 1%
  useEffect(() => {
    const base = parseNum(basePisCofins);
    setIrrf(fmt2(base * 0.015));
    setContribSociaisRetidas(fmt2(base * 0.01));
  }, [basePisCofins]);

  // Base de cálculo INSS = Valor do serviço − Deduções
  useEffect(() => {
    setBaseInss(fmt2(Math.max(0, parseNum(valorServico) - parseNum(deducoes))));
  }, [valorServico, deducoes]);

  // Contribuição Previdenciária Retida = 11% da base INSS
  useEffect(() => { setContribPrevidRetida(fmt2(parseNum(baseInss) * 0.11)); }, [baseInss]);



  const onSubmit = async () => {
    if (!empresa?.id) return toast.error("Cadastre os dados da empresa primeiro");
    if (!empresa.certificadoA1Url) return toast.error("Cadastre o certificado A1 em Dados da Empresa");
    if (!cliente) return toast.error("Selecione o tomador (cliente)");
    if (!descricao) return toast.error("Informe a descrição do serviço");
    if (!codigoTrib) return toast.error("Informe o código de tributação municipal (LC 116)");
    if (!senhaCert) return toast.error("Informe a senha do certificado A1");
    if (!municipioPrest) return toast.error("Selecione o município de prestação do serviço");


    const modelo: ModeloEmissaoNfse = {
      empresaId: empresa.id,
      ambiente: (config?.ambiente as 1 | 2) || 2,
      serie: config?.serie_padrao || "00001",
      clienteId,
      prestador: {
        cnpj: empresa.cnpj, im: empresa.inscricaoMunicipal, razaoSocial: empresa.razaoSocial,
        codigoMunicipio: municipioPrest.id,
        optanteSimples: !!config?.optante_simples,
        regimeTributario: config?.regime_tributario || "1",
      },
      tomador: {
        tipo: (cliente as any).cnpj ? "CNPJ" : "CPF",
        documento: (cliente as any).cnpj || (cliente as any).cpf || "",
        razaoSocial: cliente.nome || cliente.nomeFantasia,
        inscricaoMunicipal: (cliente as any).inscricaoMunicipal,
        email: (cliente as any).email,
        endereco: {
          logradouro: (cliente as any).logradouro, numero: (cliente as any).numero,
          complemento: (cliente as any).complemento, bairro: (cliente as any).bairro,
          codigoMunicipio: (cliente as any).codigoMunicipio || config?.codigo_municipio_prestador,
          uf: (cliente as any).uf, cep: (cliente as any).cep,
        },
      },
      servico: {
        descricao,
        codigoObra: obraId ? (obras.find((o) => o.id === obraId)?.numero || obraId) : undefined,
        obraId: obraId || undefined,
        obraNome: obraId ? obras.find((o) => o.id === obraId)?.nome : undefined,
        informacoesObra: {
          tipo: tipoInfoObra,
          codigoObra: tipoInfoObra === "codigo" ? (codigoObraTexto || (obraId ? (obras.find((o) => o.id === obraId)?.numero || obraId) : undefined)) : undefined,
          cib: tipoInfoObra === "cib" ? obraCib || undefined : undefined,
          inscricaoMobiliariaFiscal: obraInscMobiliaria || undefined,
          enderecoBrasil: tipoInfoObra === "endBR" ? {
            cep: obraEndCep, logradouro: obraEndLogradouro, numero: obraEndNumero,
            complemento: obraEndComplemento, bairro: obraEndBairro,
            municipio: obraEndMunicipio, uf: obraEndUf,
          } : undefined,
          enderecoExterior: tipoInfoObra === "endEX" ? { pais: obraEndPais, endereco: obraEndExterior } : undefined,
        },
        codigoTributacaoNacional: codigoTribNacional || undefined,
        codigoTributacaoMunicipio: codigoTrib,
        codigoNbs: codigoNbs || undefined,
        valorServico: parseNum(valorServico),
        deducoes: parseNum(deducoes),
      },
      tributos: {
        aliquotaIss: parseNum(aliquotaIss),
        issRetido,
        federal: {
          pisCofinsSituacao,
          basePisCofins: parseNum(basePisCofins),
          aliquotaPis: parseNum(aliquotaPis),
          pisDebito: parseNum(pisDebito),
          aliquotaCofins: parseNum(aliquotaCofins),
          cofinsDebito: parseNum(cofinsDebito),
          descContribRetidas,
          irrf: parseNum(irrf),
          contribSociaisRetidas: parseNum(contribSociaisRetidas),
          contribPrevidRetida: parseNum(contribPrevidRetida),
        },
        totais: {
          federal: parseNum(totalFederal),
          estadual: parseNum(totalEstadual),
          municipal: parseNum(totalMunicipal),
        },
      },
      certificadoSenha: senhaCert,
    };

    setSubmitting(true);
    const res = await emitir(modelo);
    setSubmitting(false);
    if (res.ok) {
      toast.success("NFS-e enviada para autorização");
      onClose();
    } else {
      toast.error(res.mensagem || "Falha ao emitir NFS-e");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Emitir NFS-e Nacional</DialogTitle></DialogHeader>

        <Tabs defaultValue="tomador">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="tomador">Tomador</TabsTrigger>
            <TabsTrigger value="servico">Serviço</TabsTrigger>
            <TabsTrigger value="tributos">Tributos</TabsTrigger>
            <TabsTrigger value="emitir">Emitir</TabsTrigger>
          </TabsList>

          <TabsContent value="tomador" className="space-y-3 pt-3">
            <Label>Cliente / Tomador</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione o tomador..." /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome || c.nomeFantasia} — {(c as any).cnpj || (c as any).cpf || "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cliente && (
              <div className="text-sm bg-muted p-3 rounded">
                <p><strong>{cliente.nome}</strong></p>
                <p>{(cliente as any).logradouro}, {(cliente as any).numero} — {(cliente as any).bairro}</p>
                <p>{(cliente as any).cidade}/{(cliente as any).uf} — CEP {(cliente as any).cep}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="servico" className="space-y-3 pt-3">
            <div>
              <Label>Descrição do serviço</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>UF da prestação</Label>
                <Select value={ufPrest} onValueChange={(v) => { setUfPrest(v); setMunicipioPrest(null); }}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Município de prestação do serviço</Label>
                <Popover open={openMun} onOpenChange={setOpenMun}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" disabled={!ufPrest}
                      className={cn("w-full justify-between font-normal", !municipioPrest && "text-muted-foreground")}>
                      {municipioPrest ? `${municipioPrest.nome} (${municipioPrest.id})` : (ufPrest ? "Selecione o município..." : "Selecione a UF primeiro")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar município..." />
                      <CommandList>
                        <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                        <CommandGroup>
                          {municipios.map((m) => (
                            <CommandItem key={m.id} value={m.nome}
                              onSelect={() => { setMunicipioPrest(m); setOpenMun(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", municipioPrest?.id === m.id ? "opacity-100" : "opacity-0")} />
                              {m.nome} <span className="ml-2 text-xs text-muted-foreground">{m.id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Código de Tributação Nacional</Label>
                <Select value={codigoTribNacional} onValueChange={setCodigoTribNacional}>
                  <SelectTrigger><SelectValue placeholder="Selecione o código nacional..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CODIGOS_TRIB_NACIONAL.map((c) => (
                      <SelectItem key={c.codigo} value={c.codigo}>
                        <span className="font-mono mr-2">{c.codigo}</span>
                        <span className="text-xs">{c.descricao.length > 90 ? c.descricao.slice(0, 90) + "…" : c.descricao}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código de Tributação Municipal (LC 116)</Label>
                <Select value={codigoTrib} onValueChange={setCodigoTrib}>
                  <SelectTrigger><SelectValue placeholder="Selecione o código municipal..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CODIGOS_TRIB_MUNICIPAL.map((c) => (
                      <SelectItem key={c.codigo} value={c.codigo}>
                        <span className="font-mono mr-2">{c.codigo}</span>
                        <span className="text-xs">{c.descricao}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border rounded-md p-3 space-y-3">
              <div className="text-sm font-semibold text-primary">INFORMAÇÕES PARA OBRA</div>
              <div>
                <Label className="text-sm">Selecione uma das opções abaixo: <span className="text-destructive">*</span></Label>
                <div className="mt-2 space-y-1.5">
                  {[
                    { v: "codigo", l: "Código de obra" },
                    { v: "cib", l: "Código do Cadastro Imobiliário Brasileiro - CIB" },
                    { v: "endBR", l: "Endereço no Brasil" },
                    { v: "endEX", l: "Endereço no exterior" },
                  ].map((opt) => (
                    <label key={opt.v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="tipoInfoObra"
                        value={opt.v}
                        checked={tipoInfoObra === opt.v}
                        onChange={() => setTipoInfoObra(opt.v as any)}
                        className="accent-primary"
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              {tipoInfoObra === "codigo" && (
                <div className="space-y-3">
                  <div>
                    <Label>Código da Obra <span className="text-destructive">*</span></Label>
                    <Input
                      value={codigoObraTexto}
                      onChange={(e) => setCodigoObraTexto(e.target.value)}
                      placeholder="COI"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vincular obra cadastrada (opcional)</Label>
                    <Select value={obraId || "nenhuma"} onValueChange={(v) => setObraId(v === "nenhuma" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione a obra..." /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="nenhuma">— Sem obra vinculada —</SelectItem>
                        {(clienteId ? porCliente(clienteId) : obras).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="font-mono mr-2">{o.numero ?? "—"}</span>
                            {o.nome}{!clienteId && o.cliente_nome ? ` (${o.cliente_nome})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clienteId && porCliente(clienteId).length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Nenhuma obra cadastrada para este cliente.</p>
                    )}
                  </div>
                </div>
              )}

              {tipoInfoObra === "cib" && (
                <div>
                  <Label>Código CIB <span className="text-destructive">*</span></Label>
                  <Input value={obraCib} onChange={(e) => setObraCib(e.target.value)} placeholder="Informe o código CIB" />
                </div>
              )}

              {tipoInfoObra === "endBR" && (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3"><Label>CEP <span className="text-destructive">*</span></Label><Input value={obraEndCep} onChange={(e) => setObraEndCep(e.target.value)} /></div>
                  <div className="col-span-7"><Label>Logradouro <span className="text-destructive">*</span></Label><Input value={obraEndLogradouro} onChange={(e) => setObraEndLogradouro(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Número</Label><Input value={obraEndNumero} onChange={(e) => setObraEndNumero(e.target.value)} /></div>
                  <div className="col-span-6"><Label>Complemento</Label><Input value={obraEndComplemento} onChange={(e) => setObraEndComplemento(e.target.value)} /></div>
                  <div className="col-span-6"><Label>Bairro <span className="text-destructive">*</span></Label><Input value={obraEndBairro} onChange={(e) => setObraEndBairro(e.target.value)} /></div>
                  <div className="col-span-9"><Label>Município <span className="text-destructive">*</span></Label><Input value={obraEndMunicipio} onChange={(e) => setObraEndMunicipio(e.target.value)} /></div>
                  <div className="col-span-3"><Label>UF <span className="text-destructive">*</span></Label><Input value={obraEndUf} onChange={(e) => setObraEndUf(e.target.value.toUpperCase())} maxLength={2} /></div>
                </div>
              )}

              {tipoInfoObra === "endEX" && (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4"><Label>País <span className="text-destructive">*</span></Label><Input value={obraEndPais} onChange={(e) => setObraEndPais(e.target.value)} /></div>
                  <div className="col-span-8"><Label>Endereço no exterior <span className="text-destructive">*</span></Label><Input value={obraEndExterior} onChange={(e) => setObraEndExterior(e.target.value)} /></div>
                </div>
              )}

              <div>
                <Label>Inscrição Imobiliária Fiscal</Label>
                <Input value={obraInscMobiliaria} onChange={(e) => setObraInscMobiliaria(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Código NBS (opcional)</Label>
                <Input value={codigoNbs} onChange={(e) => setCodigoNbs(e.target.value)} />
              </div>
              <div>
                <Label>Valor do serviço (R$)</Label>
                <Input
                  value={valorServico}
                  onChange={(e) => setValorServico(e.target.value)}
                  onBlur={(e) => setValorServico(fmt2(parseNum(e.target.value)))}
                />
              </div>
              <div>
                <Label>Deduções (R$)</Label>
                <Input
                  value={deducoes}
                  onChange={(e) => setDeducoes(e.target.value)}
                  onBlur={(e) => setDeducoes(fmt2(parseNum(e.target.value)))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tributos" className="space-y-4 pt-3">
            {/* ISS Municipal */}
            <div className="border rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-semibold text-primary">ISS Municipal</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input value={aliquotaIss} onChange={(e) => setAliquotaIss(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <input id="issRet" type="checkbox" checked={issRetido} onChange={(e) => setIssRetido(e.target.checked)} />
                  <Label htmlFor="issRet">ISS retido pelo tomador</Label>
                </div>
              </div>
            </div>

            {/* Tributação Federal */}
            <div className="border rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-semibold text-primary">Tributação Federal</h4>
              <div>
                <Label>Situação tributária do PIS/COFINS</Label>
                <Select value={pisCofinsSituacao} onValueChange={setPisCofinsSituacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Operação Tributável com Alíquota Básica</SelectItem>
                    <SelectItem value="2">2 - Operação Tributável com Alíquota Diferenciada</SelectItem>
                    <SelectItem value="3">3 - Operação Tributável com Alíquota por Unidade</SelectItem>
                    <SelectItem value="4">4 - Operação Tributável Monofásica - Revenda a Alíquota Zero</SelectItem>
                    <SelectItem value="5">5 - Operação Tributável por Substituição Tributária</SelectItem>
                    <SelectItem value="6">6 - Operação Tributável a Alíquota Zero</SelectItem>
                    <SelectItem value="7">7 - Operação Isenta</SelectItem>
                    <SelectItem value="8">8 - Operação sem Incidência</SelectItem>
                    <SelectItem value="9">9 - Operação com Suspensão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Base de cálculo PIS/COFINS (R$)</Label>
                <Input value={basePisCofins} readOnly className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente com o valor bruto do serviço.</p>
              </div>
              <div>
                <Label>Base de cálculo INSS (R$)</Label>
                <Input value={baseInss} onChange={(e) => setBaseInss(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente com o valor bruto do serviço.</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">PIS - Alíquota (%)</Label>
                  <Input value={aliquotaPis} onChange={(e) => setAliquotaPis(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">PIS - Débito Apuração Própria (R$)</Label>
                  <Input value={pisDebito} onChange={(e) => setPisDebito(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">COFINS - Alíquota (%)</Label>
                  <Input value={aliquotaCofins} onChange={(e) => setAliquotaCofins(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">COFINS - Débito Apuração Própria (R$)</Label>
                  <Input value={cofinsDebito} onChange={(e) => setCofinsDebito(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Descrição Contribuições Sociais - Retidas</Label>
                <Select value={descContribRetidas} onValueChange={setDescContribRetidas}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Não Retido</SelectItem>
                    <SelectItem value="1">1 - PIS Retido</SelectItem>
                    <SelectItem value="2">2 - COFINS Retido</SelectItem>
                    <SelectItem value="3">3 - PIS/COFINS/CSLL Retidos</SelectItem>
                    <SelectItem value="4">4 - CSLL Retido</SelectItem>
                    <SelectItem value="5">5 - PIS/COFINS Retidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">IRRF (R$)</Label>
                  <Input value={irrf} onChange={(e) => setIrrf(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">Contribuições Sociais - Retidas (R$)</Label>
                  <Input value={contribSociaisRetidas} onChange={(e) => setContribSociaisRetidas(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <Label className="min-h-[2.5rem] leading-tight">Contribuição Previdenciária - Retida (R$)</Label>
                  <Input value={contribPrevidRetida} readOnly className="bg-muted" />
                </div>
              </div>
            </div>

            {/* Total dos tributos */}
            <div className="border rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-semibold text-primary">Total dos tributos</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Federal (%)</Label>
                  <Input value={totalFederal} onChange={(e) => setTotalFederal(e.target.value)} />
                </div>
                <div>
                  <Label>Estadual (%)</Label>
                  <Input value={totalEstadual} onChange={(e) => setTotalEstadual(e.target.value)} />
                </div>
                <div>
                  <Label>Municipal (%)</Label>
                  <Input value={totalMunicipal} onChange={(e) => setTotalMunicipal(e.target.value)} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="emitir" className="space-y-3 pt-3">
            <div className="bg-muted p-3 rounded text-sm space-y-1">
              <p><strong>Prestador:</strong> {empresa?.razaoSocial} — {empresa?.cnpj}</p>
              <p><strong>Ambiente:</strong> {config?.ambiente === 1 ? "Produção" : "Homologação"}</p>
              <p><strong>Série:</strong> {config?.serie_padrao || "00001"}</p>
              <p><strong>Tomador:</strong> {cliente?.nome || "—"}</p>
              <p><strong>Valor:</strong> {formatBRL(parseNum(valorServico))} • <strong>ISS:</strong> {formatBRL(parseNum(valorServico) * parseNum(aliquotaIss) / 100)}</p>
            </div>
            <div>
              <Label>Senha do certificado A1</Label>
              <Input type="password" value={senhaCert} onChange={(e) => setSenhaCert(e.target.value)} autoComplete="off" />
              <p className="text-xs text-muted-foreground mt-1">A senha é usada apenas para assinar o XML e não é armazenada.</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Emitindo...</> : "Emitir NFS-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
