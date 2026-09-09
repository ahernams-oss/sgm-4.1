import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Equipamento {
  id: string;
  /** Código sequencial gerado automaticamente pelo sistema (LST-00001). */
  codLasant: string;
  clienteId: string; clienteNome: string;

  localId: string; localDescricao: string;
  pavimentoId: string; pavimentoDescricao: string;
  setorId: string; setorDescricao: string;
  situacao: string; tag: string; equipamento: string; serie: string;
  grupo: string; subgrupo: string; modelo: string;
  valor: number; fabricante: string; dataAquisicao: string;
  nivelRisco: string; nivelManutencao: string;
  expectativaVida: string; dataGarantia: string;
  tensao: string; corrente: string; potencia: string; capacidadeBtu: string;
  contrato: string; planoManutencao: string; numeroAnvisa: string;
  fotoUrl: string; manualUrl: string; fotos: string[];
  requerCalibracao: boolean;
  dataCalibracao: string; validadeCalibracao: string;
  frequenciaCalibracaoMeses: number;
  certificadoCalibracaoUrl: string; laboratorioCalibracao: string;
  numeroCertificadoCalibracao: string; observacoesCalibracao: string;
  responsavelCalibracao: string; telefoneResponsavelCalibracao: string;
  emailResponsavelCalibracao: string;
}

export type EquipamentoInput = Omit<Equipamento, "id" | "codLasant">;

interface EquipamentosContextType {
  equipamentos: Equipamento[];
  addEquipamento: (e: EquipamentoInput) => void;
  updateEquipamento: (id: string, e: Partial<EquipamentoInput>) => void;
  deleteEquipamento: (id: string) => void;
}

const EquipamentosContext = createContext<EquipamentosContextType | undefined>(undefined);
const QK = ["equipamentos"] as const;

const rowToEquipamento = (r: any): Equipamento => ({
  id: r.id,
  codLasant: r.cod_lasant ?? "",
  clienteId: r.cliente_id ?? "", clienteNome: r.cliente_nome ?? "",

  localId: r.local_id ?? "", localDescricao: r.local_descricao ?? "",
  pavimentoId: r.pavimento_id ?? "", pavimentoDescricao: r.pavimento_descricao ?? "",
  setorId: r.setor_id ?? "", setorDescricao: r.setor_descricao ?? "",
  situacao: r.situacao ?? "Ativo",
  tag: r.tag ?? "", equipamento: r.equipamento ?? "", serie: r.serie ?? "",
  grupo: r.grupo ?? "", subgrupo: r.subgrupo ?? "", modelo: r.modelo ?? "",
  valor: Number(r.valor) || 0, fabricante: r.fabricante ?? "",
  dataAquisicao: r.data_aquisicao ?? "",
  nivelRisco: r.nivel_risco ?? "", nivelManutencao: r.nivel_manutencao ?? "",
  expectativaVida: r.expectativa_vida ?? "", dataGarantia: r.data_garantia ?? "",
  tensao: r.tensao ?? "", corrente: r.corrente ?? "",
  potencia: r.potencia ?? "", capacidadeBtu: r.capacidade_btu ?? "",
  contrato: r.contrato ?? "", planoManutencao: r.plano_manutencao ?? "",
  numeroAnvisa: r.numero_anvisa ?? "",
  fotoUrl: r.foto_url ?? "", manualUrl: r.manual_url ?? "",
  fotos: Array.isArray(r.fotos) ? r.fotos : (r.fotos ? (() => { try { return JSON.parse(r.fotos); } catch { return []; } })() : []),
  requerCalibracao: !!r.requer_calibracao,
  dataCalibracao: r.data_calibracao ?? "", validadeCalibracao: r.validade_calibracao ?? "",
  frequenciaCalibracaoMeses: Number(r.frequencia_calibracao_meses) || 12,
  certificadoCalibracaoUrl: r.certificado_calibracao_url ?? "",
  laboratorioCalibracao: r.laboratorio_calibracao ?? "",
  numeroCertificadoCalibracao: r.numero_certificado_calibracao ?? "",
  observacoesCalibracao: r.observacoes_calibracao ?? "",
  responsavelCalibracao: r.responsavel_calibracao ?? "",
  telefoneResponsavelCalibracao: r.telefone_responsavel_calibracao ?? "",
  emailResponsavelCalibracao: r.email_responsavel_calibracao ?? "",
});

const equipamentoToRow = (e: Partial<EquipamentoInput>) => ({
  cliente_id: e.clienteId, cliente_nome: e.clienteNome,
  local_id: e.localId, local_descricao: e.localDescricao,
  pavimento_id: e.pavimentoId, pavimento_descricao: e.pavimentoDescricao,
  setor_id: e.setorId, setor_descricao: e.setorDescricao,
  situacao: e.situacao, tag: e.tag, equipamento: e.equipamento, serie: e.serie,
  grupo: e.grupo, subgrupo: e.subgrupo, modelo: e.modelo,
  valor: e.valor, fabricante: e.fabricante, data_aquisicao: e.dataAquisicao,
  nivel_risco: e.nivelRisco, nivel_manutencao: e.nivelManutencao,
  expectativa_vida: e.expectativaVida, data_garantia: e.dataGarantia,
  tensao: e.tensao, corrente: e.corrente, potencia: e.potencia, capacidade_btu: e.capacidadeBtu,
  contrato: e.contrato, plano_manutencao: e.planoManutencao, numero_anvisa: e.numeroAnvisa,
  foto_url: e.fotoUrl, manual_url: e.manualUrl,
  fotos: e.fotos ?? [],
  requer_calibracao: e.requerCalibracao,
  data_calibracao: e.dataCalibracao || null,
  validade_calibracao: e.validadeCalibracao || null,
  frequencia_calibracao_meses: e.frequenciaCalibracaoMeses,
  certificado_calibracao_url: e.certificadoCalibracaoUrl,
  laboratorio_calibracao: e.laboratorioCalibracao,
  numero_certificado_calibracao: e.numeroCertificadoCalibracao,
  observacoes_calibracao: e.observacoesCalibracao,
  responsavel_calibracao: e.responsavelCalibracao,
  telefone_responsavel_calibracao: e.telefoneResponsavelCalibracao,
  email_responsavel_calibracao: e.emailResponsavelCalibracao,
});

export function EquipamentosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Equipamentos");
  const qc = useQueryClient();
  const { data: equipamentos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("equipamentos")).map(rowToEquipamento),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addEquipamento = async (e: EquipamentoInput) => {
    await insertRow("equipamentos", equipamentoToRow(e));
    invalidate();
  };

  const updateEquipamento = async (id: string, e: Partial<EquipamentoInput>) => {
    await updateRow("equipamentos", id, equipamentoToRow(e));
    invalidate();
  };

  const deleteEquipamento = async (id: string) => {
    await deleteRow("equipamentos", id);
    invalidate();
  };

  return (
    <EquipamentosContext.Provider value={{ equipamentos, addEquipamento, updateEquipamento, deleteEquipamento }}>
      {children}
    </EquipamentosContext.Provider>
  );
}

export function useEquipamentos() {
  useActivateProvider("Equipamentos");
  const ctx = useContext(EquipamentosContext);
  if (!ctx) throw new Error("useEquipamentos must be used within EquipamentosProvider");
  return ctx;
}
