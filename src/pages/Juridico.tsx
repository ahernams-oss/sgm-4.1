import { useState, useMemo, useEffect, useCallback } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Scale, Plus, Eye, Edit, Trash2, FileText, Calendar, AlertTriangle, DollarSign, BarChart3, Users, Phone, Send, Upload, X, Download, FileSpreadsheet, Printer, Banknote, CheckCircle2, CalendarCheck, CreditCard, MessageCircle, Lock as LockIcon, TrendingUp, Gavel, Percent, Landmark } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  gerarPdfProcessos, gerarExcelProcessos,
  gerarPdfAudiencias, gerarExcelAudiencias,
  gerarPdfContatos, gerarExcelContatos,
  gerarPdfProvisao, gerarExcelProvisao,
  gerarPdfSintese, gerarExcelSintese,
  gerarPdfDecisoes, gerarExcelDecisoes,
  gerarPdfParcelas, gerarExcelParcelas,
} from "@/lib/gerarRelatoriosJuridico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useProcessosTrabalhistas, ProcessoTrabalhista, Andamento } from "@/contexts/ProcessosTrabalhistas";
import { useClientes } from "@/contexts/ClientesContext";
import { usePermissao } from "@/hooks/usePermissao";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { verificarSenhaUsuario } from "@/lib/verifySenha";

import PaginationControls, { paginate } from "@/components/PaginationControls";

const STATUS_OPTIONS = ["Ativo", "Recurso", "Acordo", "Encerrado", "Arquivado"];
const RISCO_OPTIONS = ["Baixo", "Médio", "Alto"];
const FASE_OPTIONS = ["Inicial", "Instrução", "Julgamento", "Recursal", "Execução", "Encerrado"];
const TIPO_ANDAMENTO = ["Audiência", "Petição", "Decisão", "Prazo", "Outros"];
const TIPO_AUDIENCIA = ["Audiência Inicial", "Audiência de Instrução", "Audiência de Julgamento", "Audiência de Conciliação", "Audiência UNA", "Outros"];
const TIPO_CONTATO = ["Advogado", "Contador", "Preposto"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Audiencia {
  id: string;
  processo_id: string;
  processo_numero: string;
  data_audiencia: string;
  hora: string;
  tipo: string;
  local: string;
  vara: string;
  observacoes: string;
  status: string;
  notificado_10d: boolean;
  notificado_7d: boolean;
  notificado_5d: boolean;
  notificado_2d: boolean;
}

interface ContatoNotificacao {
  id: string;
  nome: string;
  tipo: string;
  telefone_whatsapp: string;
  email: string;
  oab: string;
  crc: string;
  cpf: string;
  ativo: boolean;
  observacoes: string;
}

const emptyProcesso: Omit<ProcessoTrabalhista, "id"> = {
  numero_processo: "", vara: "", comarca: "", estado: "", autor_nome: "", autor_cpf: "",
  advogado_autor: "", advogado_autor_oab: "", advogado_empresa: "", advogados_empresa: [], preposto: "", data_distribuicao: null, objeto_acao: "",
  valor_causa: 0, provisao_contabil: 0, valor_acordo: 0, valor_condenacao: 0, honorarios: 0,
  risco: "Médio", status: "Ativo", fase_processual: "Inicial", observacoes: "", anexos: [],
  cliente_id: "", cliente_nome: "",
};

const emptyAudiencia: Omit<Audiencia, "id"> = {
  processo_id: "", processo_numero: "", data_audiencia: "", hora: "", tipo: "Audiência Inicial",
  local: "", vara: "", observacoes: "", status: "Agendada",
  notificado_10d: false, notificado_7d: false, notificado_5d: false, notificado_2d: false,
};

const emptyContato: Omit<ContatoNotificacao, "id"> = {
  nome: "", tipo: "Advogado", telefone_whatsapp: "", email: "", oab: "", crc: "", cpf: "", ativo: true, observacoes: "",
};

const TIPO_DECISAO = ["Acordo", "Decisão", "Sentença", "Homologação"];
const STATUS_DECISAO = ["Em andamento", "Quitado", "Inadimplente", "Cancelado"];
const STATUS_PARCELA = ["Pendente", "Pago", "Atrasado", "Cancelado"];
const TIPO_CONTA = ["Corrente", "Poupança"];
const TIPO_PIX = ["CPF", "CNPJ", "E-mail", "Telefone", "Aleatória"];

interface Decisao {
  id: string;
  processo_id: string;
  processo_numero: string;
  tipo: string;
  data_decisao: string | null;
  juiz: string;
  descricao: string;
  valor_total: number;
  valor_principal: number;
  valor_honorarios: number;
  valor_custas: number;
  qtd_parcelas: number;
  primeiro_vencimento: string | null;
  valor_entrada: number;
  data_entrada: string | null;
  status: string;
  patrono_nome: string;
  patrono_oab: string;
  patrono_telefone: string;
  patrono_email: string;
  patrono_escritorio: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  pix_chave: string;
  pix_tipo: string;
  titular_nome: string;
  titular_documento: string;
  observacoes: string;
  anexos: { nome: string; path: string; tamanho: number }[];
}

interface Parcela {
  id: string;
  decisao_id: string;
  numero: number;
  data_vencimento: string | null;
  valor: number;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  forma_pagamento: string;
  comprovante_url: string;
  observacoes: string;
}

const emptyDecisao: Omit<Decisao, "id"> = {
  processo_id: "", processo_numero: "", tipo: "Acordo", data_decisao: null, juiz: "", descricao: "",
  valor_total: 0, valor_principal: 0, valor_honorarios: 0, valor_custas: 0,
  qtd_parcelas: 1, primeiro_vencimento: null, valor_entrada: 0, data_entrada: null, status: "Em andamento",
  patrono_nome: "", patrono_oab: "", patrono_telefone: "", patrono_email: "", patrono_escritorio: "",
  banco: "", agencia: "", conta: "", tipo_conta: "Corrente", pix_chave: "", pix_tipo: "CPF",
  titular_nome: "", titular_documento: "", observacoes: "", anexos: [],
};

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m - 1) + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function JuridicoPage() {
  const { processos, andamentos, loading, addProcesso, updateProcesso, deleteProcesso, addAndamento, deleteAndamento, loadAndamentos } = useProcessosTrabalhistas();
  const { tem } = usePermissao();
  const podeCriar = tem("juridico.criar");
  const podeEditar = tem("juridico.editar");
  const podeExcluir = tem("juridico.excluir");
  const podeAudiencias = tem("juridico.gerenciar_audiencias");
  const podeContatos = tem("juridico.gerenciar_contatos");
  const podeAnexos = tem("juridico.gerenciar_anexos");

  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();

  // Confirmação de senha para lançar Decisão/Acordo
  const [showSenhaConfirm, setShowSenhaConfirm] = useState(false);
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [validandoSenha, setValidandoSenha] = useState(false);

  const [tab, setTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProcesso);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterRisco, setFilterRisco] = useState("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [viewProcesso, setViewProcesso] = useState<ProcessoTrabalhista | null>(null);
  const [showAndamentoForm, setShowAndamentoForm] = useState(false);
  const [andForm, setAndForm] = useState<Omit<Andamento, "id">>({ processo_id: "", tipo: "Outros", data_andamento: "", descricao: "", responsavel: "", prazo_limite: null, status_prazo: "Pendente" });

  // Audiências
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [showAudForm, setShowAudForm] = useState(false);
  const [audEditId, setAudEditId] = useState<string | null>(null);
  const [audForm, setAudForm] = useState(emptyAudiencia);
  const [audDeleteId, setAudDeleteId] = useState<string | null>(null);

  // Contatos
  const [contatos, setContatos] = useState<ContatoNotificacao[]>([]);
  const [showContatoForm, setShowContatoForm] = useState(false);
  const [contatoEditId, setContatoEditId] = useState<string | null>(null);
  const [contatoForm, setContatoForm] = useState(emptyContato);
  const [contatoDeleteId, setContatoDeleteId] = useState<string | null>(null);

  // Decisões e Pagamentos
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [showDecisaoForm, setShowDecisaoForm] = useState(false);
  const [decisaoEditId, setDecisaoEditId] = useState<string | null>(null);
  const [decisaoForm, setDecisaoForm] = useState(emptyDecisao);
  const [decisaoDeleteId, setDecisaoDeleteId] = useState<string | null>(null);
  const [viewDecisao, setViewDecisao] = useState<Decisao | null>(null);
  const [parcelaPagar, setParcelaPagar] = useState<Parcela | null>(null);
  const [parcelaEditar, setParcelaEditar] = useState<Parcela | null>(null);
  const [parcelaEditForm, setParcelaEditForm] = useState({ valor: 0, data_vencimento: "", redistribuir: true });
  const [pagamentoForm, setPagamentoForm] = useState({ data_pagamento: "", valor_pago: 0, forma_pagamento: "PIX", comprovante_url: "", observacoes: "" });

  const [filterDecisaoStatus, setFilterDecisaoStatus] = useState("Todos");
  const [filterDecisaoTipo, setFilterDecisaoTipo] = useState("Todos");
  const [filterDecisaoBusca, setFilterDecisaoBusca] = useState("");
  const [filterDecisaoDe, setFilterDecisaoDe] = useState("");
  const [filterDecisaoAte, setFilterDecisaoAte] = useState("");
  const [filterParcelaStatus, setFilterParcelaStatus] = useState("Todos");
  const [filterParcelaDe, setFilterParcelaDe] = useState("");
  const [filterParcelaAte, setFilterParcelaAte] = useState("");
  const [filterParcelaAutor, setFilterParcelaAutor] = useState("");
  const [filterParcelaAdvogado, setFilterParcelaAdvogado] = useState("");

  const loadAudiencias = useCallback(async () => {
    const { data, error } = await (supabase as any).from("juridico_audiencias").select("*").order("data_audiencia", { ascending: true });
    if (error) { console.error(error); return; }
    setAudiencias((data || []).map((r: any) => ({
      id: r.id, processo_id: r.processo_id ?? "", processo_numero: r.processo_numero ?? "",
      data_audiencia: r.data_audiencia ?? "", hora: r.hora ?? "", tipo: r.tipo ?? "",
      local: r.local ?? "", vara: r.vara ?? "", observacoes: r.observacoes ?? "",
      status: r.status ?? "Agendada",
      notificado_10d: r.notificado_10d ?? false, notificado_7d: r.notificado_7d ?? false,
      notificado_5d: r.notificado_5d ?? false, notificado_2d: r.notificado_2d ?? false,
    })));
  }, []);

  const loadContatos = useCallback(async () => {
    const { data, error } = await (supabase as any).from("juridico_contatos_notificacao").select("*").order("nome", { ascending: true });
    if (error) { console.error(error); return; }
    setContatos((data || []).map((r: any) => ({
      id: r.id, nome: r.nome ?? "", tipo: r.tipo ?? "Advogado",
      telefone_whatsapp: r.telefone_whatsapp ?? "", email: r.email ?? "",
      oab: r.oab ?? "", crc: r.crc ?? "", cpf: r.cpf ?? "", ativo: r.ativo ?? true, observacoes: r.observacoes ?? "",
    })));
  }, []);

  const loadDecisoes = useCallback(async () => {
    const { data, error } = await (supabase as any).from("juridico_decisoes_pagamentos").select("*").order("data_decisao", { ascending: false });
    if (error) { console.error(error); return; }
    setDecisoes((data || []).map((r: any) => ({
      id: r.id, processo_id: r.processo_id ?? "", processo_numero: r.processo_numero ?? "",
      tipo: r.tipo ?? "Acordo", data_decisao: r.data_decisao ?? null, juiz: r.juiz ?? "",
      descricao: r.descricao ?? "", valor_total: Number(r.valor_total) || 0,
      valor_principal: Number(r.valor_principal) || 0, valor_honorarios: Number(r.valor_honorarios) || 0,
      valor_custas: Number(r.valor_custas) || 0, qtd_parcelas: Number(r.qtd_parcelas) || 1,
      primeiro_vencimento: r.primeiro_vencimento ?? null,
      valor_entrada: Number(r.valor_entrada) || 0, data_entrada: r.data_entrada ?? null,
      status: r.status ?? "Em andamento",
      patrono_nome: r.patrono_nome ?? "", patrono_oab: r.patrono_oab ?? "",
      patrono_telefone: r.patrono_telefone ?? "", patrono_email: r.patrono_email ?? "",
      patrono_escritorio: r.patrono_escritorio ?? "",
      banco: r.banco ?? "", agencia: r.agencia ?? "", conta: r.conta ?? "",
      tipo_conta: r.tipo_conta ?? "Corrente", pix_chave: r.pix_chave ?? "", pix_tipo: r.pix_tipo ?? "CPF",
      titular_nome: r.titular_nome ?? "", titular_documento: r.titular_documento ?? "",
      observacoes: r.observacoes ?? "", anexos: Array.isArray(r.anexos) ? r.anexos : [],
    })));
  }, []);

  const loadParcelas = useCallback(async () => {
    const { data, error } = await (supabase as any).from("juridico_parcelas").select("*").order("data_vencimento", { ascending: true });
    if (error) { console.error(error); return; }
    setParcelas((data || []).map((r: any) => ({
      id: r.id, decisao_id: r.decisao_id, numero: Number(r.numero) || 1,
      data_vencimento: r.data_vencimento ?? null, valor: Number(r.valor) || 0,
      status: r.status ?? "Pendente", data_pagamento: r.data_pagamento ?? null,
      valor_pago: r.valor_pago != null ? Number(r.valor_pago) : null,
      forma_pagamento: r.forma_pagamento ?? "", comprovante_url: r.comprovante_url ?? "",
      observacoes: r.observacoes ?? "",
    })));
  }, []);

  useEffect(() => { loadAudiencias(); loadContatos(); loadDecisoes(); loadParcelas(); }, [loadAudiencias, loadContatos, loadDecisoes, loadParcelas]);

  // Decisões CRUD — abre confirmação de senha antes de gravar
  const handleSaveDecisao = () => {
    if (!decisaoForm.processo_id) { toast.error("Selecione o processo"); return; }
    if (!decisaoForm.valor_total || decisaoForm.valor_total <= 0) { toast.error("Informe o valor total"); return; }
    if (!usuarioLogado) { toast.error("Usuário não autenticado"); return; }
    setSenhaConfirm("");
    setShowSenhaConfirm(true);
  };

  const executarSaveDecisao = async () => {
    if (!usuarioLogado) return;
    setValidandoSenha(true);
    try {
      const ok = await verificarSenhaUsuario(usuarioLogado.email, senhaConfirm);
      if (!ok) { toast.error("Senha incorreta. Operação cancelada."); return; }

      const proc = processos.find(p => p.id === decisaoForm.processo_id);
      const payload = { ...decisaoForm, processo_numero: proc?.numero_processo || "" };
      let decisaoId = decisaoEditId;
      if (decisaoEditId) {
        const { error } = await (supabase as any).from("juridico_decisoes_pagamentos").update(payload).eq("id", decisaoEditId);
        if (error) { toast.error("Erro ao salvar"); console.error(error); return; }
        toast.success("Decisão atualizada");
      } else {
        const { data, error } = await (supabase as any).from("juridico_decisoes_pagamentos").insert(payload).select().single();
        if (error) { toast.error("Erro ao salvar"); console.error(error); return; }
        decisaoId = data.id;
        toast.success("Decisão registrada");
      }
      // Gerar parcelas (somente em criação): entrada opcional + qtd_parcelas mensais
      if (!decisaoEditId && decisaoId) {
        const entrada = Number(decisaoForm.valor_entrada) || 0;
        const restante = +(decisaoForm.valor_total - entrada).toFixed(2);
        const rows: any[] = [];
        let numero = 1;
        if (entrada > 0) {
          rows.push({
            decisao_id: decisaoId, numero: numero++,
            data_vencimento: decisaoForm.data_entrada || decisaoForm.primeiro_vencimento || null,
            valor: entrada, status: "Pendente",
            observacoes: "Entrada / Primeira parcela",
          });
        }
        if (decisaoForm.qtd_parcelas > 0 && restante > 0 && decisaoForm.primeiro_vencimento) {
          const valorParcela = +(restante / decisaoForm.qtd_parcelas).toFixed(2);
          for (let i = 0; i < decisaoForm.qtd_parcelas; i++) {
            const isLast = i === decisaoForm.qtd_parcelas - 1;
            const valor = isLast
              ? +(restante - valorParcela * (decisaoForm.qtd_parcelas - 1)).toFixed(2)
              : valorParcela;
            rows.push({
              decisao_id: decisaoId, numero: numero++,
              data_vencimento: addMonthsISO(decisaoForm.primeiro_vencimento!, i),
              valor, status: "Pendente",
            });
          }
        }
        if (rows.length > 0) {
          const { data: parcInseridas, error: errPar } = await (supabase as any)
            .from("juridico_parcelas").insert(rows).select();
          if (errPar) { console.error(errPar); }

          // Integração com Contas a Pagar
          if (parcInseridas && parcInseridas.length > 0) {
            const total = parcInseridas.length;
            const descBase = `Jurídico - Proc. ${proc?.numero_processo || ""}${proc?.autor_nome ? ` (${proc.autor_nome})` : ""}`;
            const cpRows = parcInseridas
              .filter((p: any) => !!p.data_vencimento)
              .map((p: any) => ({
                descricao: `${descBase} - Parcela ${p.numero}/${total}${decisaoForm.patrono_nome ? ` - Patrono: ${decisaoForm.patrono_nome}` : ""}`,
                fornecedor_nome: decisaoForm.patrono_nome || proc?.advogado_autor || "",
                valor_total: Number(p.valor) || 0,
                valor_pago: 0,
                data_emissao: new Date().toISOString().slice(0, 10),
                data_vencimento: p.data_vencimento,
                status: "aberta",
                parcela_num: p.numero,
                parcela_total: total,
                origem: "juridico",
                juridico_parcela_id: p.id,
                observacao: [
                  decisaoForm.banco ? `Banco: ${decisaoForm.banco}` : "",
                  decisaoForm.agencia ? `Ag: ${decisaoForm.agencia}` : "",
                  decisaoForm.conta ? `Conta: ${decisaoForm.conta}` : "",
                  decisaoForm.pix_chave ? `PIX (${decisaoForm.pix_tipo || "chave"}): ${decisaoForm.pix_chave}` : "",
                ].filter(Boolean).join(" | ") || null,
              }));
            if (cpRows.length > 0) {
              const { error: errCp } = await (supabase as any).from("fin_contas_pagar").insert(cpRows);
              if (errCp) console.error("Erro ao lançar em Contas a Pagar", errCp);
              else toast.success(`${cpRows.length} parcela(s) lançada(s) em Contas a Pagar`);
            }
          }
        }
      }
      setShowDecisaoForm(false);
      setShowSenhaConfirm(false);
      setSenhaConfirm("");
      setDecisaoEditId(null);
      setDecisaoForm(emptyDecisao);
      await loadDecisoes();
      await loadParcelas();
    } finally {
      setValidandoSenha(false);
    }
  };

  const handleDeleteDecisao = async () => {
    if (!decisaoDeleteId) return;
    await (supabase as any).from("juridico_decisoes_pagamentos").delete().eq("id", decisaoDeleteId);
    toast.success("Decisão removida");
    setDecisaoDeleteId(null);
    await loadDecisoes();
    await loadParcelas();
  };

  const openPagarParcela = (p: Parcela) => {
    setParcelaPagar(p);
    setPagamentoForm({
      data_pagamento: p.data_pagamento || new Date().toISOString().slice(0, 10),
      valor_pago: p.valor_pago ?? p.valor,
      forma_pagamento: p.forma_pagamento || "PIX",
      comprovante_url: p.comprovante_url || "",
      observacoes: p.observacoes || "",
    });
  };

  const handleConfirmarPagamento = async () => {
    if (!parcelaPagar) return;
    const { error } = await (supabase as any).from("juridico_parcelas").update({
      ...pagamentoForm, status: "Pago",
    }).eq("id", parcelaPagar.id);
    if (error) { toast.error("Erro ao registrar pagamento"); return; }
    toast.success("Pagamento registrado");
    // Reflete em Contas a Pagar
    await (supabase as any).from("fin_contas_pagar").update({
      status: "paga",
      data_pagamento: pagamentoForm.data_pagamento,
      valor_pago: pagamentoForm.valor_pago,
    }).eq("juridico_parcela_id", parcelaPagar.id);
    // Atualiza status da decisão se todas pagas
    const restantes = parcelas.filter(x => x.decisao_id === parcelaPagar.decisao_id && x.id !== parcelaPagar.id && x.status !== "Pago" && x.status !== "Cancelado");
    if (restantes.length === 0) {
      await (supabase as any).from("juridico_decisoes_pagamentos").update({ status: "Quitado" }).eq("id", parcelaPagar.decisao_id);
    }
    setParcelaPagar(null);
    await loadDecisoes();
    await loadParcelas();
  };

  const handleCancelarParcela = async (p: Parcela) => {
    await (supabase as any).from("juridico_parcelas").update({ status: "Cancelado" }).eq("id", p.id);
    await (supabase as any).from("fin_contas_pagar").update({ status: "cancelada" }).eq("juridico_parcela_id", p.id);
    toast.success("Parcela cancelada");
    await loadParcelas();
  };

  const openEditarParcela = (p: Parcela) => {
    setParcelaEditar(p);
    setParcelaEditForm({ valor: p.valor, data_vencimento: p.data_vencimento || "", redistribuir: true });
  };

  // Parcelas em aberto posteriores à parcela editada (base do recálculo)
  const parcelasPosteriores = useMemo(() => {
    if (!parcelaEditar) return [] as Parcela[];
    return parcelas
      .filter(x => x.decisao_id === parcelaEditar.decisao_id && x.id !== parcelaEditar.id
        && x.status !== "Pago" && x.status !== "Cancelado" && x.numero > parcelaEditar.numero)
      .sort((a, b) => a.numero - b.numero);
  }, [parcelas, parcelaEditar]);

  const previewRecalculo = useMemo(() => {
    if (!parcelaEditar || !parcelaEditForm.redistribuir || parcelasPosteriores.length === 0) return null;
    const totalAberto = parcelaEditar.valor + parcelasPosteriores.reduce((s, x) => s + x.valor, 0);
    const restante = +(totalAberto - (Number(parcelaEditForm.valor) || 0)).toFixed(2);
    if (restante < 0) return null;
    const base = +(restante / parcelasPosteriores.length).toFixed(2);
    return parcelasPosteriores.map((x, i) => ({
      parcela: x,
      novoValor: i === parcelasPosteriores.length - 1
        ? +(restante - base * (parcelasPosteriores.length - 1)).toFixed(2)
        : base,
    }));
  }, [parcelaEditar, parcelaEditForm, parcelasPosteriores]);

  const handleSalvarParcela = async () => {
    if (!parcelaEditar) return;
    const novoValor = Number(parcelaEditForm.valor) || 0;
    if (novoValor <= 0) { toast.error("Informe um valor válido"); return; }
    if (!parcelaEditForm.data_vencimento) { toast.error("Informe o vencimento"); return; }
    if (parcelaEditForm.redistribuir && parcelasPosteriores.length > 0 && !previewRecalculo) {
      toast.error("Valor maior que o saldo em aberto das parcelas seguintes");
      return;
    }

    const atualizar = async (id: string, valor: number, venc?: string) => {
      const payload: any = { valor };
      if (venc) payload.data_vencimento = venc;
      const { error } = await (supabase as any).from("juridico_parcelas").update(payload).eq("id", id);
      if (error) throw error;
      const cpPayload: any = { valor };
      if (venc) cpPayload.data_vencimento = venc;
      await (supabase as any).from("fin_contas_pagar").update(cpPayload).eq("juridico_parcela_id", id);
    };

    try {
      await atualizar(parcelaEditar.id, novoValor, parcelaEditForm.data_vencimento);
      if (previewRecalculo) {
        for (const r of previewRecalculo) await atualizar(r.parcela.id, r.novoValor);
      }
      toast.success(previewRecalculo ? "Parcela alterada e demais recalculadas" : "Parcela alterada");
      setParcelaEditar(null);
      await loadParcelas();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar parcela");
    }
  };



  // Atualiza status visual de parcelas atrasadas (em memória)
  const parcelasComStatus = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return parcelas.map(p => {
      if (p.status === "Pendente" && p.data_vencimento && p.data_vencimento < hoje) {
        return { ...p, status: "Atrasado" };
      }
      return p;
    });
  }, [parcelas]);

  const decisoesFiltradas = useMemo(() => {
    const q = filterDecisaoBusca.trim().toLowerCase();
    return decisoes.filter(d => {
      if (filterDecisaoStatus !== "Todos" && d.status !== filterDecisaoStatus) return false;
      if (filterDecisaoTipo !== "Todos" && d.tipo !== filterDecisaoTipo) return false;
      if (filterDecisaoDe && (!d.data_decisao || d.data_decisao < filterDecisaoDe)) return false;
      if (filterDecisaoAte && (!d.data_decisao || d.data_decisao > filterDecisaoAte)) return false;
      if (q) {
        const blob = `${d.processo_numero ?? ""} ${d.juiz ?? ""} ${d.patrono_nome ?? ""} ${d.patrono_oab ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [decisoes, filterDecisaoStatus, filterDecisaoTipo, filterDecisaoBusca, filterDecisaoDe, filterDecisaoAte]);

  const parcelasFiltradas = useMemo(() => {
    const idsDec = new Set(decisoesFiltradas.map(d => d.id));
    const fAutor = filterParcelaAutor.trim().toLowerCase();
    const fAdv = filterParcelaAdvogado.trim().toLowerCase();
    return parcelasComStatus.filter(p => {
      if (!idsDec.has(p.decisao_id)) return false;
      if (filterParcelaStatus !== "Todos" && p.status !== filterParcelaStatus) return false;
      if (filterParcelaDe && (!p.data_vencimento || p.data_vencimento < filterParcelaDe)) return false;
      if (filterParcelaAte && (!p.data_vencimento || p.data_vencimento > filterParcelaAte)) return false;
      if (fAutor || fAdv) {
        const dec = decisoes.find(d => d.id === p.decisao_id);
        const proc = dec ? processos.find(pr => pr.id === dec.processo_id) : null;
        const autorNome = (proc?.autor_nome || "").toLowerCase();
        const advNome = ((dec?.patrono_nome || proc?.advogado_autor || "")).toLowerCase();
        if (fAutor && !autorNome.includes(fAutor)) return false;
        if (fAdv && !advNome.includes(fAdv)) return false;
      }
      return true;
    });
  }, [parcelasComStatus, decisoesFiltradas, filterParcelaStatus, filterParcelaDe, filterParcelaAte, filterParcelaAutor, filterParcelaAdvogado, decisoes, processos]);

  const decisaoStats = useMemo(() => {
    const totalAcordado = decisoes.reduce((s, d) => s + d.valor_total, 0);
    const totalPago = parcelas.filter(p => p.status === "Pago").reduce((s, p) => s + (p.valor_pago ?? p.valor), 0);
    const totalPendente = parcelasComStatus.filter(p => p.status === "Pendente").reduce((s, p) => s + p.valor, 0);
    const totalAtrasado = parcelasComStatus.filter(p => p.status === "Atrasado").reduce((s, p) => s + p.valor, 0);
    return { totalAcordado, totalPago, totalPendente, totalAtrasado };
  }, [decisoes, parcelas, parcelasComStatus]);


  // Dashboard stats
  const stats = useMemo(() => {
    const ativos = processos.filter(p => p.status === "Ativo").length;
    const emRecurso = processos.filter(p => p.status === "Recurso").length;
    const encerrados = processos.filter(p => ["Encerrado", "Arquivado", "Acordo"].includes(p.status)).length;
    const totalProvisao = processos.reduce((s, p) => s + (p.provisao_contabil || 0), 0);
    const totalValorCausa = processos.reduce((s, p) => s + (p.valor_causa || 0), 0);
    const totalAcordos = processos.reduce((s, p) => s + (p.valor_acordo || 0), 0);
    const totalCondenacoes = processos.reduce((s, p) => s + (p.valor_condenacao || 0), 0);
    const totalHonorarios = processos.reduce((s, p) => s + (p.honorarios || 0), 0);
    const exposicaoTotal = totalProvisao + totalAcordos + totalCondenacoes;
    const mediaProvisao = processos.length ? totalProvisao / processos.length : 0;
    const riscoAlto = processos.filter(p => p.risco === "Alto" && p.status === "Ativo").length;
    const porStatus = STATUS_OPTIONS.map(st => ({ status: st, count: processos.filter(p => p.status === st).length }));
    const porRisco = RISCO_OPTIONS.map(r => ({ risco: r, count: processos.filter(p => p.risco === r && p.status === "Ativo").length }));
    const proximasAudiencias = audiencias.filter(a => a.status === "Agendada" && new Date(a.data_audiencia + "T23:59:59") >= new Date()).slice(0, 5);
    // Por fase
    const fasesMap = new Map<string, number>();
    processos.forEach(p => { if (p.fase_processual) fasesMap.set(p.fase_processual, (fasesMap.get(p.fase_processual) || 0) + 1); });
    const porFase = Array.from(fasesMap.entries()).map(([fase, count]) => ({ fase, count })).sort((a, b) => b.count - a.count);
    // Distribuição por ano
    const anoMap = new Map<string, number>();
    processos.forEach(p => {
      if (p.data_distribuicao) {
        const ano = new Date(p.data_distribuicao).getFullYear().toString();
        anoMap.set(ano, (anoMap.get(ano) || 0) + 1);
      }
    });
    const porAno = Array.from(anoMap.entries()).map(([ano, count]) => ({ ano, count })).sort((a, b) => a.ano.localeCompare(b.ano));
    // Top clientes
    const cliMap = new Map<string, number>();
    processos.forEach(p => { if (p.cliente_nome) cliMap.set(p.cliente_nome, (cliMap.get(p.cliente_nome) || 0) + 1); });
    const topClientes = Array.from(cliMap.entries()).map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    // Audiências próximos 30 dias
    const hoje = new Date(); const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const audiencias30d = audiencias.filter(a => a.status === "Agendada" && new Date(a.data_audiencia + "T12:00:00") >= hoje && new Date(a.data_audiencia + "T12:00:00") <= em30).length;
    return { ativos, emRecurso, encerrados, totalProvisao, totalValorCausa, totalAcordos, totalCondenacoes, totalHonorarios, exposicaoTotal, mediaProvisao, riscoAlto, porStatus, porRisco, porFase, porAno, topClientes, audiencias30d, proximasAudiencias };
  }, [processos, audiencias]);

  const filtered = useMemo(() => {
    return processos.filter(p => {
      const matchSearch = !search || p.numero_processo.toLowerCase().includes(search.toLowerCase()) || p.autor_nome.toLowerCase().includes(search.toLowerCase()) || p.objeto_acao.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "Todos" || p.status === filterStatus;
      const matchRisco = filterRisco === "Todos" || p.risco === filterRisco;
      return matchSearch && matchStatus && matchRisco;
    });
  }, [processos, search, filterStatus, filterRisco]);

  const { paginated: paged, totalPages } = paginate(filtered, page, pageSize);

  const openNew = () => { setForm(emptyProcesso); setEditId(null); setShowForm(true); };
  const openEdit = (p: ProcessoTrabalhista) => { setForm({ ...p }); setEditId(p.id); setShowForm(true); };
  const openView = async (p: ProcessoTrabalhista) => { setViewProcesso(p); await loadAndamentos(p.id); };

  const handleSave = async () => {
    if (editId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.numero_processo.trim() || !form.autor_nome.trim()) { toast.error("Número do processo e nome do autor são obrigatórios"); return; }
    if (editId) { await updateProcesso(editId, form); toast.success("Processo atualizado"); }
    else { await addProcesso(form); toast.success("Processo cadastrado"); }
    setShowForm(false);
  };

  const handleAddAndamento = async () => {
    if (!podeEditar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!andForm.descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    await addAndamento({ ...andForm, processo_id: viewProcesso!.id });
    setShowAndamentoForm(false);
    setAndForm({ processo_id: "", tipo: "Outros", data_andamento: "", descricao: "", responsavel: "", prazo_limite: null, status_prazo: "Pendente" });
    toast.success("Andamento adicionado");
  };

  // Audiências CRUD
  const handleSaveAudiencia = async () => {
    if (!podeAudiencias) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!audForm.processo_id || !audForm.data_audiencia) { toast.error("Processo e data são obrigatórios"); return; }
    const proc = processos.find(p => p.id === audForm.processo_id);
    const payload = { ...audForm, processo_numero: proc?.numero_processo || "" };
    if (audEditId) {
      await (supabase as any).from("juridico_audiencias").update(payload).eq("id", audEditId);
      toast.success("Audiência atualizada");
    } else {
      await (supabase as any).from("juridico_audiencias").insert(payload);
      toast.success("Audiência agendada");
    }
    setShowAudForm(false);
    setAudEditId(null);
    setAudForm(emptyAudiencia);
    await loadAudiencias();
  };

  const handleDeleteAudiencia = async () => {
    if (!podeAudiencias) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!audDeleteId) return;
    await (supabase as any).from("juridico_audiencias").delete().eq("id", audDeleteId);
    toast.success("Audiência removida");
    setAudDeleteId(null);
    await loadAudiencias();
  };

  // Contatos CRUD
  const handleSaveContato = async () => {
    if (!podeContatos) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!contatoForm.nome.trim() || !contatoForm.telefone_whatsapp.trim()) { toast.error("Nome e WhatsApp são obrigatórios"); return; }
    if (contatoEditId) {
      await (supabase as any).from("juridico_contatos_notificacao").update(contatoForm).eq("id", contatoEditId);
      toast.success("Contato atualizado");
    } else {
      await (supabase as any).from("juridico_contatos_notificacao").insert(contatoForm);
      toast.success("Contato cadastrado");
    }
    setShowContatoForm(false);
    setContatoEditId(null);
    setContatoForm(emptyContato);
    await loadContatos();
  };

  const handleDeleteContato = async () => {
    if (!podeContatos) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!contatoDeleteId) return;
    await (supabase as any).from("juridico_contatos_notificacao").delete().eq("id", contatoDeleteId);
    toast.success("Contato removido");
    setContatoDeleteId(null);
    await loadContatos();
  };

  const riscoBadge = (r: string) => {
    const cls = r === "Alto" ? "bg-destructive text-destructive-foreground" : r === "Médio" ? "bg-yellow-500 text-white" : "bg-green-600 text-white";
    return <Badge className={cls}>{r}</Badge>;
  };
  const statusBadge = (s: string) => {
    const cls = s === "Ativo" ? "bg-primary" : s === "Recurso" ? "bg-yellow-600 text-white" : s === "Acordo" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground";
    return <Badge className={cls}>{s}</Badge>;
  };

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Jurídico</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">Contencioso Jurídico</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de processos trabalhistas da empresa</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Relatórios
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Síntese</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => gerarPdfSintese(processos, audiencias)}>
                <FileText className="h-4 w-4 mr-2" /> Síntese (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarExcelSintese(processos, audiencias)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Síntese (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Processos {filtered.length !== processos.length ? `(filtrados: ${filtered.length})` : ""}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => gerarPdfProcessos(filtered, `Status: ${filterStatus} | Risco: ${filterRisco}`)}>
                <FileText className="h-4 w-4 mr-2" /> Processos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarExcelProcessos(filtered, `Status: ${filterStatus} | Risco: ${filterRisco}`)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Processos (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Provisão Financeira</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => gerarPdfProvisao(processos)}>
                <FileText className="h-4 w-4 mr-2" /> Provisão (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarExcelProvisao(processos)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Provisão (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Audiências</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => gerarPdfAudiencias(audiencias)}>
                <FileText className="h-4 w-4 mr-2" /> Audiências (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarExcelAudiencias(audiencias)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Audiências (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Contatos</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => gerarPdfContatos(contatos)}>
                <FileText className="h-4 w-4 mr-2" /> Contatos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarExcelContatos(contatos)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Contatos (Excel)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="processos"><FileText className="h-4 w-4 mr-1" /> Processos</TabsTrigger>
            <TabsTrigger value="audiencias"><Calendar className="h-4 w-4 mr-1" /> Audiências</TabsTrigger>
            <TabsTrigger value="contatos"><Users className="h-4 w-4 mr-1" /> Contatos</TabsTrigger>
            <TabsTrigger value="decisoes"><Banknote className="h-4 w-4 mr-1" /> Decisões e Pagamentos</TabsTrigger>
          </TabsList>

          {/* ============ DASHBOARD ============ */}
          <TabsContent value="dashboard" className="space-y-4">
            {/* KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Total Processos</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{processos.length}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Gavel className="h-3 w-3" /> Ativos</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-600">{stats.ativos}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Em Recurso</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-yellow-600">{stats.emRecurso}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-muted-foreground/40">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Encerrados</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-muted-foreground">{stats.encerrados}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-destructive">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Risco Alto</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{stats.riscoAlto}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Audiências 30d</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-600">{stats.audiencias30d}</p></CardContent>
              </Card>
            </div>

            {/* KPIs Financeiros */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor da Causa</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold">{fmt(stats.totalValorCausa)}</p></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/5 to-transparent">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Landmark className="h-3 w-3" /> Provisão Total</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold text-blue-600">{fmt(stats.totalProvisao)}</p></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-500/5 to-transparent">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3" /> Acordos</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold text-yellow-700">{fmt(stats.totalAcordos)}</p></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-destructive/5 to-transparent">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Gavel className="h-3 w-3" /> Condenações</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold text-destructive">{fmt(stats.totalCondenacoes)}</p></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Honorários</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold text-purple-600">{fmt(stats.totalHonorarios)}</p></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/30">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Exposição Total</CardTitle></CardHeader>
                <CardContent><p className="text-base font-bold text-orange-600">{fmt(stats.exposicaoTotal)}</p></CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
                <CardContent>
                  {processos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={stats.porStatus.filter(s => s.count > 0)} dataKey="count" nameKey="status" outerRadius={80} label={(e: any) => `${e.count}`}>
                          {stats.porStatus.filter(s => s.count > 0).map((_, i) => {
                            const cores = ["#3b82f6", "#eab308", "#10b981", "#6b7280", "#94a3b8"];
                            return <Cell key={i} fill={cores[i % cores.length]} />;
                          })}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ativos por Risco</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.porRisco}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="risco" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.porRisco.map((r, i) => (
                          <Cell key={i} fill={r.risco === "Alto" ? "#dc2626" : r.risco === "Médio" ? "#eab308" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Processos por Ano de Distribuição</CardTitle></CardHeader>
                <CardContent>
                  {stats.porAno.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados de distribuição</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={stats.porAno}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="ano" fontSize={12} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#673ab7" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fase, Top clientes, Próximas audiências */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Por Fase Processual</CardTitle></CardHeader>
                <CardContent>
                  {stats.porFase.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.porFase.map(f => {
                        const pct = processos.length ? (f.count / processos.length) * 100 : 0;
                        return (
                          <div key={f.fase}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{f.fase}</span>
                              <span className="text-muted-foreground">{f.count} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Users className="h-4 w-4" /> Top Centros de Custo</CardTitle></CardHeader>
                <CardContent>
                  {stats.topClientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topClientes.map((c, i) => (
                        <div key={c.nome} className="flex items-center justify-between p-2 rounded bg-muted/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="shrink-0">{i + 1}º</Badge>
                            <span className="text-sm truncate">{c.nome}</span>
                          </div>
                          <span className="text-sm font-bold">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Calendar className="h-4 w-4 text-primary" /> Próximas Audiências</CardTitle></CardHeader>
                <CardContent>
                  {stats.proximasAudiencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma audiência agendada</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.proximasAudiencias.map(a => (
                        <div key={a.id} className="flex justify-between items-center p-2 rounded bg-primary/5">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{a.processo_numero}</p>
                            <p className="text-xs text-muted-foreground">{a.tipo}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-medium">{new Date(a.data_audiencia + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                            {a.hora && <p className="text-xs text-muted-foreground">{a.hora}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {stats.riscoAlto > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Processos com Risco Alto</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-2">
                    {processos.filter(p => p.risco === "Alto" && p.status === "Ativo").map(p => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded bg-destructive/5">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.numero_processo}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.autor_nome}</p>
                        </div>
                        <span className="text-sm font-bold text-destructive shrink-0 ml-2">{fmt(p.valor_causa)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ PROCESSOS ============ */}
          <TabsContent value="processos">
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <Input placeholder="Buscar por nº, autor ou objeto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-64" />
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos Status</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRisco} onValueChange={v => { setFilterRisco(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos Riscos</SelectItem>
                  {RISCO_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              {podeCriar && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Processo</Button>}
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Processo</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Vara/Comarca</TableHead>
                    <TableHead>Distribuição</TableHead>
                    <TableHead>Valor Causa</TableHead>
                    <TableHead>Provisão</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum processo encontrado</TableCell></TableRow>
                  )}
                  {paged.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.numero_processo}</TableCell>
                      <TableCell>{p.autor_nome}</TableCell>
                      <TableCell>{p.vara}{p.comarca ? ` - ${p.comarca}` : ""}</TableCell>
                      <TableCell>{p.data_distribuicao || "-"}</TableCell>
                      <TableCell>{fmt(p.valor_causa)}</TableCell>
                      <TableCell>{fmt(p.provisao_contabil)}</TableCell>
                      <TableCell>{riscoBadge(p.risco)}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell><span className="text-xs">{p.fase_processual}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openView(p)}><Eye className="h-4 w-4" /></Button>
                          {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>}
                          {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && <div className="mt-4"><PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} /></div>}
          </TabsContent>

          {/* ============ AUDIÊNCIAS ============ */}
          <TabsContent value="audiencias">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Agenda de Audiências</h2>
              {podeAudiencias && <Button onClick={() => { setAudForm(emptyAudiencia); setAudEditId(null); setShowAudForm(true); }} className="gap-2"><Plus className="h-4 w-4" /> Nova Audiência</Button>}
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Vara</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notificações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audiencias.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma audiência agendada</TableCell></TableRow>
                  )}
                  {audiencias.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.processo_numero}</TableCell>
                      <TableCell>{a.data_audiencia ? new Date(a.data_audiencia + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>{a.hora || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                      <TableCell>{a.local || "-"}</TableCell>
                      <TableCell>{a.vara || "-"}</TableCell>
                      <TableCell>
                        <Badge className={a.status === "Agendada" ? "bg-primary" : a.status === "Realizada" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {a.notificado_10d && <Badge variant="outline" className="text-xs">10d ✓</Badge>}
                          {a.notificado_7d && <Badge variant="outline" className="text-xs">7d ✓</Badge>}
                          {a.notificado_5d && <Badge variant="outline" className="text-xs">5d ✓</Badge>}
                          {a.notificado_2d && <Badge variant="outline" className="text-xs">2d ✓</Badge>}
                          {!a.notificado_10d && !a.notificado_7d && !a.notificado_5d && !a.notificado_2d && <span className="text-xs text-muted-foreground">Pendente</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {podeAudiencias && <Button variant="ghost" size="icon" onClick={() => { setAudForm({ ...a }); setAudEditId(a.id); setShowAudForm(true); }}><Edit className="h-4 w-4" /></Button>}
                          {podeAudiencias && <Button variant="ghost" size="icon" onClick={() => setAudDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ============ CONTATOS ============ */}
          <TabsContent value="contatos">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">Contatos para Notificação</h2>
                <p className="text-sm text-muted-foreground">Advogados e contadores que receberão avisos de audiências via WhatsApp</p>
              </div>
              {podeContatos && <Button onClick={() => { setContatoForm(emptyContato); setContatoEditId(null); setShowContatoForm(true); }} className="gap-2"><Plus className="h-4 w-4" /> Novo Contato</Button>}
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>OAB/CRC/CPF</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contatos.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum contato cadastrado</TableCell></TableRow>
                  )}
                  {contatos.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                      <TableCell><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone_whatsapp}</span></TableCell>
                      <TableCell>{c.email || "-"}</TableCell>
                      <TableCell>{c.tipo === "Advogado" ? c.oab || "-" : c.tipo === "Contador" ? c.crc || "-" : c.cpf || "-"}</TableCell>
                      <TableCell>
                        <Badge className={c.ativo ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>{c.ativo ? "Sim" : "Não"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {podeContatos && <Button variant="ghost" size="icon" onClick={() => { setContatoForm({ ...c }); setContatoEditId(c.id); setShowContatoForm(true); }}><Edit className="h-4 w-4" /></Button>}
                          {podeContatos && <Button variant="ghost" size="icon" onClick={() => setContatoDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ============ DECISÕES E PAGAMENTOS ============ */}
          <TabsContent value="decisoes">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Acordado/Decidido</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{fmt(decisaoStats.totalAcordado)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Pago</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-green-600">{fmt(decisaoStats.totalPago)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pendente</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-yellow-600">{fmt(decisaoStats.totalPendente)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Atrasado</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-destructive">{fmt(decisaoStats.totalAtrasado)}</p></CardContent></Card>
            </div>

            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="min-w-[200px] flex-1">
                <Label className="text-xs">Buscar</Label>
                <Input value={filterDecisaoBusca} onChange={e => setFilterDecisaoBusca(e.target.value)} placeholder="Processo, juiz, patrono, OAB..." />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filterDecisaoTipo} onValueChange={setFilterDecisaoTipo}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    {TIPO_DECISAO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterDecisaoStatus} onValueChange={setFilterDecisaoStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    {STATUS_DECISAO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data de</Label>
                <Input type="date" className="w-40" value={filterDecisaoDe} onChange={e => setFilterDecisaoDe(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data até</Label>
                <Input type="date" className="w-40" value={filterDecisaoAte} onChange={e => setFilterDecisaoAte(e.target.value)} />
              </div>
              {(filterDecisaoBusca || filterDecisaoTipo !== "Todos" || filterDecisaoStatus !== "Todos" || filterDecisaoDe || filterDecisaoAte) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterDecisaoBusca(""); setFilterDecisaoTipo("Todos"); setFilterDecisaoStatus("Todos"); setFilterDecisaoDe(""); setFilterDecisaoAte(""); }}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Relatórios</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Decisões / Acordos {decisoesFiltradas.length !== decisoes.length ? `(filtrados: ${decisoesFiltradas.length})` : ""}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => gerarPdfDecisoes(decisoesFiltradas, parcelasComStatus, `Tipo: ${filterDecisaoTipo} | Status: ${filterDecisaoStatus}${filterDecisaoDe ? ` | De: ${filterDecisaoDe}` : ""}${filterDecisaoAte ? ` | Até: ${filterDecisaoAte}` : ""}`)}>
                    <Printer className="h-4 w-4 mr-2" /> PDF — Decisões
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => gerarExcelDecisoes(decisoesFiltradas, parcelasComStatus, `Tipo: ${filterDecisaoTipo} | Status: ${filterDecisaoStatus}`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel — Decisões
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Programação de Parcelas {parcelasFiltradas.length !== parcelasComStatus.length ? `(filtrados: ${parcelasFiltradas.length})` : ""}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => gerarPdfParcelas(parcelasFiltradas, decisoes, `Status: ${filterParcelaStatus}${filterParcelaDe ? ` | De: ${filterParcelaDe}` : ""}${filterParcelaAte ? ` | Até: ${filterParcelaAte}` : ""}`)}>
                    <Printer className="h-4 w-4 mr-2" /> PDF — Parcelas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => gerarExcelParcelas(parcelasFiltradas, decisoes, `Status: ${filterParcelaStatus}`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel — Parcelas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {podeCriar && <Button onClick={() => { setDecisaoForm(emptyDecisao); setDecisaoEditId(null); setShowDecisaoForm(true); }} className="gap-2"><Plus className="h-4 w-4" /> Nova Decisão / Acordo</Button>}
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Patrono Autor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisoesFiltradas.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma decisão registrada</TableCell></TableRow>
                  )}
                  {decisoesFiltradas.map(d => {
                    const ps = parcelasComStatus.filter(x => x.decisao_id === d.id);
                    const pagas = ps.filter(p => p.status === "Pago");
                    const totalPago = pagas.reduce((s, p) => s + (p.valor_pago ?? p.valor), 0);
                    const corStatus = d.status === "Quitado" ? "bg-green-600 text-white" : d.status === "Inadimplente" ? "bg-destructive text-destructive-foreground" : d.status === "Cancelado" ? "bg-muted text-muted-foreground" : "bg-primary";
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.processo_numero}</TableCell>
                        <TableCell><Badge variant="outline">{d.tipo}</Badge></TableCell>
                        <TableCell>{d.data_decisao ? new Date(d.data_decisao + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="text-xs">{d.patrono_nome || "-"}{d.patrono_oab ? ` (${d.patrono_oab})` : ""}</TableCell>
                        <TableCell className="text-right">{fmt(d.valor_total)}</TableCell>
                        <TableCell className="text-center">{pagas.length}/{ps.length || d.qtd_parcelas}</TableCell>
                        <TableCell className="text-right text-green-600">{fmt(totalPago)}</TableCell>
                        <TableCell><Badge className={corStatus}>{d.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => setViewDecisao(d)}><Eye className="h-4 w-4" /></Button>
                            {podeEditar && <Button variant="ghost" size="icon" onClick={() => { setDecisaoForm({ ...d }); setDecisaoEditId(d.id); setShowDecisaoForm(true); }}><Edit className="h-4 w-4" /></Button>}
                            {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setDecisaoDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Programação geral de parcelas */}
            <div className="mt-6">
              <div className="flex flex-wrap items-end gap-3 mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><CalendarCheck className="h-4 w-4" /> Programação de Parcelas</h3>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filterParcelaStatus} onValueChange={setFilterParcelaStatus}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Pago">Pago</SelectItem>
                      <SelectItem value="Atrasado">Atrasado</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vencimento de</Label>
                  <Input type="date" className="w-40" value={filterParcelaDe} onChange={e => setFilterParcelaDe(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Vencimento até</Label>
                  <Input type="date" className="w-40" value={filterParcelaAte} onChange={e => setFilterParcelaAte(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Autor</Label>
                  <Input className="w-44" placeholder="Buscar autor..." value={filterParcelaAutor} onChange={e => setFilterParcelaAutor(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Advogado</Label>
                  <Input className="w-44" placeholder="Buscar advogado..." value={filterParcelaAdvogado} onChange={e => setFilterParcelaAdvogado(e.target.value)} />
                </div>
                {(filterParcelaStatus !== "Todos" || filterParcelaDe || filterParcelaAte || filterParcelaAutor || filterParcelaAdvogado) && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterParcelaStatus("Todos"); setFilterParcelaDe(""); setFilterParcelaAte(""); setFilterParcelaAutor(""); setFilterParcelaAdvogado(""); }}>
                    <X className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                )}
              </div>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>Autor</TableHead>
                      <TableHead>Advogado do Autor</TableHead>
                      <TableHead className="text-center">Parc.</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasFiltradas.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma parcela programada</TableCell></TableRow>
                    )}
                    {parcelasFiltradas.map(p => {
                      const dec = decisoes.find(d => d.id === p.decisao_id);
                      const proc = dec ? processos.find(pr => pr.id === dec.processo_id) : null;
                      const advogadoAutor = dec?.patrono_nome || proc?.advogado_autor || "-";
                      const cor = p.status === "Pago" ? "bg-green-600 text-white" : p.status === "Atrasado" ? "bg-destructive text-destructive-foreground" : p.status === "Cancelado" ? "bg-muted text-muted-foreground" : "bg-yellow-500 text-white";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs font-medium">{dec?.processo_numero || "-"}</TableCell>
                          <TableCell className="text-xs">{proc?.autor_nome || "-"}</TableCell>
                          <TableCell className="text-xs">{advogadoAutor}{dec?.patrono_oab ? ` (${dec.patrono_oab})` : ""}</TableCell>
                          <TableCell className="text-center">{p.numero}</TableCell>
                          <TableCell>{p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                          <TableCell><Badge className={cor}>{p.status}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {p.data_pagamento ? `${new Date(p.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR")} - ${fmt(p.valor_pago ?? p.valor)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {p.status !== "Pago" && p.status !== "Cancelado" && podeEditar && (
                                <Button variant="ghost" size="icon" title="Registrar pagamento" onClick={() => openPagarParcela(p)}>
                                  <CreditCard className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              {p.status !== "Pago" && p.status !== "Cancelado" && podeEditar && (
                                <Button variant="ghost" size="icon" title="Alterar parcela" onClick={() => openEditarParcela(p)}>
                                  <Edit className="h-4 w-4 text-primary" />
                                </Button>
                              )}

                              {p.status !== "Cancelado" && podeEditar && (
                                <Button variant="ghost" size="icon" title="Cancelar parcela" onClick={() => handleCancelarParcela(p)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ============ FORM DECISÃO ============ */}
        <Dialog open={showDecisaoForm} onOpenChange={v => { if (!v) { setShowDecisaoForm(false); setDecisaoEditId(null); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{decisaoEditId ? "Editar Decisão / Acordo" : "Nova Decisão / Acordo"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Dados da decisão */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dados da Decisão</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Processo *</Label>
                    <Select value={decisaoForm.processo_id} onValueChange={v => {
                      const proc = processos.find(p => p.id === v);
                      setDecisaoForm({ ...decisaoForm, processo_id: v, processo_numero: proc?.numero_processo || "", patrono_nome: proc?.advogado_autor || "", patrono_oab: (proc as any)?.advogado_autor_oab || "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o processo" /></SelectTrigger>
                      <SelectContent>
                        {processos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero_processo} - {p.autor_nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={decisaoForm.tipo} onValueChange={v => setDecisaoForm({ ...decisaoForm, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPO_DECISAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={decisaoForm.data_decisao || ""} onChange={e => setDecisaoForm({ ...decisaoForm, data_decisao: e.target.value || null })} /></div>
                  <div><Label>Juiz</Label><Input value={decisaoForm.juiz} onChange={e => setDecisaoForm({ ...decisaoForm, juiz: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={decisaoForm.status} onValueChange={v => setDecisaoForm({ ...decisaoForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_DECISAO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3"><Label>Descrição / Termos</Label><Textarea value={decisaoForm.descricao} onChange={e => setDecisaoForm({ ...decisaoForm, descricao: e.target.value })} rows={2} /></div>
                </div>
              </div>

              {/* Valores e parcelamento */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Valores e Parcelamento</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>Valor Total *</Label><Input type="number" step="0.01" value={decisaoForm.valor_total} onChange={e => setDecisaoForm({ ...decisaoForm, valor_total: Number(e.target.value) })} /></div>
                  <div><Label>Principal</Label><Input type="number" step="0.01" value={decisaoForm.valor_principal} onChange={e => setDecisaoForm({ ...decisaoForm, valor_principal: Number(e.target.value) })} /></div>
                  <div><Label>Honorários</Label><Input type="number" step="0.01" value={decisaoForm.valor_honorarios} onChange={e => setDecisaoForm({ ...decisaoForm, valor_honorarios: Number(e.target.value) })} /></div>
                  <div><Label>Custas</Label><Input type="number" step="0.01" value={decisaoForm.valor_custas} onChange={e => setDecisaoForm({ ...decisaoForm, valor_custas: Number(e.target.value) })} /></div>
                  <div>
                    <Label>Entrada / 1ª Parcela</Label>
                    <Input type="number" step="0.01" min={0} value={decisaoForm.valor_entrada} disabled={!!decisaoEditId}
                      onChange={e => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        const max = Number(decisaoForm.valor_total) || 0;
                        setDecisaoForm({ ...decisaoForm, valor_entrada: v > max ? max : v });
                      }} />
                    {decisaoForm.valor_total > 0 && decisaoForm.valor_entrada > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">{((decisaoForm.valor_entrada / decisaoForm.valor_total) * 100).toFixed(1)}% do total</p>
                    )}
                  </div>
                  <div>
                    <Label>Vencimento da Entrada</Label>
                    <Input type="date" value={decisaoForm.data_entrada || ""} disabled={!!decisaoEditId}
                      onChange={e => setDecisaoForm({ ...decisaoForm, data_entrada: e.target.value || null })} />
                  </div>
                  <div>
                    <Label>Qtd Parcelas {decisaoForm.valor_entrada > 0 ? "(após entrada)" : ""}</Label>
                    <Input type="number" min={0} max={10} value={decisaoForm.qtd_parcelas} disabled={!!decisaoEditId}
                      onChange={e => setDecisaoForm({ ...decisaoForm, qtd_parcelas: Math.max(0, Math.min(10, Number(e.target.value))) })} />
                  </div>
                  <div><Label>Primeiro Vencimento</Label><Input type="date" value={decisaoForm.primeiro_vencimento || ""} disabled={!!decisaoEditId} onChange={e => setDecisaoForm({ ...decisaoForm, primeiro_vencimento: e.target.value || null })} /></div>
                </div>
                {!decisaoEditId && decisaoForm.valor_total > 0 && decisaoForm.qtd_parcelas > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Restante de {(decisaoForm.valor_total - (decisaoForm.valor_entrada || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} dividido em {decisaoForm.qtd_parcelas}x de aprox. {((decisaoForm.valor_total - (decisaoForm.valor_entrada || 0)) / decisaoForm.qtd_parcelas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                )}
                {decisaoEditId && <p className="text-xs text-muted-foreground mt-1">Para alterar parcelas existentes, use a tabela de programação.</p>}
              </div>

              {/* Patrono */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Patrono da Causa do Autor</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2"><Label>Nome</Label><Input value={decisaoForm.patrono_nome} onChange={e => setDecisaoForm({ ...decisaoForm, patrono_nome: e.target.value })} /></div>
                  <div><Label>OAB</Label><Input value={decisaoForm.patrono_oab} onChange={e => setDecisaoForm({ ...decisaoForm, patrono_oab: e.target.value })} placeholder="UF 000000" /></div>
                  <div><Label>Telefone / WhatsApp</Label><Input value={decisaoForm.patrono_telefone} onChange={e => setDecisaoForm({ ...decisaoForm, patrono_telefone: e.target.value })} /></div>
                  <div><Label>E-mail</Label><Input type="email" value={decisaoForm.patrono_email} onChange={e => setDecisaoForm({ ...decisaoForm, patrono_email: e.target.value })} /></div>
                  <div><Label>Escritório</Label><Input value={decisaoForm.patrono_escritorio} onChange={e => setDecisaoForm({ ...decisaoForm, patrono_escritorio: e.target.value })} /></div>
                </div>
              </div>

              {/* Bancários */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dados Bancários para Pagamento</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Banco</Label><Input value={decisaoForm.banco} onChange={e => setDecisaoForm({ ...decisaoForm, banco: e.target.value })} /></div>
                  <div><Label>Agência</Label><Input value={decisaoForm.agencia} onChange={e => setDecisaoForm({ ...decisaoForm, agencia: e.target.value })} /></div>
                  <div><Label>Conta</Label><Input value={decisaoForm.conta} onChange={e => setDecisaoForm({ ...decisaoForm, conta: e.target.value })} /></div>
                  <div>
                    <Label>Tipo de Conta</Label>
                    <Select value={decisaoForm.tipo_conta} onValueChange={v => setDecisaoForm({ ...decisaoForm, tipo_conta: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPO_CONTA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo PIX</Label>
                    <Select value={decisaoForm.pix_tipo} onValueChange={v => setDecisaoForm({ ...decisaoForm, pix_tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPO_PIX.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2"><Label>Chave PIX</Label><Input value={decisaoForm.pix_chave} onChange={e => setDecisaoForm({ ...decisaoForm, pix_chave: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Titular</Label><Input value={decisaoForm.titular_nome} onChange={e => setDecisaoForm({ ...decisaoForm, titular_nome: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>CPF / CNPJ do Titular</Label><Input value={decisaoForm.titular_documento} onChange={e => setDecisaoForm({ ...decisaoForm, titular_documento: e.target.value })} /></div>
                </div>
              </div>

              <div><Label>Observações</Label><Textarea value={decisaoForm.observacoes} onChange={e => setDecisaoForm({ ...decisaoForm, observacoes: e.target.value })} rows={2} /></div>

              {/* Anexos (até 3, máx. 10MB cada) */}
              <div>
                <Label>Anexos <span className="text-xs text-muted-foreground font-normal">(até 3 arquivos de no máximo 10MB cada)</span></Label>
                <div className="mt-1 space-y-2">
                  {decisaoForm.anexos.length > 0 && (
                    <div className="space-y-1">
                      {decisaoForm.anexos.map((a, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{a.nome}</span>
                          <span className="text-xs text-muted-foreground">{(a.tamanho / 1024 / 1024).toFixed(2)} MB</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/processos-trabalhistas-anexos/${a.path}`;
                            window.open(url, "_blank");
                          }}><Download className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setDecisaoForm({ ...decisaoForm, anexos: decisaoForm.anexos.filter((_, i) => i !== idx) });
                          }}><X className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {decisaoForm.anexos.length < 3 ? (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                      <Upload className="h-4 w-4" />
                      <span>Adicionar arquivo ({decisaoForm.anexos.length}/3)</span>
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10MB)"); e.target.value = ""; return; }
                        if (decisaoForm.anexos.length >= 3) { toast.error("Limite de 3 anexos atingido"); e.target.value = ""; return; }
                        const ts = Date.now();
                        const path = `decisoes/${decisaoEditId || "novo"}/${ts}_${file.name}`;
                        toast.info("Enviando arquivo...");
                        const { error } = await supabase.storage.from("processos-trabalhistas-anexos").upload(path, file);
                        if (error) { toast.error("Erro ao enviar arquivo"); console.error(error); return; }
                        setDecisaoForm(prev => ({ ...prev, anexos: [...prev.anexos, { nome: file.name, path, tamanho: file.size }] }));
                        toast.success("Arquivo anexado");
                        e.target.value = "";
                      }} />
                    </label>
                  ) : (
                    <p className="text-xs text-muted-foreground">Limite de 3 anexos atingido. Remova um para adicionar outro.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Avisos automáticos por WhatsApp:</span> as parcelas pendentes serão notificadas no grupo cadastrado em <span className="font-medium">Empresa › WhatsApp RH</span>, sempre às <span className="font-medium">10:30h</span>, com <span className="font-medium">3 dias</span> e <span className="font-medium">1 dia</span> de antecedência do vencimento.
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowDecisaoForm(false); setDecisaoEditId(null); }}>Cancelar</Button>
              <Button onClick={handleSaveDecisao}>{decisaoEditId ? "Salvar" : "Cadastrar e Gerar Parcelas"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============ VIEW DECISÃO ============ */}
        <Dialog open={!!viewDecisao} onOpenChange={() => setViewDecisao(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {viewDecisao && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" /> {viewDecisao.tipo} - Processo {viewDecisao.processo_numero}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-bold">{fmt(viewDecisao.valor_total)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Principal</p><p className="font-bold">{fmt(viewDecisao.valor_principal)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Honorários</p><p className="font-bold">{fmt(viewDecisao.valor_honorarios)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Custas</p><p className="font-bold">{fmt(viewDecisao.valor_custas)}</p></Card>
                </div>
                {viewDecisao.descricao && (
                  <div className="mt-3"><p className="text-xs text-muted-foreground mb-1">Descrição</p><p className="text-sm bg-muted p-2 rounded">{viewDecisao.descricao}</p></div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-3">
                  <div><span className="text-muted-foreground">Juiz:</span> {viewDecisao.juiz || "-"}</div>
                  <div><span className="text-muted-foreground">Data:</span> {viewDecisao.data_decisao || "-"}</div>
                  <div><span className="text-muted-foreground">Status:</span> {viewDecisao.status}</div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Patrono do Autor</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> {viewDecisao.patrono_nome || "-"}</div>
                    <div><span className="text-muted-foreground">OAB:</span> {viewDecisao.patrono_oab || "-"}</div>
                    <div><span className="text-muted-foreground">Escritório:</span> {viewDecisao.patrono_escritorio || "-"}</div>
                    <div><span className="text-muted-foreground">Telefone:</span> {viewDecisao.patrono_telefone || "-"}</div>
                    <div><span className="text-muted-foreground">E-mail:</span> {viewDecisao.patrono_email || "-"}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dados Bancários</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Banco:</span> {viewDecisao.banco || "-"}</div>
                    <div><span className="text-muted-foreground">Agência:</span> {viewDecisao.agencia || "-"}</div>
                    <div><span className="text-muted-foreground">Conta:</span> {viewDecisao.conta || "-"} ({viewDecisao.tipo_conta})</div>
                    <div><span className="text-muted-foreground">PIX:</span> {viewDecisao.pix_chave ? `${viewDecisao.pix_tipo} - ${viewDecisao.pix_chave}` : "-"}</div>
                    <div><span className="text-muted-foreground">Titular:</span> {viewDecisao.titular_nome || "-"}</div>
                    <div><span className="text-muted-foreground">CPF/CNPJ:</span> {viewDecisao.titular_documento || "-"}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Parcelas</h4>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">#</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelasComStatus.filter(p => p.decisao_id === viewDecisao.id).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="text-center">{p.numero}</TableCell>
                            <TableCell>{p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                            <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                            <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                            <TableCell className="text-xs">{p.data_pagamento ? `${new Date(p.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR")} ${p.forma_pagamento ? `(${p.forma_pagamento})` : ""}` : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {viewDecisao.anexos && viewDecisao.anexos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-1">Anexos</p>
                    <div className="space-y-1">
                      {viewDecisao.anexos.map((a, idx) => (
                        <a key={idx} href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/processos-trabalhistas-anexos/${a.path}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-sm hover:bg-muted transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{a.nome}</span>
                          <span className="text-xs text-muted-foreground">{(a.tamanho / 1024 / 1024).toFixed(2)} MB</span>
                          <Download className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ============ ALTERAR PARCELA ============ */}
        <Dialog open={!!parcelaEditar} onOpenChange={v => { if (!v) setParcelaEditar(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Alterar Parcela {parcelaEditar?.numero}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={parcelaEditForm.valor}
                  onChange={e => setParcelaEditForm({ ...parcelaEditForm, valor: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={parcelaEditForm.data_vencimento}
                  onChange={e => setParcelaEditForm({ ...parcelaEditForm, data_vencimento: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Recalcular parcelas seguintes</Label>
                  <p className="text-xs text-muted-foreground">
                    Mantém o total em aberto do processo, redistribuindo a diferença entre as {parcelasPosteriores.length} parcela(s) seguintes.
                  </p>
                </div>
                <Switch checked={parcelaEditForm.redistribuir}
                  onCheckedChange={v => setParcelaEditForm({ ...parcelaEditForm, redistribuir: v })} />
              </div>
              {parcelaEditForm.redistribuir && parcelasPosteriores.length === 0 && (
                <p className="md:col-span-2 text-xs text-muted-foreground">Não há parcelas em aberto posteriores para recalcular.</p>
              )}
              {previewRecalculo && (
                <div className="md:col-span-2 rounded-md border p-3 text-xs space-y-1 max-h-48 overflow-auto">
                  <p className="font-semibold">Prévia do recálculo</p>
                  {previewRecalculo.map(r => (
                    <div key={r.parcela.id} className="flex justify-between">
                      <span>Parcela {r.parcela.numero} — {r.parcela.data_vencimento ? new Date(r.parcela.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</span>
                      <span className="text-muted-foreground">{fmt(r.parcela.valor)} → <span className="font-medium text-foreground">{fmt(r.novoValor)}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {parcelaEditForm.redistribuir && parcelasPosteriores.length > 0 && !previewRecalculo && (
                <p className="md:col-span-2 text-xs text-destructive">Valor informado excede o saldo em aberto das parcelas seguintes.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setParcelaEditar(null)}>Cancelar</Button>
              <Button onClick={handleSalvarParcela}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ============ REGISTRAR PAGAMENTO ============ */}
        <Dialog open={!!parcelaPagar} onOpenChange={() => setParcelaPagar(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Pagamento - Parcela {parcelaPagar?.numero}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Data do Pagamento *</Label><Input type="date" value={pagamentoForm.data_pagamento} onChange={e => setPagamentoForm({ ...pagamentoForm, data_pagamento: e.target.value })} /></div>
              <div><Label>Valor Pago *</Label><Input type="number" step="0.01" value={pagamentoForm.valor_pago} onChange={e => setPagamentoForm({ ...pagamentoForm, valor_pago: Number(e.target.value) })} /></div>
              <div className="md:col-span-2">
                <Label>Forma</Label>
                <Select value={pagamentoForm.forma_pagamento} onValueChange={v => setPagamentoForm({ ...pagamentoForm, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="TED">TED</SelectItem>
                    <SelectItem value="DOC">DOC</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Anexar Comprovante</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Arquivo muito grande (máx. 10MB)");
                      e.target.value = "";
                      return;
                    }
                    try {
                      const path = `comprovantes/${parcelaPagar?.id || "tmp"}/${Date.now()}_${file.name}`;
                      const { error: upErr } = await supabase.storage.from("processos-trabalhistas-anexos").upload(path, file, { upsert: false });
                      if (upErr) throw upErr;
                      const { data: pub } = supabase.storage.from("processos-trabalhistas-anexos").getPublicUrl(path);
                      setPagamentoForm({ ...pagamentoForm, comprovante_url: pub.publicUrl });
                      toast.success("Comprovante anexado");
                    } catch (err: any) {
                      toast.error("Erro ao anexar: " + err.message);
                    }
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>URL do Comprovante</Label>
                <Input value={pagamentoForm.comprovante_url} onChange={e => setPagamentoForm({ ...pagamentoForm, comprovante_url: e.target.value })} placeholder="Link/URL do recibo (preenchido ao anexar)" />
                {pagamentoForm.comprovante_url && (
                  <a href={pagamentoForm.comprovante_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                    Visualizar comprovante
                  </a>
                )}
              </div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={pagamentoForm.observacoes} onChange={e => setPagamentoForm({ ...pagamentoForm, observacoes: e.target.value })} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setParcelaPagar(null)}>Cancelar</Button>
              <Button onClick={handleConfirmarPagamento} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete decisão */}
        {/* Confirmação de senha para gravar Decisão/Acordo */}
        <Dialog open={showSenhaConfirm} onOpenChange={(v) => { if (!v) { setShowSenhaConfirm(false); setSenhaConfirm(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><LockIcon className="h-5 w-5 text-primary" /> Confirmação de Segurança</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Para registrar esta <strong>Decisão / Acordo</strong> e gerar as parcelas no módulo financeiro, confirme sua senha de acesso.</p>
              <div className="bg-muted/50 border rounded p-3 text-xs">
                <p><strong>Usuário:</strong> {usuarioLogado?.nome}</p>
                <p><strong>E-mail:</strong> {usuarioLogado?.email}</p>
              </div>
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={senhaConfirm}
                  onChange={e => setSenhaConfirm(e.target.value)}
                  placeholder="Digite sua senha"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && senhaConfirm && !validandoSenha && executarSaveDecisao()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowSenhaConfirm(false); setSenhaConfirm(""); }} disabled={validandoSenha}>Cancelar</Button>
              <Button onClick={executarSaveDecisao} disabled={!senhaConfirm || validandoSenha}>
                {validandoSenha ? "Validando..." : "Confirmar e Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!decisaoDeleteId} onOpenChange={() => setDecisaoDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir decisão / acordo?</AlertDialogTitle>
              <AlertDialogDescription>Todas as parcelas vinculadas serão removidas. Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDecisaoDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteDecisao}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* ============ FORM PROCESSO ============ */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar Processo" : "Novo Processo Trabalhista"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nº Processo *</Label><Input value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} placeholder="0000000-00.0000.0.00.0000" /></div>
              <div><Label>Autor / Reclamante *</Label><Input value={form.autor_nome} onChange={e => setForm({ ...form, autor_nome: e.target.value })} /></div>
              <div><Label>CPF do Autor</Label><Input value={form.autor_cpf} onChange={e => setForm({ ...form, autor_cpf: e.target.value })} /></div>
              <div><Label>Vara</Label><Input value={form.vara} onChange={e => setForm({ ...form, vara: e.target.value })} /></div>
              <div><Label>Comarca</Label><Input value={form.comarca} onChange={e => setForm({ ...form, comarca: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} /></div>
              <div><Label>Data Distribuição</Label><Input type="date" value={form.data_distribuicao || ""} onChange={e => setForm({ ...form, data_distribuicao: e.target.value || null })} /></div>
              <div>
                <Label>Centro de Custo (Cliente)</Label>
                <Select value={form.cliente_id} onValueChange={v => { const c = clientes.find(x => x.id === v); setForm({ ...form, cliente_id: v, cliente_nome: c?.nome || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.filter(c => c.tipo === "Cliente").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Advogado do Autor</Label><Input value={form.advogado_autor} onChange={e => setForm({ ...form, advogado_autor: e.target.value })} /></div>
              {form.advogado_autor?.trim() && (
                <div><Label>OAB do Advogado do Autor</Label><Input value={(form as any).advogado_autor_oab || ""} onChange={e => setForm({ ...form, advogado_autor_oab: e.target.value } as any)} placeholder="Ex: RJ-123456" /></div>
              )}
              <div className="md:col-span-2">
                <Label>Advogados da Empresa</Label>
                <Select
                  value=""
                  onValueChange={v => {
                    const atuais = form.advogados_empresa || [];
                    if (atuais.includes(v)) { toast.info("Advogado já adicionado."); return; }
                    setForm({ ...form, advogados_empresa: [...atuais, v], advogado_empresa: form.advogado_empresa || v });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione para adicionar" /></SelectTrigger>
                  <SelectContent>
                    {contatos.filter(c => c.tipo === "Advogado" && c.ativo && !(form.advogados_empresa || []).includes(c.nome)).map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}{c.oab ? ` (OAB ${c.oab})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(form.advogados_empresa || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(form.advogados_empresa || []).map(nome => (
                      <Badge key={nome} variant="secondary" className="gap-1">
                        {nome}
                        <button
                          type="button"
                          onClick={() => {
                            const rest = (form.advogados_empresa || []).filter(n => n !== nome);
                            setForm({ ...form, advogados_empresa: rest, advogado_empresa: rest[0] || "" });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Preposto da Empresa</Label>
                <Select value={form.preposto || ""} onValueChange={v => setForm({ ...form, preposto: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {contatos.filter(c => c.tipo === "Preposto" && c.ativo).map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}{c.cpf ? ` (${c.cpf})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Objeto da Ação</Label><Textarea value={form.objeto_acao} onChange={e => setForm({ ...form, objeto_acao: e.target.value })} rows={2} /></div>
              <div><Label>Valor da Causa</Label><Input type="number" step="0.01" value={form.valor_causa} onChange={e => setForm({ ...form, valor_causa: Number(e.target.value) })} /></div>
              <div><Label>Provisão Contábil</Label><Input type="number" step="0.01" value={form.provisao_contabil} onChange={e => setForm({ ...form, provisao_contabil: Number(e.target.value) })} /></div>
              <div><Label>Valor Acordo</Label><Input type="number" step="0.01" value={form.valor_acordo} onChange={e => setForm({ ...form, valor_acordo: Number(e.target.value) })} /></div>
              <div><Label>Valor Condenação</Label><Input type="number" step="0.01" value={form.valor_condenacao} onChange={e => setForm({ ...form, valor_condenacao: Number(e.target.value) })} /></div>
              <div><Label>Honorários</Label><Input type="number" step="0.01" value={form.honorarios} onChange={e => setForm({ ...form, honorarios: Number(e.target.value) })} /></div>
              <div>
                <Label>Risco</Label>
                <Select value={form.risco} onValueChange={v => setForm({ ...form, risco: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RISCO_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fase Processual</Label>
                <Select value={form.fase_processual} onValueChange={v => setForm({ ...form, fase_processual: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FASE_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
              {/* Anexos */}
              <div className="md:col-span-2">
                <Label>Anexos</Label>
                <div className="mt-1 space-y-2">
                  {form.anexos.length > 0 && (
                    <div className="space-y-1">
                      {form.anexos.map((a: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{a.nome}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/processos-trabalhistas-anexos/${a.path}`;
                            window.open(url, "_blank");
                          }}><Download className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setForm({ ...form, anexos: form.anexos.filter((_: any, i: number) => i !== idx) });
                          }}><X className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                    <Upload className="h-4 w-4" />
                    <span>Adicionar arquivo</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10MB)"); return; }
                      const ts = Date.now();
                      const path = `${editId || "novo"}/${ts}_${file.name}`;
                      toast.info("Enviando arquivo...");
                      const { error } = await supabase.storage.from("processos-trabalhistas-anexos").upload(path, file);
                      if (error) { toast.error("Erro ao enviar arquivo"); console.error(error); return; }
                      setForm(prev => ({ ...prev, anexos: [...prev.anexos, { nome: file.name, path, tamanho: file.size }] }));
                      toast.success("Arquivo anexado");
                      e.target.value = "";
                    }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============ FORM AUDIÊNCIA ============ */}
        <Dialog open={showAudForm} onOpenChange={v => { if (!v) { setShowAudForm(false); setAudEditId(null); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{audEditId ? "Editar Audiência" : "Nova Audiência"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Processo *</Label>
                <Select value={audForm.processo_id} onValueChange={v => {
                  const proc = processos.find(p => p.id === v);
                  setAudForm({ ...audForm, processo_id: v, processo_numero: proc?.numero_processo || "", vara: proc?.vara || audForm.vara });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o processo" /></SelectTrigger>
                  <SelectContent>
                    {processos.filter(p => p.status === "Ativo" || p.status === "Recurso").map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.numero_processo} - {p.autor_nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data *</Label><Input type="date" value={audForm.data_audiencia} onChange={e => setAudForm({ ...audForm, data_audiencia: e.target.value })} /></div>
              <div><Label>Hora</Label><Input type="time" value={audForm.hora} onChange={e => setAudForm({ ...audForm, hora: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={audForm.tipo} onValueChange={v => setAudForm({ ...audForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPO_AUDIENCIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={audForm.status} onValueChange={v => setAudForm({ ...audForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agendada">Agendada</SelectItem>
                    <SelectItem value="Realizada">Realizada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                    <SelectItem value="Adiada">Adiada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Local</Label><Input value={audForm.local} onChange={e => setAudForm({ ...audForm, local: e.target.value })} /></div>
              <div><Label>Vara</Label><Input value={audForm.vara} onChange={e => setAudForm({ ...audForm, vara: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={audForm.observacoes} onChange={e => setAudForm({ ...audForm, observacoes: e.target.value })} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowAudForm(false); setAudEditId(null); }}>Cancelar</Button>
              <Button onClick={handleSaveAudiencia}>{audEditId ? "Salvar" : "Agendar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============ FORM CONTATO ============ */}
        <Dialog open={showContatoForm} onOpenChange={v => { if (!v) { setShowContatoForm(false); setContatoEditId(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{contatoEditId ? "Editar Contato" : "Novo Contato"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label>Nome *</Label><Input value={contatoForm.nome} onChange={e => setContatoForm({ ...contatoForm, nome: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={contatoForm.tipo} onValueChange={v => setContatoForm({ ...contatoForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPO_CONTATO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>WhatsApp *</Label><Input value={contatoForm.telefone_whatsapp} onChange={e => setContatoForm({ ...contatoForm, telefone_whatsapp: e.target.value })} placeholder="+55 11 99999-9999" /></div>
              <div><Label>E-mail</Label><Input type="email" value={contatoForm.email} onChange={e => setContatoForm({ ...contatoForm, email: e.target.value })} /></div>
              {contatoForm.tipo === "Advogado" && (
                <div><Label>OAB</Label><Input value={contatoForm.oab} onChange={e => setContatoForm({ ...contatoForm, oab: e.target.value })} placeholder="UF 000000" /></div>
              )}
              {contatoForm.tipo === "Contador" && (
                <div><Label>CRC</Label><Input value={contatoForm.crc} onChange={e => setContatoForm({ ...contatoForm, crc: e.target.value })} /></div>
              )}
              {contatoForm.tipo === "Preposto" && (
                <div><Label>CPF *</Label><Input value={contatoForm.cpf} onChange={e => setContatoForm({ ...contatoForm, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={contatoForm.ativo} onCheckedChange={v => setContatoForm({ ...contatoForm, ativo: v })} />
                <Label>Ativo (receber notificações)</Label>
              </div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={contatoForm.observacoes} onChange={e => setContatoForm({ ...contatoForm, observacoes: e.target.value })} rows={2} /></div>
            </div>
            <div className="flex justify-between items-center mt-4">
              {contatoEditId ? (
                <Button variant="outline" size="sm" onClick={async () => {
                  toast.info("Enviando mensagem de teste...");
                  try {
                    const { data, error } = await supabase.functions.invoke('check-audiencias-vencimento');
                    if (error) throw error;
                    toast.success(`Teste concluído: ${data?.enviados ?? 0} mensagem(ns) enviada(s)`);
                  } catch (err: any) {
                    toast.error("Erro: " + (err.message || "Erro desconhecido"));
                  }
                }} className="gap-2"><Send className="h-4 w-4" /> Testar Envio</Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowContatoForm(false); setContatoEditId(null); }}>Cancelar</Button>
                <Button onClick={handleSaveContato}>{contatoEditId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============ VIEW PROCESSO ============ */}
        <Dialog open={!!viewProcesso} onOpenChange={() => setViewProcesso(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {viewProcesso && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" /> Processo {viewProcesso.numero_processo}
                    <span className="ml-2">{statusBadge(viewProcesso.status)}</span>
                    <span>{riscoBadge(viewProcesso.risco)}</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Autor:</span> <strong>{viewProcesso.autor_nome}</strong></div>
                  <div><span className="text-muted-foreground">CPF:</span> {viewProcesso.autor_cpf || "-"}</div>
                  <div><span className="text-muted-foreground">Vara:</span> {viewProcesso.vara || "-"}</div>
                  <div><span className="text-muted-foreground">Comarca:</span> {viewProcesso.comarca || "-"}</div>
                  <div><span className="text-muted-foreground">Estado:</span> {viewProcesso.estado || "-"}</div>
                  <div><span className="text-muted-foreground">Distribuição:</span> {viewProcesso.data_distribuicao || "-"}</div>
                  <div><span className="text-muted-foreground">Adv. Autor:</span> {viewProcesso.advogado_autor || "-"}</div>
                  <div><span className="text-muted-foreground">Adv. Empresa:</span> {(viewProcesso.advogados_empresa?.length ? viewProcesso.advogados_empresa.join(", ") : viewProcesso.advogado_empresa) || "-"}</div>
                  <div><span className="text-muted-foreground">Preposto:</span> {viewProcesso.preposto || "-"}</div>
                  <div><span className="text-muted-foreground">Fase:</span> {viewProcesso.fase_processual}</div>
                  <div><span className="text-muted-foreground">Centro de Custo:</span> {viewProcesso.cliente_nome || "-"}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Valor Causa</p><p className="font-bold">{fmt(viewProcesso.valor_causa)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Provisão</p><p className="font-bold">{fmt(viewProcesso.provisao_contabil)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Acordo</p><p className="font-bold">{fmt(viewProcesso.valor_acordo)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Condenação</p><p className="font-bold">{fmt(viewProcesso.valor_condenacao)}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Honorários</p><p className="font-bold">{fmt(viewProcesso.honorarios)}</p></Card>
                </div>

                {viewProcesso.objeto_acao && (
                  <div className="mt-3"><p className="text-xs text-muted-foreground mb-1">Objeto da Ação</p><p className="text-sm bg-muted p-2 rounded">{viewProcesso.objeto_acao}</p></div>
                )}
                {viewProcesso.observacoes && (
                  <div className="mt-2"><p className="text-xs text-muted-foreground mb-1">Observações</p><p className="text-sm bg-muted p-2 rounded">{viewProcesso.observacoes}</p></div>
                )}

                {viewProcesso.anexos && viewProcesso.anexos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Anexos</p>
                    <div className="space-y-1">
                      {viewProcesso.anexos.map((a: any, idx: number) => (
                        <a key={idx} href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/processos-trabalhistas-anexos/${a.path}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-sm hover:bg-muted transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate text-primary underline">{a.nome}</span>
                          <Download className="h-3 w-3 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm flex items-center gap-1"><Calendar className="h-4 w-4" /> Andamentos</h3>
                    {podeEditar && <Button size="sm" onClick={() => setShowAndamentoForm(true)} className="gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>}
                  </div>

                  {showAndamentoForm && (
                    <Card className="p-3 mb-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select value={andForm.tipo} onValueChange={v => setAndForm({ ...andForm, tipo: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPO_ANDAMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Data</Label><Input type="date" className="h-8" value={andForm.data_andamento || ""} onChange={e => setAndForm({ ...andForm, data_andamento: e.target.value })} /></div>
                        <div><Label className="text-xs">Responsável</Label><Input className="h-8" value={andForm.responsavel} onChange={e => setAndForm({ ...andForm, responsavel: e.target.value })} /></div>
                        <div><Label className="text-xs">Prazo Limite</Label><Input type="date" className="h-8" value={andForm.prazo_limite || ""} onChange={e => setAndForm({ ...andForm, prazo_limite: e.target.value || null })} /></div>
                        <div>
                          <Label className="text-xs">Status Prazo</Label>
                          <Select value={andForm.status_prazo} onValueChange={v => setAndForm({ ...andForm, status_prazo: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Cumprido">Cumprido</SelectItem>
                              <SelectItem value="Vencido">Vencido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-full"><Label className="text-xs">Descrição *</Label><Textarea value={andForm.descricao} onChange={e => setAndForm({ ...andForm, descricao: e.target.value })} rows={2} /></div>
                      </div>
                      <div className="flex gap-2 mt-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowAndamentoForm(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleAddAndamento}>Salvar</Button>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {andamentos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum andamento registrado</p>}
                    {andamentos.map(a => (
                      <div key={a.id} className="flex items-start gap-3 p-2 rounded border text-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{a.tipo}</Badge>
                            <span className="text-xs text-muted-foreground">{a.data_andamento || ""}</span>
                            {a.prazo_limite && (
                              <span className={`text-xs ${a.status_prazo === "Vencido" ? "text-destructive font-medium" : a.status_prazo === "Cumprido" ? "text-green-600" : "text-yellow-600"}`}>
                                Prazo: {a.prazo_limite} ({a.status_prazo})
                              </span>
                            )}
                          </div>
                          <p>{a.descricao}</p>
                          {a.responsavel && <p className="text-xs text-muted-foreground mt-1">Responsável: {a.responsavel}</p>}
                        </div>
                        {podeEditar && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { deleteAndamento(a.id); toast.success("Andamento removido"); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete processo */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O processo e todos os seus andamentos serão removidos permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; } if (deleteId) { deleteProcesso(deleteId); toast.success("Processo removido"); setDeleteId(null); } }}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete audiência */}
        <AlertDialog open={!!audDeleteId} onOpenChange={() => setAudDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir audiência?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setAudDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteAudiencia}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete contato */}
        <AlertDialog open={!!contatoDeleteId} onOpenChange={() => setContatoDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
              <AlertDialogDescription>Este contato não receberá mais notificações de audiências.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setContatoDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteContato}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
