import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, FileDown, Printer, Eye, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLaudosCondenacao, type LaudoCondenacao, type AnexoLaudo } from "@/contexts/LaudosCondenacaoContext";
import { useLaudosAssinaturas } from "@/contexts/LaudosAssinaturasContext";
import { useResponsaveisTecnicos } from "@/contexts/ResponsaveisTecnicosContext";
import { useEquipamentos, type Equipamento } from "@/contexts/EquipamentosContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { FotosLaudoEditor } from "./FotosLaudoEditor";
import { AssinaturaEletronicaLaudo } from "@/components/AssinaturaEletronicaLaudo";
import { gerarPdfLaudoCondenacao } from "@/lib/gerarPdfLaudoCondenacao";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";

interface Props {
  equipamento: Equipamento;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const emptyLaudo = (eq: Equipamento): Partial<LaudoCondenacao> => ({
  equipamento_id: eq.id,
  equipamento_tag: eq.tag,
  equipamento_nome: eq.equipamento,
  tipo: eq.equipamento,
  marca: eq.fabricante,
  modelo: eq.modelo,
  serie: eq.serie,
  patrimonio: eq.tag,
  ano_fabricacao: "",
  data_aquisicao: eq.dataAquisicao,
  localizacao: [eq.setorDescricao, eq.pavimentoDescricao, eq.localDescricao].filter(Boolean).join(" / "),
  estado_conservacao: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  data_inspecao: new Date().toISOString().slice(0, 10),
  local_inspecao: "",
  responsavel_tecnico: "",
  registro_profissional: "",
  historico: "",
  insp_condicoes_fisicas: "",
  insp_condicoes_eletricas: "",
  insp_condicoes_mecanicas: "",
  insp_funcionalidade: "",
  motivos_condenacao: [""],
  custo_reparo: 0,
  valor_residual: 0,
  valor_novo_equivalente: eq.valor || 0,
  parecer: "APROVADO PARA CONDENAÇÃO",
  conclusao_condicoes: "irrecuperáveis",
  fotos: [],
  anexos_orcamentos: [],
  outros_anexos: [],
  observacoes_outros: "",
});

export function LaudoCondenacaoDialog({ equipamento, open, onOpenChange }: Props) {
  const { porEquipamento, addLaudo, updateLaudo, deleteLaudo } = useLaudosCondenacao();
  const { porLaudo: assinaturasPorLaudo } = useLaudosAssinaturas();
  const { updateEquipamento } = useEquipamentos();
  const { empresa } = useEmpresa();
  const { responsaveis } = useResponsaveisTecnicos();
  const laudosExistentes = porEquipamento(equipamento.id);
  const [mode, setMode] = useState<"lista" | "form">("lista");
  const [editing, setEditing] = useState<LaudoCondenacao | null>(null);
  const [form, setForm] = useState<Partial<LaudoCondenacao>>(emptyLaudo(equipamento));
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("id");
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  useEffect(() => {
    if (open) {
      setMode("lista");
      setEditing(null);
      setForm(emptyLaudo(equipamento));
      setTab("id");
    }
  }, [open, equipamento]);

  const setField = (k: keyof LaudoCondenacao, v: any) => setForm(p => ({ ...p, [k]: v }));

  const pct = useMemo(() => {
    if (!form.valor_novo_equivalente) return 0;
    return ((form.custo_reparo || 0) / form.valor_novo_equivalente) * 100;
  }, [form.custo_reparo, form.valor_novo_equivalente]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyLaudo(equipamento));
    setMode("form");
    setTab("id");
  };
  const startEdit = (l: LaudoCondenacao) => {
    setEditing(l);
    setForm(l);
    setMode("form");
    setTab("id");
  };

  const salvar = async (): Promise<LaudoCondenacao | null> => {
    if (!form.responsavel_tecnico) { toast.error("Informe o responsável técnico."); setTab("id"); return null; }
    if (!(form.motivos_condenacao || []).some(m => m.trim())) { toast.error("Informe ao menos um motivo."); setTab("fund"); return null; }
    setSaving(true);
    try {
      const clean = { ...form, motivos_condenacao: (form.motivos_condenacao || []).filter(m => m.trim()) };
      let saved: LaudoCondenacao | null = null;
      if (editing) {
        const ok = await updateLaudo(editing.id, clean);
        if (ok) saved = { ...editing, ...clean } as LaudoCondenacao;
      } else {
        saved = await addLaudo(clean);
      }
      if (saved && clean.parecer === "APROVADO PARA CONDENAÇÃO") {
        await updateEquipamento(equipamento.id, { situacao: "Condenado" });
        toast.success("Laudo salvo. Situação do equipamento atualizada para Condenado.");
      } else if (saved) {
        toast.success("Laudo salvo.");
      }
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const empresaTimbrado = {
    razaoSocial: empresa?.razaoSocial,
    nomeFantasia: empresa?.nomeFantasia,
    cnpj: empresa?.cnpj,
    logoUrl: empresa?.logoUrl,
    logradouro: empresa?.logradouro,
    numero: empresa?.numero,
    complemento: empresa?.complemento,
    bairro: empresa?.bairro,
    cidade: empresa?.cidade,
    uf: empresa?.uf,
    cep: empresa?.cep,
    telefone: empresa?.telefone,
    email: empresa?.email,
    site: empresa?.site,
  };

  const salvarEGerarPdf = async () => {
    const saved = await salvar();
    if (saved) {
      const ass = assinaturasPorLaudo(saved.id);
      await gerarPdfLaudoCondenacao(saved, empresaTimbrado, ass[0]);
      setMode("lista");
    }
  };

  const salvarSomente = async () => {
    const saved = await salvar();
    if (saved) setMode("lista");
  };

  const imprimir = async (l: LaudoCondenacao) => {
    const ass = assinaturasPorLaudo(l.id);
    await gerarPdfLaudoCondenacao(l, empresaTimbrado, ass[0]);
  };

  const uploadAnexo = async (files: FileList, campo: "anexos_orcamentos" | "outros_anexos") => {
    const atuais = (form[campo] as AnexoLaudo[]) || [];
    const novos: AnexoLaudo[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: máx 10MB`); continue; }
      const path = `laudos-condenacao/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) { toast.error("Erro upload"); continue; }
      const { data } = supabase.storage.from("documentos").getPublicUrl(path);
      novos.push({ nome: file.name, path, url: data.publicUrl, tamanho: file.size });
    }
    setField(campo, [...atuais, ...novos]);
  };

  const removerAnexo = async (idx: number, campo: "anexos_orcamentos" | "outros_anexos") => {
    const atuais = (form[campo] as AnexoLaudo[]) || [];
    await supabase.storage.from("documentos").remove([atuais[idx].path]);
    setField(campo, atuais.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "lista" ? "Laudos de Condenação" : editing ? "Editar Laudo" : "Novo Laudo de Condenação"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">— {equipamento.equipamento} {equipamento.tag && `(${equipamento.tag})`}</span>
          </DialogTitle>
        </DialogHeader>

        {mode === "lista" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" />Novo Laudo</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Parecer</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laudosExistentes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum laudo emitido para este equipamento.</TableCell></TableRow>
                ) : laudosExistentes.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{String(l.numero).padStart(3, "0")}/{l.data_emissao ? new Date(l.data_emissao).getFullYear() : "----"}</TableCell>
                    <TableCell>{l.data_emissao ? l.data_emissao.split("-").reverse().join("/") : "-"}</TableCell>
                    <TableCell>{l.responsavel_tecnico || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={l.parecer === "APROVADO PARA CONDENAÇÃO" ? "destructive" : "secondary"} className="text-xs">
                        {l.parecer || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => imprimir(l)} title="Imprimir PDF"><Printer className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(l)} title="Editar"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => requestDelete(l.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => { if (!o) cancelDelete(); }} onConfirm={async () => { if (deleteId) { await deleteLaudo(deleteId); toast.success("Laudo removido."); } }} />
          </div>
        )}

        {mode === "form" && (
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-7 w-full">
                <TabsTrigger value="id">1. Identificação</TabsTrigger>
                <TabsTrigger value="hist">2. Histórico</TabsTrigger>
                <TabsTrigger value="insp">3. Inspeção</TabsTrigger>
                <TabsTrigger value="fund">4. Fundamentação</TabsTrigger>
                <TabsTrigger value="concl">5. Conclusão</TabsTrigger>
                <TabsTrigger value="anexos">6. Anexos</TabsTrigger>
                <TabsTrigger value="assinatura">7. Assinatura</TabsTrigger>
              </TabsList>

              <TabsContent value="id" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo do equipamento</Label><Input value={form.tipo || ""} onChange={e => setField("tipo", e.target.value)} /></div>
                  <div><Label>Marca</Label><Input value={form.marca || ""} onChange={e => setField("marca", e.target.value)} /></div>
                  <div><Label>Modelo</Label><Input value={form.modelo || ""} onChange={e => setField("modelo", e.target.value)} /></div>
                  <div><Label>Nº de série</Label><Input value={form.serie || ""} onChange={e => setField("serie", e.target.value)} /></div>
                  <div><Label>Patrimônio/TAG</Label><Input value={form.patrimonio || ""} onChange={e => setField("patrimonio", e.target.value)} /></div>
                  <div><Label>Ano de fabricação</Label><Input value={form.ano_fabricacao || ""} onChange={e => setField("ano_fabricacao", e.target.value)} /></div>
                  <div><Label>Data de aquisição</Label><Input type="date" value={form.data_aquisicao || ""} onChange={e => setField("data_aquisicao", e.target.value)} /></div>
                  <div><Label>Localização atual</Label><Input value={form.localizacao || ""} onChange={e => setField("localizacao", e.target.value)} /></div>
                  <div className="col-span-2"><Label>Estado de conservação aparente</Label><Input value={form.estado_conservacao || ""} onChange={e => setField("estado_conservacao", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                  <div><Label>Data de emissão *</Label><Input type="date" value={form.data_emissao || ""} onChange={e => setField("data_emissao", e.target.value)} /></div>
                  <div>
                    <Label>Responsável técnico *</Label>
                    <Select
                      value={form.responsavel_tecnico || ""}
                      onValueChange={(v) => {
                        const rt = responsaveis.find(r => r.nome === v);
                        setField("responsavel_tecnico", v);
                        setField("registro_profissional", rt?.crea || "");
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {responsaveis.map(r => (
                          <SelectItem key={r.id} value={r.nome}>{r.nome}{r.titulo ? ` — ${r.titulo}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Registro (CFT/CREA)</Label><Input value={form.registro_profissional || ""} onChange={e => setField("registro_profissional", e.target.value)} readOnly /></div>
                </div>
              </TabsContent>

              <TabsContent value="hist" className="pt-3">
                <Label>Histórico técnico do equipamento</Label>
                <Textarea rows={12} value={form.historico || ""} onChange={e => setField("historico", e.target.value)} placeholder="Descreva o histórico de uso, manutenções, ocorrências, reparos anteriores..." />
              </TabsContent>

              <TabsContent value="insp" className="space-y-3 pt-3">
                <div><Label>3.1 Condições Físicas</Label><Textarea rows={4} value={form.insp_condicoes_fisicas || ""} onChange={e => setField("insp_condicoes_fisicas", e.target.value)} placeholder="Carcaça, componentes estruturais, oxidação, trincas, deformações..." /></div>
                <div><Label>3.2 Condições Elétricas/Eletrônicas</Label><Textarea rows={4} value={form.insp_condicoes_eletricas || ""} onChange={e => setField("insp_condicoes_eletricas", e.target.value)} placeholder="Componentes elétricos, circuitos, fontes, placas, cablagens, isolação..." /></div>
                <div><Label>3.3 Condições Mecânicas</Label><Textarea rows={4} value={form.insp_condicoes_mecanicas || ""} onChange={e => setField("insp_condicoes_mecanicas", e.target.value)} placeholder="Partes móveis, rolamentos, engrenagens, vedações, lubrificação, folgas..." /></div>
                <div><Label>3.4 Funcionalidade</Label><Textarea rows={4} value={form.insp_funcionalidade || ""} onChange={e => setField("insp_funcionalidade", e.target.value)} placeholder="Testes de operação realizados e resultados obtidos..." /></div>
              </TabsContent>

              <TabsContent value="fund" className="space-y-4 pt-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Motivos técnicos da condenação</Label>
                    <Button size="sm" variant="outline" onClick={() => setField("motivos_condenacao", [...(form.motivos_condenacao || []), ""])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar motivo
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {(form.motivos_condenacao || []).map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="pt-2 text-sm text-muted-foreground w-6">{i + 1}.</span>
                        <Textarea rows={2} value={m} onChange={e => {
                          const arr = [...(form.motivos_condenacao || [])];
                          arr[i] = e.target.value;
                          setField("motivos_condenacao", arr);
                        }} />
                        <Button size="icon" variant="ghost" onClick={() => setField("motivos_condenacao", (form.motivos_condenacao || []).filter((_, x) => x !== i))}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Card><CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Análise de viabilidade econômica</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Custo estimado de reparo (R$)</Label><Input type="number" step="0.01" value={form.custo_reparo || ""} onChange={e => setField("custo_reparo", Number(e.target.value))} /></div>
                    <div><Label>Valor residual (R$)</Label><Input type="number" step="0.01" value={form.valor_residual || ""} onChange={e => setField("valor_residual", Number(e.target.value))} /></div>
                    <div><Label>Valor equipamento novo (R$)</Label><Input type="number" step="0.01" value={form.valor_novo_equivalente || ""} onChange={e => setField("valor_novo_equivalente", Number(e.target.value))} /></div>
                  </div>
                  <div className="text-sm">
                    Custo de reparo representa <strong>{pct.toFixed(1)}%</strong> do valor de um equipamento novo →{" "}
                    <Badge variant={pct >= 50 ? "destructive" : "default"}>{pct >= 50 ? "Inviável" : pct > 0 ? "Viável" : "-"}</Badge>
                  </div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="concl" className="space-y-3 pt-3">
                <div><Label>Condições (texto que completa a conclusão)</Label><Input value={form.conclusao_condicoes || ""} onChange={e => setField("conclusao_condicoes", e.target.value)} placeholder="ex.: irrecuperáveis / críticas / de risco iminente" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Parecer técnico *</Label>
                    <Select value={form.parecer || ""} onValueChange={v => setField("parecer", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APROVADO PARA CONDENAÇÃO">APROVADO PARA CONDENAÇÃO</SelectItem>
                        <SelectItem value="REPROVADO">REPROVADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data da inspeção</Label><Input type="date" value={form.data_inspecao || ""} onChange={e => setField("data_inspecao", e.target.value)} /></div>
                  <div><Label>Local da inspeção</Label><Input value={form.local_inspecao || ""} onChange={e => setField("local_inspecao", e.target.value)} /></div>
                </div>
                {form.parecer === "APROVADO PARA CONDENAÇÃO" && (
                  <div className="text-xs text-muted-foreground border-l-2 border-destructive pl-3">
                    Ao salvar, a situação do equipamento será alterada automaticamente para <strong>Condenado</strong>.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="anexos" className="space-y-4 pt-3">
                <FotosLaudoEditor fotos={form.fotos || []} onChange={(f) => setField("fotos", f)} />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Orçamentos de reparo</Label>
                    <label>
                      <Button type="button" size="sm" variant="outline" asChild><span><Upload className="h-3 w-3 mr-1" />Anexar</span></Button>
                      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => e.target.files && uploadAnexo(e.target.files, "anexos_orcamentos")} />
                    </label>
                  </div>
                  {(form.anexos_orcamentos || []).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary hover:underline">{a.nome}</a>
                      <Button size="icon" variant="ghost" onClick={() => removerAnexo(i, "anexos_orcamentos")}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Outros anexos</Label>
                    <label>
                      <Button type="button" size="sm" variant="outline" asChild><span><Upload className="h-3 w-3 mr-1" />Anexar</span></Button>
                      <input type="file" multiple className="hidden" onChange={e => e.target.files && uploadAnexo(e.target.files, "outros_anexos")} />
                    </label>
                  </div>
                  {(form.outros_anexos || []).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary hover:underline">{a.nome}</a>
                      <Button size="icon" variant="ghost" onClick={() => removerAnexo(i, "outros_anexos")}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  <Textarea rows={2} placeholder="Observações sobre outros anexos" value={form.observacoes_outros || ""} onChange={e => setField("observacoes_outros", e.target.value)} />
                </div>
              </TabsContent>

              <TabsContent value="assinatura" className="space-y-3 pt-3">
                {!editing?.id ? (
                  <div className="text-sm text-muted-foreground border rounded p-4 text-center">
                    Salve o laudo antes de assiná-lo eletronicamente.
                  </div>
                ) : (
                  <AssinaturaEletronicaLaudo
                    laudo={editing}
                    assinaturaExistente={assinaturasPorLaudo(editing.id)[0]}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          {mode === "form" ? (
            <>
              <Button variant="outline" onClick={() => setMode("lista")}>Voltar</Button>
              <Button variant="outline" onClick={salvarSomente} disabled={saving}>Salvar</Button>
              <Button onClick={salvarEGerarPdf} disabled={saving}>
                <FileDown className="h-4 w-4 mr-1" />Salvar e Gerar PDF
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
