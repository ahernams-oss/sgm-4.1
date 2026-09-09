import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSco } from "@/contexts/ScoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useI0 } from "@/contexts/I0Context";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useOrcamentos, Orcamento } from "@/contexts/OrcamentosContext";
import { useCategoriasServicos } from "@/contexts/CategoriasServicosContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, X, FileText, Check, RotateCcw, ChevronsUpDown, Download, FileSpreadsheet, Maximize2, Minimize2 } from "lucide-react";
import { gerarPdfOrcamento } from "@/lib/gerarPdfOrcamento";
import { gerarPdfMemoriaCalculo } from "@/lib/gerarPdfMemoriaCalculo";
import { gerarPdfMemoriaCalculoFotos } from "@/lib/gerarPdfMemoriaCalculoFotos";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { gerarExcelOrcamento } from "@/lib/gerarExcelOrcamento";
import MemoriaCalculoTab, { GrupoMemoria } from "@/components/orcamento/MemoriaCalculoTab";

interface OrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacao: { id: string; numero: number; clienteId: string; clienteNome: string } | null;
  existingOrcamento?: Orcamento | null;
  onApproved?: (orcamento: Orcamento) => void;
  onSent?: () => void;
  onRevisaoSolicitada?: () => void;
}

interface ItemSco {
  id: string; codSco: string; descricao: string; unidade: string;
  quantidade: number; valorUnitario: number; valorTotal: number;
  familia?: string;
}

interface ItemMaterial {
  id: string; materialId: string; codigo: string; descricao: string; unidade: string;
  quantidade: number; valorUnitario: number; valorTotal: number;
  familia?: string;
}


export default function OrcamentoDialog({ open, onOpenChange, solicitacao, existingOrcamento, onApproved, onSent, onRevisaoSolicitada }: OrcamentoDialogProps) {
  const { scos } = useSco();
  const { clientes } = useClientes();
  const { items: i0Items } = useI0();
  const { materiais } = useMateriaisServicos();
  const { addOrcamento, updateOrcamento } = useOrcamentos();
  const { categorias: categoriasCadastradas } = useCategoriasServicos();
  const { usuarioLogado } = useAuth();
  const { empresa } = useEmpresa();
  const { toast } = useToast();

  const [itensSco, setItensSco] = useState<ItemSco[]>(existingOrcamento?.itensSco || []);
  const [itensMateriais, setItensMateriais] = useState<ItemMaterial[]>(existingOrcamento?.itensMateriais || []);
  const [anexos, setAnexos] = useState<{ file?: File; url: string; nome: string }[]>(
    (existingOrcamento?.anexos || []).map((url: string) => ({ url, nome: url.split("/").pop() || "arquivo" }))
  );
  const [observacoes, setObservacoes] = useState(existingOrcamento?.observacoes || "");
  const [expandido, setExpandido] = useState(false);
  const [memoriaCalculo, setMemoriaCalculo] = useState<GrupoMemoria[]>(
    Array.isArray((existingOrcamento as any)?.memoriaCalculo) ? (existingOrcamento as any).memoriaCalculo : []
  );
  const [categoria, setCategoria] = useState(existingOrcamento?.categoria || "");
  const [revisaoMotivo, setRevisaoMotivo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scoSearch, setScoSearch] = useState("");
  const [scoPopoverOpen, setScoPopoverOpen] = useState(false);
  const [matSearch, setMatSearch] = useState("");
  const [matPopoverOpen, setMatPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = existingOrcamento?.status === "Aprovado" || existingOrcamento?.status === "Enviado";
  const isPendente = !existingOrcamento || existingOrcamento.status === "Pendente";
  const isRevisao = existingOrcamento?.status === "Revisão";
  const isRascunho = !existingOrcamento || existingOrcamento.status === "Pendente" || existingOrcamento.status === "Revisão";

  // Get latest SCO price from I0
  const getScoPrice = (codSco: string): number => {
    const prices = i0Items.filter(i => i.codSco === codSco);
    if (prices.length === 0) return 0;
    prices.sort((a, b) => (b.ano * 100 + b.mes) - (a.ano * 100 + a.mes));
    return prices[0].valor;
  };

  const handleAddSco = (sco: typeof scos[0]) => {
    if (itensSco.find(i => i.codSco === sco.codSco)) {
      toast({ title: "Item SCO já adicionado", variant: "destructive" });
      return;
    }
    const price = getScoPrice(sco.codSco);
    setItensSco(prev => [...prev, {
      id: crypto.randomUUID(),
      codSco: sco.codSco,
      descricao: sco.descricaoSco,
      unidade: sco.unidade,
      quantidade: 1,
      valorUnitario: price,
      valorTotal: price,
      familia: sco.familia || "",
    }]);
    setScoPopoverOpen(false);
    setScoSearch("");
  };

  const handleScoQty = (id: string, qty: number) => {
    if (qty < 0) return;
    setItensSco(prev => prev.map(i =>
      i.id === id ? { ...i, quantidade: qty, valorTotal: qty * i.valorUnitario } : i
    ));
  };

  const handleScoPrice = (id: string, price: number) => {
    setItensSco(prev => prev.map(i =>
      i.id === id ? { ...i, valorUnitario: price, valorTotal: i.quantidade * price } : i
    ));
  };

  const handleScoFamilia = (id: string, f: string) => {
    setItensSco(prev => prev.map(i => i.id === id ? { ...i, familia: f } : i));
  };

  const handleRemoveSco = (id: string) => setItensSco(prev => prev.filter(i => i.id !== id));

  const handleAplicarSubtotais = (subtotais: { codigo: string; total: number }[]) => {
    const mapa = new Map(subtotais.map(s => [s.codigo.trim(), s.total]));
    let atualizados = 0;
    setItensSco(prev => prev.map(i => {
      const q = mapa.get((i.codSco || "").trim());
      if (q === undefined) return i;
      atualizados++;
      return { ...i, quantidade: q, valorTotal: q * i.valorUnitario };
    }));
    setItensMateriais(prev => prev.map(i => {
      const q = mapa.get((i.codigo || "").trim());
      if (q === undefined) return i;
      atualizados++;
      return { ...i, quantidade: q, valorTotal: q * i.valorUnitario };
    }));
    toast({
      title: atualizados > 0 ? "Subtotais aplicados" : "Nenhum item correspondente",
      description: atualizados > 0
        ? `${atualizados} item(ns) tiveram a quantidade atualizada pela memória de cálculo.`
        : "Verifique se os códigos da memória de cálculo correspondem aos itens.",
      variant: atualizados > 0 ? undefined : "destructive",
    });
  };

  // Catálogo SCO disponível para inserção direta na Memória de Cálculo
  const catalogoSco = useMemo(() => scos.map(s => ({
    codigo: s.codSco, descricao: s.descricaoSco, unidade: s.unidade, familia: s.familia,
  })), [scos]);

  const handleEnviarItensParaSco = (itens: { codigo: string; descricao: string; unidade?: string; familia?: string; quantidade: number }[]) => {
    let novos = 0, atualizados = 0;
    setItensSco(prev => {
      const lista = [...prev];
      itens.forEach(it => {
        const cod = it.codigo.trim();
        if (!cod) return;
        const idx = lista.findIndex(i => (i.codSco || "").trim() === cod);
        if (idx >= 0) {
          const q = it.quantidade || lista[idx].quantidade;
          lista[idx] = { ...lista[idx], quantidade: q, valorTotal: q * lista[idx].valorUnitario, familia: lista[idx].familia || it.familia || "" };
          atualizados++;
        } else {
          if (itensMateriais.some(m => (m.codigo || "").trim() === cod)) return;
          const price = getScoPrice(cod);
          const q = it.quantidade || 1;
          lista.push({
            id: crypto.randomUUID(),
            codSco: cod,
            descricao: it.descricao,
            unidade: it.unidade || "",
            quantidade: q,
            valorUnitario: price,
            valorTotal: q * price,
            familia: it.familia || "",
          });
          novos++;
        }
      });
      return lista;
    });
    toast({
      title: novos || atualizados ? "Itens enviados para Itens SCO" : "Nenhum item enviado",
      description: novos || atualizados
        ? `${novos} novo(s) e ${atualizados} atualizado(s).`
        : "Adicione itens com código na memória de cálculo.",
      variant: novos || atualizados ? undefined : "destructive",
    });
  };


  const handleAddMaterial = (mat: typeof materiais[0]) => {
    if (itensMateriais.find(i => i.materialId === mat.id)) {
      toast({ title: "Material já adicionado", variant: "destructive" });
      return;
    }
    setItensMateriais(prev => [...prev, {
      id: crypto.randomUUID(),
      materialId: mat.id,
      codigo: mat.codigo,
      descricao: mat.descricao,
      unidade: mat.unidadeMedida,
      quantidade: 1,
      valorUnitario: 0,
      valorTotal: 0,
    }]);
    setMatPopoverOpen(false);
    setMatSearch("");
  };

  const handleMatQty = (id: string, qty: number) => {
    if (qty < 0) return;
    setItensMateriais(prev => prev.map(i =>
      i.id === id ? { ...i, quantidade: qty, valorTotal: qty * i.valorUnitario } : i
    ));
  };

  const handleMatPrice = (id: string, price: number) => {
    setItensMateriais(prev => prev.map(i =>
      i.id === id ? { ...i, valorUnitario: price, valorTotal: i.quantidade * price } : i
    ));
  };

  const handleMatFamilia = (id: string, f: string) => {
    setItensMateriais(prev => prev.map(i => i.id === id ? { ...i, familia: f } : i));
  };

  const handleRemoveMat = (id: string) => setItensMateriais(prev => prev.filter(i => i.id !== id));

  // Coleta famílias já usadas (para sugestão via datalist)
  const familiasUsadas = useMemo(() => {
    const set = new Set<string>();
    itensSco.forEach(i => { if (i.familia?.trim()) set.add(i.familia.trim()); });
    itensMateriais.forEach(i => { if (i.familia?.trim()) set.add(i.familia.trim()); });
    return Array.from(set).sort();
  }, [itensSco, itensMateriais]);

  // Itens (SCO + Materiais) que alimentam a memória de cálculo
  const itensOrigemMemoria = useMemo(() => [
    ...itensSco.map(i => ({ codigo: i.codSco, descricao: i.descricao, quantidade: i.quantidade, familia: i.familia, unidade: i.unidade })),
    ...itensMateriais.map(i => ({ codigo: i.codigo, descricao: i.descricao, quantidade: i.quantidade, familia: i.familia, unidade: (i as any).unidade })),
  ], [itensSco, itensMateriais]);

  // Setores vinculados ao cliente do orçamento
  const setoresCliente = useMemo(() => {
    const cli = clientes.find(c => c.id === solicitacao?.clienteId);
    const set = new Set<string>();
    (cli?.locais || []).forEach(loc =>
      (loc.pavimentos || []).forEach(pav =>
        (pav.setores || []).forEach(s => { if (s.descricao?.trim()) set.add(s.descricao.trim()); })));
    return Array.from(set).sort();
  }, [clientes, solicitacao?.clienteId]);


  const totalSco = useMemo(() => itensSco.reduce((s, i) => s + i.valorTotal, 0), [itensSco]);
  const totalMat = useMemo(() => itensMateriais.reduce((s, i) => s + i.valorTotal, 0), [itensMateriais]);
  const valorTotal = totalSco + totalMat;

  const handleAddAnexo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - anexos.length;
    if (remaining <= 0) { toast({ title: "Máximo de 3 anexos", variant: "destructive" }); return; }
    const newAnexos = Array.from(files).slice(0, remaining).map(file => ({
      file, url: URL.createObjectURL(file), nome: file.name,
    }));
    setAnexos(prev => [...prev, ...newAnexos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAnexo = (idx: number) => setAnexos(prev => prev.filter((_, i) => i !== idx));

  const uploadAnexos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const a of anexos) {
      if (a.file) {
        const ext = a.file.name.split(".").pop();
        const path = `orcamentos/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("documentos").upload(path, a.file);
        if (error) { console.error(error); continue; }
        const { data } = supabase.storage.from("documentos").getPublicUrl(path);
        urls.push(data.publicUrl);
      } else {
        urls.push(a.url);
      }
    }
    return urls;
  };

  const handleSave = async () => {
    if (!categoria) {
      toast({ title: "Selecione a Categoria do orçamento", variant: "destructive" });
      return;
    }
    if (itensSco.length === 0 && itensMateriais.length === 0) {
      toast({ title: "Adicione pelo menos um item ao orçamento", variant: "destructive" });
      return;
    }
    setUploading(true);
    const anexosUrls = await uploadAnexos();
    const payload: any = {
      solicitacao_id: solicitacao?.id || "",
      solicitacao_numero: solicitacao?.numero || 0,
      cliente_id: solicitacao?.clienteId || "",
      cliente_nome: solicitacao?.clienteNome || "",
      categoria,
      itens_sco: itensSco,
      itens_materiais: itensMateriais,
      anexos: anexosUrls,
      valor_total: valorTotal,
      observacoes,
      memoria_calculo: memoriaCalculo,
      status: existingOrcamento?.status === "Pendente" ? "Pendente" : "Pendente",
    };

    if (existingOrcamento) {
      await updateOrcamento(existingOrcamento.id, payload);
      toast({ title: "Orçamento atualizado" });
    } else {
      payload.criado_por = usuarioLogado?.nome || "";
      payload.data_criacao = new Date().toISOString();
      await addOrcamento(payload);
      toast({ title: "Orçamento criado com sucesso" });
    }
    setUploading(false);
    if (!existingOrcamento) {
      onOpenChange(false);
    }
  };

  const handleEnviar = async () => {
    if (!categoria) {
      toast({ title: "Selecione a Categoria do orçamento", variant: "destructive" });
      return;
    }
    if (itensSco.length === 0 && itensMateriais.length === 0) {
      toast({ title: "Adicione pelo menos um item ao orçamento", variant: "destructive" });
      return;
    }
    setUploading(true);
    const anexosUrls = await uploadAnexos();
    const payload: any = {
      solicitacao_id: solicitacao?.id || "",
      solicitacao_numero: solicitacao?.numero || 0,
      cliente_id: solicitacao?.clienteId || "",
      cliente_nome: solicitacao?.clienteNome || "",
      categoria,
      itens_sco: itensSco,
      itens_materiais: itensMateriais,
      anexos: anexosUrls,
      valor_total: valorTotal,
      observacoes,
      memoria_calculo: memoriaCalculo,
      status: "Enviado",
    };

    if (existingOrcamento) {
      await updateOrcamento(existingOrcamento.id, payload);
    } else {
      payload.criado_por = usuarioLogado?.nome || "";
      payload.data_criacao = new Date().toISOString();
      await addOrcamento(payload);
    }
    toast({ title: "Orçamento enviado com sucesso" });
    onSent?.();
    setUploading(false);
    onOpenChange(false);
  };

  const handleAprovar = async () => {
    if (!existingOrcamento) return;
    const data = {
      status: "Aprovado",
      aprovado_por: usuarioLogado?.nome || "",
      data_aprovacao: new Date().toISOString(),
    };
    await updateOrcamento(existingOrcamento.id, data);
    toast({ title: "Orçamento aprovado!" });
    onApproved?.({ ...existingOrcamento, ...data, status: "Aprovado", aprovadoPor: data.aprovado_por, dataAprovacao: data.data_aprovacao });
    onOpenChange(false);
  };

  const handleSolicitarRevisao = async () => {
    if (!existingOrcamento) return;
    if (!revisaoMotivo.trim()) {
      toast({ title: "Informe o motivo da revisão", variant: "destructive" });
      return;
    }
    const novaEntrada = {
      motivo: revisaoMotivo.trim(),
      data: new Date().toISOString(),
      usuario: usuarioLogado?.nome || "Sistema",
    };
    const historicoAtual = Array.isArray(existingOrcamento.revisoes) ? existingOrcamento.revisoes : [];
    await updateOrcamento(existingOrcamento.id, {
      status: "Revisão",
      revisao_motivo: novaEntrada.motivo,
      revisoes: [...historicoAtual, novaEntrada],
    });
    toast({ title: "Revisão solicitada" });
    setRevisaoMotivo("");
    onRevisaoSolicitada?.();
    onOpenChange(false);
  };

  const filteredScos = useMemo(() => {
    if (!scoSearch.trim()) return scos.slice(0, 50);
    const q = scoSearch.toLowerCase();
    return scos.filter(s => s.codSco.toLowerCase().includes(q) || s.descricaoSco.toLowerCase().includes(q)).slice(0, 50);
  }, [scos, scoSearch]);

  const filteredMateriais = useMemo(() => {
    if (!matSearch.trim()) return materiais.slice(0, 50);
    const q = matSearch.toLowerCase();
    return materiais.filter(m => m.codigo.toLowerCase().includes(q) || m.descricao.toLowerCase().includes(q)).slice(0, 50);
  }, [materiais, matSearch]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none overflow-y-auto p-4 " +
          "sm:rounded-lg sm:h-auto sm:max-h-[90vh] sm:w-auto sm:p-6 " +
          (expandido
            ? "sm:max-w-none sm:w-[98vw] sm:h-[96vh] sm:max-h-[96vh]"
            : "sm:max-w-5xl")
        }
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3 pr-8 text-base sm:text-lg">
            <FileText className="h-5 w-5" />
            Orçamento — SS nº {solicitacao?.numero || existingOrcamento?.solicitacaoNumero}
            {existingOrcamento && (
              <Badge variant={existingOrcamento.status === "Aprovado" ? "default" : existingOrcamento.status === "Revisão" ? "destructive" : "outline"}
                className={existingOrcamento.status === "Aprovado" ? "bg-green-600 border-green-600" : ""}>
                {existingOrcamento.status}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex ml-auto mr-8 gap-2"
              onClick={() => setExpandido(v => !v)}
            >
              {expandido ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {expandido ? "Reduzir tela" : "Expandir tela"}
            </Button>
          </DialogTitle>
        </DialogHeader>


        <datalist id="familias-orcamento">
          {familiasUsadas.map(f => <option key={f} value={f} />)}
        </datalist>

        {existingOrcamento && Array.isArray(existingOrcamento.revisoes) && existingOrcamento.revisoes.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm space-y-2">
            <strong>Histórico de pedidos de revisão ({existingOrcamento.revisoes.length}):</strong>
            <ol className="list-decimal pl-5 space-y-1">
              {existingOrcamento.revisoes.map((r, idx) => {
                const d = r.data ? new Date(r.data) : null;
                const dataFmt = d ? `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
                return (
                  <li key={idx}>
                    <span className="text-muted-foreground">{dataFmt} — {r.usuario}:</span> {r.motivo}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <Tabs defaultValue="categoria" className="w-full">
          <TabsList className="flex w-full overflow-x-auto justify-start gap-1 sm:grid sm:grid-cols-5">
            <TabsTrigger value="categoria" className="whitespace-nowrap text-xs sm:text-sm">
              Categoria {categoria ? "✓" : <span className="text-destructive ml-1">*</span>}
            </TabsTrigger>
            <TabsTrigger value="sco" className="whitespace-nowrap text-xs sm:text-sm">Itens SCO ({itensSco.length})</TabsTrigger>
            <TabsTrigger value="materiais" className="whitespace-nowrap text-xs sm:text-sm">Materiais ({itensMateriais.length})</TabsTrigger>
            <TabsTrigger value="memoria" className="whitespace-nowrap text-xs sm:text-sm">Memória de Cálculo ({memoriaCalculo.length})</TabsTrigger>
            <TabsTrigger value="anexos" className="whitespace-nowrap text-xs sm:text-sm">Anexos ({anexos.length}/3)</TabsTrigger>
          </TabsList>


          {/* Categoria Tab */}
          <TabsContent value="categoria" className="space-y-3">
            <div>
              <Label className="font-bold">
                Categoria do Orçamento <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione a categoria à qual este orçamento pertence. Campo obrigatório para envio.
              </p>
              <Select value={categoria} onValueChange={setCategoria} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriasCadastradas.map(c => (
                    <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoria && (
                <div className="mt-3 p-3 rounded-md bg-primary/10 border border-primary/30 text-sm">
                  <span className="text-muted-foreground">Categoria selecionada: </span>
                  <span className="font-semibold text-primary">{categoria}</span>
                </div>
              )}
            </div>
          </TabsContent>


          {/* SCO Tab */}
          <TabsContent value="sco" className="space-y-3">
            {!isReadOnly && (
              <Popover open={scoPopoverOpen} onOpenChange={setScoPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Adicionar item SCO...</span>
                    <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[600px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por código ou descrição..." value={scoSearch} onValueChange={setScoSearch} />
                    <CommandList>
                      <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                      <CommandGroup>
                        {filteredScos.map(s => (
                          <CommandItem key={s.id} onSelect={() => handleAddSco(s)} className="cursor-pointer">
                            <span className="font-mono text-xs mr-2">{s.codSco}</span>
                            <span className="truncate flex-1">{s.descricaoSco}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.unidade}</span>
                            <span className={`text-xs font-medium ml-2 ${s.tipo === "SCO" ? "text-primary" : s.tipo === "SINAPI" ? "text-accent-foreground" : "text-muted-foreground"}`}>{s.tipo}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {itensSco.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Família</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead className="w-32">Valor Unit.</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                      {!isReadOnly && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensSco.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input list="familias-orcamento" placeholder="Ex.: DEMOLIÇÕES" value={item.familia || ""} onChange={e => handleScoFamilia(item.id, e.target.value)} disabled={isReadOnly} className="h-8 uppercase" />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.codSco}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{item.descricao}</TableCell>
                        <TableCell className="text-xs">{item.unidade}</TableCell>
                        <TableCell>
                          <Input type="number" min={0} value={item.quantidade} onChange={e => handleScoQty(item.id, Number(e.target.value))} disabled={isReadOnly} className="h-8 w-20" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} step={0.01} value={item.valorUnitario} onChange={e => handleScoPrice(item.id, Number(e.target.value))} disabled={isReadOnly} className="h-8 w-28" />
                        </TableCell>
                        <TableCell className="font-medium">{fmt(item.valorTotal)}</TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => handleRemoveSco(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={6} className="text-right font-bold">Subtotal SCO:</TableCell>
                      <TableCell className="font-bold">{fmt(totalSco)}</TableCell>
                      {!isReadOnly && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Materiais Tab */}
          <TabsContent value="materiais" className="space-y-3">
            {!isReadOnly && (
              <Popover open={matPopoverOpen} onOpenChange={setMatPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Adicionar material...</span>
                    <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[600px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por código ou descrição..." value={matSearch} onValueChange={setMatSearch} />
                    <CommandList>
                      <CommandEmpty>Nenhum material encontrado</CommandEmpty>
                      <CommandGroup>
                        {filteredMateriais.map(m => (
                          <CommandItem key={m.id} onSelect={() => handleAddMaterial(m)} className="cursor-pointer">
                            <span className="font-mono text-xs mr-2">{m.codigo}</span>
                            <span className="truncate flex-1">{m.descricao}</span>
                            <span className="text-xs text-muted-foreground ml-2">{m.unidadeMedida}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {itensMateriais.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Família</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead className="w-32">Valor Unit.</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                      {!isReadOnly && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensMateriais.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input list="familias-orcamento" placeholder="Ex.: INSTALAÇÕES ELÉTRICAS" value={item.familia || ""} onChange={e => handleMatFamilia(item.id, e.target.value)} disabled={isReadOnly} className="h-8 uppercase" />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{item.descricao}</TableCell>
                        <TableCell className="text-xs">{item.unidade}</TableCell>
                        <TableCell>
                          <Input type="number" min={0} value={item.quantidade} onChange={e => handleMatQty(item.id, Number(e.target.value))} disabled={isReadOnly} className="h-8 w-20" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} step={0.01} value={item.valorUnitario} onChange={e => handleMatPrice(item.id, Number(e.target.value))} disabled={isReadOnly} className="h-8 w-28" />
                        </TableCell>
                        <TableCell className="font-medium">{fmt(item.valorTotal)}</TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => handleRemoveMat(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={6} className="text-right font-bold">Subtotal Materiais:</TableCell>
                      <TableCell className="font-bold">{fmt(totalMat)}</TableCell>
                      {!isReadOnly && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Memória de Cálculo Tab */}
          <TabsContent value="memoria" className="space-y-3">
            <MemoriaCalculoTab grupos={memoriaCalculo} onChange={setMemoriaCalculo} readOnly={isReadOnly}
              itensOrigem={itensOrigemMemoria} setores={setoresCliente}
              catalogoSco={catalogoSco}
              onAplicarSubtotais={handleAplicarSubtotais}
              onEnviarItensParaSco={handleEnviarItensParaSco} />


          </TabsContent>

          {/* Anexos Tab */}
          <TabsContent value="anexos" className="space-y-3">
            {!isReadOnly && (
              <>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={anexos.length >= 3}>
                  <Upload className="mr-2 h-4 w-4" /> Adicionar Anexo
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleAddAnexo} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" />
              </>
            )}
            {anexos.length > 0 ? (
              <div className="space-y-2">
                {anexos.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 border rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{a.nome}</span>
                    {!a.file && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Abrir</a>
                    )}
                    {!isReadOnly && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemoveAnexo(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum anexo adicionado</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Total */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <span className="text-lg font-bold">Valor Total do Orçamento:</span>
          <span className="text-2xl font-bold text-primary">{fmt(valorTotal)}</span>
        </div>

        {/* Observações */}
        <div>
          <Label className="font-bold">Observações</Label>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} disabled={isReadOnly} placeholder="Observações do orçamento..." />
        </div>

        {/* Revisão motivo — show when reviewing */}
        {existingOrcamento && (isPendente || isRevisao || existingOrcamento.status === "Enviado") && (
          <div>
            <Label className="font-bold">Motivo da Revisão (caso solicite)</Label>
            <Textarea value={revisaoMotivo} onChange={e => setRevisaoMotivo(e.target.value)} rows={2} placeholder="Informe o motivo caso solicite revisão..." />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>

          {/* Export options — available whenever an orçamento exists */}
          {existingOrcamento && (
            <>
              <Button variant="outline" onClick={() => gerarPdfOrcamento(existingOrcamento, empresa)}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" onClick={() => gerarExcelOrcamento(existingOrcamento, empresa)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" onClick={() => gerarPdfMemoriaCalculo(existingOrcamento, empresa)}>
                <Download className="mr-2 h-4 w-4" /> Memória de Cálculo
              </Button>
              <Button variant="outline" onClick={() => gerarPdfMemoriaCalculoFotos(existingOrcamento, empresa)}>
                <Download className="mr-2 h-4 w-4" /> Memória de Cálculo c/ Fotos
              </Button>
            </>
          )}


          {/* Save as draft */}
          {isRascunho && (
            <Button variant="outline" onClick={handleSave} disabled={uploading}>
              {uploading ? "Salvando..." : existingOrcamento ? "Atualizar Orçamento" : "Salvar Orçamento"}
            </Button>
          )}

          {/* Send budget — locks editing and changes SS status */}
          {isRascunho && (
            <Button onClick={handleEnviar} disabled={uploading}>
              {uploading ? "Enviando..." : "Enviar Orçamento"}
            </Button>
          )}

          {/* Approval actions — only for sent budgets */}
          {existingOrcamento && existingOrcamento.status === "Enviado" && (
            <>
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={handleSolicitarRevisao}>
                <RotateCcw className="mr-2 h-4 w-4" /> Solicitar Revisão
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleAprovar}>
                <Check className="mr-2 h-4 w-4" /> Aprovar Orçamento
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
