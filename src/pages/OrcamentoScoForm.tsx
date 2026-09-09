import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ArrowLeft, Save, FileText, FileSpreadsheet, Search } from "lucide-react";
import { useOrcamentosSco, OrcamentoScoItem, ScoServico } from "@/contexts/OrcamentosScoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { gerarPdfOrcamentoSco } from "@/lib/gerarPdfOrcamentoSco";
import { gerarExcelOrcamentoSco } from "@/lib/gerarExcelOrcamentoSco";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

export default function OrcamentoScoForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const { orcamentos, add, update, searchServicos, listReferencias } = useOrcamentosSco();
  const { clientes } = useClientes() as any;
  const { empresa } = useEmpresa() as any;
  const { tem } = usePermissao();
  const podeCriar = tem("orcamentos_sco.criar");
  const podeEditar = tem("orcamentos_sco.editar");
  const podePdf = tem("orcamentos_sco.exportar");
  const podeExcel = tem("orcamentos_sco.exportar");

  const editing = id && id !== "novo" ? orcamentos.find((o) => o.id === id) : null;

  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [obra, setObra] = useState("");
  const [tipo, setTipo] = useState<"sintetica" | "analitica">("sintetica");
  const [bdi, setBdi] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<OrcamentoScoItem[]>([]);
  const [status, setStatus] = useState("Em elaboração");
  const [referencia, setReferencia] = useState<string>("");
  const [referencias, setReferencias] = useState<string[]>([]);

  useEffect(() => {
    listReferencias().then((r) => {
      setReferencias(r);
      if (!referencia && r.length > 0) setReferencia(r[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ScoServico[]>([]);

  useEffect(() => {
    if (editing) {
      setTitulo(editing.titulo);
      setClienteId(editing.cliente_id || "");
      setObra(editing.obra || "");
      setTipo(editing.tipo_analise);
      setBdi(String(editing.bdi));
      setDesconto(String(editing.desconto));
      setObservacoes(editing.observacoes || "");
      setItens(editing.itens || []);
      setStatus(editing.status);
      if (editing.referencia) setReferencia(editing.referencia);
    }
  }, [editing]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchOpen) setSearchResults(await searchServicos(searchQ, 30, referencia || undefined));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen, searchServicos, referencia]);

  const subtotal = useMemo(() => itens.reduce((s, i) => s + (i.preco_total || 0), 0), [itens]);
  const bdiNum = parseFloat(bdi.replace(",", ".")) || 0;
  const descNum = parseFloat(desconto.replace(",", ".")) || 0;
  const valorTotal = useMemo(() => {
    const sub = subtotal;
    const comBdi = sub * (1 + bdiNum / 100);
    return comBdi * (1 - descNum / 100);
  }, [subtotal, bdiNum, descNum]);

  const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const adicionarServico = (s: ScoServico) => {
    setItens((p) => [
      ...p,
      {
        servico_codigo: s.codigo,
        descricao: s.descricao,
        unidade: s.unidade || "",
        quantidade: 1,
        preco_unit: Number(s.preco) || 0,
        preco_total: Number(s.preco) || 0,
      },
    ]);
    setSearchOpen(false);
    setSearchQ("");
  };

  const updateItem = (idx: number, patch: Partial<OrcamentoScoItem>) => {
    setItens((p) => p.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.preco_total = (Number(merged.quantidade) || 0) * (Number(merged.preco_unit) || 0);
      return merged;
    }));
  };
  const removeItem = (idx: number) => setItens((p) => p.filter((_, i) => i !== idx));

  const salvar = async () => {
    if (editing ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!titulo.trim()) { toast.error("Informe o título do orçamento"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    const cliNome = clientes.find((c: any) => c.id === clienteId)?.nome || "";
    const payload = {
      titulo: titulo.trim(),
      cliente_id: clienteId || null,
      cliente_nome: cliNome,
      obra,
      tipo_analise: tipo,
      bdi: bdiNum,
      desconto: descNum,
      observacoes,
      referencia,
      itens,
      subtotal,
      valor_total: valorTotal,
      status,
    };
    if (editing) {
      await update(editing.id, payload as any);
      toast.success("Orçamento atualizado");
    } else {
      await add(payload as any);
      toast.success("Orçamento criado");
      nav("/orcamentos");
    }
  };

  const exportar = async (kind: "pdf" | "xlsx") => {
    if (kind === "pdf" && !podePdf) { toast.error("Você não possui permissão para exportar PDF."); return; }
    if (kind === "xlsx" && !podeExcel) { toast.error("Você não possui permissão para exportar Excel."); return; }
    const obj: any = {
      ...editing,
      ...{
        id: editing?.id || "tmp",
        numero: editing?.numero || 0,
        created_at: editing?.created_at || new Date().toISOString(),
        titulo, cliente_nome: clientes.find((c: any) => c.id === clienteId)?.nome || "",
        obra, tipo_analise: tipo, bdi: bdiNum, desconto: descNum, observacoes, referencia,
        itens, subtotal, valor_total: valorTotal, status,
      },
    };
    if (kind === "pdf") await gerarPdfOrcamentoSco(obj, empresa?.nome || "");
    else await gerarExcelOrcamentoSco(obj);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/orcamentos")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-serif font-bold">{editing ? `Orçamento Nº ${editing.numero}` : "Novo Orçamento SCO"}</h1>
        </div>
        <div className="flex gap-2">
          {podePdf && <Button variant="outline" onClick={() => exportar("pdf")}><FileText className="h-4 w-4 mr-1" /> PDF</Button>}
          {podeExcel && <Button variant="outline" onClick={() => exportar("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>}
          {(editing ? podeEditar : podeCriar) && <Button onClick={salvar} style={{ background: "#673ab7" }}><Save className="h-4 w-4 mr-1" /> Salvar</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2"><Label>Título *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div>
            <Label>Tipo de Análise</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sintetica">Sintética</SelectItem>
                <SelectItem value="analitica">Analítica (com composição)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId || "__none__"} onValueChange={(v) => setClienteId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(nenhum)</SelectItem>
                {clientes.filter((c: any) => c.tipo === "Cliente").map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Obra</Label><Input value={obra} onChange={(e) => setObra(e.target.value)} placeholder="(opcional)" /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Em elaboração", "Aprovado", "Reprovado", "Em revisão"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>BDI (%)</Label><Input value={bdi} onChange={(e) => setBdi(e.target.value)} /></div>
          <div><Label>Desconto (%)</Label><Input value={desconto} onChange={(e) => setDesconto(e.target.value)} /></div>
          <div>
            <Label>Tabela de Preços (Mês/Ano)</Label>
            <Select value={referencia || "__auto__"} onValueChange={(v) => setReferencia(v === "__auto__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">(qualquer)</SelectItem>
                {referencias.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3"><Label>Observações</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Itens de Serviço</CardTitle>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button style={{ background: "#673ab7" }}><Plus className="h-4 w-4 mr-1" /> Adicionar Item</Button>
              </PopoverTrigger>
              <PopoverContent className="w-[600px] p-0" align="end">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por código ou descrição..." value={searchQ} onValueChange={setSearchQ} />
                  <CommandList className="max-h-[400px]">
                    <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((s) => (
                        <CommandItem key={s.codigo} onSelect={() => adicionarServico(s)} value={s.codigo}>
                          <div className="flex flex-col gap-0.5 w-full">
                            <div className="flex justify-between gap-2">
                              <span className="font-mono text-xs font-bold">{s.codigo}</span>
                              <span className="text-xs text-muted-foreground">{s.unidade} • {fmt(Number(s.preco))}</span>
                            </div>
                            <span className="text-xs">{s.descricao}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Un</TableHead>
                <TableHead className="w-24">Qtd</TableHead>
                <TableHead className="w-32">Unit.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum item adicionado</TableCell></TableRow>}
              {itens.map((it, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{it.servico_codigo}</TableCell>
                  <TableCell className="text-xs">{it.descricao}</TableCell>
                  <TableCell>{it.unidade}</TableCell>
                  <TableCell><Input value={String(it.quantidade)} onChange={(e) => updateItem(i, { quantidade: parseFloat(e.target.value.replace(",", ".")) || 0 })} className="h-8" /></TableCell>
                  <TableCell><Input value={String(it.preco_unit)} onChange={(e) => updateItem(i, { preco_unit: parseFloat(e.target.value.replace(",", ".")) || 0 })} className="h-8" /></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(it.preco_total)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <div className="w-80 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>BDI ({bdiNum}%):</span><span>{fmt(subtotal * bdiNum / 100)}</span></div>
              <div className="flex justify-between"><span>Desconto ({descNum}%):</span><span>- {fmt(subtotal * (1 + bdiNum / 100) * descNum / 100)}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t" style={{ color: "#673ab7" }}>
                <span>Valor Total:</span><span>{fmt(valorTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
