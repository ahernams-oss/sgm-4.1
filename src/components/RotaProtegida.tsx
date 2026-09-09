import { ReactNode } from "react";
import { Navigate, useLocation } from "@/lib/router-compat";
import { ShieldAlert } from "lucide-react";
import { usePermissao } from "@/hooks/usePermissao";
import { ACCESS_ROUTES } from "@/lib/accessRoutes";

interface RotaProtegidaProps {
  /** Chave do módulo em MODULOS_SISTEMA (ex.: "ordem_servico"). Se vazia, libera acesso. */
  perm?: string;
  /** Se true, exige cargo com acesso total (Diretor / Gerente Executivo / Coordenador). */
  requireAcessoTotal?: boolean;
  children: ReactNode;
}

/**
 * Protege uma rota verificando a permissão do módulo no perfil de acesso do usuário.
 * Cargos com acesso total (Diretor, Gerente Executivo, Coordenador) sempre passam,
 * exceto o módulo de Auditoria que é restrito apenas a Diretores.
 * Quando o acesso é negado, redireciona para a primeira página permitida do usuário.
 */
export function RotaProtegida({ perm, requireAcessoTotal, children }: RotaProtegidaProps) {
  const { temModulo, acessoTotal, isDiretor, usuarioLogado, perfil } = usePermissao();
  const location = useLocation();

  if (!usuarioLogado) return <>{children}</>;

  // Restrição por privilégio qualificado (Diretor / Gerente Executivo / Coordenador)
  if (requireAcessoTotal && !acessoTotal) {
    // cai no bloco de acesso negado abaixo
  } else if (!perm) {
    return <>{children}</>;
  } else if (perm === "auditoria") {
    if (isDiretor || temModulo(perm)) return <>{children}</>;
  } else if (acessoTotal || temModulo(perm)) {
    return <>{children}</>;
  }

  // Aguarda perfis carregarem para evitar redirects prematuros
  if (!perfil) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Busca a primeira rota acessível e redireciona
  const firstAccessible = ACCESS_ROUTES.find((r) => temModulo(r.perm));
  if (firstAccessible && firstAccessible.url !== location.pathname) {
    return <Navigate to={firstAccessible.url} replace />;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          Você não possui permissão para acessar esta página. Entre em contato com o administrador
          se acredita que deveria ter acesso.
        </p>
      </div>
    </div>
  );
}

export default RotaProtegida;
