import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Loader2, Stethoscope, Upload, Eye, Ban, Link2, FileSpreadsheet, ArrowUpDown, Webhook, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFinanceiro, formatBRL as fmtBRL } from "@/contexts/FinanceiroContext";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

interface Nfe {
  id: string;
  chave: string;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  data_recebimento: string | null;
  ambiente: string | null;
  status: string | null;
  xml_url: string | null;
  conta_pagar_id?: string | null;
  motivo_rejeicao?: string | null;
  rejeitada_em?: string | null;
}

interface Nfse {
  id: string;
  chave: string;
  numero: string | null;
  codigo_verificacao: string | null;
  prestador_cnpj: string | null;
  prestador_nome: string | null;
  valor_total: number | null;
  valor_servicos: number | null;
  data_emissao: string | null;
  ambiente: string | null;
  status: string | null;
  origem: string | null;
  xml_url: string | null;
  discriminacao: string | null;
  conta_pagar_id?: string | null;
  motivo_rejeicao?: string | null;
  rejeitada_em?: string | null;
}

const formatDateTime = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const formatBRL = (v: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCnpj = (c: string | null) => {
  const d = (c || "").replace(/\D+/g, "");
  if (d.length !== 14) return c || "—";
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};
// Nº/Série: usa os campos gravados e, quando ausentes, extrai da chave de acesso (44 dígitos)
const numeroSerie = (n: { numero: string | null; serie: string | null; chave?: string | null }) => {
  const ch = (n.chave || "").replace(/\D+/g, "");
  let numero = (n.numero || "").replace(/^0+/, "");
  let serie = (n.serie || "").replace(/^0+/, "");
  if (ch.length === 44) {
    if (!numero) numero = ch.slice(25, 34).replace(/^0+/, "");
    if (!serie) serie = ch.slice(22, 25).replace(/^0+/, "");
  }
  if (!serie && ch.length === 44) serie = "0";
  if (!numero && !serie) return "—";
  return `${numero || "—"}${serie ? ` / ${serie}` : ""}`;
};

const exportarExcel = async (tipo: "nfe" | "nfse", rows: Nfe[] | Nfse[]) => {
  const wb = (await getXLSX()).utils.book_new();
  const fmtDate = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("pt-BR");
  };
  if (tipo === "nfe") {
    const dados = (rows as Nfe[]).map(n => ({
      Emissão: fmtDate(n.data_emissao),
      "Nº/Série": numeroSerie(n),
      Emitente: n.emitente_nome || "—",
      CNPJ: formatCnpj(n.emitente_cnpj),
      "Valor Total": Number(n.valor_total) || 0,
      Status: n.status || "—",
      Vinculada: n.conta_pagar_id ? "Sim" : "Não",
      Rejeitada: n.status === "rejeitada" ? "Sim" : "Não",
      "Motivo Rejeição": n.motivo_rejeicao || "",
      Chave: n.chave,
    }));
    const ws = (await getXLSX()).utils.json_to_sheet(dados);
    ws["!cols"] = [
      { wch: 14 }, { wch: 16 }, { wch: 35 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 50 },
    ];
    (await getXLSX()).utils.book_append_sheet(wb, ws, "NFe");
  } else {
    const dados = (rows as Nfse[]).map(n => ({
      Emissão: fmtDate(n.data_emissao),
      Nº: n.numero || "—",
      "Código Verificação": n.codigo_verificacao || "—",
      Prestador: n.prestador_nome || "—",
      CNPJ: formatCnpj(n.prestador_cnpj),
      Discriminação: n.discriminacao || "—",
      "Valor Serviços": Number(n.valor_servicos) || 0,
      "Valor Total": Number(n.valor_total) || 0,
      Origem: n.origem || "—",
      Status: n.status || "—",
      Vinculada: n.conta_pagar_id ? "Sim" : "Não",
      Rejeitada: n.status === "rejeitada" ? "Sim" : "Não",
      "Motivo Rejeição": n.motivo_rejeicao || "",
      Chave: n.chave,
    }));
    const ws = (await getXLSX()).utils.json_to_sheet(dados);
    ws["!cols"] = [
      { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 35 }, { wch: 20 },
      { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 50 },
    ];
    (await getXLSX()).utils.book_append_sheet(wb, ws, "NFSe");
  }
  (await getXLSX()).writeFile(wb, `${tipo === "nfe" ? "nfes-recebidas" : "nfses-tomadas"}_${new Date().toISOString().slice(0,10)}.xlsx`, { compression: true });
  toast.success("Excel gerado com sucesso.");
};

export default function NfesRecebidas() {
  const { empresa } = useEmpresa();
  const { contasPagar, addContaPagar } = useFinanceiro();
  const [tab, setTab] = useState<"nfe" | "nfse">("nfe");

  // NFe
  const [rows, setRows] = useState<Nfe[]>([]);
  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);

  // NFS-e
  const [nfses, setNfses] = useState<Nfse[]>([]);
  const [loadingNfse, setLoadingNfse] = useState(false);
  const [importandoNfse, setImportandoNfse] = useState(false);

  // Visualizar / Rejeitar / Vincular
  const [docSel, setDocSel] = useState<any>(null);
  const [docTipo, setDocTipo] = useState<"nfe" | "nfse">("nfe");
  const [verOpen, setVerOpen] = useState(false);
  const [xmlTexto, setXmlTexto] = useState("");
  const [xmlLoading, setXmlLoading] = useState(false);
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [vincularOpen, setVincularOpen] = useState(false);
  const [contaSel, setContaSel] = useState("");
  const [contaPickerOpen, setContaPickerOpen] = useState(false);
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");


  // Filtros compartilhados
  const [busca, setBusca] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [diagBnOpen, setDiagBnOpen] = useState(false);
  const [diagBnLoading, setDiagBnLoading] = useState(false);
  const [diagBnData, setDiagBnData] = useState<any>(null);



  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const diagnosticarBrasilNfe = async () => {
    setDiagBnOpen(true); setDiagBnLoading(true); setDiagBnData(null);
    try {
      const { data, error } = await supabase.functions.invoke("brasilnfe-diagnostico", {
        body: {
          tipoDocumentoFiscal: 0,
          dtInicio: dataIni ? `${dataIni}T00:00:00-03:00` : undefined,
          dtFim: dataFim ? `${dataFim}T23:59:59-03:00` : undefined,
        },
      });
      if (error) throw error;
      setDiagBnData(data);
    } catch (e: any) {
      setDiagBnData({ ok: false, error: e.message });
    } finally {
      setDiagBnLoading(false);
    }
  };


  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("nfes_recebidas").select("*").order("data_emissao", { ascending: false });
    if (error) toast.error("Erro ao carregar NFes"); else setRows((data as Nfe[]) || []);
    setLoading(false);
  };

  const loadNfse = async () => {
    setLoadingNfse(true);
    const { data, error } = await (supabase as any).from("nfses_tomadas").select("*").order("data_emissao", { ascending: false });
    if (error) toast.error("Erro ao carregar NFS-e"); else setNfses((data as Nfse[]) || []);
    setLoadingNfse(false);
  };

  useEffect(() => { load(); loadNfse(); }, []);

  // Importação única via Brasil NFe (NFe e NFS-e vêm na mesma consulta)
  const importarBrasilNfe = async (setBusy: (b: boolean) => void) => {
    if (!empresa.id) return toast.error("Empresa não cadastrada");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("importar-nfes-brasilnfe", {
        body: { empresaId: empresa.id, dataInicial: dataIni || undefined, dataFinal: dataFim || undefined },
      });
      if (error) throw error;
      const r: any = data;
      if (!r?.ok) throw new Error(r?.error || "Falha na importação");
      toast.success(`Importação concluída: ${r.total} documento(s) — ${r.inseridas} novos, ${r.atualizadas} atualizados`);
      await load(); await loadNfse();
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar notas fiscais");
    } finally {
      setBusy(false);
    }
  };

  const importar = () => importarBrasilNfe(setImportando);
  const importarNfse = () => importarBrasilNfe(setImportandoNfse);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!empresa.id) return toast.error("Empresa não cadastrada");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const { data, error } = await supabase.functions.invoke("importar-xml-manual", {
          body: { empresaId: empresa.id, xmlBase64: b64 },
        });
        if (error) throw error;
        const r: any = data;
        if (!r?.ok) throw new Error(r?.error || "Falha");
        ok++;
      } catch (err: any) {
        fail++;
        toast.error(`${f.name}: ${err.message}`);
      }
    }
    if (ok) toast.success(`${ok} XML(s) importado(s) com sucesso`);
    if (fail) toast.error(`${fail} XML(s) falharam`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load(); await loadNfse();
  };

  const obterUrlXml = async (n: any, t: "nfe" | "nfse") => {
    const { data, error } = await supabase.functions.invoke("nfe-xml-url", {
      body: { path: n.xml_url || undefined, chave: n.chave, tabela: t },
    });
    if (error) throw error;
    const r: any = data;
    if (!r?.ok) throw new Error(r?.error || "Falha ao obter XML");
    return r.url as string;
  };

  const baixarXml = async (n: Nfe | Nfse, t: "nfe" | "nfse" = "nfe") => {
    try {
      const url = await obterUrlXml(n, t);
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${n.chave}.xml`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.error(e.message || "Erro ao baixar XML");
    }
  };

  const tabela = (t: "nfe" | "nfse") => (t === "nfe" ? "nfes_recebidas" : "nfses_tomadas");
  const recarregar = async () => { await load(); await loadNfse(); };

  const abrirVisualizacao = async (n: any, t: "nfe" | "nfse") => {
    setDocSel(n); setDocTipo(t); setVerOpen(true); setXmlTexto("");
    setXmlLoading(true);
    try {
      const url = await obterUrlXml(n, t);
      const resp = await fetch(url);
      setXmlTexto(await resp.text());
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar XML");
    } finally {
      setXmlLoading(false);
    }
  };


  const abrirRejeicao = (n: any, t: "nfe" | "nfse") => {
    setDocSel(n); setDocTipo(t); setMotivo(n.motivo_rejeicao || ""); setRejeitarOpen(true);
  };

  const confirmarRejeicao = async () => {
    if (!motivo.trim()) return toast.error("Informe o motivo da rejeição");
    setSalvando(true);
    const { error } = await (supabase as any).from(tabela(docTipo)).update({
      status: "rejeitada", motivo_rejeicao: motivo.trim(), rejeitada_em: new Date().toISOString(),
    }).eq("id", docSel.id);
    setSalvando(false);
    if (error) return toast.error("Erro ao rejeitar nota fiscal");
    toast.success("Nota fiscal rejeitada");
    setRejeitarOpen(false); setMotivo(""); await recarregar();
  };

  const reverterRejeicao = async (n: any, t: "nfe" | "nfse") => {
    const { error } = await (supabase as any).from(tabela(t)).update({
      status: "importada", motivo_rejeicao: null, rejeitada_em: null,
    }).eq("id", n.id);
    if (error) return toast.error("Erro ao reverter rejeição");
    toast.success("Rejeição revertida");
    await recarregar();
  };

  const abrirVinculo = (n: any, t: "nfe" | "nfse") => {
    setDocSel(n); setDocTipo(t); setContaSel(n.conta_pagar_id || "");
    setVencimento(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setVincularOpen(true);
  };

  const salvarVinculo = async () => {
    if (!contaSel) return toast.error("Selecione um título ou crie um novo");
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from(tabela(docTipo))
        .update({ conta_pagar_id: contaSel }).eq("id", docSel.id);
      if (error) throw error;
      toast.success("Nota fiscal vinculada ao contas a pagar");
      setVincularOpen(false); await recarregar();
    } catch (e: any) {
      toast.error(e.message || "Erro ao vincular");
    } finally { setSalvando(false); }
  };

  const criarEVincular = async () => {
    if (!vencimento) return toast.error("Informe o vencimento");
    setSalvando(true);
    try {
      const fornecedor = docTipo === "nfe" ? docSel.emitente_nome : docSel.prestador_nome;
      const criada = await addContaPagar({
        descricao: `NF ${docSel.numero || docSel.chave} — ${fornecedor || "Fornecedor"}`,
        fornecedor_nome: fornecedor || "",
        valor_total: Number(docSel.valor_total) || 0,
        valor_pago: 0,
        data_emissao: docSel.data_emissao ? String(docSel.data_emissao).slice(0, 10) : null,
        data_vencimento: vencimento,
        status: "aberta",
        parcela_num: 1,
        parcela_total: 1,
        origem: docTipo === "nfe" ? "nfe" : "nfse",
      } as any);
      if (!criada?.id) throw new Error("Falha ao criar título");
      const { error } = await (supabase as any).from(tabela(docTipo))
        .update({ conta_pagar_id: criada.id }).eq("id", docSel.id);
      if (error) throw error;
      toast.success("Título criado e vinculado");
      setVincularOpen(false); await recarregar();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar título");
    } finally { setSalvando(false); }
  };

  const desvincular = async (n: any, t: "nfe" | "nfse") => {
    const { error } = await (supabase as any).from(tabela(t)).update({ conta_pagar_id: null }).eq("id", n.id);
    if (error) return toast.error("Erro ao desvincular");
    toast.success("Vínculo removido");
    await recarregar();
  };



  const filtradosBase = useMemo(() => rows.filter(r => {
    if (busca) {
      const q = busca.toLowerCase();
      const hay = `${r.chave} ${r.numero ?? ""} ${r.emitente_nome ?? ""} ${r.emitente_cnpj ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (dataIni && r.data_emissao && r.data_emissao.slice(0, 10) < dataIni) return false;
    if (dataFim && r.data_emissao && r.data_emissao.slice(0, 10) > dataFim) return false;
    return true;
  }), [rows, busca, dataIni, dataFim]);

  const filtradosNfseBase = useMemo(() => nfses.filter(r => {
    if (busca) {
      const q = busca.toLowerCase();
      const hay = `${r.chave} ${r.numero ?? ""} ${r.prestador_nome ?? ""} ${r.prestador_cnpj ?? ""} ${r.discriminacao ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (dataIni && r.data_emissao && r.data_emissao.slice(0, 10) < dataIni) return false;
    if (dataFim && r.data_emissao && r.data_emissao.slice(0, 10) > dataFim) return false;
    return true;
  }), [nfses, busca, dataIni, dataFim]);

  // ---- Ordenação por coluna ----
  const [ordem, setOrdem] = useState<{ campo: string; dir: "asc" | "desc" }>({ campo: "data_emissao", dir: "desc" });
  const [ordemNfse, setOrdemNfse] = useState<{ campo: string; dir: "asc" | "desc" }>({ campo: "data_emissao", dir: "desc" });

  const toggleOrdem = (campo: string, nfse = false) => {
    const set = nfse ? setOrdemNfse : setOrdem;
    const atual = nfse ? ordemNfse : ordem;
    set(atual.campo === campo ? { campo, dir: atual.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" });
    setPage(1);
  };

  const valorOrdem = (r: any, campo: string, nfse: boolean) => {
    switch (campo) {
      case "data_emissao": return r.data_emissao || "";
      case "numero": return Number(numeroSerie(r).split("/")[0]) || 0;
      case "nome": return String((nfse ? r.prestador_nome : r.emitente_nome) || "").toLowerCase();
      case "cnpj": return String((nfse ? r.prestador_cnpj : r.emitente_cnpj) || "");
      case "discriminacao": return String(r.discriminacao || "").toLowerCase();
      case "valor_total": return Number(r.valor_total) || 0;
      case "status": return String(r.status || "").toLowerCase();
      case "origem": return String(r.origem || "").toLowerCase();
      default: return "";
    }
  };

  const ordenar = (list: any[], o: { campo: string; dir: "asc" | "desc" }, nfse: boolean) =>
    [...list].sort((a, b) => {
      const va = valorOrdem(a, o.campo, nfse);
      const vb = valorOrdem(b, o.campo, nfse);
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR");
      return o.dir === "asc" ? cmp : -cmp;
    });

  const filtrados = useMemo(() => ordenar(filtradosBase, ordem, false), [filtradosBase, ordem]);
  const filtradosNfse = useMemo(() => ordenar(filtradosNfseBase, ordemNfse, true), [filtradosNfseBase, ordemNfse]);

  const SortHead = ({ campo, nfse, className, children }: { campo: string; nfse?: boolean; className?: string; children: React.ReactNode }) => {
    const o = nfse ? ordemNfse : ordem;
    const ativo = o.campo === campo;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleOrdem(campo, nfse)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${ativo ? "text-foreground font-semibold" : ""}`}
        >
          {children}
          <ArrowUpDown className={`h-3 w-3 ${ativo ? "opacity-100" : "opacity-40"}`} />
        </button>
      </TableHead>
    );
  };

  useEffect(() => { setPage(1); }, [busca, dataIni, dataFim, pageSize, tab]);

  const { paginated } = paginate(filtrados, page, pageSize);
  const { paginated: paginatedNfse } = paginate(filtradosNfse, page, pageSize);
  const totalValor = useMemo(() => filtrados.reduce((s, r) => s + (Number(r.valor_total) || 0), 0), [filtrados]);
  const totalValorNfse = useMemo(() => filtradosNfse.reduce((s, r) => s + (Number(r.valor_total) || 0), 0), [filtradosNfse]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-serif font-semibold">Notas Fiscais Recebidas</h1>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !empresa.id}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar XML manual
          </Button>
          <Button variant="outline" onClick={diagnosticarBrasilNfe}>
            <Stethoscope className="h-4 w-4 mr-2" /> Diagnóstico Brasil NFe
          </Button>
          <Button variant="outline" onClick={() => setWebhookOpen(true)}>
            <Webhook className="h-4 w-4 mr-2" /> Webhook
          </Button>
          {tab === "nfe" ? (
            <Button onClick={importar} disabled={importando || !empresa.id}>
              {importando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Importar NFes (Brasil NFe)
            </Button>
          ) : (
            <Button onClick={importarNfse} disabled={importandoNfse || !empresa.id}>
              {importandoNfse ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Importar NFS-e (Brasil NFe)
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "nfe" | "nfse")}>
        <TabsList>
          <TabsTrigger value="nfe">NFe — Produtos ({filtrados.length})</TabsTrigger>
          <TabsTrigger value="nfse">NFS-e — Serviços ({filtradosNfse.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="nfe" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                {filtrados.length} nota(s) — Total: {formatBRL(totalValor)}
                {empresa.nfeAmbiente && (<Badge variant="outline" className="ml-2">{empresa.nfeAmbiente}</Badge>)}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Buscar (chave, nº, emitente)" value={busca} onChange={e => setBusca(e.target.value)} className="w-72" />
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="w-40" />
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
                <Button variant="outline" size="sm" onClick={() => exportarExcel("nfe", filtrados)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead campo="data_emissao">Emissão</SortHead>
                    <SortHead campo="numero">Nº/Série</SortHead>
                    <SortHead campo="nome">Emitente</SortHead>
                    <SortHead campo="cnpj">CNPJ</SortHead>
                    <SortHead campo="valor_total" className="text-right">Valor</SortHead>
                    <SortHead campo="status">Status</SortHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                  ) : paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma NFe encontrada. Clique em <b>Importar NFes</b> ou faça upload de XML.
                    </TableCell></TableRow>
                  ) : paginated.map(n => (
                    <TableRow key={n.id}>
                      <TableCell>{formatDateTime(n.data_emissao)}</TableCell>
                      <TableCell className="tabular-nums" title={n.chave}>{numeroSerie(n)}</TableCell>
                      <TableCell className="max-w-xs truncate" title={n.emitente_nome || ""}>{n.emitente_nome || "—"}</TableCell>
                      <TableCell>{formatCnpj(n.emitente_cnpj)}</TableCell>

                      <TableCell className="text-right">{formatBRL(n.valor_total)}</TableCell>
                      <TableCell>
                        {n.status === "rejeitada"
                          ? <Badge variant="destructive" title={n.motivo_rejeicao || ""}>rejeitada</Badge>
                          : n.status ? <Badge variant="secondary">{n.status}</Badge> : "—"}
                        {n.conta_pagar_id && <Badge variant="outline" className="ml-1">vinculada</Badge>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => abrirVisualizacao(n, "nfe")} title="Visualizar nota">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => baixarXml(n, "nfe")} title="Baixar XML">

                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => n.conta_pagar_id ? desvincular(n, "nfe") : abrirVinculo(n, "nfe")} title={n.conta_pagar_id ? "Desvincular do contas a pagar" : "Vincular a contas a pagar"}>
                          <Link2 className={`h-4 w-4 ${n.conta_pagar_id ? "text-primary" : ""}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => n.status === "rejeitada" ? reverterRejeicao(n, "nfe") : abrirRejeicao(n, "nfe")} title={n.status === "rejeitada" ? "Reverter rejeição" : "Rejeitar nota"}>
                          <Ban className={`h-4 w-4 ${n.status === "rejeitada" ? "text-destructive" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls currentPage={page} pageSize={pageSize} totalItems={filtrados.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nfse" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                {filtradosNfse.length} NFS-e — Total: {formatBRL(totalValorNfse)}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Buscar (nº, prestador, serviço)" value={busca} onChange={e => setBusca(e.target.value)} className="w-72" />
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="w-40" />
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
                <Button variant="outline" size="sm" onClick={() => exportarExcel("nfse", filtradosNfse)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead nfse campo="data_emissao">Emissão</SortHead>
                    <SortHead nfse campo="numero">Nº</SortHead>
                    <SortHead nfse campo="nome">Prestador</SortHead>
                    <SortHead nfse campo="cnpj">CNPJ</SortHead>
                    <SortHead nfse campo="discriminacao">Discriminação</SortHead>
                    <SortHead nfse campo="valor_total" className="text-right">Valor</SortHead>
                    <SortHead nfse campo="origem">Origem</SortHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingNfse ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                  ) : paginatedNfse.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma NFS-e encontrada. Clique em <b>Importar NFS-e</b> (padrão nacional) ou faça upload do XML da prefeitura.
                    </TableCell></TableRow>
                  ) : paginatedNfse.map(n => (
                    <TableRow key={n.id}>
                      <TableCell>{formatDateTime(n.data_emissao)}</TableCell>
                      <TableCell>{n.numero || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={n.prestador_nome || ""}>{n.prestador_nome || "—"}</TableCell>
                      <TableCell>{formatCnpj(n.prestador_cnpj)}</TableCell>
                      <TableCell className="max-w-xs truncate" title={n.discriminacao || ""}>{n.discriminacao || "—"}</TableCell>
                      <TableCell className="text-right">{formatBRL(n.valor_total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{n.origem || "—"}</Badge>
                        {n.status === "rejeitada" && <Badge variant="destructive" className="ml-1" title={n.motivo_rejeicao || ""}>rejeitada</Badge>}
                        {n.conta_pagar_id && <Badge variant="outline" className="ml-1">vinculada</Badge>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => abrirVisualizacao(n, "nfse")} title="Visualizar nota">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => baixarXml(n, "nfse")} title="Baixar XML">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => n.conta_pagar_id ? desvincular(n, "nfse") : abrirVinculo(n, "nfse")} title={n.conta_pagar_id ? "Desvincular do contas a pagar" : "Vincular a contas a pagar"}>
                          <Link2 className={`h-4 w-4 ${n.conta_pagar_id ? "text-primary" : ""}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => n.status === "rejeitada" ? reverterRejeicao(n, "nfse") : abrirRejeicao(n, "nfse")} title={n.status === "rejeitada" ? "Reverter rejeição" : "Rejeitar nota"}>
                          <Ban className={`h-4 w-4 ${n.status === "rejeitada" ? "text-destructive" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls currentPage={page} pageSize={pageSize} totalItems={filtradosNfse.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={diagBnOpen} onOpenChange={setDiagBnOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Diagnóstico Brasil NFe</DialogTitle></DialogHeader>
          {diagBnLoading ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Consultando Brasil NFe…</div>
          ) : diagBnData ? (
            <div className="space-y-2 text-sm">
              <div><b>HTTP Status:</b> {diagBnData.httpStatus ?? "—"} {diagBnData.ok ? "✅" : "❌"}</div>
              <div className="break-all"><b>Endpoint:</b> <code className="text-xs">{diagBnData.url}</code></div>
              <div><b>Período consultado:</b> <code className="text-xs">{diagBnData.request?.DtInicio} → {diagBnData.request?.DtFim}</code></div>
              <div><b>Total de documentos:</b> {diagBnData.totalDocumentos ?? 0}</div>
              {Array.isArray(diagBnData.avisos) && diagBnData.avisos.length > 0 && (
                <div><b>Avisos:</b> {diagBnData.avisos.join(" • ")}</div>
              )}
              {diagBnData.error && <div className="text-destructive"><b>Erro:</b> {String(diagBnData.error)}</div>}
              <div><b>Resposta (preview):</b></div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-80">{JSON.stringify(diagBnData.preview?.length ? diagBnData.preview : (diagBnData.raw ?? diagBnData), null, 2)}</pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Visualizar nota */}
      <Dialog open={verOpen} onOpenChange={setVerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{docTipo === "nfe" ? "NFe" : "NFS-e"} nº {docSel?.numero || "—"}</DialogTitle></DialogHeader>
          {docSel && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><b>{docTipo === "nfe" ? "Emitente" : "Prestador"}:</b> {(docTipo === "nfe" ? docSel.emitente_nome : docSel.prestador_nome) || "—"}</div>
                <div><b>CNPJ:</b> {formatCnpj(docTipo === "nfe" ? docSel.emitente_cnpj : docSel.prestador_cnpj)}</div>
                <div><b>Emissão:</b> {formatDateTime(docSel.data_emissao)}</div>
                <div><b>Valor:</b> {formatBRL(docSel.valor_total)}</div>
                <div className="col-span-2 break-all"><b>Chave:</b> <code className="text-xs">{docSel.chave}</code></div>
                {docSel.discriminacao && <div className="col-span-2"><b>Discriminação:</b> {docSel.discriminacao}</div>}
                <div><b>Status:</b> {docSel.status || "—"}</div>
                <div><b>Contas a pagar:</b> {docSel.conta_pagar_id ? (contasPagar.find(c => c.id === docSel.conta_pagar_id)?.descricao || "Vinculada") : "Não vinculada"}</div>
                {docSel.motivo_rejeicao && <div className="col-span-2 text-destructive"><b>Motivo da rejeição:</b> {docSel.motivo_rejeicao}</div>}
              </div>
              <div>
                <b>XML:</b>
                {xmlLoading ? (
                  <div className="py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando XML…</div>
                ) : xmlTexto ? (
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap break-all">{xmlTexto}</pre>
                ) : (
                  <div className="text-muted-foreground py-2">XML não disponível para esta nota.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => baixarXml(docSel, docTipo)}>
              <Download className="h-4 w-4 mr-2" /> Baixar XML
            </Button>
            <Button onClick={() => setVerOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeitar nota */}
      <Dialog open={rejeitarOpen} onOpenChange={setRejeitarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar nota fiscal</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição *</Label>
            <Textarea rows={4} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo da rejeição" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRejeicao} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular a contas a pagar */}
      <Dialog open={vincularOpen} onOpenChange={setVincularOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vincular a Contas a Pagar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título existente</Label>
              {(() => {
                const abertos = contasPagar.filter(c => c.status === "aberta" || c.status === "parcial");
                const sel = abertos.find(c => c.id === contaSel);
                const venc = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
                const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                return (
                  <Popover open={contaPickerOpen} onOpenChange={setContaPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className={cn("truncate", !sel && "text-muted-foreground")}>
                          {sel
                            ? `${sel.descricao} — ${fmtBRL(Number(sel.valor_total))} — venc. ${venc(sel.data_vencimento)}`
                            : "Selecione um título em aberto"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command
                        filter={(value, search) => (norm(value).includes(norm(search)) ? 1 : 0)}
                      >
                        <CommandInput placeholder="Buscar por descrição, fornecedor, valor ou vencimento..." />
                        <CommandList className="max-h-72">
                          <CommandEmpty>Nenhum título encontrado.</CommandEmpty>
                          <CommandGroup>
                            {abertos.map(c => {
                              const texto = `${c.descricao} ${c.fornecedor_nome || ""} ${fmtBRL(Number(c.valor_total))} ${venc(c.data_vencimento)}`;
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${texto} ${c.id}`}
                                  onSelect={() => { setContaSel(c.id); setContaPickerOpen(false); }}
                                  className="items-start gap-2"
                                >
                                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", contaSel === c.id ? "opacity-100" : "opacity-0")} />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm">{c.descricao}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {c.fornecedor_nome ? `${c.fornecedor_nome} · ` : ""}{fmtBRL(Number(c.valor_total))} · venc. {venc(c.data_vencimento)}
                                      {c.status === "parcial" ? " · parcial" : ""}
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              })()}
              <Button className="w-full" onClick={salvarVinculo} disabled={salvando || !contaSel}>
                {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Vincular ao título selecionado
              </Button>
            </div>
            <div className="border-t pt-4 space-y-2">
              <Label>Ou criar novo título a partir da nota</Label>
              <div className="text-sm text-muted-foreground">
                {(docTipo === "nfe" ? docSel?.emitente_nome : docSel?.prestador_nome) || "—"} — {formatBRL(docSel?.valor_total)}
              </div>
              <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              <Button variant="outline" className="w-full" onClick={criarEVincular} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar título e vincular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookOpen} onOpenChange={setWebhookOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook de NF-es Recebidas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Configure esta URL no painel do <b>Brasil NFe</b> para que novas notas fiscais emitidas contra o CNPJ da empresa
              sejam importadas automaticamente, sem precisar clicar em "Importar".
            </p>
            <div className="space-y-1">
              <Label>1. Informe o token da sua conta Brasil NFe (o mesmo usado na importação):</Label>
              <Input
                value={webhookToken}
                onChange={e => setWebhookToken(e.target.value.trim())}
                placeholder="Token Brasil NFe"
                type="password"
              />
            </div>
            <div className="space-y-1">
              <Label>2. Copie a URL completa e cadastre-a como webhook no provedor:</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookToken
                    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nfe-webhook?token=${webhookToken}`
                    : "Informe o token acima para gerar a URL"}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!webhookToken}
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nfe-webhook?token=${webhookToken}`);
                    toast.success("URL do webhook copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A cada evento recebido, o sistema importa as notas dos últimos 3 dias (NF-e e NFS-e), ignorando duplicidades
              pela chave de acesso. O token nunca é exibido nem gravado nesta tela.
            </p>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
