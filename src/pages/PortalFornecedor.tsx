import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { getFornecedorClient } from "@/lib/supabaseScoped";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { LogOut, FileText, ShoppingCart, AlertCircle, Building2, FileDown, FileSpreadsheet, KeyRound, LayoutDashboard, Clock, CheckCircle2, Truck, XCircle, PackageCheck, ChevronDown, ChevronRight, FilterX, Gavel, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logoLasant from "@/assets/Logo_Lasant.png";
import PaginationControls, { paginate } from "@/components/PaginationControls";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");


const STORAGE_KEY = "fornecedorPortalLogado";

interface FornecedorSession {
  id: string;
  nome: string;
  nomeFantasia?: string;
  email: string;
  cnpj?: string;
  mustChangePassword?: boolean;
}

interface ConviteRow {
  id: string;
  token: string;
  cotacao_numero: number;
  comprador: string;
  status: string;
  expires_at: string;
  created_at: string;
  itens: any;
}

interface PedidoRow {
  id: string;
  numero: number;
  data_criacao: string;
  comprador: string;
  status: string;
  valor_total: number;
  itens: any;
  condicao_pagamento: string;
  prazo_entrega: string;
  local_entrega: string;
  observacoes: string;
}

interface PregaoRow {
  id: string;
  numero: number;
  objeto: string;
  modalidade: string;
  tipo_disputa: string;
  status: string;
  data_publicacao: string;
  data_abertura_credenciamento: string;
  data_inicio_disputa: string;
  data_encerramento_disputa: string;
  termo_participacao: string;
  termo_hash: string;
  tempo_disputa_min: number;
  decremento_minimo: number;
  decremento_tipo: string;
  created_at: string;
  pregoeiro_nome: string;
}

interface PregaoParticipacao {
  id: string;
  pregao_id: string;
  fornecedor_id: string;
  apelido: string;
  status: string;
  termo_aceito_em: string;
  motivo_status: string;
}

const STATUS_PEDIDO_COLORS: Record<string, string> = {
  "Emitido": "hsl(217 91% 60%)",
  "Comprado": "hsl(262 83% 58%)",
  "Em Entrega": "hsl(38 92% 50%)",
  "Entregue Parcial": "hsl(31 91% 55%)",
  "Entregue": "hsl(142 71% 45%)",
  "Cancelado": "hsl(0 84% 60%)",
};

const STATUS_PEDIDO_ICONS: Record<string, any> = {
  "Emitido": FileText,
  "Comprado": PackageCheck,
  "Em Entrega": Truck,
  "Entregue Parcial": Truck,
  "Entregue": CheckCircle2,
  "Cancelado": XCircle,
};

function DashboardFornecedor({ pedidos, convites, loading }: { pedidos: PedidoRow[]; convites: ConviteRow[]; loading: boolean }) {
  const fmtMoney = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  const statusOrder = ["Emitido", "Comprado", "Em Entrega", "Entregue Parcial", "Entregue", "Cancelado"];
  const porStatus = statusOrder.map((s) => ({
    status: s,
    qtd: pedidos.filter((p) => p.status === s).length,
    valor: pedidos.filter((p) => p.status === s).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0),
  }));

  const valorTotal = pedidos.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const emAndamento = pedidos.filter((p) => ["Emitido", "Comprado", "Em Entrega", "Entregue Parcial"].includes(p.status));
  const entregues = pedidos.filter((p) => p.status === "Entregue");
  const cancelados = pedidos.filter((p) => p.status === "Cancelado");

  const ultimos = [...pedidos]
    .sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime())
    .slice(0, 5);

  if (loading) {
    return <Card><CardContent className="pt-6"><p className="text-muted-foreground text-sm">Carregando...</p></CardContent></Card>;
  }

  if (pedidos.length === 0) {
    return <Card><CardContent className="pt-6"><p className="text-muted-foreground text-sm">Nenhum ordem de compra para acompanhar ainda.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Em andamento</div>
            <p className="text-2xl font-semibold mt-1">{emAndamento.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Entregues</div>
            <p className="text-2xl font-semibold mt-1 text-green-600">{entregues.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Cancelados</div>
            <p className="text-2xl font-semibold mt-1 text-destructive">{cancelados.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">Valor total</div>
            <p className="text-2xl font-semibold mt-1 text-primary">{fmtMoney(valorTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos por status</CardTitle>
          <CardDescription>Distribuição dos seus ordens de compra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {porStatus.map((s) => {
              const Icon = STATUS_PEDIDO_ICONS[s.status] || FileText;
              const color = STATUS_PEDIDO_COLORS[s.status];
              const pct = pedidos.length > 0 ? Math.round((s.qtd / pedidos.length) * 100) : 0;
              return (
                <div key={s.status} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" style={{ color }} />
                      {s.status}
                    </div>
                    <span className="text-lg font-semibold" style={{ color }}>{s.qtd}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>{pct}%</span>
                    <span>{fmtMoney(s.valor)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos pedidos</CardTitle>
          <CardDescription>5 pedidos mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">OC-{String(p.numero).padStart(4, "0")}</TableCell>
                    <TableCell>{fmtDate(p.data_criacao)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" style={{ background: `${STATUS_PEDIDO_COLORS[p.status] || "#666"}20`, color: STATUS_PEDIDO_COLORS[p.status] || undefined }}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(Number(p.valor_total) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalFornecedorPage() {
  const [session, setSession] = useState<FornecedorSession | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const updateSession = (s: FornecedorSession | null) => {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
    setSession(s);
  };

  if (!session) {
    return <LoginScreen onLogin={updateSession} />;
  }

  if (session.mustChangePassword) {
    return (
      <ForcarTrocaSenhaScreen
        session={session}
        onDone={() => updateSession({ ...session, mustChangePassword: false })}
        onLogout={() => updateSession(null)}
      />
    );
  }

  return (
    <Dashboard
      session={session}
      onLogout={() => updateSession(null)}
    />
  );
}

function ForcarTrocaSenhaScreen({ session, onDone, onLogout }: { session: FornecedorSession; onDone: () => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <img src={logoLasant} alt="Lasant Construções" className="h-16 mx-auto mb-3 object-contain" />
          <CardTitle>Defina sua nova senha</CardTitle>
          <CardDescription>
            Por segurança, você precisa trocar a senha provisória antes de acessar o portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrocaSenhaForm session={session} onSuccess={onDone} />
          <Button variant="ghost" size="sm" className="w-full mt-3" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TrocaSenhaForm({ session, onSuccess }: { session: FornecedorSession; onSuccess: () => void }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (novaSenha !== confirmar) { setError("A confirmação não confere."); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("fornecedor-trocar-senha", {
        body: { fornecedorId: session.id, senhaAtual, novaSenha },
      });
      if (err || !data?.ok) { setError(data?.error || "Não foi possível trocar a senha."); return; }
      toast.success("Senha alterada com sucesso!");
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Senha atual</Label>
        <Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required autoFocus />
      </div>
      <div>
        <Label>Nova senha</Label>
        <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
        <p className="text-[11px] text-muted-foreground mt-1">
          Mín. 8 caracteres, com maiúscula, número e caractere especial.
        </p>
      </div>
      <div>
        <Label>Confirmar nova senha</Label>
        <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
      </div>
      {error && (
        <div className="bg-destructive/10 text-destructive p-2 rounded text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

function LoginScreen({ onLogin }: { onLogin: (s: FornecedorSession) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("fornecedor-login", {
        body: { email: email.trim().toLowerCase(), senha },
      });
      if (err || !data?.fornecedor) {
        setError(data?.error || "E-mail ou senha inválidos.");
        return;
      }
      onLogin(data.fornecedor);
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <img src={logoLasant} alt="Lasant Construções" className="h-16 mx-auto mb-3 object-contain" />
          <CardTitle>Portal de fornecedores Lasant Construções</CardTitle>
          <CardDescription>Acesse suas cotações e ordens de compra</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive p-2 rounded text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              A senha é fornecida pelo comprador. Em caso de dúvidas, contate-nos.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard({ session, onLogout }: { session: FornecedorSession; onLogout: () => void }) {
  const [convites, setConvites] = useState<ConviteRow[]>([]);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [pregoes, setPregoes] = useState<PregaoRow[]>([]);
  const [minhasParticipacoes, setMinhasParticipacoes] = useState<PregaoParticipacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [trocaOpen, setTrocaOpen] = useState(false);
  const [recusarConvite, setRecusarConvite] = useState<ConviteRow | null>(null);
  const [recusarStep, setRecusarStep] = useState<1 | 2>(1);
  const [recusando, setRecusando] = useState(false);
  const [pageCotacoes, setPageCotacoes] = useState(1);
  const [pagePedidos, setPagePedidos] = useState(1);
  const [pagePregoes, setPagePregoes] = useState(1);
  const [expandedPedidos, setExpandedPedidos] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 10;

  // Pregão dialogs
  const [termoPregao, setTermoPregao] = useState<PregaoRow | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [credenciando, setCredenciando] = useState(false);

  // Filtros globais (datas) + por aba (status)
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [statusCot, setStatusCot] = useState<string>("todos");
  const [statusPed, setStatusPed] = useState<string>("todos");
  const [statusPregao, setStatusPregao] = useState<string>("todos");
  const navigate = useNavigate();

  const inRange = (iso: string) => {
    if (!iso) return true;
    const d = new Date(iso);
    if (dataDe) {
      const de = new Date(dataDe + "T00:00:00");
      if (d < de) return false;
    }
    if (dataAte) {
      const ate = new Date(dataAte + "T23:59:59");
      if (d > ate) return false;
    }
    return true;
  };

  const convitesFiltrados = useMemo(() => {
    return convites.filter((c) => {
      if (!inRange(c.created_at)) return false;
      if (statusCot === "todos") return true;
      const expirado = new Date(c.expires_at) < new Date();
      const effectiveStatus = c.status === "pendente" && expirado ? "expirado" : c.status;
      return effectiveStatus === statusCot;
    });
  }, [convites, dataDe, dataAte, statusCot]);

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (!inRange(p.data_criacao)) return false;
      if (statusPed === "todos") return true;
      return p.status === statusPed;
    });
  }, [pedidos, dataDe, dataAte, statusPed]);

  const pregoesFiltrados = useMemo(() => {
    return pregoes.filter((pr) => {
      if (!inRange(pr.created_at)) return false;
      if (statusPregao === "todos") return true;
      return pr.status === statusPregao;
    });
  }, [pregoes, dataDe, dataAte, statusPregao]);

  const limparFiltros = () => {
    setDataDe(""); setDataAte(""); setStatusCot("todos"); setStatusPed("todos"); setStatusPregao("todos");
    setPageCotacoes(1); setPagePedidos(1); setPagePregoes(1);
  };

  useEffect(() => { setPageCotacoes(1); }, [dataDe, dataAte, statusCot]);
  useEffect(() => { setPagePedidos(1); }, [dataDe, dataAte, statusPed]);
  useEffect(() => { setPagePregoes(1); }, [dataDe, dataAte, statusPregao]);

  const togglePedido = (id: string) => setExpandedPedidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPedidoIds = pedidosFiltrados.map((p) => p.id);
  const allExpanded = allPedidoIds.length > 0 && allPedidoIds.every((id) => expandedPedidos.has(id));

  const handleRecusarConfirm = async () => {
    if (!recusarConvite) return;
    setRecusando(true);
    const { error } = await getFornecedorClient(session.id)
      .from("cotacao_convites")
      .update({ status: "recusado" })
      .eq("id", recusarConvite.id);
    setRecusando(false);

    if (error) {
      toast.error("Erro ao recusar cotação.");
      return;
    }
    setConvites((prev) => prev.map((x) => (x.id === recusarConvite.id ? { ...x, status: "recusado" } : x)));
    toast.success("Cotação recusada.");
    setRecusarConvite(null);
    setRecusarStep(1);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: p }, { data: pr }, { data: part }] = await Promise.all([
        getFornecedorClient(session.id)
          .from("cotacao_convites")
          .select("id,token,cotacao_numero,comprador,status,expires_at,created_at,itens")
          .eq("fornecedor_id", session.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("pedidos_compra")
          .select("id,numero,data_criacao,comprador,status,valor_total,itens,condicao_pagamento,prazo_entrega,local_entrega,observacoes")
          .eq("fornecedor_id", session.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("pregoes")
          .select("id,numero,objeto,modalidade,tipo_disputa,status,data_publicacao,data_abertura_credenciamento,data_inicio_disputa,data_encerramento_disputa,termo_participacao,termo_hash,tempo_disputa_min,decremento_minimo,decremento_tipo,created_at,pregoeiro_nome")
          .in("status", ["Publicado", "Credenciamento", "Propostas", "Disputa", "Habilitacao", "Adjudicado", "Homologado"])
          .order("created_at", { ascending: false }),
        supabase
          .from("pregao_participantes")
          .select("id,pregao_id,fornecedor_id,apelido,status,termo_aceito_em,motivo_status")
          .eq("fornecedor_id", session.id),
      ]);
      setConvites((c as any) || []);
      setPedidos((p as any) || []);
      setPregoes((pr as any) || []);
      setMinhasParticipacoes((part as any) || []);
      setLoading(false);
    })();
  }, [session.id]);

  const pendentes = useMemo(
    () => convites.filter((c) => c.status === "pendente" && new Date(c.expires_at) > new Date()),
    [convites]
  );

  const fmtDate = (s: string) => {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("pt-BR");
  };
  const fmtMoney = (v: number) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusCotacao = (c: ConviteRow) => {
    if (c.status === "respondido") return "Respondida";
    if (new Date(c.expires_at) < new Date()) return "Expirada";
    return "Pendente";
  };

  const parseItens = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const exportCotacoesPdf = async () => {
    const doc = new (await getJsPDF())({ compress: true });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 107);
    doc.rect(0, 0, pw, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Relatório de Cotações", 14, 11);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(session.nome, 14, 18);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 18, { align: "right" });
    doc.setTextColor(30, 30, 30);
    (await getAutoTable())(doc, {
      startY: 30,
      head: [["Cotação", "Comprador", "Recebida em", "Validade", "Status"]],
      body: convitesFiltrados.map((c) => [
        `COT-${String(c.cotacao_numero).padStart(4, "0")}`,
        c.comprador, fmtDate(c.created_at), fmtDate(c.expires_at), statusCotacao(c),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    // Detalhamento dos itens por cotação
    for (const c of convitesFiltrados) {
      const itens = parseItens(c.itens);
      if (itens.length === 0) return;
      doc.addPage();
      doc.setFillColor(30, 58, 107);
      doc.rect(0, 0, pw, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Itens — COT-${String(c.cotacao_numero).padStart(4, "0")}`, 14, 11);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Comprador: ${c.comprador}    |    Status: ${statusCotacao(c)}    |    Validade: ${fmtDate(c.expires_at)}`, 14, 24);
      (await getAutoTable())(doc, {
        startY: 30,
        head: [["#", "Descrição", "Qtd", "Unidade"]],
        body: itens.map((it: any, i: number) => [
          i + 1,
          it.descricao || "-",
          Number(it.quantidade || 0),
          it.unidadeMedida || it.unidade || "-",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 107], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { halign: "center", cellWidth: 20 }, 3: { halign: "center", cellWidth: 24 } },
      });
    }

    doc.save(`cotacoes_${session.nome.replace(/\s+/g, "_")}.pdf`);
  };

  const exportCotacoesExcel = async () => {
    const wb = (await getXLSX()).utils.book_new();
    const wsResumo = (await getXLSX()).utils.json_to_sheet(convitesFiltrados.map((c) => ({
      "Cotação": `COT-${String(c.cotacao_numero).padStart(4, "0")}`,
      "Comprador": c.comprador,
      "Recebida em": fmtDate(c.created_at),
      "Validade": fmtDate(c.expires_at),
      "Status": statusCotacao(c),
      "Qtd Itens": parseItens(c.itens).length,
    })));
    wsResumo["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Cotações");

    const linhas: any[] = [];
    convitesFiltrados.forEach((c) => {
      parseItens(c.itens).forEach((it: any, i: number) => {
        linhas.push({
          "Cotação": `COT-${String(c.cotacao_numero).padStart(4, "0")}`,
          "Comprador": c.comprador,
          "Status": statusCotacao(c),
          "#": i + 1,
          "Descrição": it.descricao || "",
          "Quantidade": Number(it.quantidade || 0),
          "Unidade": it.unidadeMedida || it.unidade || "",
        });
      });
    });
    if (linhas.length > 0) {
      const wsItens = (await getXLSX()).utils.json_to_sheet(linhas);
      wsItens["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 6 }, { wch: 40 }, { wch: 12 }, { wch: 12 }];
      (await getXLSX()).utils.book_append_sheet(wb, wsItens, "Itens");
    }
    (await getXLSX()).writeFile(wb, `cotacoes_${session.nome.replace(/\s+/g, "_")}.xlsx`, { compression: true });
  };

  const exportPedidosPdf = async () => {
    const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 107);
    doc.rect(0, 0, pw, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Relatório de Ordens de Compra", 14, 11);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(session.nome, 14, 18);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 18, { align: "right" });
    doc.setTextColor(30, 30, 30);
    (await getAutoTable())(doc, {
      startY: 30,
      head: [["Pedido", "Data", "Comprador", "Status", "Pagamento", "Prazo", "Local", "Valor Total"]],
      body: pedidosFiltrados.map((p) => [
        `OC-${String(p.numero).padStart(4, "0")}`,
        fmtDate(p.data_criacao), p.comprador, p.status,
        p.condicao_pagamento || "-", p.prazo_entrega || "-", p.local_entrega || "-",
        fmtMoney(p.valor_total),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 7: { halign: "right" } },
    });
    doc.save(`pedidos_${session.nome.replace(/\s+/g, "_")}.pdf`);
  };

  const exportPedidosExcel = async () => {
    const wb = (await getXLSX()).utils.book_new();
    const wsResumo = (await getXLSX()).utils.json_to_sheet(pedidosFiltrados.map((p) => ({
      "Pedido": `OC-${String(p.numero).padStart(4, "0")}`,
      "Data": fmtDate(p.data_criacao),
      "Comprador": p.comprador,
      "Status": p.status,
      "Pagamento": p.condicao_pagamento || "",
      "Prazo": p.prazo_entrega || "",
      "Local": p.local_entrega || "",
      "Valor Total": Number(p.valor_total || 0),
    })));
    wsResumo["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 25 }, { wch: 14 }];
    (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Pedidos");

    const itens: any[] = [];
    pedidosFiltrados.forEach((p) => {
      if (Array.isArray(p.itens)) {
        p.itens.forEach((it: any) => {
          itens.push({
            "Pedido": `OC-${String(p.numero).padStart(4, "0")}`,
            "Item": it.descricao,
            "Qtd": Number(it.quantidade || 0),
            "Unidade": it.unidadeMedida || it.unidade || "",
            "Preço Unit.": Number(it.precoUnitario || 0),
            "Total": Number(it.precoUnitario || 0) * Number(it.quantidade || 0),
          });
        });
      }
    });
    if (itens.length > 0) {
      const wsItens = (await getXLSX()).utils.json_to_sheet(itens);
      wsItens["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
      (await getXLSX()).utils.book_append_sheet(wb, wsItens, "Itens");
    }
    (await getXLSX()).writeFile(wb, `pedidos_${session.nome.replace(/\s+/g, "_")}.xlsx`, { compression: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoLasant} alt="Lasant Construções" className="h-10 object-contain" />
            <div>
              <h1 className="font-semibold text-base leading-tight">Portal de fornecedores Lasant Construções</h1>
              <p className="text-xs text-muted-foreground">{session.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTrocaOpen(true)}>
              <KeyRound className="h-4 w-4 mr-2" /> Trocar senha
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Cotações pendentes</p>
              <p className="text-3xl font-semibold text-primary">{pendentes.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total de cotações</p>
              <p className="text-3xl font-semibold">{convites.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Pedidos de compra</p>
              <p className="text-3xl font-semibold">{pedidos.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Pregões disponíveis</p>
              <p className="text-3xl font-semibold text-primary">{pregoes.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="cotacoes">
              <FileText className="h-4 w-4 mr-2" /> Cotações
            </TabsTrigger>
            <TabsTrigger value="pedidos">
              <ShoppingCart className="h-4 w-4 mr-2" /> Ordens de Compra
            </TabsTrigger>
            <TabsTrigger value="pregoes">
              <Gavel className="h-4 w-4 mr-2" /> Pregões Eletrônicos
            </TabsTrigger>
          </TabsList>

          {/* Filtros (aplicados a todas as abas) */}
          <Card className="mt-3">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Data de</Label>
                  <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="h-9 w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Data até</Label>
                  <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="h-9 w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status Cotação</Label>
                  <Select value={statusCot} onValueChange={setStatusCot}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="respondido">Respondida</SelectItem>
                      <SelectItem value="recusado">Recusada</SelectItem>
                      <SelectItem value="expirado">Expirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status Pedido</Label>
                  <Select value={statusPed} onValueChange={setStatusPed}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Emitido">Emitido</SelectItem>
                      <SelectItem value="Comprado">Comprado</SelectItem>
                      <SelectItem value="Em Entrega">Em Entrega</SelectItem>
                      <SelectItem value="Entregue Parcial">Entregue Parcial</SelectItem>
                      <SelectItem value="Entregue">Entregue</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status Pregão</Label>
                  <Select value={statusPregao} onValueChange={setStatusPregao}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Publicado">Publicado</SelectItem>
                      <SelectItem value="Credenciamento">Credenciamento</SelectItem>
                      <SelectItem value="Propostas">Propostas</SelectItem>
                      <SelectItem value="Disputa">Disputa</SelectItem>
                      <SelectItem value="Habilitacao">Habilitação</SelectItem>
                      <SelectItem value="Adjudicado">Adjudicado</SelectItem>
                      <SelectItem value="Homologado">Homologado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={limparFiltros} className="h-9">
                  <FilterX className="h-4 w-4 mr-1" /> Limpar
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">
                  {convitesFiltrados.length} cotação(ões) · {pedidosFiltrados.length} pedido(s) · {pregoesFiltrados.length} pregão(ões)
                </div>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="dashboard">
            <DashboardFornecedor pedidos={pedidosFiltrados} convites={convitesFiltrados} loading={loading} />
          </TabsContent>


          <TabsContent value="cotacoes">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Cotações recebidas</CardTitle>
                  <CardDescription>Clique em "Responder" para enviar sua proposta.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportCotacoesExcel} disabled={convitesFiltrados.length === 0}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCotacoesPdf} disabled={convitesFiltrados.length === 0}>
                    <FileDown className="h-4 w-4 mr-1" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : convitesFiltrados.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma cotação encontrada.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cotação</TableHead>
                          <TableHead>Comprador</TableHead>
                          <TableHead>Recebida em</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(convitesFiltrados, pageCotacoes, PAGE_SIZE).paginated.map((c) => {
                          const expirado = new Date(c.expires_at) < new Date();
                          const podeResponder = c.status === "pendente" && !expirado;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">
                                COT-{String(c.cotacao_numero).padStart(4, "0")}
                              </TableCell>
                              <TableCell>{c.comprador}</TableCell>
                              <TableCell>{fmtDate(c.created_at)}</TableCell>
                              <TableCell>{fmtDate(c.expires_at)}</TableCell>
                              <TableCell>
                                {c.status === "respondido" ? (
                                  <Badge variant="secondary">Respondida</Badge>
                                ) : c.status === "recusado" ? (
                                  <Badge variant="destructive">Recusada</Badge>
                                ) : expirado ? (
                                  <Badge variant="outline">Expirada</Badge>
                                ) : (
                                  <Badge>Pendente</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {podeResponder ? (
                                  <div className="flex justify-end gap-2">
                                    <Link to={`/cotacao/proposta/${c.token}`}>
                                      <Button size="sm">Responder</Button>
                                    </Link>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => { setRecusarStep(1); setRecusarConvite(c); }}
                                    >
                                      Recusar
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" disabled>—</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {convitesFiltrados.length > 0 && (
                  <PaginationControls
                    currentPage={pageCotacoes}
                    totalItems={convitesFiltrados.length}
                    onPageChange={setPageCotacoes}
                    pageSize={PAGE_SIZE}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pedidos">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle className="text-base">Ordens de Compra emitidos</CardTitle>
                <div className="flex gap-2">
                  {pedidosFiltrados.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedPedidos(allExpanded ? new Set() : new Set(allPedidoIds))}
                    >
                      {allExpanded ? "Recolher todos" : "Expandir todos"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={exportPedidosExcel} disabled={pedidosFiltrados.length === 0}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPedidosPdf} disabled={pedidosFiltrados.length === 0}>
                    <FileDown className="h-4 w-4 mr-1" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : pedidosFiltrados.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
                ) : (
                  <div className="space-y-4">
                    {paginate(pedidosFiltrados, pagePedidos, PAGE_SIZE).paginated.map((p) => {
                      const isOpen = expandedPedidos.has(p.id);
                      return (
                      <div key={p.id} className="border rounded-lg p-4">
                        <button
                          type="button"
                          onClick={() => togglePedido(p.id)}
                          className="w-full flex flex-wrap items-center justify-between gap-2 text-left hover:opacity-80 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <div>
                              <p className="font-semibold">OC-{String(p.numero).padStart(4, "0")}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(p.data_criacao)} • {p.comprador}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{p.status}</Badge>
                            <span className="font-semibold text-primary">{fmtMoney(p.valor_total)}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="mt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                              <div><strong>Pagamento:</strong> {p.condicao_pagamento || "-"}</div>
                              <div><strong>Prazo:</strong> {p.prazo_entrega || "-"}</div>
                              <div><strong>Local:</strong> {p.local_entrega || "-"}</div>
                            </div>
                            {Array.isArray(p.itens) && p.itens.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Item</TableHead>
                                      <TableHead className="w-20 text-center">Qtd</TableHead>
                                      <TableHead className="w-16 text-center">Un</TableHead>
                                      <TableHead className="w-32 text-right">Preço</TableHead>
                                      <TableHead className="w-32 text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {p.itens.map((it: any, i: number) => (
                                      <TableRow key={i}>
                                        <TableCell className="text-sm">{it.descricao}</TableCell>
                                        <TableCell className="text-center">{it.quantidade}</TableCell>
                                        <TableCell className="text-center">{it.unidadeMedida || it.unidade}</TableCell>
                                        <TableCell className="text-right">{fmtMoney(Number(it.precoUnitario || 0))}</TableCell>
                                        <TableCell className="text-right">{fmtMoney(Number(it.precoUnitario || 0) * Number(it.quantidade || 0))}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                            {p.observacoes && (
                              <p className="text-xs text-muted-foreground mt-2"><strong>Obs:</strong> {p.observacoes}</p>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                {pedidosFiltrados.length > 0 && (
                  <PaginationControls
                    currentPage={pagePedidos}
                    totalItems={pedidosFiltrados.length}
                    onPageChange={setPagePedidos}
                    pageSize={PAGE_SIZE}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pregoes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pregões Eletrônicos</CardTitle>
                <CardDescription>Participe de pregões eletrônicos abertos.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : pregoesFiltrados.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum pregão encontrado.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Objeto</TableHead>
                          <TableHead>Modalidade</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Publicado em</TableHead>
                          <TableHead>Sua situação</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(pregoesFiltrados, pagePregoes, PAGE_SIZE).paginated.map((pr) => {
                          const participacao = minhasParticipacoes.find(p => p.pregao_id === pr.id);
                          const isCredenciado = participacao?.status === "Credenciado";
                          const isVencedor = participacao?.status === "Vencedor";
                          const isInabilitado = participacao?.status === "Inabilitado";
                          const isDesclassificado = participacao?.status === "Desclassificado";
                          const fmtNumeroAno = (numero: number, createdAt: string) => {
                            const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
                            return `${String(numero).padStart(2, "0")}-${year}`;
                          };
                          const numeroFmt = fmtNumeroAno(pr.numero, pr.created_at);
                          return (
                            <TableRow key={pr.id}>
                              <TableCell className="font-medium">{numeroFmt}</TableCell>
                              <TableCell className="max-w-xs truncate">{pr.objeto}</TableCell>
                              <TableCell>{pr.modalidade}</TableCell>
                              <TableCell>{pr.tipo_disputa}</TableCell>
                              <TableCell>
                                <Badge variant={pr.status === "Disputa" ? "default" : "secondary"}>{pr.status}</Badge>
                              </TableCell>
                              <TableCell>{fmtDate(pr.data_publicacao)}</TableCell>
                              <TableCell>
                                {participacao ? (
                                  <Badge variant={isCredenciado ? "default" : isVencedor ? "default" : "destructive"}>
                                    {participacao.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Não credenciado</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {participacao && (isCredenciado || isVencedor) ? (
                                  <Button size="sm" onClick={() => navigate(`/portal-fornecedor/pregao/${pr.id}/sala`)}>
                                    <ExternalLink className="h-3 w-3 mr-1" /> Acessar sala
                                  </Button>
                                ) : !participacao && (pr.status === "Publicado" || pr.status === "Credenciamento") ? (
                                  <Button size="sm" onClick={() => { setTermoPregao(pr); setTermoAceito(false); }}>
                                    <Gavel className="h-3 w-3 mr-1" /> Credenciar-se
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" disabled>—</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {pregoesFiltrados.length > 0 && (
                  <PaginationControls
                    currentPage={pagePregoes}
                    totalItems={pregoesFiltrados.length}
                    onPageChange={setPagePregoes}
                    pageSize={PAGE_SIZE}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={!!recusarConvite}
        onOpenChange={(v) => { if (!v) { setRecusarConvite(null); setRecusarStep(1); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar apresentação de proposta</AlertDialogTitle>
            <AlertDialogDescription>
              {recusarStep === 1
                ? `Deseja realmente recusar a cotação COT-${String(recusarConvite?.cotacao_numero || 0).padStart(4, "0")}? Você não poderá enviar proposta depois.`
                : "Esta ação é definitiva. O comprador será notificado da recusa. Confirma?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setRecusarConvite(null); setRecusarStep(1); }}>
              Cancelar
            </Button>
            {recusarStep === 1 ? (
              <Button variant="destructive" onClick={() => setRecusarStep(2)}>
                Sim, recusar
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleRecusarConfirm} disabled={recusando}>
                {recusando ? "Recusando..." : "Confirmo a recusa"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Termo de Participação */}
      <Dialog open={!!termoPregao} onOpenChange={(v) => { if (!v) { setTermoPregao(null); setTermoAceito(false); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Termo de Participação — Pregão {termoPregao ? `${String(termoPregao.numero).padStart(2, "0")}-${new Date(termoPregao.created_at).getFullYear()}` : ""}</DialogTitle>
            <DialogDescription>
              Leia atentamente o termo abaixo. Ao aceitar, você concorda em participar deste pregão eletrônico.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 border rounded-lg p-4 my-2">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {termoPregao?.termo_participacao || "Termo de participação não informado."}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-2 py-2">
            <Checkbox id="aceite" checked={termoAceito} onCheckedChange={(v) => setTermoAceito(v === true)} />
            <Label htmlFor="aceite" className="text-sm cursor-pointer">
              Li e aceito o termo de participação
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTermoPregao(null); setTermoAceito(false); }}>
              Cancelar
            </Button>
            <Button
              disabled={!termoAceito || credenciando}
              onClick={async () => {
                if (!termoPregao || !session) return;
                setCredenciando(true);
                const ip = ""; // IP não disponível no client, pode ser preenchido pelo backend
                const hash = termoPregao.termo_hash || "";
                const { data: existing } = await supabase
                  .from("pregao_participantes")
                  .select("id")
                  .eq("pregao_id", termoPregao.id)
                  .eq("fornecedor_id", session.id)
                  .maybeSingle();
                if (existing) {
                  toast.error("Você já está credenciado neste pregão.");
                  setCredenciando(false);
                  setTermoPregao(null);
                  return;
                }
                const { data: seqData } = await supabase
                  .from("pregao_participantes")
                  .select("id")
                  .eq("pregao_id", termoPregao.id);
                const seq = (seqData?.length || 0) + 1;
                const apelido = `Licitante ${String(seq).padStart(2, "0")}`;
                const { error } = await supabase.from("pregao_participantes").insert({
                  pregao_id: termoPregao.id,
                  fornecedor_id: session.id,
                  fornecedor_nome: session.nome,
                  fornecedor_cnpj: session.cnpj || "",
                  apelido,
                  apelido_seq: seq,
                  termo_aceito_em: new Date().toISOString(),
                  termo_aceito_ip: ip,
                  termo_hash: hash,
                  status: "Credenciado",
                });
                setCredenciando(false);
                if (error) {
                  toast.error("Erro ao se credenciar.");
                  return;
                }
                toast.success("Credenciamento realizado! Agora você pode acessar a sala de disputa.");
                setTermoPregao(null);
                setTermoAceito(false);
                // Recarrega participações
                const { data: part } = await supabase
                  .from("pregao_participantes")
                  .select("id,pregao_id,fornecedor_id,apelido,status,termo_aceito_em,motivo_status")
                  .eq("fornecedor_id", session.id);
                setMinhasParticipacoes((part as any) || []);
              }}
            >
              {credenciando ? "Credenciando..." : "Confirmar credenciamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trocaOpen} onOpenChange={setTrocaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para acessar o portal.</DialogDescription>
          </DialogHeader>
          <TrocaSenhaForm session={session} onSuccess={() => setTrocaOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
