import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "portalToken";
const USER_KEY = "portalUser";
export const PORTAL_SESSION_EXPIRED_EVENT = "portal-session-expired";
const SESSION_EXPIRED_MESSAGE = "Sessão expirada. Faça login novamente.";

export interface PortalUser {
  tipo: "funcionario" | "candidato";
  nome: string;
  cpf: string;
}

const PUBLIC_ACTIONS = ["login", "signup", "reset-request"];
const isAdminAction = (a: string) => a.startsWith("admin-");

const isBrowser = () => typeof window !== "undefined";

const decodeTokenPayload = (token: string | null): { exp?: number } | null => {
  if (!token) return null;
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload || !isBrowser()) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

const isPortalTokenExpired = (token: string | null) => {
  const payload = decodeTokenPayload(token);
  if (typeof payload?.exp !== "number") return true;
  return payload.exp <= Math.floor(Date.now() / 1000) + 30;
};

const expirePortalSession = () => {
  portalStore.clear();
  if (!isBrowser()) return;

  window.dispatchEvent(new CustomEvent(PORTAL_SESSION_EXPIRED_EVENT, { detail: { message: SESSION_EXPIRED_MESSAGE } }));
  if (window.location.pathname !== "/portal") {
    window.location.replace("/portal");
  }
};

export const portalStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: (): PortalUser | null => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || isPortalTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PortalUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  },
  set: (token: string, user: PortalUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function readFunctionError(error: unknown, data: unknown) {
  let bodyErr: string | undefined = (data as { error?: string } | null)?.error;
  let status: number | undefined = (error as any)?.status ?? (error as any)?.context?.status ?? (error as any)?.context?.response?.status;

  if (error && !bodyErr) {
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.clone === "function") {
        const cloned = ctx.clone();
        status = status ?? cloned.status;
        const parsed = await cloned.json().catch(() => null);
        bodyErr = parsed?.error;
      } else if (ctx && typeof ctx.json === "function") {
        const parsed = await ctx.json();
        bodyErr = parsed?.error;
      } else if (ctx && typeof ctx.text === "function") {
        const txt = await ctx.text();
        try {
          bodyErr = JSON.parse(txt)?.error;
        } catch {
          bodyErr = txt;
        }
      }
    } catch {
      // mantém a mensagem padrão do supabase-js
    }
  }

  return { bodyErr, status, message: bodyErr || (error as Error | null)?.message };
}

export async function portalCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = portalStore.getToken();
  const isPublicAction = PUBLIC_ACTIONS.includes(action) || isAdminAction(action);

  if (!isPublicAction && isPortalTokenExpired(token)) {
    expirePortalSession();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const { data, error } = await supabase.functions.invoke("portal-api", {
    body: { action, ...payload },
    headers: token ? { "x-portal-token": token } : undefined,
  });

  const { bodyErr, status, message } = await readFunctionError(error, data);

  const isSessionInvalid =
    !isPublicAction &&
    (status === 401 ||
      (typeof bodyErr === "string" && /sess[ãa]o inv[áa]lida|expirada/i.test(bodyErr)) ||
      (typeof message === "string" && /sess[ãa]o inv[áa]lida|expirada|non-2xx|401/i.test(message)));

  if (isSessionInvalid) {
    expirePortalSession();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (error) throw new Error(message || "Erro ao processar requisição.");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
