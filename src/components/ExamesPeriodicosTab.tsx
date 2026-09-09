import React, { useState, useEffect } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Upload, FileText, AlertTriangle, Bell, Download } from "lucide-react";
import { toast } from "sonner";

const TIPOS_EXAME = [
  "Admissional",
  "Periódico",
  "Retorno ao Trabalho",
  "Mudança de Função",
  "Demissional",
  "Complementar",
];

interface ExamePeriodico {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_telefone: string;
  funcionario_email: string;
  tipo_exame: string;
  data_realizacao: string | null;
  data_vencimento: string;
  resultado: string;
  observacoes: string;
  clinica: string;
  anexo_aso_url: string;
  notificado_30d: boolean;
  notificado_20d: boolean;
  notificado_10d: boolean;
  created_at: string;
}

interface Props {
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioTelefone: string;
  funcionarioEmail: string;
}

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-foreground/80">{label}{required && " *"}</Label>
    {children}
  </div>
);

export function ExamesPeriodicosTab({ funcionarioId, funcionarioNome, funcionarioTelefone, funcionarioEmail }: Props) {
  const [exames, setExames] = useState<ExamePeriodico[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [form, setForm] = useState({
    tipo_exame: "",
    data_realizacao: "",
    data_vencimento: "",
    resultado: "",
    observacoes: "",
    clinica: "",
  });

  const fetchExames = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('exames_periodicos')
      .select('*')
      .eq('funcionario_id', funcionarioId)
      .order('data_vencimento', { ascending: false });

    if (error) {
      console.error('Erro ao buscar exames:', error);
      toast.error('Erro ao carregar exames.');
    } else {
      setExames((data as unknown as ExamePeriodico[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (funcionarioId) fetchExames();
  }, [funcionarioId]);

  const handleAdd = async () => {
    if (!form.tipo_exame || !form.data_vencimento) {
      toast.error("Informe o tipo e a data de vencimento do exame.");
      return;
    }

    const { error } = await supabase.from('exames_periodicos').insert({
      funcionario_id: funcionarioId,
      funcionario_nome: funcionarioNome,
      funcionario_telefone: funcionarioTelefone,
      funcionario_email: funcionarioEmail,
      tipo_exame: form.tipo_exame,
      data_realizacao: form.data_realizacao || null,
      data_vencimento: form.data_vencimento,
      resultado: form.resultado,
      observacoes: form.observacoes,
      clinica: form.clinica,
    } as any);

    if (error) {
      console.error('Erro ao adicionar exame:', error);
      toast.error('Erro ao adicionar exame.');
    } else {
      toast.success('Exame adicionado com sucesso.');
      setForm({ tipo_exame: "", data_realizacao: "", data_vencimento: "", resultado: "", observacoes: "", clinica: "" });
      fetchExames();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('exames_periodicos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover exame.');
    } else {
      toast.success('Exame removido.');
      fetchExames();
    }
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const handleUploadASO = async (exameId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10MB).');
      return;
    }
    setUploading(true);
    const filePath = `${funcionarioId}/${exameId}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('exames-aso')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Erro ao enviar arquivo.');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('exames-aso').getPublicUrl(filePath);

    await supabase.from('exames_periodicos')
      .update({ anexo_aso_url: urlData.publicUrl } as any)
      .eq('id', exameId);

    toast.success('ASO anexado com sucesso.');
    setUploading(false);
    fetchExames();
  };

  const handleDownloadASO = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao baixar arquivo");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = url.split("/").pop() || "aso.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Erro ao baixar o ASO.");
    }
  };

  const getStatusVencimento = (dataVencimento: string) => {
    const hoje = new Date();
    const venc = new Date(dataVencimento + 'T00:00:00');
    const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (diffDays <= 10) return { label: `${diffDays}d`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (diffDays <= 20) return { label: `${diffDays}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    if (diffDays <= 30) return { label: `${diffDays}d`, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
    return { label: "OK", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  };

  const getNotificacaoStatus = (exame: ExamePeriodico) => {
    const flags = [];
    if (exame.notificado_30d) flags.push("30d");
    if (exame.notificado_20d) flags.push("20d");
    if (exame.notificado_10d) flags.push("10d");
    return flags.length > 0 ? flags.join(", ") : "—";
  };

  if (!funcionarioId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm">Salve o funcionário primeiro para gerenciar os exames periódicos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form to add new exam */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Tipo de Exame" required>
          <Select value={form.tipo_exame} onValueChange={(v) => setForm({ ...form, tipo_exame: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {TIPOS_EXAME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data de Realização">
          <Input type="date" value={form.data_realizacao} onChange={(e) => setForm({ ...form, data_realizacao: e.target.value })} />
        </Field>
        <Field label="Data de Vencimento" required>
          <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
        </Field>
        <Field label="Resultado">
          <Select value={form.resultado} onValueChange={(v) => setForm({ ...form, resultado: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Apto">Apto</SelectItem>
              <SelectItem value="Inapto">Inapto</SelectItem>
              <SelectItem value="Apto com Restrições">Apto com Restrições</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Clínica">
          <Input value={form.clinica} onChange={(e) => setForm({ ...form, clinica: e.target.value })} placeholder="Nome da clínica" />
        </Field>
        <Field label="Observações">
          <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações" />
        </Field>
      </div>
      <Button type="button" onClick={handleAdd} className="shadow-md">
        <Plus className="h-4 w-4 mr-1" /> Adicionar Exame
      </Button>

      {/* Exams table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando exames...</p>
      ) : exames.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum exame periódico cadastrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Realização</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Avisos</TableHead>
                <TableHead>ASO</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exames.map((exame) => {
                const status = getStatusVencimento(exame.data_vencimento);
                return (
                  <TableRow key={exame.id}>
                    <TableCell className="font-medium">{exame.tipo_exame}</TableCell>
                    <TableCell>{exame.data_realizacao ? exame.data_realizacao.split('-').reverse().join('/') : '—'}</TableCell>
                    <TableCell>{exame.data_vencimento.split('-').reverse().join('/')}</TableCell>
                    <TableCell>
                      <Badge className={`${status.className} text-xs font-medium`}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{exame.resultado || '—'}</TableCell>
                    <TableCell>{exame.clinica || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Bell className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{getNotificacaoStatus(exame)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {exame.anexo_aso_url ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          onClick={() => handleDownloadASO(exame.anexo_aso_url)}
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="Baixar ASO"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                          <Upload className="h-4 w-4" />
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading}
                            onChange={(e) => { if (e.target.files?.[0]) handleUploadASO(exame.id, e.target.files[0]); e.target.value = ""; }} />
                        </label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" type="button" onClick={() => requestDelete(exame.id)} className="h-7 w-7 text-destructive hover:text-destructive">
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
        <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Avisos automáticos</p>
        <p>O sistema enviará avisos por WhatsApp 30, 20 e 10 dias antes do vencimento de cada exame.</p>
        <p>Os avisos são verificados automaticamente todos os dias.</p>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
}
