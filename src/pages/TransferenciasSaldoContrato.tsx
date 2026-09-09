import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, type Contrato } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeftRight, Eye, Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { addHeader, addFooter } from "@/lib/gerarRelatorioEstoque";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

type TipoSaldo = "maoDeObraMensal" | "maoDeObraAnual" | "maoDeObraContratual" | "valorVariavel";

const TIPO_LABEL: Record<TipoSaldo, string> = {
  maoDeObraMensal: "Mão de Obra Mensal",
  maoDeObraAnual: "Mão de Obra Anual",
  maoDeObraContratual: "Mão de Obra Contratual",
  valorVariavel: "Valor Variável (valorBase)",
};

const CAMPO_CONTRATO: Record<TipoSaldo, keyof Contrato> = {
  maoDeObraMensal: "maoDeObraMensal",
  maoDeObraAnual: "maoDeObraAnual",
  maoDeObraContratual: "maoDeObraContratual",
  valorVariavel: "valorBase",
};

const parseBR = (v?: string | number | null): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const fmtBR = (n: number) => (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface HistoricoRow {
  id: string;
  data: string;
  tipo_saldo: TipoSaldo;
  valor: number;
  cliente_origem_nome: string | null;
  contrato_origem_numero: string | null;
  saldo_origem_antes: number | null;
  saldo_origem_depois: number | null;
  cliente_destino_nome: string | null;
  contrato_destino_numero: string | null;
  saldo_destino_antes: number | null;
  saldo_destino_depois: number | null;
  motivo: string | null;
  usuario_nome: string | null;
  created_at: string;
}

export default function TransferenciasSaldoContrato() {
  const { clientes } = useClientes();
  const qc = useQueryClient();
  const { usuarioLogado, temAcessoTotal } = useAuth();
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openNova, setOpenNova] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const detalhe = useMemo(() => historico.find(h => h.id === detalheId), [historico, detalheId]);

  const loadHistorico = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_transferencias_saldo")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar histórico: " + error.message);
    setHistorico((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadHistorico(); }, []);

  // Form
  const [clienteOrigemId, setClienteOrigemId] = useState("");
  const [contratoOrigemId, setContratoOrigemId] = useState("");
  const [clienteDestinoId, setClienteDestinoId] = useState("");
  const [contratoDestinoId, setContratoDestinoId] = useState("");
  const [tipoSaldo, setTipoSaldo] = useState<TipoSaldo>("maoDeObraMensal");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const clienteOrigem = useMemo(() => clientes.find(c => c.id === clienteOrigemId), [clientes, clienteOrigemId]);
  const clienteDestino = useMemo(() => clientes.find(c => c.id === clienteDestinoId), [clientes, clienteDestinoId]);
  const contratoOrigem = useMemo(() => clienteOrigem?.contratos.find(k => k.id === contratoOrigemId), [clienteOrigem, contratoOrigemId]);
  const contratoDestino = useMemo(() => clienteDestino?.contratos.find(k => k.id === contratoDestinoId), [clienteDestino, contratoDestinoId]);

  const saldoOrigem = useMemo(() => contratoOrigem ? parseBR((contratoOrigem as any)[CAMPO_CONTRATO[tipoSaldo]]) : 0, [contratoOrigem, tipoSaldo]);
  const saldoDestino = useMemo(() => contratoDestino ? parseBR((contratoDestino as any)[CAMPO_CONTRATO[tipoSaldo]]) : 0, [contratoDestino, tipoSaldo]);

  const resetForm = () => {
    setClienteOrigemId(""); setContratoOrigemId(""); setClienteDestinoId(""); setContratoDestinoId("");
    setTipoSaldo("maoDeObraMensal"); setValor(""); setMotivo(""); setData(new Date().toISOString().slice(0, 10));
  };

  const efetivar = async () => {
    if (!temAcessoTotal) { toast.error("Apenas Diretor / Gerente Executivo / Coordenador podem transferir saldos."); return; }
    if (!clienteOrigem || !contratoOrigem) { toast.error("Selecione origem."); return; }
    if (!clienteDestino || !contratoDestino) { toast.error("Selecione destino."); return; }
    if (clienteOrigem.id === clienteDestino.id && contratoOrigem.id === contratoDestino.id) {
      toast.error("Origem e destino não podem ser o mesmo contrato."); return;
    }
    const v = parseBR(valor);
    if (!v || v <= 0) { toast.error("Valor inválido."); return; }

    const campo = CAMPO_CONTRATO[tipoSaldo];

    // Grava direto no Supabase para evitar race de cache do react-query entre os dois updates.
    // Releitura fresca de ambos os clientes antes de aplicar as alterações.
    const ids = clienteOrigem.id === clienteDestino.id ? [clienteOrigem.id] : [clienteOrigem.id, clienteDestino.id];
    const { data: freshRows, error: errFetch } = await supabase.from("clientes").select("id, contratos").in("id", ids);
    if (errFetch || !freshRows) { toast.error("Falha ao ler clientes: " + (errFetch?.message ?? "sem dados")); return; }
    const rowOrig = freshRows.find(r => r.id === clienteOrigem.id);
    const rowDest = freshRows.find(r => r.id === clienteDestino.id) ?? rowOrig;
    if (!rowOrig || !rowDest) { toast.error("Cliente não encontrado no banco."); return; }

    const contratosOrigemAtuais = Array.isArray(rowOrig.contratos) ? (rowOrig.contratos as any[]) : [];
    const contratosDestinoAtuais = Array.isArray(rowDest.contratos) ? (rowDest.contratos as any[]) : [];
    const contratoOrigemAtual = contratosOrigemAtuais.find((k: any) => k.id === contratoOrigem.id);
    const contratoDestinoAtual = contratosDestinoAtuais.find((k: any) => k.id === contratoDestino.id);
    if (!contratoOrigemAtual || !contratoDestinoAtual) { toast.error("Contrato não encontrado no banco."); return; }

    const saldoOrigemAtual = parseBR(contratoOrigemAtual[campo]);
    const saldoDestinoAtual = parseBR(contratoDestinoAtual[campo]);
    if (v > saldoOrigemAtual + 0.001) { toast.error(`Saldo insuficiente. Disponível na origem: ${fmtBRL(saldoOrigemAtual)}`); return; }

    const novoOrigem = saldoOrigemAtual - v;
    const novoDestino = saldoDestinoAtual + v;
    const backupOrigem = contratosOrigemAtuais;
    const contratosOrigemNovo = contratosOrigemAtuais.map((k: any) => k.id === contratoOrigem.id ? { ...k, [campo]: fmtBR(novoOrigem) } : k);

    const { error: errO } = await supabase.from("clientes").update({ contratos: contratosOrigemNovo }).eq("id", clienteOrigem.id);
    if (errO) { toast.error("Falha ao debitar origem: " + errO.message); return; }

    // Base para o destino: se mesmo cliente, usa o array já debitado; senão o array atual do destino.
    const baseDestino = clienteDestino.id === clienteOrigem.id ? contratosOrigemNovo : (rowDest.contratos as any[]);
    const contratosDestinoNovo = baseDestino.map((k: any) => k.id === contratoDestino.id ? { ...k, [campo]: fmtBR(novoDestino) } : k);

    const { error: errD } = await supabase.from("clientes").update({ contratos: contratosDestinoNovo }).eq("id", clienteDestino.id);
    if (errD) {
      // rollback origem
      await supabase.from("clientes").update({ contratos: backupOrigem }).eq("id", clienteOrigem.id);
      toast.error("Falha ao creditar destino. Origem revertida. " + errD.message);
      return;
    }

    // Atualiza cache local de clientes imediatamente (evita leitura stale ao consultar contratos)
    qc.setQueryData<any[]>(["clientes"], (old = []) => old.map((c: any) => {
      if (c.id === clienteOrigem.id || c.id === clienteDestino.id) {
        const contratosAtualizados = (c.contratos || []).map((k: any) => {
          if (c.id === clienteOrigem.id && k.id === contratoOrigem.id) return { ...k, [campo]: fmtBR(novoOrigem) };
          if (c.id === clienteDestino.id && k.id === contratoDestino.id) return { ...k, [campo]: fmtBR(novoDestino) };
          return k;
        });
        return { ...c, contratos: contratosAtualizados };
      }
      return c;
    }));
    await qc.invalidateQueries({ queryKey: ["clientes"] });
    await qc.refetchQueries({ queryKey: ["clientes"] });





    // Registra histórico
    const { error: errHist } = await supabase.from("contrato_transferencias_saldo").insert({
      data,
      tipo_saldo: tipoSaldo,
      valor: v,
      cliente_origem_id: clienteOrigem.id,
      cliente_origem_nome: clienteOrigem.nome,
      contrato_origem_id: contratoOrigem.id,
      contrato_origem_numero: contratoOrigem.numero,
      saldo_origem_antes: saldoOrigemAtual,
      saldo_origem_depois: novoOrigem,
      cliente_destino_id: clienteDestino.id,
      cliente_destino_nome: clienteDestino.nome,
      contrato_destino_id: contratoDestino.id,
      contrato_destino_numero: contratoDestino.numero,
      saldo_destino_antes: saldoDestinoAtual,
      saldo_destino_depois: novoDestino,
      motivo,
      usuario_id: usuarioLogado?.id ?? null,
      usuario_nome: usuarioLogado?.nome ?? null,
    });
    if (errHist) { toast.error("Transferência realizada, mas falha ao gravar histórico: " + errHist.message); }
    else toast.success("Transferência efetivada!");

    resetForm();
    setOpenNova(false);
    loadHistorico();
  };

  const excluir = async (id: string) => {
    // Apenas apaga o registro histórico (não reverte saldos)
    const { error } = await supabase.from("contrato_transferencias_saldo").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Registro do histórico excluído.");
    loadHistorico();
  };

  const exportarExcel = async () => {
    if (historico.length === 0) { toast.error("Nenhum registro para exportar."); return; }
    const rows = historico.map(h => ({
      Data: new Date(h.data + "T00:00:00").toLocaleDateString("pt-BR"),
      Tipo: TIPO_LABEL[h.tipo_saldo],
      "Cliente Origem": h.cliente_origem_nome ?? "",
      "Contrato Origem": h.contrato_origem_numero ?? "",
      "Saldo Origem Antes": Number(h.saldo_origem_antes ?? 0),
      "Saldo Origem Depois": Number(h.saldo_origem_depois ?? 0),
      "Cliente Destino": h.cliente_destino_nome ?? "",
      "Contrato Destino": h.contrato_destino_numero ?? "",
      "Saldo Destino Antes": Number(h.saldo_destino_antes ?? 0),
      "Saldo Destino Depois": Number(h.saldo_destino_depois ?? 0),
      Valor: Number(h.valor),
      Motivo: h.motivo ?? "",
      Usuário: h.usuario_nome ?? "",
      "Registrado em": new Date(h.created_at).toLocaleString("pt-BR"),
    }));
    const ws = (await getXLSX()).utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Transferências");
    (await getXLSX()).writeFile(wb, `transferencias-saldo-${new Date().toISOString().slice(0,10)}.xlsx`, { compression: true });
    toast.success("Excel gerado.");
  };

  const exportarPDF = async () => {
    if (historico.length === 0) { toast.error("Nenhum registro para exportar."); return; }
    const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
    await addHeader(doc, {
      title: "Transferências de Saldo entre Contratos",
      subtitle: `Total: ${historico.length} registro(s)`,
    });
    const totalValor = historico.reduce((s, h) => s + Number(h.valor || 0), 0);
    (await getAutoTable())(doc, {
      startY: 40,
      head: [["Data", "Tipo", "Origem", "Destino", "Valor", "Saldo Origem", "Saldo Destino", "Motivo", "Usuário"]],
      body: historico.map(h => [
        new Date(h.data + "T00:00:00").toLocaleDateString("pt-BR"),
        TIPO_LABEL[h.tipo_saldo],
        `${h.cliente_origem_nome ?? ""}\nContrato ${h.contrato_origem_numero ?? "—"}`,
        `${h.cliente_destino_nome ?? ""}\nContrato ${h.contrato_destino_numero ?? "—"}`,
        fmtBRL(Number(h.valor)),
        `${fmtBRL(Number(h.saldo_origem_antes ?? 0))}\n${fmtBRL(Number(h.saldo_origem_depois ?? 0))}`,
        `${fmtBRL(Number(h.saldo_destino_antes ?? 0))}\n${fmtBRL(Number(h.saldo_destino_depois ?? 0))}`,
        h.motivo ?? "—",
        h.usuario_nome ?? "—",
      ]),
      foot: [[
        { content: "Total transferido", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
        { content: fmtBRL(totalValor), styles: { fontStyle: "bold", halign: "right" } },
        "", "", "", "",
      ]],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.8, valign: "middle", overflow: "linebreak", lineColor: [220, 224, 230], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255, fontSize: 7, halign: "center", valign: "middle" },
      footStyles: { fillColor: [240, 242, 245], textColor: 0, fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 45 },
        3: { cellWidth: 45 },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
        6: { cellWidth: 28, halign: "right" },
        7: { cellWidth: 38 },
        8: { cellWidth: 25 },
      },
      margin: { left: 14, right: 14, top: 40 },
    });
    addFooter(doc);
    doc.save(`transferencias-saldo-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF gerado.");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" /> Transferência de Saldos entre Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Débito/crédito imediato entre contratos, com histórico completo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportarExcel} disabled={historico.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportarPDF} disabled={historico.length === 0}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button onClick={() => setOpenNova(true)} disabled={!temAcessoTotal}>
            <Plus className="h-4 w-4 mr-2" /> Nova Transferência
          </Button>
        </div>
      </div>

      {!temAcessoTotal && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Somente usuários com cargo <strong>Diretor</strong>, <strong>Gerente Executivo</strong> ou <strong>Coordenador de Departamento</strong> podem efetuar transferências. Você pode visualizar o histórico.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de Transferências</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Data</TableHead>
                  <TableHead className="px-4 py-3">Tipo</TableHead>
                  <TableHead className="px-4 py-3">Origem</TableHead>
                  <TableHead className="px-4 py-3">Destino</TableHead>
                  <TableHead className="px-4 py-3 text-right">Valor</TableHead>
                  <TableHead className="px-4 py-3 text-right">Saldo Origem (antes → depois)</TableHead>
                  <TableHead className="px-4 py-3 text-right">Saldo Destino (antes → depois)</TableHead>
                  <TableHead className="px-4 py-3">Motivo</TableHead>
                  <TableHead className="px-4 py-3">Usuário</TableHead>
                  <TableHead className="px-4 py-3 text-center w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                )}
                {!loading && historico.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhuma transferência registrada.</TableCell></TableRow>
                )}
                {historico.map((h) => (
                  <TableRow
                    key={h.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetalheId(h.id)}
                  >
                    <TableCell className="px-4 py-3 whitespace-nowrap">{new Date(h.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">{TIPO_LABEL[h.tipo_saldo]}</TableCell>
                    <TableCell className="px-4 py-3">{h.cliente_origem_nome} <span className="text-muted-foreground">— Contrato {h.contrato_origem_numero || "—"}</span></TableCell>
                    <TableCell className="px-4 py-3">{h.cliente_destino_nome} <span className="text-muted-foreground">— Contrato {h.contrato_destino_numero || "—"}</span></TableCell>
                    <TableCell className="px-4 py-3 text-right whitespace-nowrap font-medium">{fmtBRL(Number(h.valor))}</TableCell>
                    <TableCell className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtBRL(Number(h.saldo_origem_antes ?? 0))} → {fmtBRL(Number(h.saldo_origem_depois ?? 0))}</TableCell>
                    <TableCell className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtBRL(Number(h.saldo_destino_antes ?? 0))} → {fmtBRL(Number(h.saldo_destino_depois ?? 0))}</TableCell>
                    <TableCell className="px-4 py-3 max-w-[240px] truncate" title={h.motivo ?? ""}>{h.motivo || "—"}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">{h.usuario_nome || "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDetalheId(h.id); }} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {temAcessoTotal && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(h.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openNova} onOpenChange={(o) => { setOpenNova(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nova Transferência de Saldo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de Saldo</label>
                <Select value={tipoSaldo} onValueChange={(v) => setTipoSaldo(v as TipoSaldo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as TipoSaldo[]).map(k => (
                      <SelectItem key={k} value={k}>{TIPO_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border rounded-md p-3">
              <div className="col-span-2 text-sm font-semibold text-muted-foreground">Origem (débito)</div>
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Select value={clienteOrigemId} onValueChange={(v) => { setClienteOrigemId(v); setContratoOrigemId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Contrato</label>
                <Select value={contratoOrigemId} onValueChange={setContratoOrigemId} disabled={!clienteOrigem}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clienteOrigem?.contratos.map(k => <SelectItem key={k.id} value={k.id}>Contrato {k.numero || "—"} {k.descricao ? "— " + k.descricao : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">Saldo atual ({TIPO_LABEL[tipoSaldo]}): <strong className="text-foreground">{fmtBRL(saldoOrigem)}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-4 border rounded-md p-3">
              <div className="col-span-2 text-sm font-semibold text-muted-foreground">Destino (crédito)</div>
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Select value={clienteDestinoId} onValueChange={(v) => { setClienteDestinoId(v); setContratoDestinoId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Contrato</label>
                <Select value={contratoDestinoId} onValueChange={setContratoDestinoId} disabled={!clienteDestino}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clienteDestino?.contratos.map(k => <SelectItem key={k.id} value={k.id}>Contrato {k.numero || "—"} {k.descricao ? "— " + k.descricao : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">Saldo atual ({TIPO_LABEL[tipoSaldo]}): <strong className="text-foreground">{fmtBRL(saldoDestino)}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valor a transferir (R$)</label>
                <Input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="0,00" />
              </div>
              <div>
                <label className="text-sm font-medium">Motivo / Observação</label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ex.: Realocação de mão de obra do contrato X para o Y" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNova(false)}>Cancelar</Button>
            <Button onClick={efetivar}>Efetivar Transferência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalheId} onOpenChange={(o) => { if (!o) setDetalheId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Transferência</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data da transferência</span>
                  <div className="font-medium">{new Date(detalhe.data + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo de saldo</span>
                  <div className="font-medium">{TIPO_LABEL[detalhe.tipo_saldo]}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor transferido</span>
                  <div className="font-medium text-lg">{fmtBRL(Number(detalhe.valor))}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Registrado em</span>
                  <div className="font-medium">{new Date(detalhe.created_at).toLocaleString("pt-BR")}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-4 space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Origem</div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Cliente</div>
                    <div className="font-medium">{detalhe.cliente_origem_nome || "—"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Contrato</div>
                    <div className="font-medium">{detalhe.contrato_origem_numero || "—"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Saldo antes → depois</div>
                    <div className="font-medium">
                      {fmtBRL(Number(detalhe.saldo_origem_antes ?? 0))} → {fmtBRL(Number(detalhe.saldo_origem_depois ?? 0))}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Variação</div>
                    <div className="font-medium text-destructive">
                      − {fmtBRL(Number(detalhe.saldo_origem_antes ?? 0) - Number(detalhe.saldo_origem_depois ?? 0))}
                    </div>
                  </div>
                </div>

                <div className="border rounded-md p-4 space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Destino</div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Cliente</div>
                    <div className="font-medium">{detalhe.cliente_destino_nome || "—"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Contrato</div>
                    <div className="font-medium">{detalhe.contrato_destino_numero || "—"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Saldo antes → depois</div>
                    <div className="font-medium">
                      {fmtBRL(Number(detalhe.saldo_destino_antes ?? 0))} → {fmtBRL(Number(detalhe.saldo_destino_depois ?? 0))}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Variação</div>
                    <div className="font-medium text-success">
                      + {fmtBRL(Number(detalhe.saldo_destino_depois ?? 0) - Number(detalhe.saldo_destino_antes ?? 0))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-md p-4 space-y-2">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Motivo / Observação</div>
                <div className="text-sm whitespace-pre-wrap">{detalhe.motivo || "Nenhum motivo registrado."}</div>
              </div>

              <div className="text-sm text-muted-foreground">
                Registrado por <span className="font-medium text-foreground">{detalhe.usuario_nome || "—"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalheId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        onConfirm={() => { if (confirmDeleteId) excluir(confirmDeleteId); setConfirmDeleteId(null); }}
      />
    </div>
  );
}
