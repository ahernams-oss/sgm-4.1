import { useAuth } from "@/contexts/AuthContext";
import { usePerfisAcesso } from "@/contexts/PerfisAcessoContext";
import { useCargos } from "@/contexts/CargosContext";
import { cargoTemAcessoTotal, temPermissao, temPermissaoNoModulo } from "@/lib/permissoes";

export function usePermissao() {
  const { usuarioLogado } = useAuth();
  const { perfis } = usePerfisAcesso();
  const { cargos } = useCargos();

  const cargo = cargos.find(c => c.id === usuarioLogado?.cargoId);
  const cargoNome = (cargo?.nome || "").trim().toLowerCase();
  const acessoTotal = cargo ? cargoTemAcessoTotal(cargo.nome) : false;
  const isDiretor = cargoNome === "diretor";

  const perfil = perfis.find(p => p.id === usuarioLogado?.perfilAcessoId);

  const tem = (key: string): boolean => {
    if (!usuarioLogado) return false;
    return temPermissao(acessoTotal, perfil?.permissoes, key);
  };

  /**
   * Retorna true se o usuário tem QUALQUER permissão do módulo
   * (chave exata ou qualquer subchave começando com `${prefix}.`).
   * Usado para decidir se um item de menu deve aparecer.
   */
  const temModulo = (prefix: string): boolean => {
    if (!usuarioLogado) return false;
    return temPermissaoNoModulo(acessoTotal, perfil?.permissoes, prefix);
  };

  return { tem, temModulo, acessoTotal, isDiretor, perfil, usuarioLogado };
}
