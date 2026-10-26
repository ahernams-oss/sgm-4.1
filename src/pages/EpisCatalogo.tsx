import { useState, useMemo } from "react";
import { HardHat, Plus, Search, Trash2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useEpisCatalogo, EpiCatalogo } from "@/contexts/EpisCatalogoContext";
import { usePermissao } from "@/hooks/usePermissao";
import EpiClassificacaoSelect from "@/components/EpiClassificacaoSelect";
import { filtrarEpisPorClassificacao, normalizarClassificacaoEpi, opcoesClassificacaoEpi } from "@/lib/epiClassificacao";

const emptyForm = { codigo: "", descricao: "", grupo: "", subgrupo: "", unidade: "", ca: "", validadeMeses: "", observacao: "" };

export default function EpisCatalogoPage() {
  const { epis, addEpi, updateEpi, deleteEpi } = useEpisCatalogo();
  const { tem } = usePermissao();
  const podeCriar = tem("cargos.criar");
  const podeEditar = tem("cargos.editar");
  const podeExcluir = tem("cargos.excluir");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroSubgrupo, setFiltroSubgrupo] = useState("");
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [novosGrupos, setNovosGrupos] = useState<string[]>([]);
  const [novosSubgrupos, setNovosSubgrupos] = useState<{ grupo: string; nome: string }[]>([]);
  const grupos = useMemo(() => opcoesClassificacaoEpi([...epis.map(epi => epi.grupo), ...novosGrupos, form.grupo]), [epis, novosGrupos, form.grupo]);
  const subgrupos = useMemo(() => opcoesClassificacaoEpi([
    ...epis.filter(epi => !form.grupo || normalizarClassificacaoEpi(epi.grupo) === normalizarClassificacaoEpi(form.grupo)).map(epi => epi.subgrupo),
    ...novosSubgrupos.filter(item => !form.grupo || normalizarClassificacaoEpi(item.grupo) === normalizarClassificacaoEpi(form.grupo)).map(item => item.nome),
    form.subgrupo,
  ]), [epis, novosSubgrupos, form.grupo, form.subgrupo]);
  const gruposFiltro = useMemo(() => opcoesClassificacaoEpi(epis.map(epi => epi.grupo)), [epis]);
  const subgruposFiltro = useMemo(() => opcoesClassificacaoEpi(
    epis.filter(epi => !filtroGrupo || normalizarClassificacaoEpi(epi.grupo) === normalizarClassificacaoEpi(filtroGrupo)).map(epi => epi.subgrupo),
  ), [epis, filtroGrupo]);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.descricao.trim()) { toast.error("Informe a descrição do EPI."); return; }
    const payload = {
      codigo: form.codigo.trim(),
      descricao: form.descricao.trim(),
      grupo: form.grupo.trim(),
      subgrupo: form.subgrupo.trim(),
      unidade: form.unidade.trim(),
      ca: form.ca.trim(),
      validadeMeses: form.validadeMeses ? Number(form.validadeMeses) : null,
      observacao: form.observacao.trim(),
    };
    if (editingId) {
      await updateEpi(editingId, payload);
      toast.success("EPI atualizado!");
    } else {
      await addEpi(payload);
      toast.success("EPI cadastrado!");
    }
    reset();
  };

  const startEdit = (epi: EpiCatalogo) => {
    setEditingId(epi.id);
    setForm({
      codigo: epi.codigo,
      descricao: epi.descricao,
      grupo: epi.grupo,
      subgrupo: epi.subgrupo,
      unidade: epi.unidade,
      ca: epi.ca,
      validadeMeses: epi.validadeMeses ? String(epi.validadeMeses) : "",
      observacao: epi.observacao,
    });
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const porClassificacao = filtrarEpisPorClassificacao(epis, { grupo: filtroGrupo, subgrupo: filtroSubgrupo });
    if (!s) return porClassificacao;
    return porClassificacao.filter((e) =>
      e.descricao.toLowerCase().includes(s) ||
      e.codigo.toLowerCase().includes(s) ||
      e.grupo.toLowerCase().includes(s) ||
      e.subgrupo.toLowerCase().includes(s) ||
      e.unidade.toLowerCase().includes(s) ||
      e.ca.toLowerCase().includes(s)
    );
  }, [epis, search, filtroGrupo, filtroSubgrupo]);

  const { paginated } = paginate(filtered, page, pageSize);

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary mb-1">
            <HardHat className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cadastro</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">Catálogo de EPIs</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Cadastre os EPIs disponíveis para serem associados aos cargos.
          </p>
        </div>

        <div className="section-card mb-6">
          <h2 className="section-title">{editingId ? "Editar EPI" : "Novo EPI"}</h2>
          <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-1">
              <label className="field-label">Código</label>
              <Input value={form.codigo} onChange={(e) => update("codigo", e.target.value)} placeholder="Opcional" />
            </div>
            <div className="md:col-span-3">
              <label className="field-label">Descrição *</label>
              <Input value={form.descricao} onChange={(e) => update("descricao", e.target.value)} placeholder="Ex: Capacete de segurança" />
            </div>
            <div className="md:col-span-1">
              <label className="field-label">CA</label>
              <Input value={form.ca} onChange={(e) => update("ca", e.target.value)} placeholder="Ex: 12345" />
            </div>
            <div className="md:col-span-1">
              <label className="field-label">Validade (meses)</label>
              <Input type="number" min={0} value={form.validadeMeses} onChange={(e) => update("validadeMeses", e.target.value.replace(",", "."))} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="epi-grupo" className="field-label">Grupo</label>
              <EpiClassificacaoSelect id="epi-grupo" label="Grupo" value={form.grupo} options={grupos} canCreate={editingId ? podeEditar : podeCriar}
                onChange={grupo => setForm(current => ({ ...current, grupo, subgrupo: grupo === current.grupo ? current.subgrupo : "" }))}
                onCreate={grupo => setNovosGrupos(current => [...current, grupo])} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="epi-subgrupo" className="field-label">SubGrupo</label>
              <EpiClassificacaoSelect id="epi-subgrupo" label="SubGrupo" value={form.subgrupo} options={subgrupos} canCreate={editingId ? podeEditar : podeCriar}
                onChange={subgrupo => update("subgrupo", subgrupo)}
                onCreate={nome => setNovosSubgrupos(current => [...current, { grupo: form.grupo, nome }])} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="epi-unidade" className="field-label">Unidade</label>
              <Input id="epi-unidade" value={form.unidade} onChange={(e) => update("unidade", e.target.value)} placeholder="Ex.: UN, PAR" />
            </div>
            <div className="md:col-span-6">
              <label className="field-label">Observação</label>
              <Textarea rows={2} value={form.observacao} onChange={(e) => update("observacao", e.target.value)} />
            </div>
            <div className="md:col-span-6 flex gap-2">
              <Button type="submit" className="gap-2">
                <Plus className="h-4 w-4" />
                {editingId ? "Salvar Alterações" : "Adicionar EPI"}
              </Button>
              {editingId && <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>}
            </div>
          </form>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="section-title mb-0">EPIs Cadastrados ({filtered.length})</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar..." className="pl-9 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="w-full md:w-72">
              <label htmlFor="epi-filtro-grupo" className="field-label">Filtro Grupo</label>
              <EpiClassificacaoSelect id="epi-filtro-grupo" label="Grupo" value={filtroGrupo} options={gruposFiltro} canCreate={false}
                onChange={grupo => { setFiltroGrupo(grupo); setFiltroSubgrupo(""); setPage(1); }} onCreate={() => {}} />
            </div>
            <div className="w-full md:w-72">
              <label htmlFor="epi-filtro-subgrupo" className="field-label">Filtro SubGrupo</label>
              <EpiClassificacaoSelect id="epi-filtro-subgrupo" label="SubGrupo" value={filtroSubgrupo} options={subgruposFiltro} canCreate={false}
                onChange={subgrupo => { setFiltroSubgrupo(subgrupo); setPage(1); }} onCreate={() => {}} />
            </div>
            {(filtroGrupo || filtroSubgrupo) && (
              <Button type="button" variant="outline" className="gap-2 h-9 shrink-0" onClick={() => { setFiltroGrupo(""); setFiltroSubgrupo(""); setPage(1); }}>
                <X className="h-4 w-4" />Limpar filtros
              </Button>
            )}
          </div>

          {paginated.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {filtroGrupo || filtroSubgrupo ? "Nenhum EPI encontrado para os filtros selecionados." : "Nenhum EPI cadastrado."}
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>SubGrupo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="w-24 text-center">CA</TableHead>
                    <TableHead className="w-28 text-center">Validade</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((epi, idx) => (
                    <TableRow key={epi.id} className={idx % 2 === 1 ? "bg-muted/60" : "bg-background"}>
                      <TableCell className="font-mono text-xs">{epi.codigo || "—"}</TableCell>
                      <TableCell className="font-medium">{epi.descricao}</TableCell>
                      <TableCell>{epi.grupo || "—"}</TableCell>
                      <TableCell>{epi.subgrupo || "—"}</TableCell>
                      <TableCell>{epi.unidade || "—"}</TableCell>
                      <TableCell className="text-center">
                        {epi.ca ? <Badge variant="outline">{epi.ca}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {epi.validadeMeses ? `${epi.validadeMeses} ${epi.validadeMeses === 1 ? "mês" : "meses"}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{epi.observacao || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(epi)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => requestDelete(epi.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) cancelDelete(); }}
        onConfirm={async () => {
          if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; }
          if (deleteId) { await deleteEpi(deleteId); toast.success("EPI removido."); }
          cancelDelete();
        }}
      />
    </div>
  );
}
