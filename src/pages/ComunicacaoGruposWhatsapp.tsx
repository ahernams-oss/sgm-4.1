import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaginationControls from "@/components/PaginationControls";
import { Plus, RefreshCw, Copy, Users, LogOut, Pencil, X, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";
import { plugsendGroups, extractJID, extractName, type GrupoWhatsApp } from "@/lib/plugsendGroups";
import { useClientes } from "@/contexts/ClientesContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";

const sanitize = (s: string) => String(s || "").replace(/\D/g, "");

function fmtBR(n: string) {
  const d = sanitize(n);
  if (!d) return "";
  // 55 + DDD + número
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}

function normalizeBR(n: string) {
  let d = sanitize(n);
  if (!d) return "";
  if (d.length === 10 || d.length === 11) d = "55" + d; // sem DDI: adiciona 55
  return d;
}

export default function ComunicacaoGruposWhatsappPage() {
  const { tem } = usePermissao();
  const podeVer = tem("comunicacao_grupos_whatsapp") || tem("comunicacao_whatsapp");
  const podeCriar = tem("comunicacao_grupos_whatsapp.criar") || tem("comunicacao_whatsapp.criar");
  const podeEditar = tem("comunicacao_grupos_whatsapp.editar") || tem("comunicacao_whatsapp.editar");
  const podeSair = tem("comunicacao_grupos_whatsapp.excluir") || tem("comunicacao_whatsapp.excluir");

  const { clientes, updateCliente } = useClientes();
  const { funcionarios } = useFuncionarios();

  const [grupos, setGrupos] = useState<GrupoWhatsApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // criar
  const [openNovo, setOpenNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoNumeros, setNovoNumeros] = useState<string[]>([]);
  const [novoInput, setNovoInput] = useState("");
  const [criando, setCriando] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<null | "cliente" | "fornecedor" | "funcionario">(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // pós-criação
  const [novoCriadoJID, setNovoCriadoJID] = useState<string | null>(null);
  const [novoCriadoClienteId, setNovoCriadoClienteId] = useState<string>("");

  // detalhes / editar
  const [openDet, setOpenDet] = useState<GrupoWhatsApp | null>(null);
  const [editNome, setEditNome] = useState("");
  const [addInput, setAddInput] = useState("");
  const [processando, setProcessando] = useState(false);
  const [confirmSair, setConfirmSair] = useState<string | null>(null);

  async function carregar(force = false) {
    setLoading(true);
    const r = await plugsendGroups.list({ force });
    setLoading(false);
    if (!r.success) {
      toast.error("Falha ao listar grupos: " + (r.error || ""));
      return;
    }
    const lista: GrupoWhatsApp[] = r.data?.groups || r.data || [];
    setGrupos(Array.isArray(lista) ? lista : []);
  }

  useEffect(() => { if (podeVer) carregar(false); /* eslint-disable-next-line */ }, [podeVer]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => {
      const jid = extractJID(g).toLowerCase();
      const nome = extractName(g).toLowerCase();
      return jid.includes(q) || nome.includes(q);
    });
  }, [grupos, search]);

  const pageItems = filtrados.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  function copiar(jid: string) {
    navigator.clipboard.writeText(jid).then(
      () => toast.success("JID copiado"),
      () => toast.error("Falha ao copiar")
    );
  }

  function addNumero(source: string[], setter: (v: string[]) => void, raw: string) {
    const n = normalizeBR(raw);
    if (!n) return;
    if (n.length < 12 || n.length > 15) {
      toast.error("Número inválido (use formato internacional, ex: 5511999999999)");
      return;
    }
    if (source.includes(n)) return;
    setter([...source, n]);
  }

  async function handleCriar() {
    if (!novoNome.trim()) { toast.error("Informe o nome do grupo"); return; }
    if (novoNumeros.length === 0) { toast.error("Adicione pelo menos 1 participante"); return; }
    setCriando(true);
    const r = await plugsendGroups.create(novoNome.trim(), novoNumeros);
    setCriando(false);
    if (!r.success) {
      toast.error("Falha ao criar grupo: " + (r.error || "") + (r.details ? " — " + JSON.stringify(r.details).slice(0, 200) : ""));
      return;
    }
    const jid = extractJID(r.data) || r.data?.groupjid || "";
    toast.success("Grupo criado!");
    setNovoCriadoJID(jid);
    setNovoNome("");
    setNovoNumeros([]);
    setNovoInput("");
    carregar(true);
  }

  async function handleVincularCliente() {
    if (!novoCriadoJID || !novoCriadoClienteId) return;
    const cli = clientes.find((c) => c.id === novoCriadoClienteId);
    if (!cli) return;
    await updateCliente(novoCriadoClienteId, { grupoWhatsapp: novoCriadoJID } as any);
    toast.success(`JID vinculado ao cliente ${cli.nome}`);
    setNovoCriadoClienteId("");
  }

  async function handleAddParticipantes() {
    if (!openDet) return;
    const jid = extractJID(openDet);
    const numeros = addInput.split(/[,;\n]+/).map(normalizeBR).filter((n) => n.length >= 12);
    if (!numeros.length) { toast.error("Informe ao menos 1 número válido"); return; }
    setProcessando(true);
    const r = await plugsendGroups.addParticipants(jid, numeros);
    setProcessando(false);
    if (!r.success) { toast.error("Falha: " + r.error); return; }
    toast.success("Participantes adicionados");
    setAddInput("");
    const info = await plugsendGroups.info(jid, { force: true });
    if (info.success) setOpenDet(info.data);
    carregar(true);
  }

  async function handleRemover(numero: string) {
    if (!openDet) return;
    const jid = extractJID(openDet);
    setProcessando(true);
    const r = await plugsendGroups.removeParticipants(jid, [sanitize(numero)]);
    setProcessando(false);
    if (!r.success) { toast.error("Falha: " + r.error); return; }
    toast.success("Participante removido");
    const info = await plugsendGroups.info(jid, { force: true });
    if (info.success) setOpenDet(info.data);
    carregar(true);
  }

  async function handleRenomear() {
    if (!openDet) return;
    const jid = extractJID(openDet);
    if (!editNome.trim() || editNome === extractName(openDet)) return;
    setProcessando(true);
    const r = await plugsendGroups.updateName(jid, editNome.trim());
    setProcessando(false);
    if (!r.success) { toast.error("Falha: " + r.error); return; }
    toast.success("Grupo renomeado");
    carregar(true);
    setOpenDet({ ...openDet, name: editNome.trim(), subject: editNome.trim() });
  }

  async function handleSair(jid: string) {
    setProcessando(true);
    const r = await plugsendGroups.leave(jid);
    setProcessando(false);
    if (!r.success) { toast.error("Falha ao sair: " + r.error); return; }
    toast.success("Você saiu do grupo");
    setConfirmSair(null);
    setOpenDet(null);
    carregar(true);
  }

  const pickerLista = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (pickerOpen === "cliente" || pickerOpen === "fornecedor") {
      const tipo = pickerOpen === "cliente" ? "Cliente" : "Fornecedor";
      return clientes
        .filter((c) => c.tipo === tipo)
        .filter((c) => !q || c.nome.toLowerCase().includes(q))
        .slice(0, 100)
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          telefone: (c as any).telefonesWhatsapp || (c as any).telefoneCelular || (c.telefones || [])[0] || "",
        }))
        .filter((x) => x.telefone);
    }
    if (pickerOpen === "funcionario") {
      return funcionarios
        .filter((f) => !q || (f.nome || "").toLowerCase().includes(q))
        .slice(0, 100)
        .map((f) => ({
          id: f.id,
          nome: f.nome || "",
          telefone: (f as any).celular || (f as any).telefone || "",
        }))
        .filter((x) => x.telefone);
    }
    return [];
  }, [pickerOpen, pickerSearch, clientes, funcionarios]);

  if (!podeVer) {
    return <div className="p-6"><Card><CardContent className="p-6">Você não tem permissão para acessar esta página.</CardContent></Card></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-serif font-semibold">Grupos WhatsApp</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => carregar(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          {podeCriar && (
            <Button onClick={() => { setOpenNovo(true); setNovoCriadoJID(null); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Grupo
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {filtrados.length} grupo{filtrados.length !== 1 ? "s" : ""}
            </CardTitle>
            <div className="relative w-72">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nome ou JID..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>JID (@g.us)</TableHead>
                  <TableHead className="text-center">Participantes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((g, i) => {
                  const jid = extractJID(g);
                  const nome = extractName(g) || "(sem nome)";
                  const qtd = g.participants?.length ?? g.size ?? 0;
                  return (
                    <TableRow key={jid || i}>
                      <TableCell className="font-medium">{nome}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[280px]" title={jid}>{jid}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copiar(jid)} title="Copiar JID">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{qtd}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={async () => {
                          const info = await plugsendGroups.info(jid, { force: true });
                          setOpenDet(info.success ? info.data : g);
                          setEditNome(nome);
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                        {podeSair && (
                          <Button variant="ghost" size="sm" onClick={() => setConfirmSair(jid)}>
                            <LogOut className="h-3.5 w-3.5 mr-1 text-destructive" /> Sair
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageItems.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    {loading ? "Carregando grupos..." : "Nenhum grupo encontrado. Crie um novo ou clique em Atualizar."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={page} totalItems={filtrados.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>

      {/* Dialog: Novo Grupo */}
      <Dialog open={openNovo} onOpenChange={(v) => { setOpenNovo(v); if (!v) setNovoCriadoJID(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{novoCriadoJID ? "Grupo criado" : "Novo Grupo WhatsApp"}</DialogTitle>
          </DialogHeader>

          {!novoCriadoJID ? (
            <div className="space-y-3">
              <div>
                <Label>Nome do grupo *</Label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} maxLength={100} placeholder="Ex.: Suporte Cliente XYZ" />
              </div>

              <div>
                <Label>Participantes ({novoNumeros.length}/50)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={novoInput}
                    onChange={(e) => setNovoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNumero(novoNumeros, setNovoNumeros, novoInput); setNovoInput(""); } }}
                    placeholder="Ex.: (11) 99999-9999 ou 5511999999999"
                  />
                  <Button type="button" variant="outline" onClick={() => { addNumero(novoNumeros, setNovoNumeros, novoInput); setNovoInput(""); }}>
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPickerOpen("cliente"); setPickerSearch(""); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> De Clientes
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPickerOpen("fornecedor"); setPickerSearch(""); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> De Fornecedores
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPickerOpen("funcionario"); setPickerSearch(""); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> De Funcionários
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2 min-h-[40px] border rounded p-2 bg-muted/30">
                  {novoNumeros.map((n) => (
                    <Badge key={n} variant="secondary" className="gap-1">
                      {fmtBR(n)}
                      <button onClick={() => setNovoNumeros(novoNumeros.filter((x) => x !== n))} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {novoNumeros.length === 0 && <span className="text-xs text-muted-foreground">Nenhum participante adicionado</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">O número da instância (você) é adicionado automaticamente como criador/admin.</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNovo(false)}>Cancelar</Button>
                <Button onClick={handleCriar} disabled={criando}>
                  {criando ? "Criando..." : "Criar Grupo"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded">
                <div className="text-sm text-emerald-800 dark:text-emerald-200 mb-2">✓ Grupo criado com sucesso. Copie o JID abaixo:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background border rounded font-mono text-xs break-all">{novoCriadoJID}</code>
                  <Button size="sm" onClick={() => copiar(novoCriadoJID)}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
                </div>
              </div>

              <div>
                <Label>Vincular como grupo padrão de cliente (opcional)</Label>
                <div className="flex gap-2 mt-1">
                  <select
                    className="flex-1 border rounded px-2 py-2 bg-background text-sm"
                    value={novoCriadoClienteId}
                    onChange={(e) => setNovoCriadoClienteId(e.target.value)}
                  >
                    <option value="">— Selecione um cliente —</option>
                    {clientes.filter((c) => c.tipo === "Cliente").sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <Button onClick={handleVincularCliente} disabled={!novoCriadoClienteId}>Vincular</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Isso grava o JID em <code>grupoWhatsapp</code> do cliente. Notificações automáticas (mudança de status de PC, etc.) usarão este grupo.
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => { setOpenNovo(false); setNovoCriadoJID(null); }}>Concluir</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Picker de contatos */}
      <Dialog open={!!pickerOpen} onOpenChange={(v) => { if (!v) setPickerOpen(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar de {pickerOpen === "cliente" ? "Clientes" : pickerOpen === "fornecedor" ? "Fornecedores" : "Funcionários"}</DialogTitle>
          </DialogHeader>
          <Input placeholder="Buscar..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
          <div className="max-h-[400px] overflow-auto border rounded divide-y">
            {pickerLista.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between"
                onClick={() => { addNumero(novoNumeros, setNovoNumeros, p.telefone); }}
              >
                <div>
                  <div className="text-sm font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{fmtBR(p.telefone)}</div>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ))}
            {pickerLista.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Nenhum registro com telefone cadastrado</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes / Editar */}
      <Dialog open={!!openDet} onOpenChange={(v) => { if (!v) setOpenDet(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Grupo</DialogTitle>
          </DialogHeader>
          {openDet && (
            <div className="space-y-4">
              <div>
                <Label>JID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-muted border rounded font-mono text-xs break-all">{extractJID(openDet)}</code>
                  <Button size="sm" variant="outline" onClick={() => copiar(extractJID(openDet))}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {podeEditar && (
                <div>
                  <Label>Nome do grupo</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={25} />
                    <Button onClick={handleRenomear} disabled={processando || !editNome.trim() || editNome === extractName(openDet)}>Renomear</Button>
                  </div>
                </div>
              )}

              {podeEditar && (
                <div>
                  <Label>Adicionar participantes</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={addInput} onChange={(e) => setAddInput(e.target.value)} placeholder="Números separados por vírgula" />
                    <Button onClick={handleAddParticipantes} disabled={processando}>Adicionar</Button>
                  </div>
                </div>
              )}

              <div>
                <Label>Participantes ({openDet.participants?.length ?? 0})</Label>
                <div className="border rounded max-h-[280px] overflow-auto divide-y mt-1">
                  {(openDet.participants || []).map((p: any, idx: number) => {
                    const pjid = p?.JID || p?.jid || "";
                    const numero = sanitize(pjid.split("@")[0]);
                    return (
                      <div key={pjid || idx} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{fmtBR(numero)}</span>
                          {(p?.isAdmin || p?.isSuperAdmin) && <Badge variant="outline" className="text-xs">admin</Badge>}
                        </div>
                        {podeEditar && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemover(numero)} disabled={processando}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {(!openDet.participants || openDet.participants.length === 0) && (
                    <div className="p-3 text-xs text-muted-foreground text-center">Sem dados de participantes</div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDet(null)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm sair */}
      <DoubleConfirmDelete
        open={!!confirmSair}
        onOpenChange={(v) => !v && setConfirmSair(null)}
        onConfirm={() => { if (confirmSair) handleSair(confirmSair); }}
      />
    </div>
  );
}
