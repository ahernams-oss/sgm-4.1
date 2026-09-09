import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Fase 1 - Migração: cria contas no Supabase Auth para usuários existentes
// e (opcionalmente) dispara e-mail de redefinição de senha.
//
// Modos:
//   { mode: "preview" }                     -> apenas conta quantos usuários precisam ser migrados
//   { mode: "migrate", sendEmail: false }   -> cria contas no Auth, sem enviar e-mail
//   { mode: "migrate", sendEmail: true }    -> cria contas e dispara recovery email
//   { mode: "send-recovery", userIds: [] }  -> só envia recovery para usuários já migrados
//
// Auth: somente Diretor/Gerente/Coordenador (validado via JWT do chamador) pode invocar
// quando já houver migração. Para o primeiro disparo (boostrap, ninguém tem auth_user_id
// ainda), aceitamos chave service-role no header X-Bootstrap-Key.

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function genPassword(): string {
  const upp = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const low = "abcdefghjkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*?";
  const all = upp + low + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let out = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 16; i++) out += pick(all);
  return out.split("").sort(() => Math.random() - 0.5).join("");
}

async function isAuthorized(req: Request): Promise<boolean> {
  const bootstrap = req.headers.get("x-bootstrap-key");
  if (bootstrap && bootstrap === SERVICE_KEY) return true;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^bearer\s+/i, "");
  if (!token) return false;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return false;

  const { data: usuario } = await admin
    .from("usuarios")
    .select("cargo_id, cargos:cargo_id(nome)")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  const nomeCargo = (usuario as any)?.cargos?.nome;
  return ["Diretor", "Gerente Executivo", "Coordenador de Departamento"].includes(
    nomeCargo
  );
}

async function sendRecovery(email: string, redirectTo: string) {
  // generateLink type=recovery emite o e-mail via templates do projeto
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!(await isAuthorized(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "preview";
    const sendEmail = body.sendEmail === true;
    const userIds: string[] | undefined = body.userIds;
    const origin = req.headers.get("origin") || "https://app.lasant.com.br";
    const redirectTo = `${origin}/redefinir-senha`;

    if (mode === "preview") {
      const { count: pending } = await admin
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .is("auth_user_id", null);
      const { count: migrated } = await admin
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .not("auth_user_id", "is", null);
      return new Response(
        JSON.stringify({ pending: pending ?? 0, migrated: migrated ?? 0 }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    if (mode === "migrate") {
      let query = admin
        .from("usuarios")
        .select("id, email, nome")
        .is("auth_user_id", null);
      if (Array.isArray(userIds) && userIds.length) query = query.in("id", userIds);

      const { data: users, error } = await query;
      if (error) throw error;

      const results: any[] = [];
      for (const u of users ?? []) {
        if (!u.email) {
          results.push({ id: u.id, status: "skipped", reason: "no_email" });
          continue;
        }
        try {
          // Cria usuário no Auth (e-mail já confirmado, senha aleatória)
          const { data: created, error: cerr } =
            await admin.auth.admin.createUser({
              email: u.email,
              password: genPassword(),
              email_confirm: true,
              user_metadata: { nome: u.nome, usuario_id: u.id },
            });
          if (cerr) {
            // Se já existir no Auth (e-mail repetido), tentar localizar e vincular
            const msg = String(cerr.message || "").toLowerCase();
            if (msg.includes("already") || msg.includes("registered")) {
              // procura via listUsers (paginada): faz uma busca simples por email
              const { data: list } = await admin.auth.admin.listUsers({
                page: 1,
                perPage: 200,
              });
              const found = list?.users?.find(
                (x) => (x.email || "").toLowerCase() === u.email.toLowerCase()
              );
              if (found) {
                await admin
                  .from("usuarios")
                  .update({ auth_user_id: found.id })
                  .eq("id", u.id);
                if (sendEmail) await sendRecovery(u.email, redirectTo);
                results.push({ id: u.id, status: "linked_existing" });
                continue;
              }
            }
            throw cerr;
          }
          // O trigger on_auth_user_created já vincula via email, mas garantimos:
          if (created?.user) {
            await admin
              .from("usuarios")
              .update({ auth_user_id: created.user.id })
              .eq("id", u.id);
          }
          if (sendEmail) await sendRecovery(u.email, redirectTo);
          results.push({ id: u.id, status: "created" });
        } catch (e: any) {
          results.push({ id: u.id, status: "error", error: String(e?.message ?? e) });
        }
      }
      const summary = results.reduce(
        (acc: any, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc),
        {}
      );
      return new Response(JSON.stringify({ summary, results }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (mode === "send-recovery") {
      if (!Array.isArray(userIds) || !userIds.length) {
        return new Response(JSON.stringify({ error: "userIds required" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      const { data: users, error } = await admin
        .from("usuarios")
        .select("id, email")
        .in("id", userIds)
        .not("auth_user_id", "is", null);
      if (error) throw error;
      const results: any[] = [];
      for (const u of users ?? []) {
        try {
          await sendRecovery(u.email, redirectTo);
          results.push({ id: u.id, status: "sent" });
        } catch (e: any) {
          results.push({ id: u.id, status: "error", error: String(e?.message ?? e) });
        }
      }
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("[migrate-users-to-auth] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});

export default __slot.dispatch;
