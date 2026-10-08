import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useUsuarios, Usuario } from "./UsuariosContext";
import { useCargos } from "./CargosContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cargoTemAcessoTotal } from "@/lib/permissoes";

const STORAGE_KEY = "usuarioLogado";

interface AuthContextType {
  usuarioLogado: Usuario | null;
  login: (email: string, senha: string, lembrar?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  temAcessoTotal: boolean;
  clientesPermitidosIds: string[];
  resetSenha: (email: string) => Promise<{ ok: boolean; message: string }>;
}

// Guardado no globalThis para que recarregamentos do módulo (atualização ao vivo)
// não criem um segundo contexto e deixem a tela de login "desconectada".
const g = globalThis as unknown as { __sgmAuthContext?: React.Context<AuthContextType | undefined> };
const AuthContext = (g.__sgmAuthContext ??= createContext<AuthContextType | undefined>(undefined));

const readStored = (): Usuario | null => {
  const persisted = localStorage.getItem(STORAGE_KEY);
  if (persisted) return JSON.parse(persisted);
  const session = sessionStorage.getItem(STORAGE_KEY);
  return session ? JSON.parse(session) : null;
};

const writeStored = (user: Usuario | null, lembrar: boolean) => {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!user) return;
  const target = lembrar ? localStorage : sessionStorage;
  target.setItem(STORAGE_KEY, JSON.stringify(user));
};

const gerarSenhaTemporaria = (): string => {
  // 10 caracteres com classes garantidas (atende política)
  const upp = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const low = "abcdefghjkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*?";
  const all = upp + low + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let out = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 6; i++) out += pick(all);
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

/** Última mensagem de erro de login retornada pelo servidor (ex.: bloqueio por tentativas). */
export let lastLoginError = "";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { usuarios } = useUsuarios();
  const { cargos } = useCargos();
  const queryClient = useQueryClient();

  // Dados lidos antes do login (sem sessão) vêm vazios por causa das regras de acesso;
  // ao entrar/sair, recarrega tudo para o menu e as telas aparecerem sem F5.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setTimeout(() => { queryClient.invalidateQueries(); }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(() => readStored());
  const [lembrar, setLembrar] = useState<boolean>(() => !!localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    writeStored(usuarioLogado, lembrar);
  }, [usuarioLogado, lembrar]);

  // Sessões antigas (sem autenticação no backend) precisam refazer o login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && !data.session && readStored()) {
        setUsuarioLogado(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  // Keep logged user in sync with usuarios list
  useEffect(() => {
    if (usuarioLogado) {
      const atualizado = usuarios.find((u) => u.id === usuarioLogado.id);
      if (atualizado) {
        setUsuarioLogado(atualizado);
      }
    }
  }, [usuarios]);

  const temAcessoTotal = useMemo(() => {
    if (!usuarioLogado) return false;
    const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);
    return cargo ? cargoTemAcessoTotal(cargo.nome) : false;
  }, [usuarioLogado, cargos]);

  const clientesPermitidosIds = useMemo(() => {
    if (!usuarioLogado) return [];
    return usuarioLogado.clientesPermitidos;
  }, [usuarioLogado]);

  const login = async (email: string, senha: string, lembrarMe = false): Promise<boolean> => {
    lastLoginError = "";
    const emailNorm = email.trim().toLowerCase();
    const senhaNorm = senha.trim();

    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { email: emailNorm, senha: senhaNorm },
      });

      if (error || !data?.usuario) {
        console.warn("[Login] Falha ao autenticar:", error?.message);
        let msg: string | undefined = data?.error;
        try {
          const ctx: any = (error as any)?.context;
          if (!msg && ctx?.clone) msg = (await ctx.clone().json().catch(() => null))?.error;
        } catch { /* mantém padrão */ }
        lastLoginError = msg || "";
        return false;
      }

      // Mapeia resposta da função (snake_case) para o objeto Usuario (camelCase)
      const r = data.usuario;
      const usuario: Usuario = {
        id: r.id,
        nome: r.nome ?? "",
        cargoId: r.cargo_id ?? "",
        telefone: r.telefone ?? "",
        email: r.email ?? "",
        senha: "", // nunca persistir senha no client
        clientesPermitidos: r.clientes_permitidos ?? [],
        perfilAcessoId: r.perfil_acesso_id ?? "",
        matricula: r.matricula ?? "",
        ramal: r.ramal ?? "",
        limiteAprovacaoCompras: Number(r.limite_aprovacao_compras ?? 0),
        limiteAprovacaoOS: Number(r.limite_aprovacao_os ?? 0),
      };

      // Estabelece a sessão autenticada no backend (necessária para as regras de acesso)
      if (data?.tokenHash && data?.email) {
        const { error: sessErr } = await supabase.auth.verifyOtp({
          type: "email",
          token_hash: data.tokenHash as string,
        });
        if (sessErr) console.warn("[Login] Sessão não estabelecida:", sessErr.message);
      }

      await queryClient.invalidateQueries();
      setLembrar(lembrarMe);
      setUsuarioLogado(usuario);
      return true;
    } catch (e) {
      console.error("[Login] Erro inesperado:", e);
      return false;
    }
  };

  const logout = () => {
    supabase.auth.signOut().catch(() => undefined);
    setUsuarioLogado(null);
  };


  const resetSenha = async (email: string): Promise<{ ok: boolean; message: string }> => {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) return { ok: false, message: "Informe um e-mail válido." };

    const user = usuarios.find((u) => u.email.toLowerCase() === emailNormalizado);
    if (!user) {
      // Resposta neutra para evitar enumeração de e-mails
      return { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos uma senha temporária." };
    }

    const novaSenha = gerarSenhaTemporaria();

    // Grava senha hasheada via Edge Function
    const { error: setError } = await supabase.functions.invoke("auth-set-password", {
      body: { userId: user.id, novaSenha, skipPolicy: false },
    });

    if (setError) {
      return { ok: false, message: "Erro ao gerar nova senha. Tente novamente." };
    }

    // Envia por e-mail
    try {
      const { error } = await supabase.functions.invoke("send-email-senha-temporaria", {
        body: {
          recipientEmail: user.email,
          idempotencyKey: `pwd-reset-${user.id}-${Date.now()}`,
          templateData: {
            nomeUsuario: user.nome,
            senhaTemporaria: novaSenha,
            nomeEmpresa: "LASANT CONSTRUÇÕES",
          },
        },
      });
      if (error) throw error;
    } catch {
      return {
        ok: false,
        message: "Senha redefinida, mas houve falha no envio do e-mail. Contate o administrador.",
      };
    }

    return { ok: true, message: "Senha temporária enviada para o seu e-mail." };
  };

  return (
    <AuthContext.Provider
      value={{
        usuarioLogado,
        login,
        logout,
        isAuthenticated: !!usuarioLogado,
        temAcessoTotal,
        clientesPermitidosIds,
        resetSenha,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Fallback inerte usado apenas em situações transitórias (HMR, recuperação
// de erro concorrente do React). Evita tela branca lançando exceção fora do
// provider; o AuthProvider real é montado em App.tsx.
const AUTH_FALLBACK: AuthContextType = {
  usuarioLogado: null,
  login: async () => {
    lastLoginError = "Sistema ainda carregando. Recarregue a página (F5) e tente novamente.";
    return false;
  },
  logout: () => {},
  isAuthenticated: false,
  temAcessoTotal: false,
  clientesPermitidosIds: [],
  resetSenha: async () => ({ ok: false, message: "Auth indisponível." }),
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof console !== "undefined") {
      console.warn("[useAuth] Contexto indisponível — usando fallback.");
    }
    return AUTH_FALLBACK;
  }
  return ctx;
}
