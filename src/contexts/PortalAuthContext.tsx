import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { PORTAL_SESSION_EXPIRED_EVENT, portalCall, portalStore, PortalUser } from "@/lib/portalClient";

interface Ctx {
  user: PortalUser | null;
  login: (cpf: string, senha: string) => Promise<void>;
  signup: (cpf: string, dataNasc: string, senha: string) => Promise<void>;
  reset: (cpf: string, dataNasc: string, novaSenha: string) => Promise<void>;
  logout: () => void;
}

const PortalAuthCtx = createContext<Ctx | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(() => portalStore.getUser());

  useEffect(() => {
    const syncUser = () => setUser(portalStore.getUser());
    const handleExpired = () => {
      portalStore.clear();
      setUser(null);
    };

    window.addEventListener(PORTAL_SESSION_EXPIRED_EVENT, handleExpired);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener(PORTAL_SESSION_EXPIRED_EVENT, handleExpired);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const login = useCallback(async (cpf: string, senha: string) => {
    const r = await portalCall<{ token: string; tipo: PortalUser["tipo"]; nome: string }>("login", { cpf, senha });
    const u: PortalUser = { tipo: r.tipo, nome: r.nome, cpf: cpf.replace(/\D/g, "") };
    portalStore.set(r.token, u);
    setUser(u);
  }, []);

  const signup = useCallback(async (cpf: string, dataNascimento: string, senha: string) => {
    const r = await portalCall<{ token: string; tipo: PortalUser["tipo"]; nome: string }>("signup", { cpf, dataNascimento, senha });
    const u: PortalUser = { tipo: r.tipo, nome: r.nome, cpf: cpf.replace(/\D/g, "") };
    portalStore.set(r.token, u);
    setUser(u);
  }, []);

  const reset = useCallback(async (cpf: string, dataNascimento: string, novaSenha: string) => {
    await portalCall("reset-request", { cpf, dataNascimento, novaSenha });
  }, []);

  const logout = useCallback(() => {
    portalStore.clear();
    setUser(null);
  }, []);

  return <PortalAuthCtx.Provider value={{ user, login, signup, reset, logout }}>{children}</PortalAuthCtx.Provider>;
}

export function usePortalAuth() {
  const c = useContext(PortalAuthCtx);
  if (!c) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return c;
}
