import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PedidoLike {
  id: string;
  numero: number;
  fornecedorId: string;
  fornecedorNome: string;
  valorTotal: number;
  dataCriacao: string;
  condicaoPagamento?: string;
  observacoes?: string;
}

/** Extrai dias de parcelas de strings tipo "30/60/90", "30 dias", "à vista", "28 ddl" */
export function parseParcelas(condicao?: string): number[] {
  if (!condicao) return [0];
  const c = condicao.toLowerCase().trim();
  if (!c || c.includes("vista") || c === "0") return [0];
  // pega todos números
  const nums = c.match(/\d+/g);
  if (!nums || nums.length === 0) return [0];
  // se vier "3x de 30" ignora o primeiro "3x"; pega só números >=2 dígitos
  const dias = nums.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
  // se contém "/" ou múltiplos números de 2+ dígitos = parcelas
  if (c.includes("/") || dias.length > 1) return dias;
  return [dias[0]];
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Gera lançamentos no Contas a Pagar para um Ordem de Compra. Idempotente. */
export async function gerarContasPagarDePC(pedido: PedidoLike, opts?: { silent?: boolean }): Promise<number> {
  // verifica se já existe
  const { data: existentes } = await (supabase as any)
    .from("fin_contas_pagar")
    .select("id")
    .eq("pedido_compra_id", pedido.id);
  if (existentes && existentes.length > 0) {
    if (!opts?.silent) toast.info("Lançamentos financeiros já gerados para este pedido.");
    return 0;
  }

  const dias = parseParcelas(pedido.condicaoPagamento);
  const total = pedido.valorTotal;
  const n = dias.length;
  const valorParcela = Math.round((total / n) * 100) / 100;
  const baseDate = pedido.dataCriacao?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  const rows = dias.map((d, i) => {
    const valor = i === n - 1 ? Math.round((total - valorParcela * (n - 1)) * 100) / 100 : valorParcela;
    return {
      descricao: `OC-${String(pedido.numero).padStart(4, "0")} ${pedido.fornecedorNome}${n > 1 ? ` (${i + 1}/${n})` : ""}`,
      fornecedor_id: pedido.fornecedorId || null,
      fornecedor_nome: pedido.fornecedorNome,
      valor_total: valor,
      valor_pago: 0,
      data_emissao: baseDate,
      data_vencimento: addDays(baseDate, d),
      status: "aberta",
      parcela_num: i + 1,
      parcela_total: n,
      observacao: pedido.observacoes || null,
      pedido_compra_id: pedido.id,
      origem: "pedido_compra",
    };
  });

  const { error } = await (supabase as any).from("fin_contas_pagar").insert(rows);
  if (error) {
    console.error("Erro ao gerar contas a pagar:", error);
    if (!opts?.silent) toast.error("Erro ao gerar lançamento financeiro.");
    return 0;
  }
  if (!opts?.silent) toast.success(`${n} lançamento${n > 1 ? "s" : ""} gerado${n > 1 ? "s" : ""} no Contas a Pagar.`);
  return n;
}

interface FaturamentoLike {
  id: string;
  numeroNf?: string;
  numeroMedicao?: string;
  descricao?: string;
  valorBruto?: string;
  valorLiquido?: string;
  dataEmissaoNf?: string;
  periodoFim?: string;
  pago?: boolean;
  dataPagamento?: string;
}

/** Gera Conta a Receber a partir de Faturamento. Idempotente por faturamento_id. */
export async function gerarContaReceberDeFaturamento(
  fat: FaturamentoLike,
  ctx: { clienteId?: string | null; clienteNome?: string; contratoId?: string | null; contratoNumero?: string },
  opts?: { silent?: boolean }
): Promise<boolean> {
  const valor = parseFloat((fat.valorLiquido || fat.valorBruto || "0").toString().replace(",", "."));
  if (!valor || valor <= 0) return false;

  const { data: existentes } = await (supabase as any)
    .from("fin_contas_receber")
    .select("id, status, valor_recebido, data_recebimento")
    .eq("faturamento_id", fat.id);

  const baseDate = fat.dataEmissaoNf || fat.periodoFim || new Date().toISOString().slice(0, 10);
  const venc = addDays(baseDate, 30);

  const row: any = {
    descricao: `NF ${fat.numeroNf || fat.numeroMedicao || ""} ${ctx.clienteNome || ""}${ctx.contratoNumero ? ` - Contrato ${ctx.contratoNumero}` : ""}`.trim(),
    cliente_id: ctx.clienteId || null,
    cliente_nome: ctx.clienteNome || "",
    valor_total: valor,
    valor_recebido: fat.pago ? valor : 0,
    data_emissao: baseDate,
    data_vencimento: venc,
    data_recebimento: fat.pago ? (fat.dataPagamento || baseDate) : null,
    status: fat.pago ? "recebida" : "aberta",
    parcela_num: 1,
    parcela_total: 1,
    observacao: fat.descricao || null,
    contrato_id: ctx.contratoId || null,
    faturamento_id: fat.id,
    origem: "faturamento",
  };

  if (existentes && existentes.length > 0) {
    // sincroniza status pago
    const exist = existentes[0];
    if (fat.pago && exist.status !== "recebida") {
      await (supabase as any).from("fin_contas_receber").update({
        status: "recebida", valor_recebido: valor, data_recebimento: fat.dataPagamento || baseDate,
      }).eq("id", exist.id);
    }
    return true;
  }

  const { error } = await (supabase as any).from("fin_contas_receber").insert(row);
  if (error) {
    console.error("Erro ao gerar conta a receber:", error);
    if (!opts?.silent) toast.error("Erro ao gerar lançamento no Contas a Receber.");
    return false;
  }
  if (!opts?.silent) toast.success("Lançamento gerado no Contas a Receber.");
  return true;
}
