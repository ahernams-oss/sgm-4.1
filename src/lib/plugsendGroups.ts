import { supabase } from "@/integrations/supabase/client";

export interface GrupoWhatsApp {
  JID?: string;
  jid?: string;
  name?: string;
  subject?: string;
  owner?: string;
  participants?: Array<{ JID?: string; jid?: string; isAdmin?: boolean; isSuperAdmin?: boolean }>;
  size?: number;
  desc?: string;
  [k: string]: any;
}

async function invoke(body: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string; details?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke("plugsend-groups", { body });
    if (error) {
      // supabase-js wraps non-2xx as generic error; try to read context
      // @ts-ignore
      const ctx = (error as any).context;
      let details: any = error.message;
      try { if (ctx?.text) details = await ctx.text(); } catch { /* noop */ }
      return { success: false, error: error.message, details };
    }
    return data;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export const plugsendGroups = {
  create: (name: string, participants: string[]) =>
    invoke({ action: "create", name, participants }),
  list: (opts?: { force?: boolean; noparticipants?: boolean }) =>
    invoke({ action: "list", ...opts }),
  info: (groupjid: string, opts?: { getInviteLink?: boolean; force?: boolean }) =>
    invoke({ action: "info", groupjid, ...opts }),
  addParticipants: (groupjid: string, participants: string[]) =>
    invoke({ action: "addParticipants", groupjid, participants }),
  removeParticipants: (groupjid: string, participants: string[]) =>
    invoke({ action: "removeParticipants", groupjid, participants }),
  updateName: (groupjid: string, name: string) =>
    invoke({ action: "updateName", groupjid, name }),
  leave: (groupjid: string) => invoke({ action: "leave", groupjid }),
};

/** Extrai o JID @g.us de um objeto de grupo, independente de casing */
export function extractJID(g: GrupoWhatsApp): string {
  return g?.JID || g?.jid || (g as any)?.id || "";
}

/** Extrai o nome de exibição */
export function extractName(g: GrupoWhatsApp): string {
  return g?.name || g?.subject || (g as any)?.Name || "";
}
