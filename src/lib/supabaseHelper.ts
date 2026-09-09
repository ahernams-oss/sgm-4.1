import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditoria";

// Tabelas que NÃO devem ser auditadas (ruído operacional ou auto-referência).
const SKIP_AUDIT = new Set<string>([
  "auditoria",
  "login_auditoria",
  "email_queue",
  "kb_artigos_embeddings",
]);

export async function fetchAll(table: string, orderBy = "created_at"): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from(table)
    .select("*")
    .order(orderBy, { ascending: true });
  if (error) {
    console.error(`Erro ao carregar ${table}:`, error);
    toast.error(`Erro ao carregar dados.`);
    return [];
  }
  return data || [];
}

export async function insertRow(table: string, row: any): Promise<any> {
  const { data, error } = await (supabase as any).from(table).insert(row).select().single();
  if (error) {
    console.error(`Erro ao inserir em ${table}:`, error);
    toast.error(`Erro ao salvar dados.`);
    return null;
  }
  if (!SKIP_AUDIT.has(table)) {
    registrarAuditoria({ modulo: table, acao: "insert", entidadeId: data?.id, dadosDepois: data });
  }
  return data;
}

export async function updateRow(table: string, id: string, row: any): Promise<boolean> {
  let antes: any = null;
  if (!SKIP_AUDIT.has(table)) {
    const { data: prev } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
    antes = prev;
  }
  const { error } = await (supabase as any).from(table).update(row).eq("id", id);
  if (error) {
    console.error(`Erro ao atualizar ${table}:`, error);
    toast.error(`Erro ao atualizar dados.`);
    return false;
  }
  if (!SKIP_AUDIT.has(table)) {
    const { data: depois } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
    registrarAuditoria({ modulo: table, acao: "update", entidadeId: id, dadosAntes: antes, dadosDepois: depois });
  }
  return true;
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  let antes: any = null;
  if (!SKIP_AUDIT.has(table)) {
    const { data: prev } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
    antes = prev;
  }
  const { error } = await (supabase as any).from(table).delete().eq("id", id);
  if (error) {
    console.error(`Erro ao remover de ${table}:`, error);
    toast.error(`Erro ao remover dados.`);
    return false;
  }
  if (!SKIP_AUDIT.has(table)) {
    registrarAuditoria({ modulo: table, acao: "delete", entidadeId: id, dadosAntes: antes });
  }
  return true;
}
