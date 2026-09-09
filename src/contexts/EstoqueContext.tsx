import { createContext, useContext, useCallback, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface MovimentacaoEstoque {
  id: string;
  materialId: string;
  materialCodigo: string;
  materialDescricao: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  local: string;
  documentoRef: string;
  observacao: string;
  usuario: string;
  dataMovimentacao: string;
  lote: string;
  validade: string;
  depositoOrigem: string;
  depositoDestino: string;
  fornecedorNome: string;
  valorUnitario: number;
  codSco: string;
  descricaoSco: string;
  quantidadeSco: number;
  fatorConversao: number;
}

export interface ItemInventario {
  materialId: string;
  materialCodigo: string;
  materialDescricao: string;
  saldoSistema: number;
  quantidadeContada: number;
  diferenca: number;
  observacao: string;
}

export interface Inventario {
  id: string;
  dataInventario: string;
  local: string;
  status: "Aberto" | "Fechado";
  itens: ItemInventario[];
  usuario: string;
  observacao: string;
}

export interface SaldoEstoque {
  materialId: string;
  materialCodigo: string;
  materialDescricao: string;
  local: string;
  quantidade: number;
  valorUnitarioFIFO: number;
  valorTotal: number;
}

export interface LoteFIFO {
  movimentacaoId: string;
  quantidade: number;
  quantidadeOriginal: number;
  valorUnitario: number;
  dataMovimentacao: string;
  documentoRef: string;
}

interface EstoqueContextType {
  movimentacoes: MovimentacaoEstoque[];
  inventarios: Inventario[];
  registrarMovimentacao: (data: Omit<MovimentacaoEstoque, "id" | "dataMovimentacao">) => Promise<void>;
  registrarEntradaRecebimento: (itens: { materialId: string; materialCodigo: string; materialDescricao: string; quantidade: number; unidadeMedida: string; valorUnitario?: number }[], local: string, documentoRef: string, usuario: string) => Promise<void>;
  getSaldos: () => SaldoEstoque[];
  getSaldoPorMaterial: (materialId: string) => number;
  getSaldoPorLocal: (materialId: string, local: string) => number;
  getLotesFIFO: (materialId: string, local: string) => LoteFIFO[];
  transferirEntreLocais: (data: { materialId: string; materialCodigo: string; materialDescricao: string; quantidade: number; localOrigem: string; localDestino: string; usuario: string; observacao?: string }) => Promise<void>;
  criarInventario: (data: Omit<Inventario, "id" | "dataInventario" | "status">) => Promise<void>;
  atualizarInventario: (id: string, itens: ItemInventario[], observacao: string) => Promise<void>;
  fecharInventario: (id: string, usuario: string) => Promise<void>;
  atualizarValorMovimentacao: (id: string, valorUnitario: number) => Promise<void>;
  reload: () => Promise<void>;
}

const EstoqueContext = createContext<EstoqueContextType | undefined>(undefined);
const QK_MOV = ["estoque_movimentacoes"] as const;
const QK_INV = ["estoque_inventarios"] as const;

const rowToMov = (r: any): MovimentacaoEstoque => ({
  id: r.id, materialId: r.material_id ?? "", materialCodigo: r.material_codigo ?? "",
  materialDescricao: r.material_descricao ?? "", tipo: r.tipo ?? "entrada",
  quantidade: Number(r.quantidade ?? 0), local: r.local ?? "",
  documentoRef: r.documento_ref ?? "", observacao: r.observacao ?? "",
  usuario: r.usuario ?? "", dataMovimentacao: r.data_movimentacao ?? "",
  lote: r.lote ?? "", validade: r.validade ?? "",
  depositoOrigem: r.deposito_origem ?? "", depositoDestino: r.deposito_destino ?? "",
  fornecedorNome: r.fornecedor_nome ?? "",
  valorUnitario: Number(r.valor_unitario ?? 0),
  codSco: r.cod_sco ?? "", descricaoSco: r.descricao_sco ?? "",
  quantidadeSco: Number(r.quantidade_sco ?? 0), fatorConversao: Number(r.fator_conversao ?? 1),
});

const rowToInv = (r: any): Inventario => ({
  id: r.id, dataInventario: r.data_inventario ?? "", local: r.local ?? "",
  status: r.status ?? "Aberto", itens: r.itens ?? [], usuario: r.usuario ?? "",
  observacao: r.observacao ?? "",
});

export function EstoqueProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Estoque");
  const qc = useQueryClient();

  const { data: movimentacoes = [], refetch: refetchMov } = useQuery({
    enabled: __active,
    queryKey: QK_MOV,
    queryFn: async () => (await fetchAll("estoque_movimentacoes", "created_at")).map(rowToMov),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const { data: inventarios = [], refetch: refetchInv } = useQuery({
    enabled: __active,
    queryKey: QK_INV,
    queryFn: async () => (await fetchAll("estoque_inventarios", "created_at")).map(rowToInv),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });

  const invMov = () => qc.invalidateQueries({ queryKey: QK_MOV });
  const invInv = () => qc.invalidateQueries({ queryKey: QK_INV });
  const reload = async () => { await Promise.all([refetchMov(), refetchInv()]); };

  const registrarMovimentacao = async (data: Omit<MovimentacaoEstoque, "id" | "dataMovimentacao">) => {
    await insertRow("estoque_movimentacoes", {
      material_id: data.materialId, material_codigo: data.materialCodigo,
      material_descricao: data.materialDescricao, tipo: data.tipo,
      quantidade: data.quantidade, local: data.local,
      documento_ref: data.documentoRef, observacao: data.observacao,
      usuario: data.usuario, data_movimentacao: new Date().toISOString(),
      lote: data.lote || "", validade: data.validade || null,
      deposito_origem: data.depositoOrigem || "", deposito_destino: data.depositoDestino || "",
      fornecedor_nome: data.fornecedorNome || "",
      valor_unitario: data.valorUnitario || 0,
      cod_sco: data.codSco || null, descricao_sco: data.descricaoSco || null,
      quantidade_sco: data.quantidadeSco || null, fator_conversao: data.fatorConversao || null,
    });
    invMov();
  };

  const registrarEntradaRecebimento = async (
    itens: { materialId: string; materialCodigo: string; materialDescricao: string; quantidade: number; unidadeMedida: string; valorUnitario?: number }[],
    local: string, documentoRef: string, usuario: string
  ) => {
    for (const item of itens) {
      if (item.quantidade > 0) {
        await insertRow("estoque_movimentacoes", {
          material_id: item.materialId, material_codigo: item.materialCodigo,
          material_descricao: item.materialDescricao, tipo: "entrada",
          quantidade: item.quantidade, local,
          documento_ref: documentoRef, observacao: "Entrada automática via recebimento",
          usuario, data_movimentacao: new Date().toISOString(),
          valor_unitario: item.valorUnitario || 0,
        });
      }
    }
    invMov();
  };

  const getLotesFIFO = useCallback((materialId: string, local: string): LoteFIFO[] => {
    const movs = movimentacoes
      .filter(m => m.materialId === materialId && m.local === local)
      .sort((a, b) => (a.dataMovimentacao || "").localeCompare(b.dataMovimentacao || ""));

    const lotes: LoteFIFO[] = [];
    let saidasPendentes = 0;

    for (const m of movs) {
      if (m.tipo === "entrada" || m.tipo === "ajuste") {
        if (m.quantidade > 0) {
          lotes.push({
            movimentacaoId: m.id,
            quantidade: m.quantidade,
            quantidadeOriginal: m.quantidade,
            valorUnitario: m.valorUnitario,
            dataMovimentacao: m.dataMovimentacao,
            documentoRef: m.documentoRef,
          });
        } else if (m.quantidade < 0) {
          saidasPendentes += Math.abs(m.quantidade);
        }
      } else if (m.tipo === "saida") {
        saidasPendentes += m.quantidade;
      }
    }

    for (const lote of lotes) {
      if (saidasPendentes <= 0) break;
      const consumir = Math.min(saidasPendentes, lote.quantidade);
      lote.quantidade -= consumir;
      saidasPendentes -= consumir;
    }

    return lotes.filter(l => l.quantidade > 0);
  }, [movimentacoes]);

  const getSaldos = useCallback((): SaldoEstoque[] => {
    const map = new Map<string, { materialId: string; materialCodigo: string; materialDescricao: string; local: string; quantidade: number }>();
    for (const m of movimentacoes) {
      const key = `${m.materialId}__${m.local}`;
      if (!map.has(key)) {
        map.set(key, { materialId: m.materialId, materialCodigo: m.materialCodigo, materialDescricao: m.materialDescricao, local: m.local, quantidade: 0 });
      }
      const s = map.get(key)!;
      if (m.tipo === "entrada") s.quantidade += m.quantidade;
      else if (m.tipo === "saida") s.quantidade -= m.quantidade;
      else s.quantidade += m.quantidade;
    }
    return Array.from(map.values())
      .filter(s => s.quantidade !== 0)
      .map(s => {
        const lotes = getLotesFIFO(s.materialId, s.local);
        const valorTotal = lotes.reduce((sum, l) => sum + l.quantidade * l.valorUnitario, 0);
        const valorUnitarioFIFO = s.quantidade > 0 ? valorTotal / s.quantidade : 0;
        return { ...s, valorUnitarioFIFO, valorTotal };
      });
  }, [movimentacoes, getLotesFIFO]);

  const getSaldoPorMaterial = useCallback((materialId: string): number => {
    return movimentacoes
      .filter(m => m.materialId === materialId)
      .reduce((sum, m) => {
        if (m.tipo === "entrada") return sum + m.quantidade;
        if (m.tipo === "saida") return sum - m.quantidade;
        return sum + m.quantidade;
      }, 0);
  }, [movimentacoes]);

  const getSaldoPorLocal = useCallback((materialId: string, local: string): number => {
    return movimentacoes
      .filter(m => m.materialId === materialId && m.local === local)
      .reduce((sum, m) => {
        if (m.tipo === "entrada") return sum + m.quantidade;
        if (m.tipo === "saida") return sum - m.quantidade;
        return sum + m.quantidade;
      }, 0);
  }, [movimentacoes]);

  const criarInventario = async (data: Omit<Inventario, "id" | "dataInventario" | "status">) => {
    await insertRow("estoque_inventarios", {
      data_inventario: new Date().toISOString(), local: data.local,
      status: "Aberto", itens: data.itens as any, usuario: data.usuario,
      observacao: data.observacao,
    });
    invInv();
  };

  const atualizarInventario = async (id: string, itens: ItemInventario[], observacao: string) => {
    await updateRow("estoque_inventarios", id, { itens: itens as any, observacao });
    invInv();
  };

  const fecharInventario = async (id: string, usuario: string) => {
    const inv = inventarios.find(i => i.id === id);
    if (!inv) return;
    for (const item of inv.itens) {
      const diferenca = item.quantidadeContada - item.saldoSistema;
      if (diferenca !== 0) {
        await insertRow("estoque_movimentacoes", {
          material_id: item.materialId, material_codigo: item.materialCodigo,
          material_descricao: item.materialDescricao, tipo: "ajuste",
          quantidade: diferenca, local: inv.local,
          documento_ref: `Inventário ${inv.dataInventario}`,
          observacao: item.observacao || "Ajuste de inventário",
          usuario, data_movimentacao: new Date().toISOString(),
        });
      }
    }
    await updateRow("estoque_inventarios", id, { status: "Fechado" });
    invMov(); invInv();
  };

  const transferirEntreLocais = async (data: { materialId: string; materialCodigo: string; materialDescricao: string; quantidade: number; localOrigem: string; localDestino: string; usuario: string; observacao?: string }) => {
    const { materialId, materialCodigo, materialDescricao, quantidade, localOrigem, localDestino, usuario, observacao } = data;
    if (!materialId || !localOrigem || !localDestino || quantidade <= 0) return;
    if (localOrigem === localDestino) throw new Error("Local de origem e destino devem ser diferentes");
    const saldoOrigem = getSaldoPorLocal(materialId, localOrigem);
    if (quantidade > saldoOrigem) throw new Error(`Saldo insuficiente em ${localOrigem}. Disponível: ${saldoOrigem}`);

    const lotes = getLotesFIFO(materialId, localOrigem);
    const dataMov = new Date().toISOString();
    const docRef = `Transferência ${localOrigem} → ${localDestino}`;
    let restante = quantidade;

    const valorTotalConsumido = (() => {
      let v = 0; let q = quantidade;
      for (const l of lotes) { if (q <= 0) break; const u = Math.min(q, l.quantidade); v += u * l.valorUnitario; q -= u; }
      return v;
    })();
    const valorMedio = quantidade > 0 ? valorTotalConsumido / quantidade : 0;

    await insertRow("estoque_movimentacoes", {
      material_id: materialId, material_codigo: materialCodigo, material_descricao: materialDescricao,
      tipo: "saida", quantidade, local: localOrigem,
      documento_ref: docRef, observacao: observacao || "Transferência entre locais",
      usuario, data_movimentacao: dataMov, valor_unitario: valorMedio,
    });

    for (const lote of lotes) {
      if (restante <= 0) break;
      const usar = Math.min(restante, lote.quantidade);
      await insertRow("estoque_movimentacoes", {
        material_id: materialId, material_codigo: materialCodigo, material_descricao: materialDescricao,
        tipo: "entrada", quantidade: usar, local: localDestino,
        documento_ref: docRef, observacao: observacao || "Transferência entre locais",
        usuario, data_movimentacao: dataMov, valor_unitario: lote.valorUnitario,
      });
      restante -= usar;
    }
    invMov();
  };

  const atualizarValorMovimentacao = async (id: string, valorUnitario: number) => {
    await updateRow("estoque_movimentacoes", id, { valor_unitario: valorUnitario });
    invMov();
  };

  return (
    <EstoqueContext.Provider value={{
      movimentacoes, inventarios, registrarMovimentacao, registrarEntradaRecebimento,
      getSaldos, getSaldoPorMaterial, getSaldoPorLocal, getLotesFIFO, transferirEntreLocais, criarInventario, atualizarInventario, fecharInventario, atualizarValorMovimentacao, reload,
    }}>
      {children}
    </EstoqueContext.Provider>
  );
}

export function useEstoque(activate: boolean = true) {
  useActivateProvider("Estoque", activate);
  const ctx = useContext(EstoqueContext);
  if (!ctx) throw new Error("useEstoque must be used within EstoqueProvider");
  return ctx;
}
