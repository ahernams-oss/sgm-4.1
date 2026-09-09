import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, Boxes, GripVertical, Filter, Copy, Save, Trash2, Percent } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useSolicitacoesServicos } from "@/contexts/SolicitacoesServicosContext";
import { useEstoque } from "@/contexts/EstoqueContext";
import { useOrcamentos } from "@/contexts/OrcamentosContext";
import { useMedicoes } from "@/contexts/MedicoesContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro } from "@/lib/gerarRelatoriosFinanceiros";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type Agg = "count" | "sum" | "avg" | "min" | "max" | "distinct";

const AGG_LABEL: Record<Agg, string> = {
  count: "Contagem (Qtd. de Registros)",
  sum: "Soma de Valor",
  avg: "Média de Valor",
  min: "Mínimo",
  max: "Máximo",
  distinct: "Contagem Distinta",
};

interface Dimension {
  key: string;
  label: string;
  get: (r: any) => string;
}
interface ValueField {
  key: string;
  label: string;
  get: (r: any) => number;
  format?: (n: number) => string;
}
interface Dataset {
  key: string;
  label: string;
  rows: any[];
  dateField?: (r: any) => string | null | undefined;
  dimensions: Dimension[];
  values: ValueField[];
}

const monthOf = (d?: string | null) => (d ? String(d).slice(0, 7) : "—");
const yearOf = (d?: string | null) => (d ? String(d).slice(0, 4) : "—");
const parseNum = (v: any) =>
  Number(
    String(v ?? "0")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  ) || 0;

type ZoneId = "available" | "rows" | "cols";
const ZONES: { id: ZoneId; title: string; hint: string }[] = [
  { id: "available", title: "Dimensões Disponíveis", hint: "Arraste para Linhas ou Colunas" },
  { id: "rows", title: "Linhas", hint: "Dimensões empilhadas verticalmente" },
  { id: "cols", title: "Colunas", hint: "Dimensões empilhadas horizontalmente" },
];

const SEP = " ▸ ";
const VIEWS_KEY = "cubo-multidim-views";

interface SavedView {
  nome: string;
  dsKey: string;
  rowsDims: string[];
  colsDims: string[];
  agg: Agg;
  valueKey: string;
  distinctDim: string;
  dataIni: string;
  dataFim: string;
  filtros: Record<string, string[]>;
}

function Chip({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-sm cursor-grab active:cursor-grabbing select-none hover:bg-muted/50"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      {label}
    </div>
  );
}

function Zone({
  id,
  title,
  hint,
  items,
  labelOf,
}: {
  id: ZoneId;
  title: string;
  hint: string;
  items: string[];
  labelOf: (k: string) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed p-3 min-h-[110px] transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <div className="mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-1.5">
          {items.length === 0 && (
            <span className="text-xs text-muted-foreground italic">— vazio —</span>
          )}
          {items.map((k) => (
            <Chip key={k} id={`${id}::${k}`} label={labelOf(k)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

/** Multi-select de valores de uma dimensão */
function DimFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtrados = useMemo(
    () => (busca ? options.filter((o) => norm(o).includes(norm(busca))) : options),
    [options, busca],
  );
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs justify-start">
          <Filter className="h-3 w-3" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Buscar valor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 mb-2 text-xs"
        />
        <div className="flex justify-between mb-1">
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => onChange(filtrados)}>
            Marcar todos
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => onChange([])}>
            Limpar
          </Button>
        </div>
        <ScrollArea className="h-56 pr-2">
          <div className="space-y-1">
            {filtrados.map((o) => (
              <label key={o} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
                <span className="truncate" title={o}>{o}</span>
              </label>
            ))}
            {filtrados.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Nenhum valor</span>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function RelatoriosMultidimensional() {
  const { tem } = usePermissao();
  const podePdf = tem("gerencial_multidim.exportar_pdf");
  const podeExcel = tem("gerencial_multidim.exportar_excel");

  const fin = useFinanceiro();
  const { clientes } = useClientes();
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { ordens } = useOrdensServico();
  const { solicitacoes } = useSolicitacoesServicos();
  const { movimentacoes } = useEstoque();
  const { orcamentos } = useOrcamentos();
  const { medicoes } = useMedicoes();

  const cargoNome = (id: string) => cargos.find((c) => c.id === id)?.nome || "—";
  const clienteNome = (id?: string | null) => clientes.find((c) => c.id === id)?.nome || "—";

  const datasets: Dataset[] = useMemo(
    () => [
      {
        key: "os",
        label: "Ordens de Serviço",
        rows: ordens,
        dateField: (r) => r.createdAt,
        dimensions: [
          { key: "cliente", label: "Cliente", get: (r) => r.clienteNome || "—" },
          { key: "situacao", label: "Situação", get: (r) => r.situacao || "—" },
          { key: "prioridade", label: "Prioridade", get: (r) => r.prioridade || "—" },
          { key: "complexidade", label: "Complexidade", get: (r) => r.complexidade || "—" },
          { key: "categoria", label: "Categoria", get: (r) => r.categoria || "—" },
          { key: "tipoOs", label: "Tipo OS", get: (r) => r.tipoOs || "—" },
          { key: "operador", label: "Operador", get: (r) => r.operadorNome || "—" },
          { key: "local", label: "Local/Setor", get: (r) => r.local || r.setor || "—" },
          { key: "numero", label: "Nº OS", get: (r) => String(r.numero ?? "—") },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.createdAt) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.createdAt) },
        ],
        values: [
          {
            key: "valor",
            label: "Valor da OS",
            get: (r) => {
              const itens = (r.materiais || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0)
                + (r.materiaisEstoque || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0);
              const bdi = itens * (Number(r.bdi || 0) / 100);
              return itens + bdi;
            },
            format: formatBRL,
          },
          {
            key: "valor_itens",
            label: "Valor dos Itens (sem BDI)",
            get: (r) => (r.materiais || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0)
              + (r.materiaisEstoque || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0),
            format: formatBRL,
          },
          { key: "bdi_pct", label: "BDI (%)", get: (r) => Number(r.bdi || 0) },
          { key: "qtd_itens", label: "Qtd. de Itens", get: (r) => (r.materiais?.length || 0) + (r.materiaisEstoque?.length || 0) },
          { key: "qtd", label: "Quantidade (contagem)", get: () => 1 },
        ],
      },
      (() => {
        const rows: any[] = [];
        ordens.forEach((o: any) => {
          [...(o.materiais || []), ...(o.materiaisEstoque || [])].forEach((m: any) => {
            rows.push({
              osNumero: o.numero,
              clienteNome: o.clienteNome || "—",
              situacao: o.situacao || "—",
              createdAt: o.createdAt,
              codigo: m.codigo || m.codSco || "—",
              descricao: m.descricao || "—",
              unidade: m.unidade || "—",
              quantidade: Number(m.quantidade) || 0,
              valorUnitario: Number(m.valorUnitario) || 0,
              valorTotal: Number(m.valorTotal) || 0,
              origem: m.codSco ? "SCO" : "Estoque/Compra",
            });
          });
        });
        return {
          key: "os_itens",
          label: "Ordens de Serviço — Itens (analítico)",
          rows,
          dateField: (r: any) => r.createdAt,
          dimensions: [
            { key: "cliente", label: "Cliente", get: (r: any) => r.clienteNome },
            { key: "situacao", label: "Situação da OS", get: (r: any) => r.situacao },
            { key: "os", label: "Nº OS", get: (r: any) => String(r.osNumero ?? "—") },
            { key: "codigo", label: "Código", get: (r: any) => r.codigo },
            { key: "descricao", label: "Descrição", get: (r: any) => r.descricao },
            { key: "unidade", label: "Unidade", get: (r: any) => r.unidade },
            { key: "origem", label: "Origem", get: (r: any) => r.origem },
            { key: "mes", label: "Mês", get: (r: any) => monthOf(r.createdAt) },
            { key: "ano", label: "Ano", get: (r: any) => yearOf(r.createdAt) },
          ],
          values: [
            { key: "valorTotal", label: "Valor Total", get: (r: any) => r.valorTotal, format: formatBRL },
            { key: "valorUnitario", label: "Valor Unitário", get: (r: any) => r.valorUnitario, format: formatBRL },
            { key: "quantidade", label: "Quantidade", get: (r: any) => r.quantidade },
          ],
        } as Dataset;
      })(),
      {
        key: "ss",
        label: "Solicitações de Serviço",
        rows: solicitacoes,
        dateField: (r) => r.createdAt,
        dimensions: [
          { key: "cliente", label: "Cliente", get: (r) => r.clienteNome || "—" },
          { key: "tipo", label: "Tipo", get: (r) => r.tipo || "—" },
          { key: "situacao", label: "Situação", get: (r) => r.situacao || "—" },
          { key: "prioridade", label: "Prioridade", get: (r) => r.prioridade || "—" },
          { key: "solicitante", label: "Solicitante", get: (r) => r.solicitante || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.createdAt) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.createdAt) },
        ],
        values: [],
      },
      {
        key: "pc",
        label: "Ordens de Compra",
        rows: pedidos,
        dateField: (r) => r.dataCriacao,
        dimensions: [
          { key: "fornecedor", label: "Fornecedor", get: (r) => r.fornecedorNome || "—" },
          { key: "comprador", label: "Comprador", get: (r) => r.comprador || "—" },
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "condicao", label: "Cond. Pagamento", get: (r) => r.condicaoPagamento || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.dataCriacao) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.dataCriacao) },
        ],
        values: [
          { key: "valor", label: "Valor Total", get: (r) => Number(r.valorTotal || 0), format: formatBRL },
        ],
      },
      {
        key: "rc",
        label: "Requisições de Compras",
        rows: requisicoes,
        dateField: (r) => r.dataCriacao,
        dimensions: [
          { key: "centro_custo", label: "Centro de Custo", get: (r) => r.centroCustoNome || "—" },
          { key: "solicitante", label: "Solicitante", get: (r) => r.solicitante || "—" },
          { key: "urgencia", label: "Urgência", get: (r) => r.urgencia || "—" },
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.dataCriacao) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.dataCriacao) },
        ],
        values: [],
      },
      {
        key: "estoque",
        label: "Movimentações de Estoque",
        rows: movimentacoes,
        dateField: (r) => r.dataMovimentacao,
        dimensions: [
          { key: "tipo", label: "Tipo", get: (r) => r.tipo || "—" },
          { key: "material", label: "Material", get: (r) => r.materialDescricao || "—" },
          { key: "codigo", label: "Código", get: (r) => r.materialCodigo || "—" },
          { key: "local", label: "Local", get: (r) => r.local || "—" },
          { key: "fornecedor", label: "Fornecedor", get: (r) => r.fornecedorNome || "—" },
          { key: "sco", label: "Cód. SCO", get: (r) => r.codSco || "—" },
          { key: "usuario", label: "Usuário", get: (r) => r.usuario || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.dataMovimentacao) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.dataMovimentacao) },
        ],
        values: [
          { key: "qtd", label: "Quantidade", get: (r) => Number(r.quantidade || 0) },
          { key: "vlr_unit", label: "Valor Unitário", get: (r) => Number(r.valorUnitario || 0), format: formatBRL },
          {
            key: "vlr_total",
            label: "Valor Total",
            get: (r) => Number(r.quantidade || 0) * Number(r.valorUnitario || 0),
            format: formatBRL,
          },
        ],
      },
      {
        key: "orc",
        label: "Orçamentos",
        rows: orcamentos,
        dateField: (r) => r.dataCriacao || r.createdAt,
        dimensions: [
          { key: "cliente", label: "Cliente", get: (r) => r.clienteNome || "—" },
          { key: "categoria", label: "Categoria", get: (r) => r.categoria || "—" },
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "criadoPor", label: "Criado por", get: (r) => r.criadoPor || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.dataCriacao || r.createdAt) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.dataCriacao || r.createdAt) },
        ],
        values: [
          { key: "valor", label: "Valor Total", get: (r) => Number(r.valorTotal || 0), format: formatBRL },
          { key: "qtd_sco", label: "Qtd. Itens SCO", get: (r) => (r.itensSco || []).length },
          { key: "qtd_mat", label: "Qtd. Itens Materiais", get: (r) => (r.itensMateriais || []).length },
        ],
      },
      {
        key: "med",
        label: "Medições de Serviços",
        rows: medicoes,
        dateField: (r) => r.created_at,
        dimensions: [
          { key: "cliente", label: "Cliente", get: (r) => r.cliente_nome || "—" },
          { key: "contrato", label: "Contrato", get: (r) => r.contrato || "—" },
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.created_at) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.created_at) },
        ],
        values: [
          { key: "contratado", label: "Valor Contratado", get: (r) => Number(r.valor_total_contratado || 0), format: formatBRL },
          { key: "medido", label: "Valor Medido", get: (r) => Number(r.valor_total_medido || 0), format: formatBRL },
          {
            key: "saldo",
            label: "Saldo a Medir",
            get: (r) => Number(r.valor_total_contratado || 0) - Number(r.valor_total_medido || 0),
            format: formatBRL,
          },
          { key: "pct", label: "% Medido", get: (r) => Number(r.percentual_medido || 0) },
        ],
      },
      {
        key: "func",
        label: "Funcionários",
        rows: funcionarios,
        dateField: (r) => r.dataAdmissao,
        dimensions: [
          { key: "cliente", label: "Cliente/Contrato", get: (r) => clienteNome(r.clienteId) },
          { key: "cargo", label: "Cargo", get: (r) => cargoNome(r.cargoId) },
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "tipoContrato", label: "Tipo Contrato", get: (r) => r.tipoContrato || "—" },
          { key: "sexo", label: "Sexo", get: (r) => r.sexo || "—" },
          { key: "uf", label: "UF", get: (r) => r.uf || "—" },
          { key: "cidade", label: "Cidade", get: (r) => r.cidade || "—" },
          { key: "ano_admissao", label: "Ano Admissão", get: (r) => yearOf(r.dataAdmissao) },
          { key: "mes_admissao", label: "Mês Admissão", get: (r) => monthOf(r.dataAdmissao) },
        ],
        values: [
          { key: "salario", label: "Salário", get: (r) => parseNum(r.salario), format: formatBRL },
        ],
      },
      {
        key: "cp",
        label: "Contas a Pagar",
        rows: fin.contasPagar,
        dateField: (r) => r.data_vencimento,
        dimensions: [
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "fornecedor", label: "Fornecedor", get: (r) => r.fornecedor_nome || "—" },
          { key: "centro_custo", label: "Centro de Custo", get: (r) => fin.centrosCusto.find((c) => c.id === r.centro_custo_id)?.nome || "—" },
          { key: "plano", label: "Plano de Contas", get: (r) => fin.planoContas.find((c) => c.id === r.plano_conta_id)?.nome || "—" },
          { key: "mes", label: "Mês (Venc.)", get: (r) => monthOf(r.data_vencimento) },
          { key: "ano", label: "Ano (Venc.)", get: (r) => yearOf(r.data_vencimento) },
        ],
        values: [
          { key: "total", label: "Valor Total", get: (r) => Number(r.valor_total || 0), format: formatBRL },
          { key: "pago", label: "Valor Pago", get: (r) => Number(r.valor_pago || 0), format: formatBRL },
          {
            key: "aberto",
            label: "Saldo em Aberto",
            get: (r) => Number(r.valor_total || 0) - Number(r.valor_pago || 0),
            format: formatBRL,
          },
        ],
      },
      {
        key: "cr",
        label: "Contas a Receber",
        rows: fin.contasReceber,
        dateField: (r) => r.data_vencimento,
        dimensions: [
          { key: "status", label: "Status", get: (r) => r.status || "—" },
          { key: "cliente", label: "Cliente", get: (r) => r.cliente_nome || "—" },
          { key: "centro_custo", label: "Centro de Custo", get: (r) => fin.centrosCusto.find((c) => c.id === r.centro_custo_id)?.nome || "—" },
          { key: "plano", label: "Plano de Contas", get: (r) => fin.planoContas.find((c) => c.id === r.plano_conta_id)?.nome || "—" },
          { key: "mes", label: "Mês (Venc.)", get: (r) => monthOf(r.data_vencimento) },
          { key: "ano", label: "Ano (Venc.)", get: (r) => yearOf(r.data_vencimento) },
        ],
        values: [
          { key: "total", label: "Valor Total", get: (r) => Number(r.valor_total || 0), format: formatBRL },
          { key: "recebido", label: "Valor Recebido", get: (r) => Number(r.valor_recebido || 0), format: formatBRL },
          {
            key: "aberto",
            label: "Saldo em Aberto",
            get: (r) => Number(r.valor_total || 0) - Number(r.valor_recebido || 0),
            format: formatBRL,
          },
        ],
      },
      {
        key: "lanc",
        label: "Lançamentos Financeiros (Caixa/Banco)",
        rows: fin.lancamentos,
        dateField: (r) => r.data,
        dimensions: [
          { key: "tipo", label: "Tipo", get: (r) => r.tipo || "—" },
          { key: "conta", label: "Conta Bancária", get: (r) => fin.contasBancarias.find((c: any) => c.id === r.conta_bancaria_id)?.nome || "—" },
          { key: "centro_custo", label: "Centro de Custo", get: (r) => fin.centrosCusto.find((c) => c.id === r.centro_custo_id)?.nome || "—" },
          { key: "plano", label: "Plano de Contas", get: (r) => fin.planoContas.find((c) => c.id === r.plano_conta_id)?.nome || "—" },
          { key: "conciliado", label: "Conciliado", get: (r) => (r.conciliado ? "Sim" : "Não") },
          { key: "mes", label: "Mês", get: (r) => monthOf(r.data) },
          { key: "ano", label: "Ano", get: (r) => yearOf(r.data) },
        ],
        values: [
          { key: "valor", label: "Valor", get: (r) => Number(r.valor || 0), format: formatBRL },
          {
            key: "valor_sinal",
            label: "Valor (com sinal)",
            get: (r) => (r.tipo === "saida" ? -Number(r.valor || 0) : Number(r.valor || 0)),
            format: formatBRL,
          },
        ],
      },
      (() => {
        type FRow = {
          clienteNome: string;
          contratoNumero: string;
          periodo: string;
          mes: string;
          ano: string;
          numeroNf: string;
          valorFolha: number;
          valorVariavel: number;
          valorNota: number;
          moMensal: number;
          verbaVarMensal: number;
          saldoMO: number;
          saldoVar: number;
        };
        const rows: FRow[] = [];
        clientes.forEach((c) => {
          (c.contratos || []).forEach((ct: any) => {
            const moMensal = parseNum(ct.maoDeObraMensal);
            const verbaVarMensal = parseNum(ct.maoDeObraAnual) / 12;
            (ct.faturamentos || []).forEach((f: any) => {
              const valorFolha = parseNum(f.valorFolha);
              const valorVariavel = parseNum(f.valorVariavel);
              const periodo = f.periodoInicio || f.dataEmissaoNf || "";
              rows.push({
                clienteNome: c.nome || "—",
                contratoNumero: ct.numero || "—",
                periodo,
                mes: monthOf(periodo),
                ano: yearOf(periodo),
                numeroNf: f.numeroNf || "—",
                valorFolha,
                valorVariavel,
                valorNota: valorFolha + valorVariavel,
                moMensal,
                verbaVarMensal,
                saldoMO: moMensal - valorFolha,
                saldoVar: verbaVarMensal - valorVariavel,
              });
            });
          });
        });
        return {
          key: "saldos_fat",
          label: "Saldos de Faturamento (M.O. Fixa e Variável)",
          rows,
          dateField: (r: FRow) => r.periodo,
          dimensions: [
            { key: "cliente", label: "Cliente", get: (r: FRow) => r.clienteNome },
            { key: "contrato", label: "Contrato", get: (r: FRow) => r.contratoNumero },
            { key: "mes", label: "Mês", get: (r: FRow) => r.mes },
            { key: "ano", label: "Ano", get: (r: FRow) => r.ano },
            { key: "nf", label: "Nº Nota Fiscal", get: (r: FRow) => r.numeroNf },
          ],
          values: [
            { key: "valorFolha", label: "V. Fat. - M.O. Fixa", get: (r: FRow) => r.valorFolha, format: formatBRL },
            { key: "valorVariavel", label: "V. Fat. - Variável", get: (r: FRow) => r.valorVariavel, format: formatBRL },
            { key: "valorNota", label: "V. Total - Nota Fiscal", get: (r: FRow) => r.valorNota, format: formatBRL },
            { key: "moMensal", label: "V. Prev. - M.O. Fixa", get: (r: FRow) => r.moMensal, format: formatBRL },
            { key: "verbaVarMensal", label: "V. Prev. - Variável", get: (r: FRow) => r.verbaVarMensal, format: formatBRL },
            { key: "saldoMO", label: "Saldo - M.O. Fixa", get: (r: FRow) => r.saldoMO, format: formatBRL },
            { key: "saldoVar", label: "Saldo - Variável", get: (r: FRow) => r.saldoVar, format: formatBRL },
          ],
        } as Dataset;
      })(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordens, solicitacoes, pedidos, requisicoes, funcionarios, fin, clientes, cargos, movimentacoes, orcamentos, medicoes],
  );

  const [dsKey, setDsKey] = useState<string>("os");
  const ds = datasets.find((d) => d.key === dsKey) || datasets[0];

  const [rowsDims, setRowsDims] = useState<string[]>([ds.dimensions[0]?.key].filter(Boolean) as string[]);
  const [colsDims, setColsDims] = useState<string[]>([]);
  const available = ds.dimensions.map((d) => d.key).filter((k) => !rowsDims.includes(k) && !colsDims.includes(k));
  const labelOf = (k: string) => ds.dimensions.find((d) => d.key === k)?.label || k;

  const [agg, setAgg] = useState<Agg>("count");
  const [valueKey, setValueKey] = useState<string>(ds.values[0]?.key || "");
  const [distinctDim, setDistinctDim] = useState<string>(ds.dimensions[0]?.key || "");
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioAno = `${new Date().getFullYear()}-01-01`;
  const [dataIni, setDataIni] = useState(inicioAno);
  const [dataFim, setDataFim] = useState(hoje);
  const [semData, setSemData] = useState(false);

  // Filtros por dimensão
  const [filtros, setFiltros] = useState<Record<string, string[]>>({});

  // Visualização
  const [ordenacao, setOrdenacao] = useState<"label" | "total_desc" | "total_asc">("label");
  const [topN, setTopN] = useState<string>("0");
  const [ocultarZerados, setOcultarZerados] = useState(false);
  const [mostrarPct, setMostrarPct] = useState(false);
  const [buscaLinha, setBuscaLinha] = useState("");

  // Drill-down
  const [drill, setDrill] = useState<{ titulo: string; rows: any[] } | null>(null);

  // Views salvas
  const [views, setViews] = useState<SavedView[]>(() => {
    try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || "[]"); } catch { return []; }
  });

  // Reset when dataset changes
  useEffect(() => {
    setRowsDims(ds.dimensions[0]?.key ? [ds.dimensions[0].key] : []);
    setColsDims([]);
    setValueKey(ds.values[0]?.key || "");
    setDistinctDim(ds.dimensions[0]?.key || "");
    setFiltros({});
    setBuscaLinha("");
    if (!ds.values.length) setAgg("count");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey]);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const parseId = (id: string) => {
    const [zone, key] = id.split("::");
    return { zone: zone as ZoneId, key };
  };
  const getList = (z: ZoneId) => (z === "rows" ? rowsDims : z === "cols" ? colsDims : available);
  const setList = (z: ZoneId, v: string[]) => {
    if (z === "rows") setRowsDims(v);
    else if (z === "cols") setColsDims(v);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const a = parseId(String(active.id));
    let targetZone: ZoneId;
    let targetKey: string | null = null;
    const overId = String(over.id);
    if (overId === "available" || overId === "rows" || overId === "cols") {
      targetZone = overId as ZoneId;
    } else {
      const o = parseId(overId);
      targetZone = o.zone;
      targetKey = o.key;
    }
    if (a.zone === targetZone) {
      if (targetZone === "available") return;
      const list = [...getList(targetZone)];
      const oldIdx = list.indexOf(a.key);
      const newIdx = targetKey ? list.indexOf(targetKey) : list.length - 1;
      if (oldIdx < 0) return;
      setList(targetZone, arrayMove(list, oldIdx, newIdx));
      return;
    }
    if (a.zone === "rows") setRowsDims((r) => r.filter((k) => k !== a.key));
    if (a.zone === "cols") setColsDims((r) => r.filter((k) => k !== a.key));
    if (targetZone === "rows") {
      setRowsDims((r) => {
        const next = r.filter((k) => k !== a.key);
        const idx = targetKey ? next.indexOf(targetKey) : next.length;
        next.splice(idx >= 0 ? idx : next.length, 0, a.key);
        return next;
      });
    } else if (targetZone === "cols") {
      setColsDims((r) => {
        const next = r.filter((k) => k !== a.key);
        const idx = targetKey ? next.indexOf(targetKey) : next.length;
        next.splice(idx >= 0 ? idx : next.length, 0, a.key);
        return next;
      });
    }
  };

  // Linhas após período + filtros de dimensão
  const rowsFiltradas = useMemo(() => {
    return ds.rows.filter((r) => {
      if (!semData && ds.dateField) {
        const d = ds.dateField(r);
        if (d) {
          const s = String(d).slice(0, 10);
          if (s < dataIni || s > dataFim) return false;
        }
      }
      for (const [dimKey, vals] of Object.entries(filtros)) {
        if (!vals?.length) continue;
        const dim = ds.dimensions.find((x) => x.key === dimKey);
        if (!dim) continue;
        if (!vals.includes(dim.get(r) || "—")) return false;
      }
      return true;
    });
  }, [ds, dataIni, dataFim, semData, filtros]);

  // Valores possíveis por dimensão (respeitando período)
  const opcoesDim = useMemo(() => {
    const base = ds.rows.filter((r) => {
      if (semData || !ds.dateField) return true;
      const d = ds.dateField(r);
      if (!d) return true;
      const s = String(d).slice(0, 10);
      return s >= dataIni && s <= dataFim;
    });
    const map: Record<string, string[]> = {};
    ds.dimensions.forEach((dim) => {
      const set = new Set<string>();
      base.forEach((r) => set.add(dim.get(r) || "—"));
      map[dim.key] = Array.from(set).sort();
    });
    return map;
  }, [ds, dataIni, dataFim, semData]);

  interface Acc { sum: number; count: number; min: number; max: number; distinct: Set<string>; rows: any[] }
  const novoAcc = (): Acc => ({ sum: 0, count: 0, min: Infinity, max: -Infinity, distinct: new Set(), rows: [] });

  const cube = useMemo(() => {
    const rowDefs = rowsDims.map((k) => ds.dimensions.find((d) => d.key === k)!).filter(Boolean);
    const colDefs = colsDims.map((k) => ds.dimensions.find((d) => d.key === k)!).filter(Boolean);
    const valDef = ds.values.find((v) => v.key === valueKey);
    const distDef = ds.dimensions.find((d) => d.key === distinctDim);
    if (!rowDefs.length) return null;

    const map: Record<string, Record<string, Acc>> = {};
    const rowKeysSet = new Set<string>();
    const colKeysSet = new Set<string>();

    rowsFiltradas.forEach((r) => {
      const rk = rowDefs.map((d) => d.get(r) || "—").join(SEP);
      const ck = colDefs.length ? colDefs.map((d) => d.get(r) || "—").join(SEP) : "Total";
      rowKeysSet.add(rk);
      colKeysSet.add(ck);
      map[rk] ||= {};
      map[rk][ck] ||= novoAcc();
      const acc = map[rk][ck];
      const v = valDef ? valDef.get(r) : 0;
      acc.sum += v;
      acc.count += 1;
      acc.min = Math.min(acc.min, v);
      acc.max = Math.max(acc.max, v);
      if (distDef) acc.distinct.add(distDef.get(r) || "—");
      if (acc.rows.length < 500) acc.rows.push(r);
    });

    const mergeAcc = (list: Acc[]): Acc => {
      const out = novoAcc();
      list.forEach((a) => {
        out.sum += a.sum;
        out.count += a.count;
        out.min = Math.min(out.min, a.min);
        out.max = Math.max(out.max, a.max);
        a.distinct.forEach((d) => out.distinct.add(d));
        out.rows.push(...a.rows.slice(0, 200));
      });
      return out;
    };

    const valOf = (a?: Acc): number => {
      if (!a || a.count === 0) return 0;
      switch (agg) {
        case "count": return a.count;
        case "sum": return a.sum;
        case "avg": return a.sum / a.count;
        case "min": return a.min === Infinity ? 0 : a.min;
        case "max": return a.max === -Infinity ? 0 : a.max;
        case "distinct": return a.distinct.size;
      }
    };

    const cols = Array.from(colKeysSet).sort();
    let rowKeys = Array.from(rowKeysSet).sort();

    const numFmt = (n: number) =>
      Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const usaMoeda = (agg === "sum" || agg === "avg" || agg === "min" || agg === "max") && !!valDef?.format;
    const fmt = usaMoeda ? valDef!.format! : numFmt;

    let matrix = rowKeys.map((rk) => {
      const accs = cols.map((ck) => map[rk]?.[ck]);
      const cells = accs.map((a) => valOf(a));
      const totAcc = mergeAcc(accs.filter(Boolean) as Acc[]);
      return { rk, parts: rk.split(SEP), cells, accs, tot: valOf(totAcc) };
    });

    // busca textual nas linhas
    if (buscaLinha.trim()) {
      const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      matrix = matrix.filter((m) => norm(m.rk).includes(norm(buscaLinha)));
    }
    if (ocultarZerados) matrix = matrix.filter((m) => m.tot !== 0);
    if (ordenacao === "total_desc") matrix = [...matrix].sort((a, b) => b.tot - a.tot);
    else if (ordenacao === "total_asc") matrix = [...matrix].sort((a, b) => a.tot - b.tot);

    const limite = Number(topN) || 0;
    const totalLinhas = matrix.length;
    if (limite > 0) matrix = matrix.slice(0, limite);

    const colTotals = cols.map((_, i) => {
      const accs = matrix.map((row) => row.accs[i]).filter(Boolean) as Acc[];
      return valOf(mergeAcc(accs));
    });
    const grandTotal = valOf(mergeAcc(matrix.flatMap((r) => r.accs.filter(Boolean) as Acc[])));

    return { rowDefs, colDefs, valDef, cols, matrix, colTotals, grandTotal, fmt, totalLinhas, registros: rowsFiltradas.length };
  }, [ds, rowsDims, colsDims, agg, valueKey, distinctDim, rowsFiltradas, ordenacao, topN, ocultarZerados, buscaLinha]);

  const pct = (n: number) => (cube && cube.grandTotal ? `${((n / cube.grandTotal) * 100).toFixed(1)}%` : "—");
  const cellText = (n: number) => (mostrarPct ? pct(n) : cube!.fmt(n));

  const buildReport = () => {
    if (!cube) return null;
    const rowHeaders = cube.rowDefs.map((d) => d.label);
    const colHeader = cube.colDefs.length ? cube.colDefs.map((d) => d.label).join(" × ") : "Total";
    const colunas = [...rowHeaders, ...cube.cols, `${colHeader} (Total)`];
    const linhas = cube.matrix.map((r) => [...r.parts, ...r.cells.map(cellText), cellText(r.tot)]);
    linhas.push([
      "TOTAL GERAL",
      ...Array(Math.max(rowHeaders.length - 1, 0)).fill(""),
      ...cube.colTotals.map(cellText),
      cellText(cube.grandTotal),
    ]);
    const valLabel =
      agg === "count" ? "Contagem"
        : agg === "distinct" ? `Contagem Distinta de ${labelOf(distinctDim)}`
          : `${AGG_LABEL[agg]} — ${cube.valDef?.label || "Valor"}`;
    const filtrosAtivos = Object.entries(filtros)
      .filter(([, v]) => v?.length)
      .map(([k, v]) => `${labelOf(k)}: ${v.join(", ")}`)
      .join(" | ");
    return {
      titulo: `Cubo Multidimensional - ${ds.label}`,
      subtitulo: `Linhas: ${rowHeaders.join(" × ") || "—"} | Colunas: ${colHeader} | Métrica: ${valLabel}`,
      filtros: `${semData ? "Período: todos" : `Período: ${formatDate(dataIni)} a ${formatDate(dataFim)}`}${filtrosAtivos ? ` | ${filtrosAtivos}` : ""}`,
      colunas,
      linhas,
      totais: [{ label: "Total Geral", valor: cellText(cube.grandTotal) }],
    };
  };

  const exportar = (fmtType: "pdf" | "xlsx") => {
    const report = buildReport();
    if (!report || !cube?.matrix.length) {
      toast.warning("Nenhum dado para exportar.");
      return;
    }
    try {
      if (fmtType === "pdf") gerarPdfFinanceiro(report);
      else gerarExcelFinanceiro(report);
      toast.success(`${fmtType.toUpperCase()} gerado com sucesso!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar exportação");
    }
  };

  const copiarCsv = async () => {
    const report = buildReport();
    if (!report) return;
    const csv = [report.colunas, ...report.linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      toast.success("Tabela copiada (CSV).");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const salvarView = () => {
    const nome = window.prompt("Nome da visão:");
    if (!nome) return;
    const nova: SavedView = { nome, dsKey, rowsDims, colsDims, agg, valueKey, distinctDim, dataIni, dataFim, filtros };
    const next = [...views.filter((v) => v.nome !== nome), nova];
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    toast.success("Visão salva.");
  };

  const aplicarView = (nome: string) => {
    const v = views.find((x) => x.nome === nome);
    if (!v) return;
    setDsKey(v.dsKey);
    setTimeout(() => {
      setRowsDims(v.rowsDims);
      setColsDims(v.colsDims);
      setAgg(v.agg);
      setValueKey(v.valueKey);
      setDistinctDim(v.distinctDim);
      setDataIni(v.dataIni);
      setDataFim(v.dataFim);
      setFiltros(v.filtros || {});
    }, 0);
  };

  const excluirView = (nome: string) => {
    const next = views.filter((v) => v.nome !== nome);
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };

  const swapRowsCols = () => {
    setRowsDims(colsDims);
    setColsDims(rowsDims);
  };

  const filtrosAtivosCount = Object.values(filtros).filter((v) => v?.length).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-serif font-semibold">Relatórios Multidimensional (Cubo)</h1>
          <p className="text-sm text-muted-foreground">
            Arraste dimensões, combine agregações, filtre valores e explore os dados até o registro de origem.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Configuração do Cubo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label>Dataset</Label>
              <Select value={dsKey} onValueChange={setDsKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agregação</Label>
              <Select value={agg} onValueChange={(v) => setAgg(v as Agg)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">{AGG_LABEL.count}</SelectItem>
                  <SelectItem value="distinct">{AGG_LABEL.distinct}</SelectItem>
                  {ds.values.length > 0 && <SelectItem value="sum">{AGG_LABEL.sum}</SelectItem>}
                  {ds.values.length > 0 && <SelectItem value="avg">{AGG_LABEL.avg}</SelectItem>}
                  {ds.values.length > 0 && <SelectItem value="min">{AGG_LABEL.min}</SelectItem>}
                  {ds.values.length > 0 && <SelectItem value="max">{AGG_LABEL.max}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {agg !== "count" && agg !== "distinct" && ds.values.length > 0 && (
              <div>
                <Label>Campo de Valor</Label>
                <Select value={valueKey} onValueChange={setValueKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ds.values.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {agg === "distinct" && (
              <div>
                <Label>Contar distintos de</Label>
                <Select value={distinctDim} onValueChange={setDistinctDim}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ds.dimensions.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Período Início</Label>
              <Input type="date" value={dataIni} disabled={semData} onChange={(e) => setDataIni(e.target.value)} />
            </div>
            <div>
              <Label>Período Fim</Label>
              <Input type="date" value={dataFim} disabled={semData} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={semData} onCheckedChange={(v) => setSemData(!!v)} />
            Ignorar período (considerar toda a base)
          </label>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {ZONES.map((z) => (
                <Zone
                  key={z.id}
                  id={z.id}
                  title={z.title}
                  hint={z.hint}
                  items={getList(z.id)}
                  labelOf={labelOf}
                />
              ))}
            </div>
            <DragOverlay>
              {activeId ? (
                <div className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-lg">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  {labelOf(parseId(activeId).key)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Filtros por dimensão */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm">Filtros por dimensão</Label>
              {filtrosAtivosCount > 0 && (
                <>
                  <Badge variant="secondary" className="text-[10px]">{filtrosAtivosCount} ativo(s)</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setFiltros({})}>
                    Limpar filtros
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ds.dimensions.map((d) => (
                <DimFilter
                  key={d.key}
                  label={d.label}
                  options={opcoesDim[d.key] || []}
                  selected={filtros[d.key] || []}
                  onChange={(v) => setFiltros((f) => ({ ...f, [d.key]: v }))}
                />
              ))}
            </div>
          </div>

          {/* Opções de visualização */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Ordenar linhas</Label>
              <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as any)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="label">Alfabética</SelectItem>
                  <SelectItem value="total_desc">Maior total primeiro</SelectItem>
                  <SelectItem value="total_asc">Menor total primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Top N linhas</Label>
              <Select value={topN} onValueChange={setTopN}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todas</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                  <SelectItem value="100">Top 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar na linha</Label>
              <Input className="h-9 text-xs" placeholder="Filtrar rótulos..." value={buscaLinha} onChange={(e) => setBuscaLinha(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end gap-1.5 pb-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={ocultarZerados} onCheckedChange={(v) => setOcultarZerados(!!v)} />
                Ocultar linhas zeradas
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={mostrarPct} onCheckedChange={(v) => setMostrarPct(!!v)} />
                <span className="inline-flex items-center gap-1"><Percent className="h-3 w-3" /> Exibir % do total geral</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={swapRowsCols}>
              ⇄ Inverter Linhas e Colunas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRowsDims(ds.dimensions[0]?.key ? [ds.dimensions[0].key] : []);
                setColsDims([]);
                setFiltros({});
                setBuscaLinha("");
                setTopN("0");
              }}
            >
              Limpar Pivot
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={salvarView} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar visão
            </Button>
            {views.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">Visões salvas ({views.length})</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="space-y-1">
                    {views.map((v) => (
                      <div key={v.nome} className="flex items-center justify-between gap-2">
                        <Button variant="ghost" size="sm" className="h-7 flex-1 justify-start text-xs" onClick={() => aplicarView(v.nome)}>
                          {v.nome}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirView(v.nome)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Resultado: {ds.label} — Linhas:{" "}
              {cube?.rowDefs.map((d) => d.label).join(" × ") || "—"}
              {cube?.colDefs.length ? ` | Colunas: ${cube.colDefs.map((d) => d.label).join(" × ")}` : ""}
            </CardTitle>
            {cube && (
              <p className="text-xs text-muted-foreground mt-1">
                {cube.registros} registro(s) no filtro · {cube.totalLinhas} linha(s) · {cube.cols.length} coluna(s)
                {Number(topN) > 0 && cube.totalLinhas > Number(topN) ? ` · exibindo Top ${topN}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copiarCsv} className="gap-2">
              <Copy className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!podePdf} onClick={() => exportar("pdf")} className="gap-2">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" disabled={!podeExcel} onClick={() => exportar("xlsx")} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!cube || !cube.matrix.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {rowsDims.length === 0
                ? "Adicione ao menos uma dimensão em Linhas para visualizar o cubo."
                : "Nenhum dado para exibir."}
            </p>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    {cube.rowDefs.map((d) => (
                      <th key={d.key} className="border px-3 py-2 text-left font-semibold whitespace-nowrap bg-muted">
                        {d.label}
                      </th>
                    ))}
                    {cube.cols.map((c) => (
                      <th key={c} className="border px-3 py-2 text-right font-semibold whitespace-nowrap bg-muted">
                        {c}
                      </th>
                    ))}
                    <th className="border px-3 py-2 text-right font-semibold bg-primary/10">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cube.matrix.map((row) => (
                    <tr key={row.rk} className="hover:bg-muted/40">
                      {row.parts.map((p, i) => (
                        <td key={i} className="border px-3 py-1.5 whitespace-nowrap">{p}</td>
                      ))}
                      {row.cells.map((n, i) => (
                        <td
                          key={i}
                          className="border px-3 py-1.5 text-right tabular-nums cursor-pointer hover:bg-primary/10"
                          onClick={() =>
                            setDrill({
                              titulo: `${row.rk} — ${cube.cols[i]}`,
                              rows: row.accs[i]?.rows || [],
                            })
                          }
                          title="Clique para ver os registros"
                        >
                          {cellText(n)}
                        </td>
                      ))}
                      <td className="border px-3 py-1.5 text-right tabular-nums font-semibold bg-primary/5">
                        {cellText(row.tot)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted font-semibold">
                    <td className="border px-3 py-2" colSpan={cube.rowDefs.length}>TOTAL GERAL</td>
                    {cube.colTotals.map((n, i) => (
                      <td key={i} className="border px-3 py-2 text-right tabular-nums">{cellText(n)}</td>
                    ))}
                    <td className="border px-3 py-2 text-right tabular-nums bg-primary/10">
                      {cellText(cube.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalhamento</DialogTitle>
            <DialogDescription>{drill?.titulo}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted">
                  {ds.dimensions.map((d) => (
                    <th key={d.key} className="border px-2 py-1.5 text-left whitespace-nowrap">{d.label}</th>
                  ))}
                  {ds.values.map((v) => (
                    <th key={v.key} className="border px-2 py-1.5 text-right whitespace-nowrap">{v.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(drill?.rows || []).map((r, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    {ds.dimensions.map((d) => (
                      <td key={d.key} className="border px-2 py-1 whitespace-nowrap">{d.get(r)}</td>
                    ))}
                    {ds.values.map((v) => (
                      <td key={v.key} className="border px-2 py-1 text-right tabular-nums">
                        {v.format ? v.format(v.get(r)) : v.get(r)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!drill?.rows.length && (
                  <tr><td className="p-4 text-center text-muted-foreground" colSpan={99}>Sem registros.</td></tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
