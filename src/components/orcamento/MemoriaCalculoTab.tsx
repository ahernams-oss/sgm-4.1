import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, RefreshCw, MapPin, Send, Search } from "lucide-react";
import { Fragment, useEffect, useRef, useState, useMemo } from "react";
import SetorCombobox from "./SetorCombobox";
import ImagensSubItem, { type ImagemSubItem } from "./ImagensSubItem";


export type TipoMemoria = "area" | "mao_de_obra" | "unidade";

export interface EntradaSetor {
  id: string;
  setor: string;
  funcionario?: string;
  quantidade?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  hrDia?: number;
  dias?: number;
}

export interface LinhaMemoria {
  id: string;
  item: string;
  codigo: string;
  descricao: string;
  /** Unidade cadastrada no item de origem (SCO/Material) */
  unidade?: string;
  /** Tipo de medição do sub-item (sobrepõe o tipo do grupo) */
  tipo?: TipoMemoria;
  /** @deprecated usar entradas */
  setor?: string;
  funcionario?: string;
  quantidade?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  hrDia?: number;
  dias?: number;
  entradas?: EntradaSetor[];
  /** Até 3 imagens anexadas ao sub-item */
  imagens?: ImagemSubItem[];
}

export interface GrupoMemoria {
  id: string;
  item: string;
  titulo: string;
  tipo: TipoMemoria;
  linhas: LinhaMemoria[];
}

/** Retorna as entradas (setores) de uma linha, convertendo o formato antigo. */
export const getEntradas = (l: LinhaMemoria): EntradaSetor[] => {
  if (Array.isArray(l.entradas) && l.entradas.length) return l.entradas;
  return [{
    id: `${l.id}-0`,
    setor: l.setor || "",
    funcionario: l.funcionario,
    quantidade: l.quantidade,
    comprimento: l.comprimento,
    largura: l.largura,
    altura: l.altura,
    hrDia: l.hrDia,
    dias: l.dias,
  }];
};

export const calcEntrada = (tipo: TipoMemoria, e: EntradaSetor): number => {
  if (tipo === "area") {
    const alt = Number(e.altura) || 0;
    return (e.quantidade || 0) * (e.comprimento || 0) * (e.largura || 0) * (alt > 0 ? alt : 1);
  }
  if (tipo === "mao_de_obra") return (e.hrDia || 0) * (e.dias || 0);
  return e.quantidade || 0;
};

/** Tipo de medição efetivo de um sub-item (linha) */
export const tipoLinha = (g: { tipo: TipoMemoria }, l: LinhaMemoria): TipoMemoria =>
  (l.tipo || g.tipo || "unidade") as TipoMemoria;

export const calcLinha = (tipo: TipoMemoria, l: LinhaMemoria): number =>
  getEntradas(l).reduce((s, e) => s + calcEntrada(tipo, e), 0);

export const calcGrupo = (g: GrupoMemoria): number =>
  g.linhas.reduce((s, l) => s + calcLinha(tipoLinha(g, l), l), 0);

const UNIDADE_CURTA: Record<TipoMemoria, string> = {
  area: "m²",
  mao_de_obra: "h",
  unidade: "un",
};

const UNIDADE_LABEL: Record<TipoMemoria, string> = {
  area: "ÁREA",
  mao_de_obra: "HORA TOTAL",
  unidade: "UNIDADE",
};

const unidadeLinha = (l: LinhaMemoria, t: TipoMemoria) => (l.unidade || "").trim() || UNIDADE_CURTA[t];

const nf = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface ItemOrigem {
  codigo: string;
  descricao: string;
  quantidade: number;
  familia?: string;
  unidade?: string;
}

export interface CatalogoScoItem {
  codigo: string;
  descricao: string;
  unidade?: string;
  familia?: string;
}

export interface ItemParaSco {
  codigo: string;
  descricao: string;
  unidade?: string;
  familia?: string;
  quantidade: number;
}

interface Props {
  grupos: GrupoMemoria[];
  onChange: (g: GrupoMemoria[]) => void;
  readOnly?: boolean;
  itensOrigem?: ItemOrigem[];
  setores?: string[];
  /** Catálogo de itens SCO disponíveis para inserção direta na memória de cálculo */
  catalogoSco?: CatalogoScoItem[];
  /** Envia os subtotais calculados (por código de item) para as abas Itens SCO / Materiais */
  onAplicarSubtotais?: (subtotais: { codigo: string; total: number }[]) => void;
  /** Envia os itens da memória (novos e existentes) para a aba Itens SCO */
  onEnviarItensParaSco?: (itens: ItemParaSco[]) => void;
}

const SEM_FAMILIA = "SEM FAMÍLIA";

export default function MemoriaCalculoTab({ grupos, onChange, readOnly, itensOrigem = [], setores = [], catalogoSco = [], onAplicarSubtotais, onEnviarItensParaSco }: Props) {
  const [scoPopoverGrupo, setScoPopoverGrupo] = useState<string | null>(null);
  const [scoSearch, setScoSearch] = useState("");

  const catalogoFiltrado = useMemo(() => {
    const q = scoSearch.trim().toLowerCase();
    if (!q) return catalogoSco.slice(0, 50);
    return catalogoSco
      .filter(s => s.codigo.toLowerCase().includes(q) || (s.descricao || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [catalogoSco, scoSearch]);

  const aplicarSubtotais = () => {
    const mapa = new Map<string, number>();
    grupos.forEach(g => g.linhas.forEach(l => {
      const cod = (l.codigo || "").trim();
      if (!cod) return;
      mapa.set(cod, (mapa.get(cod) || 0) + calcLinha(tipoLinha(g, l), l));
    }));
    onAplicarSubtotais?.(Array.from(mapa, ([codigo, total]) => ({ codigo, total })));
  };

  const enviarItensParaSco = () => {
    const mapa = new Map<string, ItemParaSco>();
    grupos.forEach(g => g.linhas.forEach(l => {
      const cod = (l.codigo || "").trim();
      if (!cod) return;
      const total = calcLinha(tipoLinha(g, l), l);
      const atual = mapa.get(cod);
      if (atual) atual.quantidade += total;
      else mapa.set(cod, {
        codigo: cod,
        descricao: l.descricao || "",
        unidade: l.unidade,
        familia: (g.titulo || "").trim(),
        quantidade: total,
      });
    }));
    onEnviarItensParaSco?.(Array.from(mapa.values()));
  };


  const sincronizar = (atuais: GrupoMemoria[]): GrupoMemoria[] => {
    const familias: string[] = [];
    const porFamilia = new Map<string, ItemOrigem[]>();
    itensOrigem.forEach(i => {
      const f = (i.familia || "").trim() || SEM_FAMILIA;
      if (!porFamilia.has(f)) { porFamilia.set(f, []); familias.push(f); }
      porFamilia.get(f)!.push(i);
    });

    return familias.map((f, idx) => {
      const existente = atuais.find(g => g.titulo.trim().toUpperCase() === f.toUpperCase());
      const tipo: TipoMemoria = existente?.tipo || "unidade";
      const linhas: LinhaMemoria[] = porFamilia.get(f)!.map((i, li) => {
        const antiga = existente?.linhas.find(l => l.codigo === i.codigo);
        const entradas: EntradaSetor[] = antiga
          ? getEntradas(antiga)
          : [{ id: crypto.randomUUID(), setor: "", quantidade: i.quantidade }];
        return {
          id: antiga?.id || crypto.randomUUID(),
          item: antiga?.item || `${idx + 1}.${li + 1}`,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade || antiga?.unidade,
          tipo: antiga?.tipo,
          imagens: antiga?.imagens || [],
          entradas,
        };
      });
      return {
        id: existente?.id || crypto.randomUUID(),
        item: existente?.item || String(idx + 1),
        titulo: f,
        tipo,
        linhas,
      };
    });
  };

  const assinatura = itensOrigem.map(i => `${i.familia || ""}|${i.codigo}|${i.quantidade}`).join(";");
  const lastSig = useRef<string | null>(null);
  useEffect(() => {
    if (readOnly) return;
    if (lastSig.current === assinatura) return;
    lastSig.current = assinatura;
    if (!itensOrigem.length) return;
    onChange(sincronizar(grupos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, readOnly]);

  const addGrupo = () =>
    onChange([...grupos, { id: crypto.randomUUID(), item: "", titulo: "", tipo: "area", linhas: [] }]);

  const updGrupo = (id: string, patch: Partial<GrupoMemoria>) =>
    onChange(grupos.map(g => (g.id === id ? { ...g, ...patch } : g)));

  const delGrupo = (id: string) => onChange(grupos.filter(g => g.id !== id));

  const addLinha = (gid: string) =>
    onChange(grupos.map(g => g.id === gid ? {
      ...g,
      linhas: [...g.linhas, {
        id: crypto.randomUUID(), item: "", codigo: "", descricao: "",
        entradas: [{ id: crypto.randomUUID(), setor: "", quantidade: 1 }],
      }],
    } : g));

  const addLinhaSco = (gid: string, sco: CatalogoScoItem) =>
    onChange(grupos.map(g => {
      if (g.id !== gid) return g;
      if (g.linhas.some(l => (l.codigo || "").trim() === sco.codigo.trim())) return g;
      const idxGrupo = grupos.findIndex(x => x.id === gid);
      return {
        ...g,
        linhas: [...g.linhas, {
          id: crypto.randomUUID(),
          item: `${g.item || idxGrupo + 1}.${g.linhas.length + 1}`,
          codigo: sco.codigo,
          descricao: sco.descricao,
          unidade: sco.unidade,
          entradas: [{ id: crypto.randomUUID(), setor: "", quantidade: 1 }],
        }],
      };
    }));



  const updLinha = (gid: string, lid: string, patch: Partial<LinhaMemoria>) =>
    onChange(grupos.map(g => g.id === gid ? {
      ...g, linhas: g.linhas.map(l => (l.id === lid ? { ...l, ...patch } : l)),
    } : g));

  const delLinha = (gid: string, lid: string) =>
    onChange(grupos.map(g => g.id === gid ? { ...g, linhas: g.linhas.filter(l => l.id !== lid) } : g));

  const setEntradas = (gid: string, l: LinhaMemoria, entradas: EntradaSetor[]) =>
    updLinha(gid, l.id, { entradas });

  const addEntrada = (gid: string, l: LinhaMemoria) =>
    setEntradas(gid, l, [...getEntradas(l), { id: crypto.randomUUID(), setor: "", quantidade: 1 }]);

  const updEntrada = (gid: string, l: LinhaMemoria, eid: string, patch: Partial<EntradaSetor>) =>
    setEntradas(gid, l, getEntradas(l).map(e => (e.id === eid ? { ...e, ...patch } : e)));

  const delEntrada = (gid: string, l: LinhaMemoria, eid: string) => {
    const rest = getEntradas(l).filter(e => e.id !== eid);
    setEntradas(gid, l, rest.length ? rest : [{ id: crypto.randomUUID(), setor: "", quantidade: 0 }]);
  };

  /** Colunas de medida exibidas no grupo (união dos tipos usados pelos sub-itens) */
  const colunasGrupo = (g: GrupoMemoria) => {
    const tipos = g.linhas.length ? g.linhas.map(l => tipoLinha(g, l)) : [g.tipo];
    const hasArea = tipos.includes("area");
    const hasMo = tipos.includes("mao_de_obra");
    const hasQtd = hasArea || tipos.includes("unidade");
    const uniforme = tipos.every(t => t === tipos[0]) ? tipos[0] : null;
    const m = (hasQtd ? 1 : 0) + (hasArea ? 3 : 0) + (hasMo ? 3 : 0);
    return { hasArea, hasMo, hasQtd, uniforme, m };
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Os grupos são gerados a partir das abas Itens SCO e Materiais: o título vem do campo Família e as quantidades
        dos itens. Cada item pode ter vários setores (1 - N) — use "Adicionar setor" para desdobrar o item; o total do
        item é a soma dos setores.
      </p>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onChange(sincronizar(grupos))} className="flex-1 min-w-[200px]"
            disabled={itensOrigem.length === 0}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar itens (SCO / Materiais)
          </Button>
          <Button variant="outline" onClick={addGrupo} className="flex-1 min-w-[160px]">
            <Plus className="mr-2 h-4 w-4" /> Adicionar grupo
          </Button>
          {onAplicarSubtotais && (
            <Button variant="default" onClick={aplicarSubtotais} className="flex-1 min-w-[200px]" disabled={grupos.length === 0}>
              <Send className="mr-2 h-4 w-4" /> Enviar subtotais para Itens SCO
            </Button>
          )}
        </div>
      )}


      {grupos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado na memória de cálculo.</p>
      )}

      {grupos.map(g => (
        <div key={g.id} className="border rounded-md p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[100px_1fr_200px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Item</Label>
              <Input className="h-8" placeholder="1.2" value={g.item} disabled={readOnly}
                onChange={e => updGrupo(g.id, { item: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Título do grupo</Label>
              <Input className="h-8 uppercase" placeholder="MÃO DE OBRA DA ADMINISTRAÇÃO LOCAL" value={g.titulo}
                disabled onChange={e => updGrupo(g.id, { titulo: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tipo de medição (padrão)</Label>
              <Select value={g.tipo} disabled={readOnly} onValueChange={(v: TipoMemoria) => updGrupo(g.id, { tipo: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Área (qtd × comp. × larg.)</SelectItem>
                  <SelectItem value="mao_de_obra">Mão de obra (hr/dia × dias)</SelectItem>
                  <SelectItem value="unidade">Unidade (quantidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!readOnly && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delGrupo(g.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {(() => {
            const { hasArea, hasMo, hasQtd, uniforme, m } = colunasGrupo(g);
            return (
          <div className="border rounded-md overflow-x-auto">
            <Table className="min-w-[1250px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ITEM</TableHead>
                  <TableHead className="w-40">CÓDIGO</TableHead>
                  <TableHead className="min-w-[140px]">DESCRIÇÃO</TableHead>
                  <TableHead className="w-44">TIPO DE MEDIÇÃO</TableHead>
                  <TableHead className="w-56">SETOR</TableHead>
                  {hasMo && (
                    <>
                      <TableHead className="w-44">FUNCIONÁRIO</TableHead>
                      <TableHead className="w-24">HR/DIA</TableHead>
                      <TableHead className="w-24">DIAS</TableHead>
                    </>
                  )}
                  {hasQtd && <TableHead className="w-24">QUANT.</TableHead>}
                  {hasArea && (
                    <>
                      <TableHead className="w-28">COMPRIMENTO</TableHead>
                      <TableHead className="w-28">LARG.</TableHead>
                      <TableHead className="w-28">ALT.</TableHead>
                    </>
                  )}
                  <TableHead className="w-28">{uniforme ? UNIDADE_LABEL[uniforme] : "TOTAL"}</TableHead>
                  <TableHead className="w-16">UN.</TableHead>
                  <TableHead className="w-24">IMAGENS</TableHead>
                  {!readOnly && <TableHead className="w-10" />}
                  {!readOnly && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.linhas.map(l => {
                  const tl = tipoLinha(g, l);
                  const entradas = getEntradas(l);
                  const linhasEntradas = entradas.map((e, ei) => (
                    <TableRow key={e.id} className={ei > 0 ? "border-t-0" : ""}>
                      {ei === 0 && (
                        <>
                          <TableCell rowSpan={entradas.length} className="align-top">
                            <Input className="h-8" value={l.item} disabled
                              onChange={ev => updLinha(g.id, l.id, { item: ev.target.value })} />
                          </TableCell>
                          <TableCell rowSpan={entradas.length} className="align-top">
                            <Input className="h-8 font-mono text-xs" value={l.codigo} disabled
                              onChange={ev => updLinha(g.id, l.id, { codigo: ev.target.value })} />
                          </TableCell>
                          <TableCell rowSpan={entradas.length} className="align-top">
                            <textarea
                              rows={1}
                              title={l.descricao}
                              className="w-full min-w-[140px] min-h-8 resize rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={l.descricao}
                              disabled
                              onChange={ev => updLinha(g.id, l.id, { descricao: ev.target.value })}
                            />
                          </TableCell>
                          <TableCell rowSpan={entradas.length} className="align-top">
                            <Select value={tl} disabled={readOnly}
                              onValueChange={(v: TipoMemoria) => updLinha(g.id, l.id, { tipo: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="area">Área (qtd × comp. × larg.)</SelectItem>
                                <SelectItem value="mao_de_obra">Mão de obra (hr/dia × dias)</SelectItem>
                                <SelectItem value="unidade">Unidade (quantidade)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        {setores.length > 0 ? (
                          <SetorCombobox value={e.setor || ""} options={setores} disabled={readOnly}
                            onChange={v => updEntrada(g.id, l, e.id, { setor: v })} />
                        ) : (
                          <Input className="h-8" value={e.setor || ""} disabled={readOnly}
                            onChange={ev => updEntrada(g.id, l, e.id, { setor: ev.target.value })} />
                        )}
                      </TableCell>
                      {hasMo && (
                        <>
                          <TableCell>
                            <Input className="h-8" value={e.funcionario || ""} disabled={readOnly || tl !== "mao_de_obra"}
                              onChange={ev => updEntrada(g.id, l, e.id, { funcionario: ev.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.01" className="h-8" value={e.hrDia ?? ""} disabled={readOnly || tl !== "mao_de_obra"}
                              onChange={ev => updEntrada(g.id, l, e.id, { hrDia: Number(ev.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.01" className="h-8" value={e.dias ?? ""} disabled={readOnly || tl !== "mao_de_obra"}
                              onChange={ev => updEntrada(g.id, l, e.id, { dias: Number(ev.target.value) })} />
                          </TableCell>
                        </>
                      )}
                      {hasQtd && (
                        <TableCell>
                          <Input type="number" min={0} step="0.01" className="h-8" value={e.quantidade ?? ""} disabled={readOnly || tl === "mao_de_obra"}
                            onChange={ev => updEntrada(g.id, l, e.id, { quantidade: Number(ev.target.value) })} />
                        </TableCell>
                      )}
                      {hasArea && (
                        <>
                          <TableCell>
                            <Input type="number" min={0} step="0.0001" className="h-8" value={e.comprimento ?? ""} disabled={readOnly || tl !== "area"}
                              onChange={ev => updEntrada(g.id, l, e.id, { comprimento: Number(ev.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.0001" className="h-8" value={e.largura ?? ""} disabled={readOnly || tl !== "area"}
                              onChange={ev => updEntrada(g.id, l, e.id, { largura: Number(ev.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.0001" className="h-8" value={e.altura ?? ""} disabled={readOnly || tl !== "area"}
                              onChange={ev => updEntrada(g.id, l, e.id, { altura: Number(ev.target.value) })} />
                          </TableCell>
                        </>
                      )}
                      <TableCell className="font-medium">
                        {nf(calcEntrada(tl, e))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{unidadeLinha(l, tl)}</TableCell>
                      {ei === 0 && (
                        <TableCell rowSpan={entradas.length} className="align-top">
                          <ImagensSubItem
                            imagens={l.imagens || []}
                            readOnly={readOnly}
                            titulo={`${l.item || ""} ${l.descricao || ""}`.trim()}
                            onChange={imgs => updLinha(g.id, l.id, { imagens: imgs })}
                          />
                        </TableCell>
                      )}


                      {!readOnly && (
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                            title="Remover setor" onClick={() => delEntrada(g.id, l, e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                      {!readOnly && ei === 0 && (
                        <TableCell rowSpan={entradas.length} className="align-top">
                          <div className="flex flex-col gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Adicionar setor"
                              onClick={() => addEntrada(g.id, l)}>
                              <MapPin className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir item"
                              onClick={() => delLinha(g.id, l.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ));
                  return (
                    <Fragment key={l.id}>
                      {linhasEntradas}
                      <TableRow key={`${l.id}-sub`} className="bg-muted/30">
                        <TableCell colSpan={5 + m} className="text-right text-xs font-semibold">
                          SUBTOTAL{l.item ? ` ITEM ${l.item}` : " DO ITEM"}
                        </TableCell>
                        <TableCell className="font-bold">{nf(calcLinha(tl, l))}</TableCell>
                        <TableCell className="text-xs font-semibold">{unidadeLinha(l, tl)}</TableCell>
                        <TableCell />
                        {!readOnly && <TableCell colSpan={2} />}
                      </TableRow>
                    </Fragment>
                  );
                })}
                {(() => {
                  const porTipo = new Map<TipoMemoria, number>();
                  g.linhas.forEach(l => {
                    const t = tipoLinha(g, l);
                    porTipo.set(t, (porTipo.get(t) || 0) + calcLinha(t, l));
                  });
                  const linhasTotal = porTipo.size ? Array.from(porTipo) : ([[g.tipo, 0]] as [TipoMemoria, number][]);
                  return linhasTotal.map(([t, v], i) => (
                    <TableRow key={`total-${t}`} className="bg-muted/50">
                      <TableCell className="font-bold">{i === 0 ? "TOTAL" : ""}</TableCell>
                      <TableCell colSpan={4 + m} className="text-right text-xs font-semibold">
                        {linhasTotal.length > 1 ? UNIDADE_LABEL[t] : ""}
                      </TableCell>
                      <TableCell className="font-bold">{nf(v)}</TableCell>
                      <TableCell className="text-xs font-semibold">{UNIDADE_CURTA[t]}</TableCell>
                      <TableCell />
                      {!readOnly && <TableCell colSpan={2} />}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
            );
          })()}

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addLinha(g.id)}>
                <Plus className="mr-2 h-3.5 w-3.5" /> Adicionar linha
              </Button>
            </div>
          )}

        </div>
      ))}
    </div>
  );
}
