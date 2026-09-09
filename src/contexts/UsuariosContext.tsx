import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Usuario {
  id: string; nome: string; cargoId: string; telefone: string;
  email: string; senha: string; clientesPermitidos: string[];
  perfilAcessoId: string; matricula: string; ramal: string;
  limiteAprovacaoCompras: number; limiteAprovacaoOS: number;
  senhaStatus?: "sem_senha" | "legado" | "seguro";
}

interface UsuariosContextType {
  usuarios: Usuario[]; addUsuario: (u: Omit<Usuario, "id">) => void;
  updateUsuario: (id: string, u: Omit<Usuario, "id">) => void;
  deleteUsuario: (id: string) => void;
}

const UsuariosContext = createContext<UsuariosContextType | undefined>(undefined);
const QK = ["usuarios"] as const;

const rowToUsuario = (r: any): Usuario => ({
  id: r.id, nome: r.nome ?? "", cargoId: r.cargo_id ?? "",
  telefone: r.telefone ?? "", email: r.email ?? "", senha: "",
  clientesPermitidos: r.clientes_permitidos ?? [],
  perfilAcessoId: r.perfil_acesso_id ?? "",
  matricula: r.matricula ?? "", ramal: r.ramal ?? "",
  limiteAprovacaoCompras: Number(r.limite_aprovacao_compras ?? 0),
  limiteAprovacaoOS: Number(r.limite_aprovacao_os ?? 0),
  senhaStatus: (r.senha_status ?? "sem_senha") as Usuario["senhaStatus"],
});

const usuarioToRow = (u: Omit<Usuario, "id">) => ({
  nome: u.nome, cargo_id: u.cargoId, telefone: u.telefone,
  email: u.email, clientes_permitidos: u.clientesPermitidos as any,
  perfil_acesso_id: u.perfilAcessoId, matricula: u.matricula, ramal: u.ramal,
  limite_aprovacao_compras: u.limiteAprovacaoCompras ?? 0,
  limite_aprovacao_os: u.limiteAprovacaoOS ?? 0,
});

export function UsuariosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Usuarios");
  const qc = useQueryClient();
  const { data: usuarios = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("usuarios", "nome")).map(rowToUsuario),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addUsuario = async (u: Omit<Usuario, "id">) => { await insertRow("usuarios", usuarioToRow(u)); invalidate(); };
  const updateUsuario = async (id: string, data: Omit<Usuario, "id">) => { await updateRow("usuarios", id, usuarioToRow(data)); invalidate(); };
  const deleteUsuario = async (id: string) => { await deleteRow("usuarios", id); invalidate(); };

  return (
    <UsuariosContext.Provider value={{ usuarios, addUsuario, updateUsuario, deleteUsuario }}>
      {children}
    </UsuariosContext.Provider>
  );
}

export function useUsuarios() {
  useActivateProvider("Usuarios");
  const ctx = useContext(UsuariosContext);
  if (!ctx) throw new Error("useUsuarios must be used within UsuariosProvider");
  return ctx;
}
