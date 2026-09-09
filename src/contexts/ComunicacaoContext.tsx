import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export interface Conversa {
  id: string;
  tipo: "direta" | "grupo";
  titulo: string;
  criadoPor: string;
  createdAt: string;
  participantes: Participante[];
  ultimaMensagem?: Mensagem;
}

export interface Participante {
  id: string;
  conversaId: string;
  usuarioNome: string;
  usuarioEmail: string;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  remetenteNome: string;
  remetenteEmail: string;
  conteudo: string;
  createdAt: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  prioridade: string;
  criadoPor: string;
  ativo: boolean;
  createdAt: string;
  leituras: AvisoLeitura[];
  destinatariosEmails: string[];
  gruposIds: string[];
}

export interface AvisoLeitura {
  id: string;
  avisoId: string;
  usuarioNome: string;
  usuarioEmail: string;
  lidoEm: string;
}

export interface Grupo {
  id: string;
  nome: string;
  descricao: string;
  membrosEmails: string[];
  criadoPor: string;
  createdAt: string;
}

export interface Notificacao {
  id: string;
  destinatarioNome: string;
  destinatarioEmail: string;
  titulo: string;
  descricao: string;
  tipo: string;
  lida: boolean;
  criadoPor: string;
  createdAt: string;
}

interface ComunicacaoContextType {
  conversas: Conversa[];
  mensagens: Mensagem[];
  avisos: Aviso[];
  notificacoes: Notificacao[];
  grupos: Grupo[];
  loadMensagens: (conversaId: string) => Promise<void>;
  addConversa: (data: any) => Promise<any>;
  addParticipante: (data: any) => Promise<void>;
  addMensagem: (data: any) => Promise<void>;
  addAviso: (data: any) => Promise<void>;
  updateAviso: (id: string, data: any) => Promise<void>;
  deleteAviso: (id: string) => Promise<void>;
  confirmarLeitura: (data: any) => Promise<void>;
  addNotificacao: (data: any) => Promise<void>;
  marcarNotificacaoLida: (id: string) => Promise<void>;
  deleteNotificacao: (id: string) => Promise<void>;
  deleteConversa: (id: string) => Promise<void>;
  loadConversas: () => Promise<void>;
  loadAvisos: () => Promise<void>;
  loadNotificacoes: () => Promise<void>;
  loadGrupos: () => Promise<void>;
  addGrupo: (data: { nome: string; descricao?: string; membros_emails: string[]; criado_por: string }) => Promise<void>;
  updateGrupo: (id: string, data: { nome?: string; descricao?: string; membros_emails?: string[] }) => Promise<void>;
  deleteGrupo: (id: string) => Promise<void>;
}

const ComunicacaoContext = createContext<ComunicacaoContextType | undefined>(undefined);

const QK_GRUPOS = ["comunicacao_grupos"] as const;
const QK_CONV = ["comunicacao_conversas"] as const;
const QK_AVISOS = ["comunicacao_avisos"] as const;
const QK_NOTIF = ["comunicacao_notificacoes"] as const;

const mapGrupo = (g: any): Grupo => ({
  id: g.id,
  nome: g.nome ?? "",
  descricao: g.descricao ?? "",
  membrosEmails: Array.isArray(g.membros_emails) ? g.membros_emails : [],
  criadoPor: g.criado_por ?? "",
  createdAt: g.created_at ?? "",
});

const mapNotif = (n: any): Notificacao => ({
  id: n.id,
  destinatarioNome: n.destinatario_nome ?? "",
  destinatarioEmail: n.destinatario_email ?? "",
  titulo: n.titulo ?? "",
  descricao: n.descricao ?? "",
  tipo: n.tipo ?? "tarefa",
  lida: n.lida ?? false,
  criadoPor: n.criado_por ?? "",
  createdAt: n.created_at ?? "",
});

export function ComunicacaoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Comunicacao");
  const qc = useQueryClient();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const opts = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 };

  const { data: grupos = [] } = useQuery({
    enabled: __active,
    queryKey: QK_GRUPOS,
    queryFn: async () => (await fetchAll("comunicacao_grupos", "created_at")).reverse().map(mapGrupo),
    ...opts,
  });

  const convQueries = useQueries({
    queries: gateQueries([
      { queryKey: [...QK_CONV, "raw"], queryFn: () => fetchAll("comunicacao_conversas", "created_at"), ...opts },
      { queryKey: ["comunicacao_participantes"], queryFn: () => fetchAll("comunicacao_participantes", "created_at"), ...opts },
    ], __active),
  });
  const convData = (convQueries[0].data as any[]) ?? [];
  const partData = (convQueries[1].data as any[]) ?? [];
  const conversas: Conversa[] = convData.map((c: any) => ({
    id: c.id,
    tipo: c.tipo ?? "direta",
    titulo: c.titulo ?? "",
    criadoPor: c.criado_por ?? "",
    createdAt: c.created_at ?? "",
    participantes: partData.filter((p: any) => p.conversa_id === c.id).map((p: any) => ({
      id: p.id, conversaId: p.conversa_id,
      usuarioNome: p.usuario_nome ?? "", usuarioEmail: p.usuario_email ?? "",
    })),
  })).reverse();

  const avisoQueries = useQueries({
    queries: gateQueries([
      { queryKey: [...QK_AVISOS, "raw"], queryFn: () => fetchAll("comunicacao_avisos", "created_at"), ...opts },
      { queryKey: ["comunicacao_avisos_leitura"], queryFn: () => fetchAll("comunicacao_avisos_leitura", "lido_em"), ...opts },
    ], __active),
  });
  const avData = (avisoQueries[0].data as any[]) ?? [];
  const leitData = (avisoQueries[1].data as any[]) ?? [];
  const avisos: Aviso[] = avData.slice().reverse().map((a: any) => ({
    id: a.id,
    titulo: a.titulo ?? "",
    conteudo: a.conteudo ?? "",
    prioridade: a.prioridade ?? "Normal",
    criadoPor: a.criado_por ?? "",
    ativo: a.ativo ?? true,
    createdAt: a.created_at ?? "",
    leituras: leitData.filter((l: any) => l.aviso_id === a.id).map((l: any) => ({
      id: l.id, avisoId: l.aviso_id,
      usuarioNome: l.usuario_nome ?? "", usuarioEmail: l.usuario_email ?? "",
      lidoEm: l.lido_em ?? "",
    })),
    destinatariosEmails: Array.isArray(a.destinatarios_emails) ? a.destinatarios_emails : [],
    gruposIds: Array.isArray(a.grupos_ids) ? a.grupos_ids : [],
  }));

  const { data: notificacoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK_NOTIF,
    queryFn: async () => (await fetchAll("comunicacao_notificacoes", "created_at")).reverse().map(mapNotif),
    ...opts,
  });

  const invGrupos = () => qc.invalidateQueries({ queryKey: QK_GRUPOS });
  const invConv = () => { qc.invalidateQueries({ queryKey: [...QK_CONV, "raw"] }); qc.invalidateQueries({ queryKey: ["comunicacao_participantes"] }); };
  const invAvisos = () => { qc.invalidateQueries({ queryKey: [...QK_AVISOS, "raw"] }); qc.invalidateQueries({ queryKey: ["comunicacao_avisos_leitura"] }); };
  const invNotif = () => qc.invalidateQueries({ queryKey: QK_NOTIF });

  const loadGrupos = async () => { invGrupos(); };
  const loadConversas = async () => { invConv(); };
  const loadAvisos = async () => { invAvisos(); };
  const loadNotificacoes = async () => { invNotif(); };

  const addGrupo = async (data: any) => { await insertRow("comunicacao_grupos", data); invGrupos(); };
  const updateGrupo = async (id: string, data: any) => { await updateRow("comunicacao_grupos", id, data); invGrupos(); };
  const deleteGrupo = async (id: string) => { await deleteRow("comunicacao_grupos", id); invGrupos(); };

  const loadMensagens = async (conversaId: string) => {
    const { data, error } = await (supabase as any)
      .from("comunicacao_mensagens")
      .select("*")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setMensagens(data.map((m: any) => ({
        id: m.id,
        conversaId: m.conversa_id,
        remetenteNome: m.remetente_nome ?? "",
        remetenteEmail: m.remetente_email ?? "",
        conteudo: m.conteudo ?? "",
        createdAt: m.created_at ?? "",
      })));
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("comunicacao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicacao_mensagens" }, () => {})
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicacao_avisos" }, () => { invAvisos(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicacao_notificacoes" }, () => { invNotif(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addConversa = async (data: any) => { const result = await insertRow("comunicacao_conversas", data); invConv(); return result; };
  const addParticipante = async (data: any) => { await insertRow("comunicacao_participantes", data); invConv(); };
  const addMensagem = async (data: any) => { await insertRow("comunicacao_mensagens", data); };
  const addAviso = async (data: any) => { await insertRow("comunicacao_avisos", data); invAvisos(); };
  const updateAviso = async (id: string, data: any) => { await updateRow("comunicacao_avisos", id, data); invAvisos(); };
  const deleteAviso = async (id: string) => { await deleteRow("comunicacao_avisos", id); invAvisos(); };
  const confirmarLeitura = async (data: any) => {
    const { data: existing } = await (supabase as any)
      .from("comunicacao_avisos_leitura")
      .select("id")
      .eq("aviso_id", data.aviso_id)
      .eq("usuario_email", data.usuario_email)
      .maybeSingle();
    if (existing) return;
    await insertRow("comunicacao_avisos_leitura", data);
    invAvisos();
  };
  const addNotificacao = async (data: any) => { await insertRow("comunicacao_notificacoes", data); invNotif(); };
  const marcarNotificacaoLida = async (id: string) => { await updateRow("comunicacao_notificacoes", id, { lida: true }); invNotif(); };
  const deleteNotificacao = async (id: string) => { await deleteRow("comunicacao_notificacoes", id); invNotif(); };
  const deleteConversa = async (id: string) => { await deleteRow("comunicacao_conversas", id); invConv(); };

  return (
    <ComunicacaoContext.Provider value={{
      conversas, mensagens, avisos, notificacoes, grupos,
      loadMensagens, addConversa, addParticipante, addMensagem,
      addAviso, updateAviso, deleteAviso, confirmarLeitura,
      addNotificacao, marcarNotificacaoLida, deleteNotificacao,
      deleteConversa, loadConversas, loadAvisos, loadNotificacoes,
      loadGrupos, addGrupo, updateGrupo, deleteGrupo,
    }}>
      {children}
    </ComunicacaoContext.Provider>
  );
}

export function useComunicacao() {
  useActivateProvider("Comunicacao");
  const ctx = useContext(ComunicacaoContext);
  if (!ctx) throw new Error("useComunicacao must be used within ComunicacaoProvider");
  return ctx;
}
