import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/contexts/ClientesContext";
import { usePermissao } from "@/hooks/usePermissao";
import TomadorSelect from "@/components/financeiro/TomadorSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contratoEventualValido, numeroEventual, servicoEventualSchema, valoresEventuais } from "@/lib/servicosEventuais";
import type { Database } from "@/integrations/supabase/types";

type Linha = Database["public"]["Tables"]["servicos_eventuais"]["Row"];
const vazio = { grupo: "", subgrupo: "", item: "", discriminacao: "", unidade: "", quantidade: "", preco_unitario: "", citl_percentual: "", referencia: "" };
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ServicosEventuaisCadastro() {
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Linha | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [form, setForm] = useState(vazio);
  const cliente = clientes.find(c => c.id === clienteId && c.tipo === "Cliente");
  const contratos = cliente?.contratos ?? [];
  const vinculo = contratoEventualValido(clienteId, contratoId, clientes);
  const chave = ["servicos-eventuais", clienteId, contratoId];
  const { data: linhas = [], isFetching, error, refetch } = useQuery({
    queryKey: chave, enabled: vinculo,
    queryFn: async () => {
      const resultado: Linha[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase.from("servicos_eventuais").select("*").eq("cliente_id", clienteId).eq("contrato_id", contratoId).order("item").order("id").range(inicio, inicio + 999);
        if (error) throw error;
        resultado.push(...data);
        if (data.length < 1000) return resultado;
      }
    },
  });
  const filtradas = useMemo(() => linhas.filter(l => normalizar(`${l.item} ${l.grupo} ${l.subgrupo} ${l.discriminacao} ${l.referencia}`).includes(normalizar(busca))).sort((a, b) => a.item.localeCompare(b.item, "pt-BR", { numeric: true })), [linhas, busca]);
  const totais = filtradas.reduce((s, l) => ({ sem: s.sem + (l.total_sem_citl ?? 0), com: s.com + (l.total_com_citl ?? 0) }), { sem: 0, com: 0 });
  const paginas = Math.max(1, Math.ceil(filtradas.length / 10));
  const paginaAtual = Math.min(pagina, paginas);
  const preview = valoresEventuais(numeroEventual(form.quantidade), numeroEventual(form.preco_unitario), numeroEventual(form.citl_percentual));
  function editar(linha?: Linha) {
    setEditando(linha?.id ?? null);
    setForm(linha ? { grupo: linha.grupo, subgrupo: linha.subgrupo, item: linha.item, discriminacao: linha.discriminacao, unidade: linha.unidade, quantidade: String(linha.quantidade).replace(".", ","), preco_unitario: String(linha.preco_unitario).replace(".", ","), citl_percentual: String(linha.citl_percentual).replace(".", ","), referencia: linha.referencia } : vazio);
    setAberto(true);
  }
  async function salvar() {
    if (!vinculo || !tem(editando ? "sco.editar" : "sco.criar")) { toast.error("Sem permissão ou vínculo inválido."); return; }
    const validado = servicoEventualSchema.safeParse({ ...form, cliente_id: clienteId, contrato_id: contratoId, quantidade: numeroEventual(form.quantidade), preco_unitario: numeroEventual(form.preco_unitario), citl_percentual: numeroEventual(form.citl_percentual) });
    if (!validado.success) { toast.error(validado.error.issues[0]?.message ?? "Confira os campos."); return; }
    setOcupado(true);
    try {
      const resultado = editando
        ? await supabase.from("servicos_eventuais").update(validado.data).eq("id", editando).eq("cliente_id", clienteId).eq("contrato_id", contratoId).select("id").single()
        : await supabase.from("servicos_eventuais").insert(validado.data).select("id").single();
      if (resultado.error) throw resultado.error;
      await qc.invalidateQueries({ queryKey: chave });
      setAberto(false); toast.success("Serviço eventual salvo.");
    } catch (e) { toast.error(e && typeof e === "object" && "code" in e && e.code === "23505" ? "Este item já existe neste contrato." : "Não foi possível salvar o serviço eventual."); }
    finally { setOcupado(false); }
  }
  async function remover() {
    if (!excluir || !tem("sco.excluir") || !vinculo) return;
    setOcupado(true);
    try {
      const { data, error } = await supabase.from("servicos_eventuais").delete().eq("id", excluir.id).eq("cliente_id", clienteId).eq("contrato_id", contratoId).select("id").single();
      if (error || !data) throw error;
      await qc.invalidateQueries({ queryKey: chave }); setExcluir(null); toast.success("Serviço eventual excluído.");
    } catch { toast.error("Não foi possível excluir o serviço eventual."); }
    finally { setOcupado(false); }
  }
  return (
    <section className="w-full space-y-5 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Serv. Eventuais</h1>
      <div className="grid gap-4 border-b border-border pb-5 md:grid-cols-2">
        <div className="space-y-2"><Label>Cliente</Label><TomadorSelect options={clientes.filter(c => c.tipo === "Cliente")} value={clienteId} placeholder="Selecione o cliente..." onValueChange={id => { setClienteId(id); setContratoId(""); setBusca(""); setPagina(1); }} /></div>
        <div className="space-y-2"><Label>Contrato</Label><Select value={contratoId} onValueChange={id => { setContratoId(id); setBusca(""); setPagina(1); }} disabled={!cliente}><SelectTrigger aria-label="Contrato"><SelectValue placeholder="Selecione o contrato..." /></SelectTrigger><SelectContent>{contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.numero} — {c.descricao || "Contrato"}</SelectItem>)}</SelectContent></Select>{cliente && contratos.length === 0 && <p className="text-sm text-muted-foreground">Este cliente não possui contratos cadastrados.</p>}</div>
      </div>
      {!vinculo ? <p className="text-sm text-muted-foreground">Selecione um cliente e contrato.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-lg"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar serviços eventuais" className="pl-9" placeholder="Buscar por item, grupo, discriminação ou referência..." value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></div>
          {tem("sco.criar") && <Button onClick={() => editar()}><Plus className="mr-2 h-4 w-4" />Novo item</Button>}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border pb-4 text-sm"><span><strong>{filtradas.length}</strong> itens</span><span>Total sem CITL: <strong>{moeda(totais.sem)}</strong></span><span>Total com CITL: <strong>{moeda(totais.com)}</strong></span></div>
        {error ? <div role="alert" className="flex items-center gap-3 text-destructive">Não foi possível carregar os serviços.<Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div> : isFetching && !linhas.length ? <p role="status">Carregando serviços...</p> : <div className="overflow-x-auto"><Table className="min-w-[1350px]"><TableHeader><TableRow>{["Item", "Discriminação", "Unidade", "Quantidade", "Preço unitário", "CITL (%)", "Unitário com CITL", "Total sem CITL", "Total com CITL", "Referência", "Ações"].map(t => <TableHead key={t} className="whitespace-nowrap">{t}</TableHead>)}</TableRow></TableHeader><TableBody>
          {!filtradas.length && <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Nenhum serviço eventual encontrado neste contrato.</TableCell></TableRow>}
          {filtradas.slice((paginaAtual - 1) * 10, paginaAtual * 10).map((l, i, lote) => <ServicoLinha key={l.id} linha={l} cabecalho={i === 0 || lote[i - 1]?.grupo !== l.grupo || lote[i - 1]?.subgrupo !== l.subgrupo} podeEditar={tem("sco.editar")} podeExcluir={tem("sco.excluir")} onEditar={() => editar(l)} onExcluir={() => setExcluir(l)} />)}
        </TableBody></Table></div>}
        <div className="flex items-center justify-end gap-3 text-sm"><Button variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button><span>{paginaAtual} / {paginas}</span><Button variant="outline" disabled={paginaAtual === paginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button></div>
      </>}
      <Dialog open={aberto} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editando ? "Editar" : "Novo"} serviço eventual</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{cliente?.nome} · Contrato {contratos.find(c => c.id === contratoId)?.numero}</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void salvar(); }}>
          <div className="grid gap-4 sm:grid-cols-2">{([['grupo','Grupo'],['subgrupo','Subgrupo'],['item','Item'],['unidade','Unidade']] as const).map(([campo, texto]) => <div className="space-y-2" key={campo}><Label htmlFor={`ev-${campo}`}>{texto}</Label><Input id={`ev-${campo}`} required={campo === "item" || campo === "unidade"} value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} /></div>)}</div>
          <div className="space-y-2"><Label htmlFor="ev-discriminacao">Discriminação</Label><Textarea id="ev-discriminacao" required rows={3} value={form.discriminacao} onChange={e => setForm(f => ({ ...f, discriminacao: e.target.value }))} /></div>
          <div className="grid gap-4 sm:grid-cols-3">{([['quantidade','Quantidade'],['preco_unitario','Preço unitário (R$)'],['citl_percentual','CITL (%)']] as const).map(([campo,texto]) => <div className="space-y-2" key={campo}><Label htmlFor={`ev-${campo}`}>{texto}</Label><Input id={`ev-${campo}`} inputMode="decimal" required value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} /></div>)}</div>
          <dl className="grid gap-3 border-y border-border py-4 text-sm sm:grid-cols-3"><div><dt>Unitário com CITL</dt><dd className="font-semibold">{moeda(preview.unitarioComCitl)}</dd></div><div><dt>Total sem CITL</dt><dd className="font-semibold">{moeda(preview.totalSemCitl)}</dd></div><div><dt>Total com CITL</dt><dd className="font-semibold">{moeda(preview.totalComCitl)}</dd></div></dl>
          <div className="space-y-2"><Label htmlFor="ev-referencia">Referência</Label><Textarea id="ev-referencia" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>
      <AlertDialog open={!!excluir} onOpenChange={v => { if (!v && !ocupado) setExcluir(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir serviço eventual?</AlertDialogTitle><AlertDialogDescription>Item {excluir?.item}: {excluir?.discriminacao}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={ocupado} onClick={e => { e.preventDefault(); void remover(); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}

function ServicoLinha({ linha: l, cabecalho, podeEditar, podeExcluir, onEditar, onExcluir }: { linha: Linha; cabecalho: boolean; podeEditar: boolean; podeExcluir: boolean; onEditar: () => void; onExcluir: () => void }) {
  return <>{cabecalho && (l.grupo || l.subgrupo) && <TableRow className="bg-muted/50"><TableCell colSpan={11} className="font-semibold whitespace-normal">{[l.grupo, l.subgrupo].filter(Boolean).join(" › ")}</TableCell></TableRow>}<TableRow><TableCell>{l.item}</TableCell><TableCell className="min-w-80 max-w-lg whitespace-normal break-words">{l.discriminacao}</TableCell><TableCell>{l.unidade}</TableCell><TableCell>{l.quantidade.toLocaleString("pt-BR")}</TableCell><TableCell className="whitespace-nowrap">{moeda(l.preco_unitario)}</TableCell><TableCell>{l.citl_percentual.toLocaleString("pt-BR")}%</TableCell><TableCell className="whitespace-nowrap">{moeda(l.unitario_com_citl ?? 0)}</TableCell><TableCell className="whitespace-nowrap">{moeda(l.total_sem_citl ?? 0)}</TableCell><TableCell className="whitespace-nowrap">{moeda(l.total_com_citl ?? 0)}</TableCell><TableCell className="min-w-48 max-w-xs whitespace-normal break-words">{l.referencia || "—"}</TableCell><TableCell><div className="flex gap-1">{podeEditar && <Button size="icon" variant="ghost" title="Editar item" aria-label={`Editar item ${l.item}`} onClick={onEditar}><Pencil className="h-4 w-4" /></Button>}{podeExcluir && <Button size="icon" variant="ghost" title="Excluir item" aria-label={`Excluir item ${l.item}`} onClick={onExcluir}><Trash2 className="h-4 w-4" /></Button>}</div></TableCell></TableRow></>;
}