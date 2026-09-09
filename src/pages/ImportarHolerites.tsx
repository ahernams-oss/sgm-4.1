import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  pagina: number;
  cpf_detectado: string | null;
  nome_detectado: string | null;
  funcionario_id: string | null;
  tipo: string;
  valor_liquido: number | null;
  status_match: string;
  ignorar: boolean;
  publicado: boolean;
}

const TIPOS = [
  { v: "folha", l: "Folha Mensal" },
  { v: "13o", l: "13º Salário" },
  { v: "ferias", l: "Férias" },
  { v: "rescisao", l: "Rescisão" },
  { v: "outros", l: "Outros" },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fileToBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(f);
});

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImportarHolerites() {
  const { usuarioLogado } = useAuth();
  const { funcionarios } = useFuncionarios();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);

  const funcAtivos = funcionarios.filter((f: any) => (f.status || "").toLowerCase() === "ativo");

  const carregarItens = async (lid: string) => {
    const { data, error } = await supabase
      .from("portal_holerites_import_item")
      .select("id,pagina,cpf_detectado,nome_detectado,funcionario_id,tipo,valor_liquido,status_match,ignorar,publicado")
      .eq("lote_id", lid).order("pagina");
    if (error) { toast.error(error.message); return; }
    setItens(data as any);
  };

  const [progresso, setProgresso] = useState<string>("");

  const isExcel = !!file && /\.(xlsx|xls|csv)$/i.test(file.name);

  const analisar = async () => {
    if (!file) return toast.error("Selecione um arquivo PDF ou Excel");
    setProcessing(true);
    setProgresso("");
    try {
      const b64 = await fileToBase64(file);
      let lid: string | null = null;
      let inicio = 0;
      let total = 0;
      // Processa em blocos para evitar timeout da função (150s)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase.functions.invoke("processar-holerites-lote", {
          body: {
            ...(isExcel ? { excelBase64: b64 } : { pdfBase64: b64 }),
            arquivo_nome: file.name,
            competencia_mes: mes,
            competencia_ano: ano,
            importado_por: usuarioLogado?.id,
            importado_por_nome: usuarioLogado?.nome,
            lote_id: lid,
            inicio,
            tamanho: isExcel ? 25 : 4,
          },
        });
        if (error) throw error;
        const d = data as any;
        if (d?.error) throw new Error(d.error);
        lid = d.lote_id;
        total = d.total;
        inicio = d.proximo_inicio;
        setProgresso(`${d.processadas} de ${d.total} ${isExcel ? "registros" : "páginas"} processados…`);
        if (d.concluido) break;
      }
      setLoteId(lid);
      if (lid) await carregarItens(lid);
      toast.success(`${total} ${isExcel ? "registros" : "páginas"} analisados.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar o arquivo.");
    } finally {
      setProcessing(false);
      setProgresso("");
    }
  };


  const atualizarItem = async (id: string, patch: Partial<Item>) => {
    setItens((old) => old.map((i) => (i.id === id ? { ...i, ...patch } as Item : i)));
    await supabase.from("portal_holerites_import_item").update(patch).eq("id", id);
  };

  const publicar = async () => {
    if (!loteId) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("publicar-holerites-lote", { body: { lote_id: loteId } });
      if (error) throw error;
      toast.success(`${(data as any).publicados} holerites publicados no portal.`);
      await carregarItens(loteId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const pendentes = itens.filter((i) => !i.ignorar && !i.funcionario_id).length;
  const publicaveis = itens.filter((i) => !i.ignorar && i.funcionario_id && !i.publicado).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Importar Holerites</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Enviar PDF consolidado ou planilha Excel</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Label>Arquivo (PDF com todos os holerites ou Excel com uma linha por funcionário)</Label>
            <Input
              type="file"
              accept=".pdf,application/pdf,.xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Excel: colunas CPF, Nome, Tipo, Salário Base, Horas, Horas Extras, Valor Horas Extras,
              Total de Vencimentos, Total de Descontos e Valor Líquido.
            </p>
          </div>
          <div className="md:col-span-4">
            <Button onClick={analisar} disabled={!file || processing}>
              {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isExcel ? "Processando planilha…" : "Analisando com IA…"}</> : <><Upload className="mr-2 h-4 w-4" />{isExcel ? "Analisar planilha" : "Analisar PDF"}</>}
            </Button>
            {processing && <p className="text-xs text-muted-foreground mt-2">{progresso || "Processando em blocos…"} Aguarde.</p>}
          </div>
        </CardContent>
      </Card>

      {loteId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">2. Conferência ({itens.length} registros)</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{publicaveis} prontos</Badge>
              {pendentes > 0 && <Badge variant="destructive">{pendentes} pendentes</Badge>}
              <Button onClick={publicar} disabled={publicaveis === 0 || publishing}>
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Publicar {publicaveis} holerite(s)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>CPF detectado</TableHead>
                  <TableHead>Nome detectado</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead className="text-right">Valor líquido</TableHead>
                  <TableHead className="w-24 text-center">Ignorar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => (
                  <TableRow key={it.id} className={it.publicado ? "opacity-50" : it.ignorar ? "opacity-40" : ""}>
                    <TableCell>{it.pagina}</TableCell>
                    <TableCell>
                      {it.publicado ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                        it.funcionario_id ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                        it.status_match === "ambiguo" ? <AlertCircle className="h-4 w-4 text-amber-500" /> :
                        <XCircle className="h-4 w-4 text-red-500" />}
                    </TableCell>
                    <TableCell className="text-sm">{it.cpf_detectado || "—"}</TableCell>
                    <TableCell className="text-sm">{it.nome_detectado || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={it.funcionario_id || "none"}
                        onValueChange={(v) => atualizarItem(it.id, { funcionario_id: v === "none" ? null : v, status_match: "manual" })}
                        disabled={it.publicado}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— não vincular —</SelectItem>
                          {funcAtivos.map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome} — {f.cpf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={it.tipo} onValueChange={(v) => atualizarItem(it.id, { tipo: v })} disabled={it.publicado}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-sm">{money(it.valor_liquido)}</TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" checked={it.ignorar} disabled={it.publicado}
                        onChange={(e) => atualizarItem(it.id, { ignorar: e.target.checked })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
