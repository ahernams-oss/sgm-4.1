import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
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
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [pagina, setPagina] = useState(1);
  const filtrados = useMemo(() => filtrarEventuaisPorNome(itens, busca), [itens, busca]);
  const comSaldo = itens.filter(item => Number(item.quantidade) > 0).length;
  const semSaldo = itens.length - comSaldo;
  const paginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * 10, paginaAtual * 10);

  function adicionar(item: ServicoEventualCatalogo) {
    const disponivel = Number(item.quantidade);
    const quantidade = Number(quantidades[item.id] ?? "1");
    const invalido = validarQuantidadeEventual(disponivel, quantidade);
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
      quantidade,
      valorUnitario,
      valorTotal: valoresEventuais(quantidade, valorUnitario, 0).totalComCitl,
    }];
    onChange(atualizados);
    onPersist(atualizados);
    setQuantidades(atuais => ({ ...atuais, [item.id]: "1" }));
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

    <div className="relative max-w-2xl">
      <Label htmlFor="busca-eventual-os">Pesquisar serviço eventual</Label>
      <Search className="absolute bottom-3 left-3 h-4 w-4 text-muted-foreground" />
      <Input id="busca-eventual-os" className="mt-2 pl-9" placeholder="Buscar por nome, item, grupo ou subgrupo..." value={busca} onChange={event => { setBusca(event.target.value); setPagina(1); }} />
    </div>

    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="min-w-[1040px]">
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Discriminação</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead className="text-right">Valor unitário com CITL</TableHead><TableHead className="w-32">Quantidade</TableHead><TableHead className="w-28"><span className="sr-only">Adicionar</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {visiveis.map(item => {
            const disponivel = Number(item.quantidade);
            const saldoInvalido = !Number.isFinite(disponivel) || disponivel <= 0;
            return <TableRow key={item.id}>
              <TableCell className="font-medium">{item.item}</TableCell>
              <TableCell className="min-w-80 max-w-xl whitespace-normal break-words"><span>{item.discriminacao}</span>{(item.grupo || item.subgrupo) && <span className="mt-1 block text-xs text-muted-foreground">{[item.grupo, item.subgrupo].filter(Boolean).join(" › ")}</span>}{saldoInvalido && <span role="alert" className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{disponivel < 0 ? "Saldo negativo: regularize o cadastro." : "Saldo zerado: item indisponível."}</span>}</TableCell>
              <TableCell>{item.unidade}</TableCell>
              <TableCell className={`text-right font-semibold ${saldoInvalido ? "text-destructive" : ""}`}>{Number.isFinite(disponivel) ? numero(disponivel) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold">{moeda(unitarioComCitl(item))}</TableCell>
              <TableCell><Input aria-label={`Quantidade de ${item.discriminacao}`} type="number" min="0.01" step="0.01" disabled={saldoInvalido} value={quantidades[item.id] ?? "1"} onChange={event => setQuantidades(atuais => ({ ...atuais, [item.id]: event.target.value }))} /></TableCell>
              <TableCell><Button type="button" size="sm" disabled={saldoInvalido} onClick={() => adicionar(item)}><Plus className="mr-1 h-4 w-4" />Adicionar</Button></TableCell>
            </TableRow>;
          })}
          {!visiveis.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhum serviço eventual corresponde à pesquisa.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
    {filtrados.length > 10 && <div className="flex items-center justify-end gap-3 text-sm"><Button type="button" variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button><span>{paginaAtual} / {paginas}</span><Button type="button" variant="outline" disabled={paginaAtual === paginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button></div>}

    {selecionados.length > 0 && <div className="space-y-2 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Itens adicionados à O.S. ({selecionados.length})</h4>
      <div className="overflow-x-auto rounded-md border border-border"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Discriminação</TableHead><TableHead>Quantidade</TableHead><TableHead className="text-right">Unitário com CITL</TableHead><TableHead className="text-right">Total com CITL</TableHead><TableHead><span className="sr-only">Remover</span></TableHead></TableRow></TableHeader><TableBody>
        {selecionados.map(selecionado => {
          const catalogo = itens.find(item => idOs(item.id) === selecionado.id);
          const invalido = validarQuantidadeEventual(Number(catalogo?.quantidade), selecionado.quantidade);
          return <TableRow key={selecionado.id}>
            <TableCell>{selecionado.codigo}</TableCell>
            <TableCell className="min-w-72 whitespace-normal break-words">{selecionado.descricao}{invalido && <span role="alert" className="mt-1 block text-xs text-destructive">{invalido}</span>}</TableCell>
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
