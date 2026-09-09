import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { Plus, Trash2, Pencil, FileDown, Paperclip } from "lucide-react";
import { ContratosTerceirosProvider, useContratosTerceiros, type ContratoTerceiro, type ContratoAditivo } from "@/contexts/ContratosTerceirosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useObras } from "@/contexts/ObrasContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { fetchAll } from "@/lib/supabaseHelper";
import { gerarPdfContratoTerceiro } from "@/lib/gerarPdfContratoTerceiro";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


const STATUS = ["ativo", "encerrado", "suspenso", "cancelado"] as const;

const fmtMoney = (n?: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
};

const numeroAno = (numero?: number, createdAt?: string) => {
  const ano = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `${String(numero || 0).padStart(2, "0")}-${ano}`;
};

function ContratosInner() {
  const { contratos, loading, add, update, remove } = useContratosTerceiros();
  const { clientes } = useClientes();
  const { obras } = useObras();
  const { empresa } = useEmpresa();
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { materiais } = useMateriaisServicos();
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoTerceiro | null>(null);
  const [form, setForm] = useState<Partial<ContratoTerceiro>>({});
  const [filtro, setFiltro] = useState("");
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [pedidoSelId, setPedidoSelId] = useState<string>("");

  React.useEffect(() => {
    fetchAll("fin_centros_custo", "codigo").then((d) => setCentrosCusto(d as any[]));
  }, []);

  const fornecedores = useMemo(() => clientes.filter((c: any) => c.tipo === "Fornecedor"), [clientes]);
  const apenasClientes = useMemo(() => clientes.filter((c: any) => c.tipo === "Cliente"), [clientes]);
  const obrasDoCliente = useMemo(
    () => obras.filter((o) => o.cliente_id === form.cliente_id),
    [obras, form.cliente_id],
  );

  // PCs de serviços: somente pedidos cujos itens são todos do tipo "Serviço".
  // O itemId do pedido referencia o item da Requisição; o vínculo com o
  // cadastro de Materiais/Serviços é via requisicao.itens[].materialId.
  // Se o pedido não tiver requisição vinculada, tenta ler o materialId direto do item.
  const pedidosServico = useMemo(() => {
    const tipoByMaterialId = new Map(materiais.map((m: any) => [m.id, String(m.tipo || "").trim().toLowerCase()]));
    const reqById = new Map(requisicoes.map((r: any) => [r.id, r]));
    return pedidos.filter((p) => {
      if (!p.itens?.length) return false;
      const req: any = reqById.get(p.requisicaoId);
      const reqItens: any[] = req?.itens || [];
      return p.itens.every((it: any) => {
        // 1) Material via requisição vinculada
        const reqIt = reqItens.find((ri: any) => ri.id === it.itemId);
        let matId = reqIt?.materialId;
        // 2) MaterialId direto no item do pedido (fallback)
        if (!matId) matId = it.materialId;
        if (!matId) return false;
        const tipo = tipoByMaterialId.get(matId);
        return tipo === "serviço";
      });
    });
  }, [pedidos, materiais, requisicoes]);


  const onSelectPedido = (pedidoId: string) => {
    setPedidoSelId(pedidoId);
    const p = pedidosServico.find((x) => x.id === pedidoId);
    if (!p) return;

    // Fornecedor + CNPJ/CPF + endereço
    const f: any = clientes.find((c: any) => c.id === p.fornecedorId);
    const endParts = f ? [
      [f.logradouro, f.numero].filter(Boolean).join(", "),
      f.complemento, f.bairro,
      [f.cidade, f.uf].filter(Boolean).join("/"),
    ].filter(Boolean) : [];
    // Cliente: tenta via Requisição → Centro de Custo (cliente_id),
    // ou pelo próprio centroCusto sendo um UUID de cliente,
    // ou casando por centroCustoNome.
    const req: any = requisicoes.find((r) => r.id === p.requisicaoId);
    let cli: any = null;
    if (req) {
      const cc = centrosCusto.find((c) => c.id === req.centroCusto || c.codigo === req.centroCusto);
      if (cc?.cliente_id) cli = clientes.find((c: any) => c.id === cc.cliente_id);
      if (!cli) cli = clientes.find((c: any) => c.id === req.centroCusto);
      if (!cli && req.centroCustoNome) {
        const nome = String(req.centroCustoNome).toLowerCase();
        cli = clientes.find((c: any) => (c.nome || "").toLowerCase() === nome) ||
              clientes.find((c: any) => (c.nome || "").toLowerCase().includes(nome));
      }
    }
    setForm((prev) => ({
      ...prev,
      fornecedor_id: p.fornecedorId,
      fornecedor_nome: p.fornecedorNome || f?.nome || "",
      fornecedor_cnpj: f?.cnpj || f?.cpf || "",
      fornecedor_endereco: endParts.join(" - "),
      cliente_id: cli?.id || prev.cliente_id || null,
      cliente_nome: cli?.nome || prev.cliente_nome || "",
      valor: p.valorTotal,
    }) as any);
  };


  const resetForm = () => {
    setForm({
      objeto: "",
      valor: 0,
      status: "ativo",
      aditivos: [],
      medicoes_vinculadas: [],
      anexos: [],
    });
    setEditing(null);
    setPedidoSelId("");
  };


  const abrirNovo = () => { resetForm(); setOpen(true); };
  const abrirEdit = (c: ContratoTerceiro) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  const onSelectFornecedor = (id: string) => {
    const f: any = fornecedores.find((x: any) => x.id === id);
    const endParts = [
      [f?.logradouro, f?.numero].filter(Boolean).join(", "),
      f?.complemento,
      f?.bairro,
      [f?.cidade, f?.uf].filter(Boolean).join("/"),
    ].filter(Boolean);
    const endereco = endParts.join(" - ");
    setForm((p) => ({
      ...p,
      fornecedor_id: id,
      fornecedor_nome: f?.nome || (f as any)?.razaoSocial || "",
      fornecedor_cnpj: f?.cnpj || (f as any)?.cpf || "",
      fornecedor_endereco: endereco,
    } as any));
  };
  const onSelectCliente = (id: string) => {
    const cl = clientes.find((c) => c.id === id);
    setForm((p) => ({ ...p, cliente_id: id, cliente_nome: cl?.nome || "", obra_id: null, obra_nome: "" }));
  };
  const onSelectObra = (id: string) => {
    const ob = obras.find((o) => o.id === id);
    setForm((p) => ({ ...p, obra_id: id, obra_nome: ob?.nome || "" }));
  };

  // Aditivos
  const addAditivo = () => {
    const novo: ContratoAditivo = { id: crypto.randomUUID(), numero: String((form.aditivos?.length || 0) + 1), data: new Date().toISOString().slice(0, 10), tipo: "valor" };
    setForm((p) => ({ ...p, aditivos: [...(p.aditivos || []), novo] }));
  };
  const updAditivo = (id: string, patch: Partial<ContratoAditivo>) => {
    setForm((p) => ({ ...p, aditivos: (p.aditivos || []).map((a) => a.id === id ? { ...a, ...patch } : a) }));
  };
  const delAditivo = (id: string) => {
    setForm((p) => ({ ...p, aditivos: (p.aditivos || []).filter((a) => a.id !== id) }));
  };

  // Anexos
  const handleAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `contratos-terceiros/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("documentos").upload(path, file, { upsert: true });
    if (error) { toast.error("Falha ao enviar anexo"); return; }
    const { data } = supabase.storage.from("documentos").getPublicUrl(path);
    setForm((p) => ({ ...p, anexos: [...(p.anexos || []), { nome: file.name, url: data.publicUrl, size: file.size, tipo: file.type }] }));
    toast.success("Anexo adicionado");
    e.target.value = "";
  };
  const delAnexo = (idx: number) => setForm((p) => ({ ...p, anexos: (p.anexos || []).filter((_, i) => i !== idx) }));

  const salvar = async () => {
    if (!form.objeto?.trim()) { toast.error("Informe o objeto do contrato"); return; }
    if (!form.fornecedor_id) { toast.error("Selecione o fornecedor/prestador"); return; }
    const payload: Partial<ContratoTerceiro> = {
      fornecedor_id: form.fornecedor_id,
      fornecedor_nome: form.fornecedor_nome || "",
      fornecedor_cnpj: form.fornecedor_cnpj || "",
      fornecedor_endereco: (form as any).fornecedor_endereco || "",
      cliente_id: form.cliente_id || null,
      cliente_nome: form.cliente_nome || "",
      obra_id: form.obra_id || null,
      obra_nome: form.obra_nome || "",
      objeto: form.objeto || "",
      valor: Number(form.valor) || 0,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      status: form.status || "ativo",
      observacoes: form.observacoes || "",
      aditivos: form.aditivos || [],
      medicoes_vinculadas: form.medicoes_vinculadas || [],
      anexos: form.anexos || [],
    };
    const ok = editing ? await update(editing.id, payload) : await add(payload);
    if (ok) { setOpen(false); resetForm(); }
  };

  const filtrados = useMemo(() => {
    const f = filtro.toLowerCase();
    if (!f) return contratos;
    return contratos.filter((c) =>
      (c.objeto || "").toLowerCase().includes(f) ||
      (c.fornecedor_nome || "").toLowerCase().includes(f) ||
      (c.cliente_nome || "").toLowerCase().includes(f) ||
      (c.obra_nome || "").toLowerCase().includes(f) ||
      numeroAno(c.numero, c.created_at).includes(f),
    );
  }, [contratos, filtro]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-semibold">Contratos de Terceiro</h1>
        <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-2" /> Novo Contrato</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Input placeholder="Buscar por número, fornecedor, cliente, obra ou objeto..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-md" />
            <Badge variant="secondary">{filtrados.length} contrato(s)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Fornecedor / Prestador</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Nenhum contrato cadastrado.</TableCell></TableRow>
              ) : filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{numeroAno(c.numero, c.created_at)}</TableCell>
                  <TableCell>{c.fornecedor_nome || "—"}</TableCell>
                  <TableCell>{c.cliente_nome || "—"}</TableCell>
                  <TableCell>{c.obra_nome || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate" title={c.objeto}>{c.objeto}</TableCell>
                  <TableCell>{fmtMoney(c.valor)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}</TableCell>
                  <TableCell><Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => gerarPdfContratoTerceiro(c, empresa as any)} title="Gerar PDF"><FileDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => abrirEdit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => requestDelete(c.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Form */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar Contrato ${numeroAno(editing.numero, editing.created_at)}` : "Novo Contrato de Terceiro"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados Principais</TabsTrigger>
              <TabsTrigger value="aditivos">Aditivos ({form.aditivos?.length || 0})</TabsTrigger>
              <TabsTrigger value="anexos">Anexos ({form.anexos?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <Label>Ordem de Compra (Serviços) — preenche Fornecedor, CNPJ/CPF, Cliente e Valor</Label>
                <Select value={pedidoSelId} onValueChange={onSelectPedido}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma OC de serviços..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pedidosServico.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma OC de serviços encontrada</div>
                    ) : pedidosServico.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        OC {String(p.numero).padStart(4, "0")} — {p.fornecedorNome} — {fmtMoney(p.valorTotal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <Label>Fornecedor / Prestador *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate">{form.fornecedor_nome || "Selecione..."}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar fornecedor..." />
                        <CommandList>
                          <CommandEmpty>Nenhum encontrado</CommandEmpty>
                          <CommandGroup>
                            {fornecedores.map((f: any) => (
                              <CommandItem key={f.id} value={`${f.nome || f.razaoSocial || ""} ${f.cnpj || ""}`} onSelect={() => onSelectFornecedor(f.id)}>
                                <Check className={`mr-2 h-4 w-4 ${form.fornecedor_id === f.id ? "opacity-100" : "opacity-0"}`} />
                                {f.nome || f.razaoSocial}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>CNPJ/CPF</Label>
                  <Input value={form.fornecedor_cnpj || ""} onChange={(e) => setForm((p) => ({ ...p, fornecedor_cnpj: e.target.value }))} />
                </div>

                <div>
                  <Label>Cliente</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate">{form.cliente_nome || "Selecione..."}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum encontrado</CommandEmpty>
                          <CommandGroup>
                            {apenasClientes.map((c: any) => (
                              <CommandItem key={c.id} value={c.nome} onSelect={() => onSelectCliente(c.id)}>
                                <Check className={`mr-2 h-4 w-4 ${form.cliente_id === c.id ? "opacity-100" : "opacity-0"}`} />
                                {c.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Obra</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" disabled={!form.cliente_id} className="w-full justify-between font-normal">
                        <span className="truncate">{form.obra_nome || (form.cliente_id ? "Selecione..." : "Selecione um cliente")}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar obra..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma encontrada</CommandEmpty>
                          <CommandGroup>
                            {obrasDoCliente.map((o) => (
                              <CommandItem key={o.id} value={o.nome} onSelect={() => onSelectObra(o.id)}>
                                <Check className={`mr-2 h-4 w-4 ${form.obra_id === o.id ? "opacity-100" : "opacity-0"}`} />
                                {o.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="col-span-2">
                  <Label>Objeto do Contrato *</Label>
                  <Textarea rows={3} value={form.objeto || ""} onChange={(e) => setForm((p) => ({ ...p, objeto: e.target.value }))} />
                </div>

                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input
                    inputMode="numeric"
                    value={fmtMoney(form.valor)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const n = digits ? Number(digits) / 100 : 0;
                      setForm((p) => ({ ...p, valor: n }));
                    }}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status || "ativo"} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Início da Vigência</Label>
                  <Input type="date" value={form.data_inicio || ""} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label>Fim da Vigência</Label>
                  <Input type="date" value={form.data_fim || ""} onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))} />
                </div>

                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.observacoes || ""} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="aditivos" className="space-y-3 pt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={addAditivo}><Plus className="h-4 w-4 mr-1" /> Adicionar Aditivo</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Nº</TableHead>
                    <TableHead className="w-40">Data</TableHead>
                    <TableHead className="w-40">Tipo</TableHead>
                    <TableHead>Valor Adic.</TableHead>
                    <TableHead>Nova Vigência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(form.aditivos || []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell><Input value={a.numero} onChange={(e) => updAditivo(a.id, { numero: e.target.value })} /></TableCell>
                      <TableCell><Input type="date" value={a.data} onChange={(e) => updAditivo(a.id, { data: e.target.value })} /></TableCell>
                      <TableCell>
                        <Select value={a.tipo} onValueChange={(v) => updAditivo(a.id, { tipo: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prazo">Prazo</SelectItem>
                            <SelectItem value="valor">Valor</SelectItem>
                            <SelectItem value="prazo_valor">Prazo + Valor</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" step="0.01" value={a.valor_adicional ?? 0} onChange={(e) => updAditivo(a.id, { valor_adicional: Number(e.target.value.replace(",", ".")) })} /></TableCell>
                      <TableCell><Input type="date" value={a.nova_data_fim || ""} onChange={(e) => updAditivo(a.id, { nova_data_fim: e.target.value })} /></TableCell>
                      <TableCell><Input value={a.descricao || ""} onChange={(e) => updAditivo(a.id, { descricao: e.target.value })} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delAditivo(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {!(form.aditivos || []).length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhum aditivo.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="anexos" className="space-y-3 pt-4">
              <div>
                <Label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-accent">
                  <Paperclip className="h-4 w-4" /> Anexar arquivo
                  <input type="file" className="hidden" onChange={handleAnexo} />
                </Label>
              </div>
              <ul className="space-y-2">
                {(form.anexos || []).map((a, i) => (
                  <li key={i} className="flex items-center justify-between border rounded-md p-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{a.nome}</a>
                    <Button size="icon" variant="ghost" onClick={() => delAnexo(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
                {!(form.anexos || []).length && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
              </ul>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>{editing ? "Atualizar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) cancelDelete(); }}
        onConfirm={async () => { if (deleteId) { await remove(deleteId); cancelDelete(); } }}
      />
    </div>
  );
}

export default function ContratosTerceirosPage() {
  return (
    <ContratosTerceirosProvider>
      <ContratosInner />
    </ContratosTerceirosProvider>
  );
}
