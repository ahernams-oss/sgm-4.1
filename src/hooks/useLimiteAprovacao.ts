import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Hook que valida se o usuário logado pode aprovar um valor financeiro,
 * de acordo com seus limites cadastrados em Usuários.
 *
 * Tipos:
 *  - "compras": cotações de compras
 *  - "os": Ordens de Serviço e Solicitações de Serviço
 *
 * Retorna true se permitido. Retorna false e dispara um toast se bloqueado.
 * Limite = 0 significa SEM permissão de aprovação.
 */
export function useLimiteAprovacao() {
  const { usuarioLogado } = useAuth();

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const podeAprovar = (valor: number, tipo: "compras" | "os"): boolean => {
    if (!usuarioLogado) {
      toast.error("Aprovação bloqueada: usuário não identificado. Faça login novamente.");
      return false;
    }
    const limite =
      tipo === "compras"
        ? usuarioLogado.limiteAprovacaoCompras ?? 0
        : usuarioLogado.limiteAprovacaoOS ?? 0;

    if (limite <= 0) {
      toast.error(
        `Você não possui permissão para aprovar ${
          tipo === "compras" ? "compras" : "Ordens/Solicitações de Serviço"
        }. Solicite ao administrador um limite de aprovação.`
      );
      return false;
    }

    if (valor > limite) {
      toast.error(
        `Aprovação bloqueada: valor ${formatBRL(valor)} excede seu limite de ${formatBRL(limite)}.`
      );
      return false;
    }
    return true;
  };

  return { podeAprovar };
}
