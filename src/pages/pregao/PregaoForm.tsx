import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, Gavel, Pencil, Check, X } from "lucide-react";
import { usePregao, type Pregao, type PregaoItem, type PregaoDocumentoExigido } from "@/contexts/PregaoContext";
import { usePermissao } from "@/hooks/usePermissao";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumeroAno } from "@/lib/formatNumero";
import { toast } from "sonner";
import { valorPorExtenso, formatMilharBR, parseMilharBR } from "@/lib/valorPorExtenso";
import EditalAnexosTab from "@/components/pregao/EditalAnexosTab";

const EMPTY: Omit<Pregao, "id" | "numero" | "createdAt"> = {
  objeto: "",
  modalidade: "Aberto",
  tipoDisputa: "Item",
  valorEstimado: 0,
  valorEstimadoSigiloso: true,
  decrementoMinimo: 0,
  decrementoTipo: "reais",
  tempoDisputaMin: 10,
  tempoProrrogacaoMin: 2,
  dataPublicacao: "",
  dataAberturaCredenciamento: "",
  dataAberturaPropostas: "",
  dataInicioDisputa: "",
  dataEncerramentoDisputa: "",
  status: "Rascunho",
  termoParticipacao: "O fornecedor declara estar ciente das condições e regras estabelecidas neste pregão e aceita os termos para participação.",
  termoHash: "",
  pregoeiroId: "",
  pregoeiroNome: "",
  observacoes: "",
  motivoCancelamento: "",
  resultadoPublico: false,
};

const DOCS_PADRAO = [
  "Cartão CNPJ",
  "Contrato Social ou Estatuto",
  "Certidão Negativa Federal",
  "Certidão Negativa Estadual",
  "Certidão Negativa Municipal",
  "Certidão de Regularidade do FGTS",
  "Certidão Negativa de Débitos Trabalhistas",
  "Atestado de Capacidade Técnica",
];

export default function PregaoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { usuarioLogado } = useAuth();
  const { pregoes, itens, documentos, participantes, addPregao, updatePregao,
          addItem, updateItem, deleteItem, addDocumento, deleteDocumento } = usePregao();
  const { tem } = usePermissao();

  const editing = id && id !== "novo" ? pregoes.find(p => p.id === id) : undefined;
  const readOnly = !!editing && editing.status !== "Rascunho" && editing.status !== "Publicado";
  const podeEditar = tem("pregao.criar") && !readOnly;

  const [form, setForm] = useState<Omit<Pregao, "id" | "numero" | "createdAt">>(EMPTY);
  const [pregaoId, setPregaoId] = useState<string | null>(editing?.id ?? null);

  useEffect(() => {
    if (editing) {
      setForm({ ...editing });
      setPregaoId(editing.id);
    }
  }, [editing?.id]);

  const meusItens = useMemo(() => itens.filter(i => i.pregaoId === pregaoId).sort((a,b) => a.ordem - b.ordem), [itens, pregaoId]);
  const meusDocs = useMemo(() => documentos.filter(d => d.pregaoId === pregaoId).sort((a,b) => a.ordem - b.ordem), [documentos, pregaoId]);
  const meusPart = useMemo(() => participantes.filter(p => p.pregaoId === pregaoId), [participantes, pregaoId]);

  const handleSaveDados = async () => {
    const payload = {
      ...form,
      pregoeiroId: form.pregoeiroId || usuarioLogado?.id || "",
      pregoeiroNome: form.pregoeiroNome || usuarioLogado?.nome || "",
    };
    if (pregaoId) {
      const ok = await updatePregao(pregaoId, payload);
      if (ok) toast.success("Pregão atualizado.");
    } else {
      const p = await addPregao(payload);
      if (p) {
        toast.success(`Pregão ${formatNumeroAno(p.numero, p.createdAt)} criado.`);
        setPregaoId(p.id);
        nav(`/compras/pregao/${p.id}`, { replace: true });
      }
    }
  };

  // ============ ITENS ============
  const [novoItem, setNovoItem] = useState<Omit<PregaoItem, "id">>({
    pregaoId: "", ordem: 1, agrupamento: "Item", loteCodigo: "",
    materialId: "", descricao: "", unidade: "UN", quantidade: 1,
    precoReferencia: 0, precoReferenciaSigiloso: true, status: "Aguardando",
    iniciadoEm: "", encerraEm: "", encerradoEm: "",
    vencedorParticipanteId: "", vencedorValor: 0, vencedorValorUnitario: 0, observacoes: "",
  });

  const handleAddItem = async () => {
    if (!pregaoId) { toast.error("Salve os dados gerais primeiro."); return; }
    if (!novoItem.descricao) { toast.error("Informe a descrição do item."); return; }
    const ok = await addItem({ ...novoItem, pregaoId, ordem: meusItens.length + 1 });
    if (ok) {
      setNovoItem({ ...novoItem, descricao: "", quantidade: 1, precoReferencia: 0, loteCodigo: "" });
    }
  };
  // Edição inline de itens
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Partial<PregaoItem>>({});

  const startEdit = (it: PregaoItem) => {
    setEditItemId(it.id);
    setEditItem({
      agrupamento: it.agrupamento, loteCodigo: it.loteCodigo, descricao: it.descricao,
      unidade: it.unidade, quantidade: it.quantidade, precoReferencia: it.precoReferencia,
    });
  };
  const cancelEdit = () => { setEditItemId(null); setEditItem({}); };
  const saveEdit = async () => {
    if (!editItemId) return;
    if (!editItem.descricao) { toast.error("Descrição obrigatória."); return; }
    const ok = await updateItem(editItemId, editItem);
    if (ok) { toast.success("Item atualizado."); cancelEdit(); }
  };

  // ============ DOCUMENTOS ============
  const [novoDoc, setNovoDoc] = useState({ nome: "", descricao: "", obrigatorio: true });

  const handleAddDoc = async () => {
    if (!pregaoId) { toast.error("Salve os dados gerais primeiro."); return; }
    if (!novoDoc.nome) return;
    await addDocumento({ pregaoId, ...novoDoc, ordem: meusDocs.length + 1 });
    setNovoDoc({ nome: "", descricao: "", obrigatorio: true });
  };

  const handleSeedDocs = async () => {
    if (!pregaoId) return;
    for (const [i, nome] of DOCS_PADRAO.entries()) {
      await addDocumento({ pregaoId, nome, descricao: "", obrigatorio: true, ordem: meusDocs.length + i + 1 });
    }
    toast.success("Documentos padrão adicionados.");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/compras/pregao")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="p-2 rounded-xl bg-primary/10 text-primary"><Gavel className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-semibold">
              {editing ? `Pregão ${formatNumeroAno(editing.numero, editing.createdAt)}` : "Novo Pregão"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editing && <Badge variant="outline" className="mr-2">{editing.status}</Badge>}
              {readOnly ? "Somente leitura — disputa já iniciada" : "Preencha os dados, itens e documentos exigidos"}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
          <TabsTrigger value="itens" disabled={!pregaoId}>Itens / Lotes ({meusItens.length})</TabsTrigger>
          <TabsTrigger value="documentos" disabled={!pregaoId}>Documentos Exigidos ({meusDocs.length})</TabsTrigger>
          <TabsTrigger value="edital" disabled={!pregaoId}>Anexos do Edital</TabsTrigger>
          <TabsTrigger value="termo" disabled={!pregaoId}>Termo de Participação</TabsTrigger>
          <TabsTrigger value="participantes" disabled={!pregaoId}>Participantes ({meusPart.length})</TabsTrigger>
        </TabsList>

        {/* ===== DADOS GERAIS ===== */}
        <TabsContent value="dados">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Dados do Pregão</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label>Objeto do Pregão *</Label>
                <Textarea value={form.objeto} onChange={e => setForm({ ...form, objeto: e.target.value })} rows={2} disabled={!podeEditar} />
              </div>
              <div>
                <Label>Modalidade *</Label>
                <Select value={form.modalidade} onValueChange={(v: any) => setForm({ ...form, modalidade: v })} disabled={!podeEditar}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberto">Aberto (lances livres + prorrogação)</SelectItem>
                    <SelectItem value="Aberto-Fechado">Aberto-Fechado</SelectItem>
                    <SelectItem value="Fechado">Fechado (proposta lacrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Disputa *</Label>
                <Select value={form.tipoDisputa} onValueChange={(v: any) => setForm({ ...form, tipoDisputa: v })} disabled={!podeEditar}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Item">Por item</SelectItem>
                    <SelectItem value="Lote">Por lote</SelectItem>
                    <SelectItem value="Misto">Misto (item + lote)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Estimado Total (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.valorEstimado ? formatMilharBR(form.valorEstimado) : ""}
                  onChange={e => setForm({ ...form, valorEstimado: parseMilharBR(e.target.value) })}
                  disabled={!podeEditar}
                  placeholder="0,00"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Switch checked={form.valorEstimadoSigiloso} onCheckedChange={v => setForm({ ...form, valorEstimadoSigiloso: v })} disabled={!podeEditar} />
                  <span className="text-xs text-muted-foreground">Sigiloso (oculto para fornecedores)</span>
                </div>
                {form.valorEstimado > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 italic first-letter:uppercase">
                    {valorPorExtenso(form.valorEstimado)}
                  </p>
                )}
              </div>
              <div>
                <Label>Decremento Mínimo</Label>
                <div className="flex gap-2">
                  <Input type="number" value={form.decrementoMinimo} onChange={e => setForm({ ...form, decrementoMinimo: Number(e.target.value) })} disabled={!podeEditar} />
                  <Select value={form.decrementoTipo} onValueChange={(v: any) => setForm({ ...form, decrementoTipo: v })} disabled={!podeEditar}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reais">R$</SelectItem>
                      <SelectItem value="percentual">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Tempo de Disputa (min)</Label>
                <Input type="number" value={form.tempoDisputaMin} onChange={e => setForm({ ...form, tempoDisputaMin: Number(e.target.value) })} disabled={!podeEditar} />
              </div>
              <div>
                <Label>Prorrogação Automática (min)</Label>
                <Input type="number" value={form.tempoProrrogacaoMin} onChange={e => setForm({ ...form, tempoProrrogacaoMin: Number(e.target.value) })} disabled={!podeEditar} />
              </div>
              <div>
                <Label>Abertura do Credenciamento</Label>
                <Input type="datetime-local" value={form.dataAberturaCredenciamento?.slice(0,16)} onChange={e => setForm({ ...form, dataAberturaCredenciamento: e.target.value })} disabled={!podeEditar} />
              </div>
              <div>
                <Label>Abertura das Propostas</Label>
                <Input type="datetime-local" value={form.dataAberturaPropostas?.slice(0,16)} onChange={e => setForm({ ...form, dataAberturaPropostas: e.target.value })} disabled={!podeEditar} />
              </div>
              <div>
                <Label>Início da Disputa</Label>
                <Input type="datetime-local" value={form.dataInicioDisputa?.slice(0,16)} onChange={e => setForm({ ...form, dataInicioDisputa: e.target.value })} disabled={!podeEditar} />
              </div>
              <div className="md:col-span-3">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} disabled={!podeEditar} />
              </div>
              {podeEditar && (
                <div className="md:col-span-3 flex justify-end">
                  <Button onClick={handleSaveDados} className="rounded-xl"><Save className="h-4 w-4 mr-2" /> Salvar Dados</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ITENS ===== */}
        <TabsContent value="itens">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Itens e Lotes em disputa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {podeEditar && (
                <div className="grid grid-cols-12 gap-2 p-3 bg-muted/30 rounded-lg items-end">
                  <div className="col-span-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={novoItem.agrupamento} onValueChange={(v: any) => setNovoItem({ ...novoItem, agrupamento: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Item">Item</SelectItem>
                        <SelectItem value="Lote">Lote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Lote</Label>
                    <Input value={novoItem.loteCodigo} onChange={e => setNovoItem({ ...novoItem, loteCodigo: e.target.value })} placeholder="L1" />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">Descrição *</Label>
                    <Input value={novoItem.descricao} onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Un.</Label>
                    <Input value={novoItem.unidade} onChange={e => setNovoItem({ ...novoItem, unidade: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" value={novoItem.quantidade} onChange={e => setNovoItem({ ...novoItem, quantidade: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Preço Ref. (R$)</Label>
                    <Input type="number" value={novoItem.precoReferencia} onChange={e => setNovoItem({ ...novoItem, precoReferencia: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-1">
                    <Button onClick={handleAddItem} className="w-full rounded-xl"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço Ref.</TableHead>
                    <TableHead>Status</TableHead>
                    {podeEditar && <TableHead className="w-[60px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meusItens.length === 0 && (
                    <TableRow><TableCell colSpan={podeEditar ? 9 : 8} className="text-center text-muted-foreground py-6">Nenhum item adicionado.</TableCell></TableRow>
                  )}
                  {meusItens.map((it, idx) => {
                    const isEditing = editItemId === it.id;
                    return (
                    <TableRow key={it.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <TableCell>{it.ordem}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select value={editItem.agrupamento} onValueChange={(v: any) => setEditItem({ ...editItem, agrupamento: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Item">Item</SelectItem>
                              <SelectItem value="Lote">Lote</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <Badge variant="outline">{it.agrupamento}</Badge>}
                      </TableCell>
                      <TableCell>
                        {isEditing
                          ? <Input className="h-8 w-16" value={editItem.loteCodigo || ""} onChange={e => setEditItem({ ...editItem, loteCodigo: e.target.value })} />
                          : (it.loteCodigo || "-")}
                      </TableCell>
                      <TableCell>
                        {isEditing
                          ? <Input className="h-8" value={editItem.descricao || ""} onChange={e => setEditItem({ ...editItem, descricao: e.target.value })} />
                          : it.descricao}
                      </TableCell>
                      <TableCell>
                        {isEditing
                          ? <Input className="h-8 w-16" value={editItem.unidade || ""} onChange={e => setEditItem({ ...editItem, unidade: e.target.value })} />
                          : it.unidade}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing
                          ? <Input type="number" className="h-8 w-24 text-right" value={editItem.quantidade ?? 0} onChange={e => setEditItem({ ...editItem, quantidade: Number(e.target.value) })} />
                          : it.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing
                          ? <Input type="number" step="0.01" className="h-8 w-28 text-right" value={editItem.precoReferencia ?? 0} onChange={e => setEditItem({ ...editItem, precoReferencia: Number(e.target.value) })} />
                          : it.precoReferencia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{it.status}</Badge></TableCell>
                      {podeEditar && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={saveEdit}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(it)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600"
                                  onClick={() => { if (confirm("Excluir este item?")) deleteItem(it.id); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DOCUMENTOS ===== */}
        <TabsContent value="documentos">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Documentos exigidos para habilitação</CardTitle>
              {podeEditar && meusDocs.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleSeedDocs}>Adicionar lista padrão</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {podeEditar && (
                <div className="grid grid-cols-12 gap-2 p-3 bg-muted/30 rounded-lg items-end">
                  <div className="col-span-4">
                    <Label className="text-xs">Nome do documento *</Label>
                    <Input value={novoDoc.nome} onChange={e => setNovoDoc({ ...novoDoc, nome: e.target.value })} />
                  </div>
                  <div className="col-span-6">
                    <Label className="text-xs">Descrição / instruções</Label>
                    <Input value={novoDoc.descricao} onChange={e => setNovoDoc({ ...novoDoc, descricao: e.target.value })} />
                  </div>
                  <div className="col-span-1 flex items-center gap-2 pb-2">
                    <Switch checked={novoDoc.obrigatorio} onCheckedChange={v => setNovoDoc({ ...novoDoc, obrigatorio: v })} />
                    <span className="text-xs">Obrig.</span>
                  </div>
                  <div className="col-span-1">
                    <Button onClick={handleAddDoc} className="w-full rounded-xl"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px] text-center">Obrigatório</TableHead>
                    {podeEditar && <TableHead className="w-[60px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meusDocs.length === 0 && (
                    <TableRow><TableCell colSpan={podeEditar ? 5 : 4} className="text-center text-muted-foreground py-6">Nenhum documento exigido.</TableCell></TableRow>
                  )}
                  {meusDocs.map((d, idx) => (
                    <TableRow key={d.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <TableCell>{d.ordem}</TableCell>
                      <TableCell>{d.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{d.descricao || "-"}</TableCell>
                      <TableCell className="text-center">{d.obrigatorio ? <Badge>Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                      {podeEditar && (
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600"
                            onClick={() => { if (confirm("Remover este documento?")) deleteDocumento(d.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ANEXOS DO EDITAL ===== */}
        <TabsContent value="edital">
          {pregaoId && <EditalAnexosTab pregaoId={pregaoId} podeEditar={podeEditar} />}
        </TabsContent>

        {/* ===== TERMO ===== */}
        <TabsContent value="termo">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Termo de participação</CardTitle>
              <p className="text-xs text-muted-foreground">Texto que o fornecedor deverá aceitar ao se credenciar. Aceite é registrado com IP, data e hash SHA-256 deste texto.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea rows={12} value={form.termoParticipacao} onChange={e => setForm({ ...form, termoParticipacao: e.target.value })} disabled={!podeEditar} className="font-mono text-sm" />
              {podeEditar && (
                <div className="flex justify-end">
                  <Button onClick={handleSaveDados}><Save className="h-4 w-4 mr-2" /> Salvar Termo</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PARTICIPANTES ===== */}
        <TabsContent value="participantes">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Fornecedores credenciados</CardTitle>
              <p className="text-xs text-muted-foreground">Lista preenchida automaticamente conforme fornecedores aceitam o termo no Portal do Fornecedor.</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apelido (anônimo)</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Aceite</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meusPart.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum fornecedor credenciado ainda.</TableCell></TableRow>
                  )}
                  {meusPart.map((p, idx) => (
                    <TableRow key={p.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <TableCell className="font-mono">{p.apelido}</TableCell>
                      <TableCell>{p.fornecedorNome}</TableCell>
                      <TableCell>{p.fornecedorCnpj}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.termoAceitoEm ? new Date(p.termoAceitoEm).toLocaleString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
