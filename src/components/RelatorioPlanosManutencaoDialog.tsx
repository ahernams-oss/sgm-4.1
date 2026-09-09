import { useMemo, useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { PlanoManutencao, PlanoAtividade, PlanoExecucao } from "@/contexts/PlanosManutencaoContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

type TipoRelatorio = "planos" | "atividades" | "execucoes" | "conformidade" | "checklists" | "vencimentos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  planos: PlanoManutencao[];
  atividades: PlanoAtividade[];
  execucoes: PlanoExecucao[];
}

const TIPOS: { value: TipoRelatorio; label: string; desc: string }[] = [
  { value: "planos", label: "Planos de Manutenção", desc: "Lista geral de planos cadastrados com cliente, vigência e status." },
  { value: "atividades", label: "Atividades por Plano", desc: "Detalhamento das atividades vinculadas a cada plano (tipo, periodicidade, prioridade)." },
  { value: "execucoes", label: "Histórico de Execuções", desc: "Registro de execuções realizadas com data, responsável e conformidade." },
  { value: "conformidade", label: "Conformidade dos Planos", desc: "Indicadores de conformidade (% de atividades executadas) por plano." },
  { value: "checklists", label: "Checklists das Atividades", desc: "Lista completa dos itens de checklist por atividade." },
  { value: "vencimentos", label: "Próximos Vencimentos", desc: "Atividades com data de próxima execução em janela definida." },
];

const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";
const fmtDataHora = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "-";

function addHeader(doc: jsPDF, titulo: string, subtitulo?: string, filtros?: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (subtitulo) doc.text(subtitulo, 14, 20);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 12, { align: "right" });
  if (filtros) doc.text(filtros, pw - 14, 20, { align: "right" });
  doc.setTextColor(30, 30, 30);
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
  }
}

export default function RelatorioPlanosManutencaoDialog({ open, onOpenChange, planos, atividades, execucoes }: Props) {
  const [tipo, setTipo] = useState<TipoRelatorio>("planos");
  const [escopo, setEscopo] = useState<"todos" | "cliente" | "plano">("todos");
  const [clienteSel, setClienteSel] = useState<string>("");
  const [planoSel, setPlanoSel] = useState<string>("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [janelaDias, setJanelaDias] = useState<number>(30);

  const clientesUnicos = useMemo(() => {
    const m = new Map<string, string>();
    planos.forEach(p => { if (p.cliente_id) m.set(p.cliente_id, p.cliente_nome); });
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [planos]);

  const planosFiltrados = useMemo(() => {
    let res = planos;
    if (escopo === "cliente" && clienteSel) res = res.filter(p => p.cliente_id === clienteSel);
    if (escopo === "plano" && planoSel) res = res.filter(p => p.id === planoSel);
    if (statusFiltro !== "todos") res = res.filter(p => p.status === statusFiltro);
    return res;
  }, [planos, escopo, clienteSel, planoSel, statusFiltro]);

  const atividadesFiltradas = useMemo(() => {
    const ids = new Set(planosFiltrados.map(p => p.id));
    return atividades.filter(a => ids.has(a.plano_id));
  }, [atividades, planosFiltrados]);

  const execucoesFiltradas = useMemo(() => {
    const ids = new Set(planosFiltrados.map(p => p.id));
    let res = execucoes.filter(e => ids.has(e.plano_id));
    if (dataInicio) res = res.filter(e => e.data_execucao >= dataInicio);
    if (dataFim) res = res.filter(e => e.data_execucao <= dataFim);
    return res;
  }, [execucoes, planosFiltrados, dataInicio, dataFim]);

  const filtrosLabel = useMemo(() => {
    const parts: string[] = [];
    if (escopo === "cliente" && clienteSel) parts.push(`Cliente: ${clientesUnicos.find(c => c.id === clienteSel)?.nome}`);
    if (escopo === "plano" && planoSel) parts.push(`Plano: ${planos.find(p => p.id === planoSel)?.titulo}`);
    if (statusFiltro !== "todos") parts.push(`Status: ${statusFiltro}`);
    if (dataInicio) parts.push(`De: ${fmtData(dataInicio)}`);
    if (dataFim) parts.push(`Até: ${fmtData(dataFim)}`);
    return parts.join(" | ");
  }, [escopo, clienteSel, planoSel, statusFiltro, dataInicio, dataFim, clientesUnicos, planos]);

  const buildData = (): { titulo: string; columns: string[]; rows: string[][]; orientation: "p" | "l" } => {
    if (tipo === "planos") {
      const rows = planosFiltrados.map(p => {
        const ats = atividades.filter(a => a.plano_id === p.id);
        const exec = ats.filter(a => a.ultima_execucao).length;
        const conf = ats.length === 0 ? 0 : Math.round((exec / ats.length) * 100);
        return [
          p.titulo, p.cliente_nome, p.contrato || "-",
          fmtData(p.vigencia_inicio), fmtData(p.vigencia_fim),
          p.responsavel_tecnico_nome || "-",
          String(ats.length), `${conf}%`, p.status,
        ];
      });
      const totAtv = rows.reduce((s, r) => s + (Number(r[6]) || 0), 0);
      const mediaConf = rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + parseInt(r[7]), 0) / rows.length);
      rows.push(["TOTAL", `${rows.length} plano(s)`, "", "", "", "", String(totAtv), `${mediaConf}% (média)`, ""]);
      return {
        titulo: "Relatório de Planos de Manutenção",
        columns: ["Título", "Cliente", "Contrato", "Início", "Fim", "Resp. Técnico", "Atividades", "Conform.", "Status"],
        rows, orientation: "l",
      };
    }
    if (tipo === "atividades") {
      const planoMap = new Map(planos.map(p => [p.id, p]));
      const rows = atividadesFiltradas.map(a => {
        const p = planoMap.get(a.plano_id);
        return [
          p?.titulo || "-", p?.cliente_nome || "-",
          a.descricao, a.equipamento_nome || "-",
          a.tipo || "-", a.periodicidade || "-", a.prioridade || "-",
          a.responsavel || "-", fmtData(a.ultima_execucao), fmtData(a.proxima_execucao), a.status || "-",
        ];
      });
      rows.push(["", "", "", "", "", "", "", "", "", "", `TOTAL: ${rows.length} atividade(s)`]);
      return {
        titulo: "Relatório de Atividades dos Planos",
        columns: ["Plano", "Cliente", "Descrição", "Equipamento", "Tipo", "Periodicidade", "Prioridade", "Responsável", "Últ. Execução", "Próx. Execução", "Status"],
        rows, orientation: "l",
      };
    }
    if (tipo === "execucoes") {
      const planoMap = new Map(planos.map(p => [p.id, p]));
      const atvMap = new Map(atividades.map(a => [a.id, a]));
      const rows = execucoesFiltradas.map(e => {
        const p = planoMap.get(e.plano_id);
        const a = atvMap.get(e.atividade_id);
        return [
          fmtData(e.data_execucao), p?.titulo || "-", p?.cliente_nome || "-",
          a?.descricao || "-", e.responsavel || "-",
          `${e.percentual_conformidade ?? 0}%`,
          e.os_numero ? String(e.os_numero) : "-",
          e.observacoes || "-",
        ];
      });
      const mediaConfExec = rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + parseInt(r[5]), 0) / rows.length);
      rows.push(["", "", "", "", `TOTAL: ${rows.length} execução(ões)`, `${mediaConfExec}% (média)`, "", ""]);
      return {
        titulo: "Histórico de Execuções",
        columns: ["Data", "Plano", "Cliente", "Atividade", "Responsável", "Conform.", "Nº OS", "Observações"],
        rows, orientation: "l",
      };
    }
    if (tipo === "conformidade") {
      const rows = planosFiltrados.map(p => {
        const ats = atividades.filter(a => a.plano_id === p.id);
        const total = ats.length;
        const exec = ats.filter(a => a.ultima_execucao).length;
        const atrasadas = ats.filter(a => a.proxima_execucao && a.proxima_execucao < new Date().toISOString().slice(0, 10)).length;
        const pendentes = total - exec;
        const conf = total === 0 ? 0 : Math.round((exec / total) * 100);
        return [
          p.titulo, p.cliente_nome, p.status,
          String(total), String(exec), String(pendentes), String(atrasadas), `${conf}%`,
        ];
      });
      const sumIdx = (i: number) => rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);
      const tTot = sumIdx(3), tExec = sumIdx(4), tPend = sumIdx(5), tAtr = sumIdx(6);
      const confGeral = tTot === 0 ? 0 : Math.round((tExec / tTot) * 100);
      rows.push(["TOTAL", `${rows.length} plano(s)`, "", String(tTot), String(tExec), String(tPend), String(tAtr), `${confGeral}%`]);
      return {
        titulo: "Relatório de Conformidade",
        columns: ["Plano", "Cliente", "Status", "Total Atv.", "Executadas", "Pendentes", "Atrasadas", "Conform."],
        rows, orientation: "l",
      };
    }
    if (tipo === "checklists") {
      const planoMap = new Map(planos.map(p => [p.id, p]));
      const rows: string[][] = [];
      atividadesFiltradas.forEach(a => {
        const p = planoMap.get(a.plano_id);
        const checklist = a.checklist || [];
        if (checklist.length === 0) {
          rows.push([p?.titulo || "-", a.descricao, "(sem itens)", ""]);
        } else {
          checklist.forEach((it, i) => {
            rows.push([p?.titulo || "-", a.descricao, `${i + 1}. ${it.descricao}`, it.obrigatorio ? "Sim" : "Não"]);
          });
        }
      });
      rows.push(["", "", `TOTAL: ${rows.length} item(ns)`, ""]);
      return {
        titulo: "Checklists das Atividades",
        columns: ["Plano", "Atividade", "Item de Checklist", "Obrigatório"],
        rows, orientation: "p",
      };
    }
    // vencimentos
    const planoMap = new Map(planos.map(p => [p.id, p]));
    const hoje = new Date();
    const limite = new Date(); limite.setDate(limite.getDate() + janelaDias);
    const limiteStr = limite.toISOString().slice(0, 10);
    const hojeStr = hoje.toISOString().slice(0, 10);
    const rows = atividadesFiltradas
      .filter(a => a.proxima_execucao && a.proxima_execucao <= limiteStr)
      .sort((a, b) => (a.proxima_execucao || "").localeCompare(b.proxima_execucao || ""))
      .map(a => {
        const p = planoMap.get(a.plano_id);
        const status = a.proxima_execucao && a.proxima_execucao < hojeStr ? "ATRASADA" : "A vencer";
        return [
          fmtData(a.proxima_execucao), status, p?.titulo || "-", p?.cliente_nome || "-",
          a.descricao, a.equipamento_nome || "-", a.periodicidade || "-", a.responsavel || "-",
        ];
      });
    const atrasadasTot = rows.filter(r => r[1] === "ATRASADA").length;
    const aVencerTot = rows.filter(r => r[1] === "A vencer").length;
    rows.push(["TOTAL", `${atrasadasTot} atrasada(s) / ${aVencerTot} a vencer`, `${rows.length} atividade(s)`, "", "", "", "", ""]);
    return {
      titulo: `Próximos Vencimentos (${janelaDias} dias)`,
      columns: ["Próx. Execução", "Situação", "Plano", "Cliente", "Atividade", "Equipamento", "Periodicidade", "Responsável"],
      rows, orientation: "l",
    };
  };

  const exportar = async (formato: "pdf" | "excel") => {
    const { titulo, columns, rows, orientation } = buildData();
    if (rows.length === 0) { toast.error("Nenhum dado para exportar com os filtros selecionados."); return; }

    if (formato === "pdf") {
      const doc = new (await getJsPDF())({ compress: true, orientation });
      addHeader(doc, titulo, `Total: ${rows.length} registro(s)`, filtrosLabel);
      (await getAutoTable())(doc, {
        startY: 34,
        head: [columns],
        body: rows,
        styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      addFooter(doc);
      doc.save(`${titulo.replace(/\s+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF gerado!");
    } else {
      const data = rows.map(r => {
        const o: Record<string, string> = {};
        columns.forEach((c, i) => { o[c] = r[i] || ""; });
        return o;
      });
      const ws = (await getXLSX()).utils.json_to_sheet(data);
      ws["!cols"] = columns.map(() => ({ wch: 20 }));
      const wb = (await getXLSX()).utils.book_new();
      (await getXLSX()).utils.book_append_sheet(wb, ws, titulo.substring(0, 31));
      (await getXLSX()).writeFile(wb, `${titulo.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
      toast.success("Excel gerado!");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatórios — Planos de Manutenção</DialogTitle>
          <DialogDescription>Selecione o tipo de relatório, aplique filtros e exporte em PDF ou Excel.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Tipo de relatório</Label>
            <ScrollArea className="h-48 border rounded-md p-3">
              <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)} className="space-y-2">
                {TIPOS.map(t => (
                  <div key={t.value} className="flex items-start gap-2">
                    <RadioGroupItem value={t.value} id={`t-${t.value}`} className="mt-1" />
                    <Label htmlFor={`t-${t.value}`} className="font-normal cursor-pointer flex-1">
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Escopo</Label>
              <Select value={escopo} onValueChange={(v) => setEscopo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os planos</SelectItem>
                  <SelectItem value="cliente">Por cliente</SelectItem>
                  <SelectItem value="plano">Plano específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {escopo === "cliente" && (
              <div>
                <Label className="text-sm">Cliente</Label>
                <Select value={clienteSel} onValueChange={setClienteSel}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clientesUnicos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {escopo === "plano" && (
              <div>
                <Label className="text-sm">Plano</Label>
                <Select value={planoSel} onValueChange={setPlanoSel}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {planos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm">Status do Plano</Label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "execucoes" && (
              <>
                <div>
                  <Label className="text-sm">Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </>
            )}

            {tipo === "vencimentos" && (
              <div>
                <Label className="text-sm">Janela (dias)</Label>
                <Input type="number" min={1} value={janelaDias} onChange={e => setJanelaDias(Number(e.target.value) || 30)} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => exportar("excel")} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={() => exportar("pdf")} className="gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
