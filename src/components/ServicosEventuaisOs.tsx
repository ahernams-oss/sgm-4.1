import { useMemo, useState } from "react";
import { AlertTriangle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MaterialOS } from "@/contexts/OrdensServicoContext";
import type { ServicoEventualCatalogo } from "@/hooks/useServicosEventuaisContrato";
import { filtrarEventuaisPorNome, validarQuantidadeEventual, valoresEventuais } from "@/lib/servicosEventuais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const idOs = (id: string) => `eventual:${id}`;

function unitarioComCitl(item: ServicoEventualCatalogo) {
  return item.unitario_com_citl ?? valoresEventuais(1, item.preco_unitario, item.citl_percentual).unitarioComCitl;
}

interface Props {
  contratoNumero: string;
  itens: ServicoEventualCatalogo[];
  selecionados: MaterialOS[];
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
  onChange: (itens: MaterialOS[]) => void;
  onPersist: (itens: MaterialOS[]) => void;
}

export default function ServicosEventuaisOs({ contratoNumero, itens, selecionados, carregando, erro, onTentarNovamente, onChange, onPersist }: Props) {
  const [busca, setBusca] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const buscaAtiva = busca.trim().length > 0;
  const sugestoes = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return [];
    return (termo === "*" ? itens : filtrarEventuaisPorNome(itens, termo)).slice(0, 50);
  }, [itens, busca]);
  const comSaldo = itens.filter(item => Number(item.quantidade) > 0).length;
  const semSaldo = itens.length - comSaldo;

  function adicionar(item: ServicoEventualCatalogo) {
    const disponivel = Number(item.quantidade);
    const qtd = Number(quantidade.replace(",", "."));
    const invalido = validarQuantidadeEventual(disponivel, qtd);
    if (invalido) { toast.error(invalido); return; }
    if (selecionados.some(selecionado => selecionado.id === idOs(item.id))) {
      toast.warning("Este item já foi adicionado. Ajuste a quantidade na lista de itens selecionados.");
      return;
    }
    const valorUnitario = unitarioComCitl(item);
    const atualizados = [...selecionados, {
      id: idOs(item.id),
      codigo: item.item,
      descricao: item.discriminacao,
      unidade: item.unidade,
      quantidade: qtd,
      valorUnitario,
      valorTotal: valoresEventuais(qtd, valorUnitario, 0).totalComCitl,
    }];
    onChange(atualizados);
    onPersist(atualizados);
    setBusca("");
    setQuantidade("1");
    toast.success("Serviço eventual adicionado.");
  }

  function alterarQuantidade(selecionado: MaterialOS, valor: string) {
    const quantidade = Number(valor);
    const atualizados = selecionados.map(item => item.id === selecionado.id ? {
      ...item,
      quantidade: Number.isFinite(quantidade) ? quantidade : 0,
      valorTotal: valoresEventuais(Number.isFinite(quantidade) ? quantidade : 0, item.valorUnitario, 0).totalComCitl,
    } : item);
    onChange(atualizados);
  }

  function persistirQuantidade(selecionado: MaterialOS) {
    const catalogo = itens.find(item => idOs(item.id) === selecionado.id);
    const invalido = validarQuantidadeEventual(Number(catalogo?.quantidade), selecionado.quantidade);
    if (invalido) { toast.error(invalido); return; }
    onPersist(selecionados);
  }

  function remover(id: string) {
    const atualizados = selecionados.filter(item => item.id !== id);
    onChange(atualizados);
    onPersist(atualizados);
  }

  if (carregando) return <p role="status" className="text-sm text-muted-foreground">Carregando serviços eventuais do contrato...</p>;
  if (erro) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">Não foi possível carregar os serviços eventuais.<Button type="button" variant="outline" onClick={onTentarNovamente}>Tentar novamente</Button></div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <span>Contrato <strong>{contratoNumero || "—"}</strong></span>
      <span><strong>{itens.length}</strong> {itens.length === 1 ? "item associado" : "itens associados"}</span>
      <span><strong>{comSaldo}</strong> com saldo</span>
      {semSaldo > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /><strong>{semSaldo}</strong> zerado(s) ou negativo(s)</span>}
    </div>

    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-72 flex-1">
        <Label htmlFor="busca-eventual-os">Código</Label>
        <div className="relative mt-2">
          <Input id="busca-eventual-os" autoComplete="off" className="pr-9" placeholder="Código ou descrição (digite * para listar tudo)" value={busca} onChange={event => setBusca(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setBusca(""); if (event.key === "Enter" && sugestoes.length === 1 && sugestoes[0]) { event.preventDefault(); adicionar(sugestoes[0]); } }} />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {buscaAtiva && <div role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {sugestoes.map(item => {
            const disponivel = Number(item.quantidade);
            const saldoInvalido = !Number.isFinite(disponivel) || disponivel <= 0;
            return <button key={item.id} type="button" role="option" aria-selected={false} disabled={saldoInvalido} onClick={() => adicionar(item)} className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
              <span className="min-w-0"><span className="font-semibold">{item.item}</span> — <span className="break-words">{item.discriminacao}</span> <span className="text-muted-foreground">({item.unidade})</span>{saldoInvalido && <span className="mt-0.5 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{disponivel < 0 ? "Saldo negativo" : "Saldo zerado"}: item indisponível</span>}</span>
              <span className="shrink-0 text-right text-xs"><span className="block font-semibold">{moeda(unitarioComCitl(item))}</span><span className={saldoInvalido ? "text-destructive" : "text-muted-foreground"}>Disp.: {Number.isFinite(disponivel) ? numero(disponivel) : "—"}</span></span>
            </button>;
          })}
          {!sugestoes.length && <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum serviço eventual encontrado.</p>}
        </div>}
      </div>
      <div>
        <Label htmlFor="qtd-eventual-os">Qtd.</Label>
        <Input id="qtd-eventual-os" className="mt-2 w-28 text-center" type="number" min="0.01" step="0.01" value={quantidade} onChange={event => setQuantidade(event.target.value)} />
      </div>
    </div>

    {selecionados.length > 0 && <div className="space-y-2 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Itens adicionados à O.S. ({selecionados.length})</h4>
      <div className="overflow-x-auto rounded-md border border-border"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Discriminação</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead>Quantidade</TableHead><TableHead className="text-right">Unitário com CITL</TableHead><TableHead className="text-right">Total com CITL</TableHead><TableHead><span className="sr-only">Remover</span></TableHead></TableRow></TableHeader><TableBody>
        {selecionados.map(selecionado => {
          const catalogo = itens.find(item => idOs(item.id) === selecionado.id);
          const invalido = validarQuantidadeEventual(Number(catalogo?.quantidade), selecionado.quantidade);
          return <TableRow key={selecionado.id}>
            <TableCell>{selecionado.codigo}</TableCell>
            <TableCell className="min-w-72 whitespace-normal break-words">{selecionado.descricao}{invalido && <span role="alert" className="mt-1 block text-xs text-destructive">{invalido}</span>}</TableCell>
            <TableCell className={`whitespace-nowrap text-right font-semibold ${Number(catalogo?.quantidade) > 0 ? "" : "text-destructive"}`}>{catalogo && Number.isFinite(Number(catalogo.quantidade)) ? numero(Number(catalogo.quantidade)) : "—"}</TableCell>
            <TableCell><Input aria-label={`Quantidade adicionada de ${selecionado.descricao}`} className="w-28" type="number" min="0.01" step="0.01" value={selecionado.quantidade} onChange={event => alterarQuantidade(selecionado, event.target.value)} onBlur={() => persistirQuantidade(selecionado)} /></TableCell>
            <TableCell className="whitespace-nowrap text-right">{moeda(selecionado.valorUnitario)}</TableCell>
            <TableCell className="whitespace-nowrap text-right font-semibold">{moeda(selecionado.valorTotal)}</TableCell>
            <TableCell><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${selecionado.descricao}`} onClick={() => remover(selecionado.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
          </TableRow>;
        })}
      </TableBody></Table></div>
    </div>}
  </div>;
}
