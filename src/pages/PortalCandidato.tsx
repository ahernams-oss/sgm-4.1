import { lerArquivoBase64 } from "@/lib/compressFile";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENTOS_OBRIGATORIOS,
  Candidato,
  DocumentoContratacao,
} from "@/contexts/ProcessoSeletivoContext";
import { toast } from "sonner";
import { ShieldCheck, FileText, Paperclip, Trash2, CheckCircle2, Loader2 } from "lucide-react";

const DOCS_REMOVIDOS = ["Atestado de Antecedentes Criminais"];

export default function PortalCandidato() {
  const { processoId, candidatoId } = useParams<{ processoId: string; candidatoId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [allCandidatos, setAllCandidatos] = useState<Candidato[]>([]);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);

  useEffect(() => {
    (async () => {
      if (!processoId || !candidatoId) return;
      const { data, error } = await (supabase as any)
        .from("processos_seletivos")
        .select("candidatos")
        .eq("id", processoId)
        .maybeSingle();
      if (error || !data) { toast.error("Link inválido."); setLoading(false); return; }
      const cands: Candidato[] = data.candidatos || [];
      setAllCandidatos(cands);
      const c = cands.find((x) => x.id === candidatoId);
      if (!c) { toast.error("Candidato não encontrado."); setLoading(false); return; }
      // Normaliza lista de documentos (sem exame admissional, sem antecedentes)
      const docs: DocumentoContratacao[] =
        (c.documentos && c.documentos.length > 0
          ? c.documentos
          : DOCUMENTOS_OBRIGATORIOS.map((n) => ({ nome: n, entregue: false })))
          .filter((d) => !DOCS_REMOVIDOS.includes(d.nome));
      setCandidato({ ...c, documentos: docs });
      setAceiteLgpd(!!c.lgpdAceite);
      setLoading(false);
    })();
  }, [processoId, candidatoId]);

  const persist = async (patch: Partial<Candidato>) => {
    if (!candidato) return;
    setSaving(true);
    const novo = { ...candidato, ...patch };
    setCandidato(novo);
    const novos = allCandidatos.map((c) => (c.id === candidato.id ? novo : c));
    setAllCandidatos(novos);
    const { error } = await (supabase as any)
      .from("processos_seletivos")
      .update({ candidatos: novos })
      .eq("id", processoId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar."); console.error(error); }
  };

  const aceitarLgpd = async () => {
    if (!aceiteLgpd) { toast.error("Você precisa aceitar os termos da LGPD."); return; }
    await persist({ lgpdAceite: true, lgpdAceiteData: new Date().toISOString() });
    toast.success("Termos aceitos. Você já pode anexar seus documentos.");
  };

  const anexarDoc = async (idx: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error(`"${file.name}" excede 2MB.`); return; }
    const base64 = await lerArquivoBase64(file);
    const docs = [...(candidato!.documentos || [])];
    docs[idx] = {
      ...docs[idx],
      anexo: { nome: file.name, tipo: file.type, base64 },
      entregue: true,
      naoPossui: false,
    };
    persist({ documentos: docs });
  };

  const removerAnexo = (idx: number) => {
    const docs = [...(candidato!.documentos || [])];
    const { anexo, ...rest } = docs[idx];
    docs[idx] = { ...(rest as DocumentoContratacao), entregue: false };
    persist({ documentos: docs });
  };

  const marcarNaoPossui = (idx: number, checked: boolean) => {
    const docs = [...(candidato!.documentos || [])];
    const item = { ...docs[idx], naoPossui: checked };
    if (checked) { item.entregue = true; delete (item as any).anexo; }
    else { item.entregue = !!item.anexo; }
    docs[idx] = item;
    persist({ documentos: docs });
  };

  const updateBanco = (field: keyof Candidato["dadosBancarios"], value: string) => {
    const dadosBancarios = {
      ...(candidato!.dadosBancarios || { banco: "", agencia: "", conta: "", tipoConta: "", pisPasep: "" }),
      [field]: value,
    };
    persist({ dadosBancarios });
  };

  const progresso = useMemo(() => {
    if (!candidato) return { ok: 0, total: 0 };
    const total = candidato.documentos.length;
    const ok = candidato.documentos.filter((d) => d.anexo || d.naoPossui).length;
    return { ok, total };
  }, [candidato]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!candidato) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Link inválido ou candidato não encontrado.</div>;
  }

  // ====== Tela LGPD ======
  if (!candidato.lgpdAceite) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Termo de Consentimento — LGPD
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>Olá, <strong className="text-foreground">{candidato.nome}</strong>! Antes de anexar seus documentos, é necessário ler e aceitar os termos da <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD)</strong>.</p>
              <div className="bg-background border rounded-md p-4 max-h-[40vh] overflow-y-auto space-y-3">
                <p><strong>1. Finalidade:</strong> Os dados pessoais e documentos enviados serão utilizados exclusivamente para fins de processo seletivo, admissão e cumprimento de obrigações legais e contratuais.</p>
                <p><strong>2. Compartilhamento:</strong> Seus dados poderão ser compartilhados com órgãos públicos (eSocial, Receita Federal, Ministério do Trabalho) e instituições financeiras, quando necessário.</p>
                <p><strong>3. Armazenamento:</strong> Os dados serão armazenados de forma segura pelo período legal exigido.</p>
                <p><strong>4. Seus direitos:</strong> Você poderá, a qualquer momento, solicitar acesso, correção, exclusão ou portabilidade dos seus dados, conforme art. 18 da LGPD.</p>
                <p><strong>5. Segurança:</strong> Empregamos medidas técnicas e administrativas para proteger seus dados contra acessos não autorizados.</p>
                <p>Ao prosseguir, você declara estar ciente e de acordo com o tratamento dos seus dados conforme descrito.</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={aceiteLgpd} onCheckedChange={(v) => setAceiteLgpd(!!v)} className="mt-0.5" />
                <span className="text-foreground">Li e aceito os termos da LGPD e autorizo o tratamento dos meus dados pessoais.</span>
              </label>
              <Button onClick={aceitarLgpd} className="w-full" disabled={!aceiteLgpd || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Aceitar e continuar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ====== Tela de envio ======
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Documentos para Admissão</span>
              <Badge variant="outline">{progresso.ok} / {progresso.total}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Olá <strong className="text-foreground">{candidato.nome}</strong>! Anexe abaixo cada documento (PDF, JPG ou PNG até 2MB). Caso não possua algum, marque a opção <em>"Não possuo"</em>.</p>
            <div className="space-y-2">
              {candidato.documentos.map((doc, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {doc.anexo || doc.naoPossui ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">{doc.nome}</span>
                      {doc.naoPossui && <Badge variant="secondary" className="text-[10px]">Não possui</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.anexo ? (
                        <>
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{doc.anexo.nome}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removerAnexo(idx)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        !doc.naoPossui && (
                          <>
                            <input
                              type="file" id={`f-${idx}`} className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) anexarDoc(idx, f); e.target.value = ""; }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`f-${idx}`)?.click()}>
                              <Paperclip className="h-4 w-4 mr-1" /> Anexar
                            </Button>
                          </>
                        )
                      )}
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <Checkbox checked={!!doc.naoPossui} onCheckedChange={(v) => marcarNaoPossui(idx, !!v)} />
                        Não possuo
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dados Bancários</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Banco</label>
              <Input value={candidato.dadosBancarios?.banco || ""} onChange={(e) => updateBanco("banco", e.target.value)} placeholder="Ex: Bradesco" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Agência</label>
              <Input value={candidato.dadosBancarios?.agencia || ""} onChange={(e) => updateBanco("agencia", e.target.value)} placeholder="Ex: 1234" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Conta</label>
              <Input value={candidato.dadosBancarios?.conta || ""} onChange={(e) => updateBanco("conta", e.target.value)} placeholder="Ex: 12345-6" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Conta</label>
              <select
                value={candidato.dadosBancarios?.tipoConta || ""}
                onChange={(e) => updateBanco("tipoConta", e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="salario">Salário</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">PIS/PASEP</label>
              <Input value={candidato.dadosBancarios?.pisPasep || ""} onChange={(e) => updateBanco("pisPasep", e.target.value)} placeholder="Número do PIS/PASEP" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">PIX</label>
              <Input value={candidato.dadosBancarios?.pix || ""} onChange={(e) => updateBanco("pix", e.target.value)} placeholder="Chave PIX (CPF, e-mail, telefone ou aleatória)" />
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          {saving ? "Salvando..." : "Suas informações são salvas automaticamente."}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={saving || progresso.ok < progresso.total}
          onClick={async () => {
            await persist({ portalConcluidoEm: new Date().toISOString() } as any);
            toast.success("Envio concluído! O RH foi notificado.");
          }}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Concluir envio ({progresso.ok}/{progresso.total})
        </Button>
        <div className="pb-6" />
      </div>
    </div>
  );
}
