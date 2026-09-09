import React, { useState, useEffect } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Upload, FileText, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { agendarEnvioRelatorioFerias } from "@/lib/enviarRelatorioFerias";

const STATUS_OPTIONS = ["A vencer", "Programada", "Em gozo", "Concluída", "Vencida"];

interface Ferias {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_limite_concessao: string;
  dias_direito: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  dias_gozados: number;
  dias_abonados: number;
  status: string;
  observacoes: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  created_at: string;
}

interface Props {
  funcionarioId: string;
  funcionarioNome: string;
  dataAdmissao: string;
}

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-foreground/80">{label}{required && " *"}</Label>
    {children}
  </div>
);

// Calcula período aquisitivo a partir da admissão e quantidade de períodos já registrados
function calcularPeriodos(dataAdmissao: string, ordem: number) {
  if (!dataAdmissao) return { inicio: "", fim: "", limite: "" };
  const adm = new Date(dataAdmissao + "T00:00:00");
  const inicio = new Date(adm);
  inicio.setFullYear(inicio.getFullYear() + ordem);
  const fim = new Date(inicio);
  fim.setFullYear(fim.getFullYear() + 1);
  fim.setDate(fim.getDate() - 1);
  // Data limite p/ concessão: até 11 meses após o fim do período aquisitivo (CLT art. 134)
  const limite = new Date(fim);
  limite.setFullYear(limite.getFullYear() + 1);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: toIso(inicio), fim: toIso(fim), limite: toIso(limite) };
}

export function FeriasTab({ funcionarioId, funcionarioNome, dataAdmissao }: Props) {
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const [form, setForm] = useState({
    periodo_aquisitivo_inicio: "",
    periodo_aquisitivo_fim: "",
    data_limite_concessao: "",
    dias_direito: 30,
    data_inicio_gozo: "",
    data_fim_gozo: "",
    dias_gozados: 0,
    dias_abonados: 0,
    status: "A vencer",
    observacoes: "",
  });

  const fetchFerias = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ferias')
      .select('*')
      .eq('funcionario_id', funcionarioId)
      .order('periodo_aquisitivo_inicio', { ascending: false });
    if (error) { console.error(error); toast.error('Erro ao carregar férias.'); }
    else setFerias((data as Ferias[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (funcionarioId) fetchFerias(); }, [funcionarioId]);

  // Sugere próximo período automaticamente
  useEffect(() => {
    if (!dataAdmissao || !funcionarioId) return;
    const proximaOrdem = ferias.length;
    const { inicio, fim, limite } = calcularPeriodos(dataAdmissao, proximaOrdem);
    setForm((f) => ({
      ...f,
      periodo_aquisitivo_inicio: f.periodo_aquisitivo_inicio || inicio,
      periodo_aquisitivo_fim: f.periodo_aquisitivo_fim || fim,
      data_limite_concessao: f.data_limite_concessao || limite,
    }));
  }, [dataAdmissao, ferias.length, funcionarioId]);

  const handleAdd = async () => {
    if (!form.periodo_aquisitivo_inicio || !form.periodo_aquisitivo_fim || !form.data_limite_concessao) {
      toast.error("Informe o período aquisitivo e a data limite.");
      return;
    }
    const { error } = await (supabase as any).from('ferias').insert({
      funcionario_id: funcionarioId,
      funcionario_nome: funcionarioNome,
      periodo_aquisitivo_inicio: form.periodo_aquisitivo_inicio,
      periodo_aquisitivo_fim: form.periodo_aquisitivo_fim,
      data_limite_concessao: form.data_limite_concessao,
      dias_direito: form.dias_direito,
      data_inicio_gozo: form.data_inicio_gozo || null,
      data_fim_gozo: form.data_fim_gozo || null,
      dias_gozados: form.dias_gozados,
      dias_abonados: form.dias_abonados,
      status: form.status,
      observacoes: form.observacoes,
    });
    if (error) { console.error(error); toast.error('Erro ao adicionar férias.'); return; }
    toast.success('Período de férias cadastrado.');
    agendarEnvioRelatorioFerias(`Novo período de férias de ${funcionarioNome}`);
    setForm({
      periodo_aquisitivo_inicio: "", periodo_aquisitivo_fim: "", data_limite_concessao: "",
      dias_direito: 30, data_inicio_gozo: "", data_fim_gozo: "", dias_gozados: 0, dias_abonados: 0,
      status: "A vencer", observacoes: "",
    });
    fetchFerias();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('ferias').delete().eq('id', id);
    if (error) toast.error('Erro ao remover.');
    else {
      toast.success('Removido.');
      agendarEnvioRelatorioFerias(`Período de férias removido (${funcionarioNome})`);
      fetchFerias();
    }
  };

  const handleUpload = async (id: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 10MB).'); return; }
    setUploading(true);
    const filePath = `${funcionarioId}/${id}/${file.name}`;
    const { error: upErr } = await supabase.storage.from('ferias-comprovantes').upload(filePath, file, { upsert: true });
    if (upErr) { console.error(upErr); toast.error('Erro no upload.'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('ferias-comprovantes').getPublicUrl(filePath);
    await (supabase as any).from('ferias').update({ anexo_url: urlData.publicUrl, anexo_nome: file.name }).eq('id', id);
    toast.success('Comprovante anexado.');
    agendarEnvioRelatorioFerias(`Comprovante de férias anexado (${funcionarioNome})`);
    setUploading(false);
    fetchFerias();
  };

  const getStatusLimite = (dataLimite: string, status: string) => {
    if (status === 'Concluída') return { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    if (status === 'Em gozo') return { label: 'Em gozo', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    const hoje = new Date();
    const lim = new Date(dataLimite + 'T00:00:00');
    const diff = Math.ceil((lim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (diff <= 30) return { label: `${diff}d`, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (diff <= 60) return { label: `${diff}d`, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: `${diff}d`, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  };

  if (!funcionarioId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm">Salve o funcionário primeiro para gerenciar as férias.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dataAdmissao && (
        <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Data de admissão:</span>
          <span className="font-semibold">{dataAdmissao.split('-').reverse().join('/')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Período Aquisitivo - Início" required>
          <Input type="date" value={form.periodo_aquisitivo_inicio} onChange={(e) => setForm({ ...form, periodo_aquisitivo_inicio: e.target.value })} />
        </Field>
        <Field label="Período Aquisitivo - Fim" required>
          <Input type="date" value={form.periodo_aquisitivo_fim} onChange={(e) => setForm({ ...form, periodo_aquisitivo_fim: e.target.value })} />
        </Field>
        <Field label="Data Limite Concessão" required>
          <Input type="date" value={form.data_limite_concessao} onChange={(e) => setForm({ ...form, data_limite_concessao: e.target.value })} />
        </Field>
        <Field label="Dias de Direito">
          <Input type="number" min={0} max={30} value={form.dias_direito} onChange={(e) => setForm({ ...form, dias_direito: parseInt(e.target.value) || 0 })} />
        </Field>
        <Field label="Início do Gozo">
          <Input type="date" value={form.data_inicio_gozo} onChange={(e) => setForm({ ...form, data_inicio_gozo: e.target.value })} />
        </Field>
        <Field label="Fim do Gozo">
          <Input type="date" value={form.data_fim_gozo} onChange={(e) => setForm({ ...form, data_fim_gozo: e.target.value })} />
        </Field>
        <Field label="Dias Gozados">
          <Input type="number" min={0} value={form.dias_gozados} onChange={(e) => setForm({ ...form, dias_gozados: parseInt(e.target.value) || 0 })} />
        </Field>
        <Field label="Dias Abonados (1/3)">
          <Input type="number" min={0} max={10} value={form.dias_abonados} onChange={(e) => setForm({ ...form, dias_abonados: parseInt(e.target.value) || 0 })} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Observações">
          <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações" />
        </Field>
      </div>

      <Button type="button" onClick={handleAdd} className="shadow-md">
        <Plus className="h-4 w-4 mr-1" /> Adicionar Período
      </Button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : ferias.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum período de férias cadastrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período Aquisitivo</TableHead>
                <TableHead>Limite Concessão</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Direito</TableHead>
                <TableHead>Gozo</TableHead>
                <TableHead className="text-center">Gozados</TableHead>
                <TableHead className="text-center">Abono</TableHead>
                <TableHead>Status Reg.</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ferias.map((f) => {
                const st = getStatusLimite(f.data_limite_concessao, f.status);
                const gozo = f.data_inicio_gozo
                  ? `${f.data_inicio_gozo.split('-').reverse().join('/')}${f.data_fim_gozo ? ' a ' + f.data_fim_gozo.split('-').reverse().join('/') : ''}`
                  : '—';
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-sm">
                      {f.periodo_aquisitivo_inicio.split('-').reverse().join('/')} a {f.periodo_aquisitivo_fim.split('-').reverse().join('/')}
                    </TableCell>
                    <TableCell>{f.data_limite_concessao.split('-').reverse().join('/')}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${st.className} text-xs font-medium`}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{f.dias_direito}</TableCell>
                    <TableCell className="text-sm">{gozo}</TableCell>
                    <TableCell className="text-center">{f.dias_gozados || 0}</TableCell>
                    <TableCell className="text-center">{f.dias_abonados || 0}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{f.status}</Badge></TableCell>
                    <TableCell>
                      {f.anexo_url ? (
                        <a href={f.anexo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <FileText className="h-4 w-4" />
                        </a>
                      ) : (
                        <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                          <Upload className="h-4 w-4" />
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading}
                            onChange={(e) => { if (e.target.files?.[0]) handleUpload(f.id, e.target.files[0]); e.target.value = ""; }} />
                        </label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" type="button" onClick={() => requestDelete(f.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> CLT - Art. 134</p>
        <p>O empregador deve conceder as férias dentro dos 12 meses seguintes ao término do período aquisitivo.</p>
        <p>A data limite é calculada automaticamente a partir da data de admissão.</p>
      </div>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={() => deleteId && handleDelete(deleteId)} />
    </div>
  );
}
