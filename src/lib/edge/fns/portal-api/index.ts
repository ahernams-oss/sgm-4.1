import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "@/lib/edge/bcrypt";
import { create, verify, getNumericDate } from "@/lib/edge/djwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JWT_SECRET = Deno.env.get("PORTAL_JWT_SECRET")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let keyPromise: Promise<CryptoKey> | null = null;
function getKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normCpf = (v: string) => String(v || "").replace(/\D/g, "");
const validCpf = (cpf: string) => /^\d{11}$/.test(cpf);
const getIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: Record<string, unknown>) {
  return await create({ alg: "HS256", typ: "JWT" }, { ...payload, exp: getNumericDate(60 * 60) }, await getKey());
}
async function verifyToken(token: string): Promise<any | null> {
  try { return await verify(token, await getKey()); } catch { return null; }
}

async function log(cpf: string | null, credId: string | null, acao: string, sucesso: boolean, detalhes: unknown, req: Request) {
  try {
    await sb.from("portal_acessos_log").insert({
      cpf, credencial_id: credId, acao, sucesso, detalhes: detalhes as any,
      ip: getIp(req), user_agent: req.headers.get("user-agent"),
    });
  } catch (_) {}
}

/** MODO TESTE: libera o acesso de candidatos sem validação de data de nascimento. */
const PORTAL_TESTE_CANDIDATO = true;

/** Locate the candidate JSON entry across all processos_seletivos. */
async function findCandidato(cpf: string, dataNasc?: string | null) {
  const { data } = await sb.from("processos_seletivos").select("id, requisicao_id, candidatos");
  if (!data) return null;
  for (const ps of data) {
    const list: any[] = Array.isArray(ps.candidatos) ? ps.candidatos : [];
    const idx = list.findIndex((c: any) => normCpf(c?.cpf) === cpf);
    if (idx >= 0) {
      if (dataNasc && list[idx]?.dataNascimento && list[idx].dataNascimento !== dataNasc) continue;
      return { processo_seletivo_id: ps.id, candidato: list[idx], candidato_ref: list[idx]?.id || String(idx) };
    }
  }
  return null;
}

/** Funcionário inativo (demitido/desligado) perde o acesso ao portal. */
async function funcionarioBloqueado(funcionarioId: string | null | undefined) {
  if (!funcionarioId) return false;
  const { data } = await sb.from("funcionarios").select("status").eq("id", funcionarioId).maybeSingle();
  if (!data) return true;
  return String(data.status || "").trim().toLowerCase() === "inativo";
}

async function requireAuth(req: Request) {
  const token = req.headers.get("x-portal-token") || "";
  const payload = await verifyToken(token);
  if (!payload) return null;
  const { data: cred } = await sb.from("portal_credenciais").select("*").eq("id", payload.sub as string).maybeSingle();
  if (!cred?.ativo) return null;
  if (cred.tipo_acesso === "funcionario" && (await funcionarioBloqueado(cred.funcionario_id))) return null;
  return cred;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // -------- SIGNUP (1º acesso) --------
    if (action === "signup") {
      const cpf = normCpf(body.cpf);
      const dataNasc = String(body.dataNascimento || "");
      const senha = String(body.senha || "");
      if (!validCpf(cpf) || !dataNasc || senha.length < 8)
        return json({ error: "CPF, data de nascimento e senha (mín. 8 caracteres) são obrigatórios." }, 400);

      // Já existe?
      const { data: existente } = await sb.from("portal_credenciais").select("id").eq("cpf", cpf).maybeSingle();
      if (existente) return json({ error: "Este CPF já possui cadastro. Use 'Esqueci a senha' se necessário." }, 409);

      // Tenta como funcionário (busca tolerante a formato do CPF)
      const { data: funcs } = await sb.from("funcionarios")
        .select("id, nome, email, telefone_whatsapp, data_nascimento, status, cpf");
      const func = (funcs ?? []).find((f: any) => normCpf(f.cpf) === cpf);

      if (func) {
        if (String(func.status || "").trim().toLowerCase() === "inativo")
          return json({ error: "Funcionário inativo. Acesso ao portal bloqueado." }, 403);
        if (func.data_nascimento !== dataNasc)
          return json({ error: "Dados não conferem." }, 401);
        const hash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));
        const { data: cred, error } = await sb.from("portal_credenciais").insert({
          cpf, senha_hash: hash, tipo_acesso: "funcionario",
          funcionario_id: func.id, email: func.email, telefone: func.telefone_whatsapp,
        }).select().single();
        if (error) return json({ error: "Falha ao criar acesso." }, 500);
        await log(cpf, cred.id, "signup", true, { tipo: "funcionario" }, req);
        const token = await sign({ sub: cred.id, cpf, tipo: "funcionario" });
        return json({ token, tipo: "funcionario", nome: func.nome });
      }

      // Tenta como candidato
      // MODO TESTE: aceita o candidato mesmo com data de nascimento divergente
      // ou sem vínculo em processo seletivo.
      const cand = PORTAL_TESTE_CANDIDATO
        ? (await findCandidato(cpf, dataNasc)) ?? (await findCandidato(cpf))
        : await findCandidato(cpf, dataNasc);
      if (!cand && !PORTAL_TESTE_CANDIDATO)
        return json({ error: "CPF não localizado como funcionário nem candidato ativo." }, 404);
      const hash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));
      const { data: cred, error } = await sb.from("portal_credenciais").insert({
        cpf, senha_hash: hash, tipo_acesso: "candidato",
        processo_seletivo_id: cand?.processo_seletivo_id ?? null,
        candidato_ref: cand?.candidato_ref ?? null,
        email: cand?.candidato?.email ?? null,
        telefone: cand?.candidato?.telefone ?? cand?.candidato?.whatsapp ?? null,
      }).select().single();
      if (error) return json({ error: "Falha ao criar acesso." }, 500);
      await log(cpf, cred.id, "signup", true, { tipo: "candidato" }, req);
      const token = await sign({ sub: cred.id, cpf, tipo: "candidato" });
      return json({ token, tipo: "candidato", nome: cand?.candidato?.nome ?? "Candidato" });
    }

    // -------- LOGIN --------
    if (action === "login") {
      const cpf = normCpf(body.cpf);
      const senha = String(body.senha || "");
      if (!validCpf(cpf) || !senha) return json({ error: "CPF e senha são obrigatórios." }, 400);
      const loginError = () => json({ error: "CPF ou senha inválidos." });

      const { data: cred } = await sb.from("portal_credenciais").select("*").eq("cpf", cpf).maybeSingle();
      if (!cred || !cred.senha_hash) {
        await log(cpf, null, "login", false, { motivo: "sem_cadastro" }, req);
        return loginError();
      }
      if (cred.bloqueado_ate && new Date(cred.bloqueado_ate) > new Date()) {
        return json({ error: "Conta temporariamente bloqueada. Tente novamente mais tarde." });
      }
      const ok = bcrypt.compareSync(senha, cred.senha_hash);
      if (!ok) {
        const tent = (cred.tentativas_falhas ?? 0) + 1;
        const bloq = tent >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await sb.from("portal_credenciais").update({ tentativas_falhas: tent, bloqueado_ate: bloq }).eq("id", cred.id);
        await log(cpf, cred.id, "login", false, { motivo: "senha_incorreta", tentativas: tent }, req);
        return loginError();
      }
      if (cred.tipo_acesso === "funcionario" && (await funcionarioBloqueado(cred.funcionario_id))) {
        await log(cpf, cred.id, "login", false, { motivo: "funcionario_inativo" }, req);
        return json({ error: "Funcionário inativo. Acesso ao portal bloqueado." }, 403);
      }
      await sb.from("portal_credenciais").update({ tentativas_falhas: 0, bloqueado_ate: null, ultimo_login: new Date().toISOString() }).eq("id", cred.id);
      await log(cpf, cred.id, "login", true, null, req);

      // Nome de exibição
      let nome = "Usuário";
      if (cred.tipo_acesso === "funcionario" && cred.funcionario_id) {
        const { data: f } = await sb.from("funcionarios").select("nome").eq("id", cred.funcionario_id).maybeSingle();
        nome = f?.nome ?? nome;
      } else if (cred.processo_seletivo_id) {
        const cand = await findCandidato(cpf);
        nome = cand?.candidato?.nome ?? nome;
      }
      const token = await sign({ sub: cred.id, cpf, tipo: cred.tipo_acesso });
      return json({ token, tipo: cred.tipo_acesso, nome });
    }

    // -------- RESET (esqueci senha - reset direto por CPF+DataNasc para v1) --------
    if (action === "reset-request") {
      const cpf = normCpf(body.cpf);
      const dataNasc = String(body.dataNascimento || "");
      const novaSenha = String(body.novaSenha || "");
      if (!validCpf(cpf) || !dataNasc || novaSenha.length < 8)
        return json({ error: "Informe CPF, data de nascimento e nova senha (mín. 8 caracteres)." }, 400);

      const { data: cred } = await sb.from("portal_credenciais").select("*").eq("cpf", cpf).maybeSingle();
      if (!cred) return json({ error: "CPF não encontrado." }, 404);

      let match = false;
      if (cred.funcionario_id) {
        if (await funcionarioBloqueado(cred.funcionario_id))
          return json({ error: "Funcionário inativo. Acesso ao portal bloqueado." }, 403);
        const { data: f } = await sb.from("funcionarios").select("data_nascimento").eq("id", cred.funcionario_id).maybeSingle();
        match = f?.data_nascimento === dataNasc;
      } else {
        // MODO TESTE: candidato pode redefinir a senha apenas com o CPF.
        const cand = await findCandidato(cpf, dataNasc);
        match = PORTAL_TESTE_CANDIDATO ? true : !!cand;
      }
      if (!match) return json({ error: "Dados não conferem." }, 401);

      const hash = bcrypt.hashSync(novaSenha, bcrypt.genSaltSync(10));
      await sb.from("portal_credenciais").update({
        senha_hash: hash, tentativas_falhas: 0, bloqueado_ate: null,
      }).eq("id", cred.id);
      await log(cpf, cred.id, "reset", true, null, req);
      return json({ ok: true });
    }

    // -------- Ações administrativas (SGM app, sem token de portal) --------
    if (action === "admin-cand-validacao") {
      const cpf = normCpf(body.cpf);
      if (!validCpf(cpf)) return json({ error: "CPF inválido." }, 400);
      const [{ data: ficha }, { data: documentos }, { data: termos }, cand] = await Promise.all([
        sb.from("portal_ficha_admissao").select("*").eq("cpf", cpf).maybeSingle(),
        sb.from("portal_documentos_candidato").select("*").eq("cpf", cpf).order("enviado_em", { ascending: false }),
        sb.from("portal_termos_assinados").select("*").eq("cpf", cpf).order("assinado_em", { ascending: false }),
        findCandidato(cpf),
      ]);
      return json({ ficha, documentos: documentos ?? [], termos: termos ?? [], candidato: cand?.candidato ?? null });
    }
    if (action === "admin-cand-doc-url") {
      const id = String(body.id || "");
      const { data: d } = await sb.from("portal_documentos_candidato").select("storage_path,nome_arquivo").eq("id", id).maybeSingle();
      if (!d) return json({ error: "Documento não encontrado." }, 404);
      const { data: u } = await sb.storage.from("portal-candidato-docs").createSignedUrl(d.storage_path, 300);
      return json({ url: u?.signedUrl, nome: d.nome_arquivo });
    }
    if (action === "admin-cand-doc-status") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!["pendente", "aprovado", "reprovado"].includes(status)) return json({ error: "Status inválido." }, 400);
      const { error } = await sb.from("portal_documentos_candidato").update({
        status, observacao: body.observacao ?? null, revisado_em: new Date().toISOString(),
      }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "admin-cand-ficha-status") {
      const cpf = normCpf(body.cpf);
      const status = String(body.status || "");
      if (!validCpf(cpf) || !["rascunho", "enviada", "em_analise", "aprovada", "reprovada"].includes(status))
        return json({ error: "Parâmetros inválidos." }, 400);
      const { error } = await sb.from("portal_ficha_admissao").update({
        status, observacoes_rh: body.observacoes_rh ?? null, revisado_em: new Date().toISOString(),
      }).eq("cpf", cpf);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // Promove credencial de candidato para funcionário quando RH finaliza contratação.
    // Reaproveita CPF/senha; portal passa a rotear para /portal/funcionario no próximo login.
    if (action === "admin-promover-funcionario") {
      const cpf = normCpf(body.cpf);
      const funcId = String(body.funcionario_id || "");
      if (!validCpf(cpf) || !funcId) return json({ error: "Parâmetros inválidos." }, 400);
      const { data: cred } = await sb.from("portal_credenciais").select("id, tipo_acesso").eq("cpf", cpf).maybeSingle();
      if (cred) {
        await sb.from("portal_credenciais").update({
          tipo_acesso: "funcionario",
          funcionario_id: funcId,
        }).eq("id", cred.id);
      }
      return json({ ok: true, promovido: !!cred });
    }

    // ---- RH: gestão das solicitações enviadas pelos colaboradores ----
    if (action === "admin-solicitacoes-list") {
      let q = sb.from("portal_solicitacoes_rh").select("*").order("created_at", { ascending: false }).limit(500);
      if (body.status) q = q.eq("status", String(body.status));
      if (body.tipo) q = q.eq("tipo", String(body.tipo));
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const ids = [...new Set((data ?? []).map((s: any) => s.funcionario_id).filter(Boolean))];
      let nomes: Record<string, any> = {};
      if (ids.length) {
        const { data: fs } = await sb.from("funcionarios").select("id,nome,cargo_id,cliente_id").in("id", ids);
        nomes = Object.fromEntries((fs ?? []).map((f: any) => [f.id, f]));
      }
      return json({
        solicitacoes: (data ?? []).map((s: any) => ({
          ...s,
          funcionario_nome: nomes[s.funcionario_id]?.nome ?? null,
          cliente_id: nomes[s.funcionario_id]?.cliente_id ?? null,
        })),
      });
    }
    if (action === "admin-solicitacao-responder") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!id || !["aberta", "em_analise", "concluida", "rejeitada"].includes(status))
        return json({ error: "Parâmetros inválidos." }, 400);
      const { error } = await sb.from("portal_solicitacoes_rh").update({
        status,
        resposta_rh: body.resposta_rh ?? null,
        respondido_em: new Date().toISOString(),
        respondido_por: body.respondido_por ?? null,
      }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "admin-solicitacao-anexo-url") {
      const id = String(body.id || "");
      const { data: s } = await sb.from("portal_solicitacoes_rh").select("anexo_path,anexo_nome").eq("id", id).maybeSingle();
      if (!s?.anexo_path) return json({ error: "Anexo não disponível." }, 404);
      const { data: u } = await sb.storage.from("funcionarios-anexos").createSignedUrl(s.anexo_path, 300);
      return json({ url: u?.signedUrl, nome: s.anexo_nome });
    }

    const cred = await requireAuth(req);
    if (!cred) return json({ error: "Sessão inválida ou expirada." }, 401);

    // Info do usuário logado
    if (action === "me") {
      if (cred.tipo_acesso === "funcionario") {
        const { data: f } = await sb.from("funcionarios").select("id, nome, email, cpf, cargo_id, data_admissao").eq("id", cred.funcionario_id).maybeSingle();
        return json({ tipo: "funcionario", cred, funcionario: f });
      }
      const cand = await findCandidato(cred.cpf);
      return json({ tipo: "candidato", cred, candidato: cand?.candidato ?? null, processo_seletivo_id: cand?.processo_seletivo_id });
    }

    if (action === "change-password") {
      const atual = String(body.senhaAtual || "");
      const nova = String(body.novaSenha || "");
      if (nova.length < 8) return json({ error: "Nova senha deve ter no mínimo 8 caracteres." }, 400);
      if (!bcrypt.compareSync(atual, cred.senha_hash)) return json({ error: "Senha atual incorreta." }, 401);
      const hash = bcrypt.hashSync(nova, bcrypt.genSaltSync(10));
      await sb.from("portal_credenciais").update({ senha_hash: hash }).eq("id", cred.id);
      await log(cred.cpf, cred.id, "change-password", true, null, req);
      return json({ ok: true });
    }

    // ---- FUNCIONÁRIO ----
    if (action === "list-holerites") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data } = await sb.from("portal_holerites")
        .select("id, tipo, competencia_mes, competencia_ano, descricao, disponibilizado_em, visualizado_em, assinado_em, assinatura_hash")
        .eq("funcionario_id", cred.funcionario_id)
        .order("competencia_ano", { ascending: false }).order("competencia_mes", { ascending: false });
      return json({ holerites: data ?? [] });
    }
    if (action === "assinar-holerite") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const senha = String(body.senha || "");
      const aceite = body.aceite === true;
      if (!id) return json({ error: "Holerite não informado." }, 400);
      if (!aceite) return json({ error: "É necessário aceitar a declaração para assinar." }, 400);
      if (!bcrypt.compareSync(senha, cred.senha_hash)) {
        await log(cred.cpf, cred.id, "assinar-holerite", false, { id }, req);
        return json({ error: "Senha incorreta." }, 401);
      }
      const { data: h } = await sb.from("portal_holerites")
        .select("id, assinado_em").eq("id", id).eq("funcionario_id", cred.funcionario_id).maybeSingle();
      if (!h) return json({ error: "Não encontrado." }, 404);
      if (h.assinado_em) return json({ error: "Holerite já assinado." }, 400);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      const dispositivo = req.headers.get("user-agent") || "";
      const assinadoEm = new Date().toISOString();
      const buf = new TextEncoder().encode(`${id}|${cred.cpf}|${cred.funcionario_id}|${assinadoEm}|${ip}|${dispositivo}`);
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const { error: upErr } = await sb.from("portal_holerites").update({
        assinado_em: assinadoEm,
        assinatura_imagem: null,
        assinatura_ip: ip,
        assinatura_dispositivo: dispositivo.slice(0, 300),
        assinatura_hash: hash,
      }).eq("id", id).eq("funcionario_id", cred.funcionario_id);
      if (upErr) return json({ error: upErr.message }, 500);
      await log(cred.cpf, cred.id, "assinar-holerite", true, { id, hash }, req);
      return json({ ok: true, assinado_em: assinadoEm, hash });
    }

    if (action === "assinar-certificado") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const senha = String(body.senha || "");
      const aceite = body.aceite === true;
      if (!id) return json({ error: "Treinamento não informado." }, 400);
      if (!aceite) return json({ error: "É necessário aceitar a declaração para assinar." }, 400);
      if (!bcrypt.compareSync(senha, cred.senha_hash)) {
        await log(cred.cpf, cred.id, "assinar-certificado", false, { id }, req);
        return json({ error: "Senha incorreta." }, 401);
      }
      const { data: t } = await sb.from("portal_treinamentos")
        .select("id, titulo, status, concluido_em, assinado_em, instr_assinado_em, coord_assinado_em").eq("id", id).eq("cpf", cred.cpf).maybeSingle();
      if (!t) return json({ error: "Treinamento não encontrado." }, 404);
      if (!t.instr_assinado_em || !t.coord_assinado_em) return json({ error: "Certificado ainda aguarda as assinaturas do Instrutor e da Coordenação." }, 400);
      if (t.status !== "concluido") return json({ error: "Treinamento ainda não concluído." }, 400);
      if (t.assinado_em) return json({ error: "Certificado já validado." }, 400);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      const dispositivo = req.headers.get("user-agent") || "";
      const assinadoEm = new Date().toISOString();
      const buf = new TextEncoder().encode(
        `${id}|${t.titulo}|${t.concluido_em ?? ""}|${cred.cpf}|${cred.funcionario_id ?? ""}|${assinadoEm}|${ip}|${dispositivo}`,
      );
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const { error: upErr } = await sb.from("portal_treinamentos").update({
        assinado_em: assinadoEm,
        assinatura_ip: ip,
        assinatura_dispositivo: dispositivo.slice(0, 300),
        assinatura_hash: hash,
      }).eq("id", id).eq("cpf", cred.cpf);
      if (upErr) return json({ error: upErr.message }, 500);
      await log(cred.cpf, cred.id, "assinar-certificado", true, { id, hash }, req);
      return json({ ok: true, assinado_em: assinadoEm, hash });
    }



    if (action === "download-holerite") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const { data: h } = await sb.from("portal_holerites").select("*").eq("id", id).eq("funcionario_id", cred.funcionario_id).maybeSingle();
      if (!h) return json({ error: "Não encontrado." }, 404);
      const { data: url } = await sb.storage.from("portal-holerites").createSignedUrl(h.arquivo_path, 60);
      await sb.from("portal_holerites").update({ visualizado_em: new Date().toISOString() }).eq("id", id);
      await log(cred.cpf, cred.id, "download-holerite", true, { id }, req);
      return json({ url: url?.signedUrl });
    }
    if (action === "func-documentos") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data: f } = await sb.from("funcionarios").select("*").eq("id", cred.funcionario_id).maybeSingle();
      const { data: exames } = await sb.from("exames_periodicos").select("*").eq("funcionario_id", cred.funcionario_id).order("data_exame", { ascending: false });
      return json({ funcionario: f, exames: exames ?? [] });
    }
    if (action === "func-epis") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data: f } = await sb.from("funcionarios").select("epis").eq("id", cred.funcionario_id).maybeSingle();
      const { data: recs } = await sb.from("epis_recebimentos")
        .select("id, status, confirmado_em, epis_ids, epis_snapshot, created_at")
        .eq("funcionario_id", cred.funcionario_id)
        .order("created_at", { ascending: false });
      return json({ epis: (f?.epis as any[]) ?? [], recebimentos: recs ?? [] });
    }


    // ---- CANDIDATO ----
    if (action === "cand-ficha-get") {
      if (cred.tipo_acesso !== "candidato") return json({ error: "Acesso negado." }, 403);
      const { data } = await sb.from("portal_ficha_admissao").select("*").eq("cpf", cred.cpf).maybeSingle();
      const cand = await findCandidato(cred.cpf);
      const c = cand?.candidato ?? {};
      const prefill = {
        nome: c?.nome ?? "",
        cpf: cred.cpf ?? "",
        dataNascimento: c?.dataNascimento ?? c?.data_nascimento ?? "",
      };
      return json({ ficha: data, prefill });
    }
    if (action === "cand-ficha-save") {
      if (cred.tipo_acesso !== "candidato") return json({ error: "Acesso negado." }, 403);
      const enviar = !!body.enviar;
      const payload = {
        cpf: cred.cpf,
        processo_seletivo_id: cred.processo_seletivo_id,
        candidato_ref: cred.candidato_ref,
        dados_pessoais: body.dados_pessoais ?? {},
        endereco: body.endereco ?? {},
        bancarios: body.bancarios ?? {},
        dependentes: body.dependentes ?? [],
        contatos_emergencia: body.contatos_emergencia ?? [],
        status: enviar ? "enviada" : "rascunho",
        enviado_em: enviar ? new Date().toISOString() : null,
      };
      const { data: existente } = await sb.from("portal_ficha_admissao").select("id").eq("cpf", cred.cpf).maybeSingle();
      if (existente) {
        await sb.from("portal_ficha_admissao").update(payload).eq("id", existente.id);
      } else {
        await sb.from("portal_ficha_admissao").insert(payload);
      }
      await log(cred.cpf, cred.id, "ficha-save", true, { enviar }, req);
      return json({ ok: true });
    }
    if (action === "cand-doc-upload") {
      if (cred.tipo_acesso !== "candidato") return json({ error: "Acesso negado." }, 403);
      const tipo = String(body.tipo_documento || "");
      const nome = String(body.nome_arquivo || "arquivo");
      const b64 = String(body.arquivo_base64 || "");
      if (!tipo || !b64) return json({ error: "Documento inválido." }, 400);
      const bin = Uint8Array.from(atob(b64.split(",").pop() || b64), (c) => c.charCodeAt(0));
      const sanitize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      const safeTipo = sanitize(tipo) || "doc";
      const safeNome = sanitize(nome) || "arquivo";
      const path = `${cred.cpf}/${safeTipo}/${Date.now()}-${safeNome}`;
      const { error: upErr } = await sb.storage.from("portal-candidato-docs").upload(path, bin, {
        contentType: body.content_type || "application/octet-stream", upsert: false,
      });
      if (upErr) return json({ error: upErr.message }, 500);
      await sb.from("portal_documentos_candidato").insert({
        cpf: cred.cpf, processo_seletivo_id: cred.processo_seletivo_id,
        tipo_documento: tipo, nome_arquivo: nome, storage_path: path, tamanho_bytes: bin.byteLength,
      });
      return json({ ok: true, path });
    }
    if (action === "cand-doc-list") {
      if (cred.tipo_acesso !== "candidato") return json({ error: "Acesso negado." }, 403);
      const { data } = await sb.from("portal_documentos_candidato").select("*").eq("cpf", cred.cpf).order("enviado_em", { ascending: false });
      return json({ documentos: data ?? [] });
    }

    if (action === "termo-assinar") {
      const tipo = String(body.tipo_termo || "");
      const texto = String(body.texto_aceite || "");
      const versao = String(body.versao_termo || "1.0");
      if (!tipo || !texto) return json({ error: "Termo inválido." }, 400);
      const canonical = JSON.stringify({ cpf: cred.cpf, tipo, versao, texto, ts: new Date().toISOString() });
      const hash = await sha256Hex(canonical);
      await sb.from("portal_termos_assinados").insert({
        cpf: cred.cpf, tipo_acesso: cred.tipo_acesso,
        funcionario_id: cred.funcionario_id, processo_seletivo_id: cred.processo_seletivo_id,
        tipo_termo: tipo, versao_termo: versao, texto_aceite: texto, hash_sha256: hash,
        ip: getIp(req), user_agent: req.headers.get("user-agent"),
      });
      await log(cred.cpf, cred.id, "termo-assinar", true, { tipo, hash }, req);
      return json({ ok: true, hash });
    }
    if (action === "termos-list") {
      const { data } = await sb.from("portal_termos_assinados").select("id, tipo_termo, versao_termo, hash_sha256, assinado_em").eq("cpf", cred.cpf).order("assinado_em", { ascending: false });
      return json({ termos: data ?? [] });
    }

    if (action === "treinamentos-list") {
      const { data } = await sb.from("portal_treinamentos").select("*").eq("cpf", cred.cpf).order("created_at", { ascending: false });
      return json({ treinamentos: data ?? [] });
    }
    if (action === "treinamento-concluir") {
      const id = String(body.id || "");
      if (!id) {
        // criar novo
        await sb.from("portal_treinamentos").insert({
          cpf: cred.cpf, processo_seletivo_id: cred.processo_seletivo_id,
          tipo: String(body.tipo || "integracao"),
          titulo: String(body.titulo || "Treinamento"),
          nota: body.nota ?? null,
          concluido_em: new Date().toISOString(), status: "concluido",
        });
      } else {
        await sb.from("portal_treinamentos").update({
          concluido_em: new Date().toISOString(), status: "concluido", nota: body.nota ?? null,
        }).eq("id", id).eq("cpf", cred.cpf);
      }
      return json({ ok: true });
    }

    // ---- FÉRIAS (funcionário) ----
    if (action === "func-ferias-list") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data } = await sb.from("ferias")
        .select("id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, data_limite_concessao, dias_direito, data_inicio_gozo, data_fim_gozo, dias_gozados, dias_abonados, status, observacoes")
        .eq("funcionario_id", cred.funcionario_id)
        .order("periodo_aquisitivo_fim", { ascending: false });
      return json({ ferias: data ?? [] });
    }
    if (action === "func-ferias-solicitar") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const inicio = String(body.data_inicio_gozo || "");
      const fim = String(body.data_fim_gozo || "");
      const abonados = Number(body.dias_abonados || 0);
      const obs = String(body.observacoes || "");
      if (!inicio || !fim) return json({ error: "Informe data de início e fim." }, 400);
      const dias = Math.max(1, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1);
      const patch: any = {
        data_inicio_gozo: inicio, data_fim_gozo: fim,
        dias_gozados: dias, dias_abonados: abonados,
        status: "solicitada",
        observacoes: obs || null,
      };
      if (id) {
        const { error } = await sb.from("ferias").update(patch).eq("id", id).eq("funcionario_id", cred.funcionario_id);
        if (error) return json({ error: error.message }, 500);
      } else {
        // Cria pedido avulso caso RH não tenha aberto o período ainda
        const { data: f } = await sb.from("funcionarios").select("nome").eq("id", cred.funcionario_id).maybeSingle();
        const today = new Date();
        const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().slice(0,10);
        const { error } = await sb.from("ferias").insert({
          funcionario_id: cred.funcionario_id,
          funcionario_nome: f?.nome ?? null,
          periodo_aquisitivo_inicio: oneYearAgo,
          periodo_aquisitivo_fim: today.toISOString().slice(0,10),
          data_limite_concessao: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().slice(0,10),
          dias_direito: 30,
          ...patch,
        });
        if (error) return json({ error: error.message }, 500);
      }
      await log(cred.cpf, cred.id, "ferias-solicitar", true, { id, inicio, fim, dias }, req);
      return json({ ok: true });
    }

    // ---- SOLICITAÇÕES RH ----
    if (action === "func-solicitacoes-list") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data } = await sb.from("portal_solicitacoes_rh")
        .select("*").eq("funcionario_id", cred.funcionario_id).order("created_at", { ascending: false });
      return json({ solicitacoes: data ?? [] });
    }
    if (action === "func-solicitacoes-criar") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const tipo = String(body.tipo || "");
      const assunto = String(body.assunto || "").trim();
      const descricao = String(body.descricao || "").trim();
      if (!tipo || !assunto) return json({ error: "Tipo e assunto são obrigatórios." }, 400);

      let anexo_path: string | null = null;
      let anexo_nome: string | null = null;
      const b64 = String(body.arquivo_base64 || "");
      if (b64) {
        const bin = Uint8Array.from(atob(b64.split(",").pop() || b64), (c) => c.charCodeAt(0));
        const sanitize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
        anexo_nome = String(body.nome_arquivo || "anexo");
        const safe = sanitize(anexo_nome) || "arquivo";
        anexo_path = `${cred.funcionario_id}/${Date.now()}-${safe}`;
        const { error: upErr } = await sb.storage.from("funcionarios-anexos").upload(anexo_path, bin, {
          contentType: body.content_type || "application/octet-stream", upsert: false,
        });
        if (upErr) return json({ error: upErr.message }, 500);
      }
      const { error } = await sb.from("portal_solicitacoes_rh").insert({
        funcionario_id: cred.funcionario_id, cpf: cred.cpf,
        tipo, assunto, descricao: descricao || null,
        anexo_path, anexo_nome, status: "aberta",
      });
      if (error) return json({ error: error.message }, 500);
      await log(cred.cpf, cred.id, "solicitacao-rh", true, { tipo, assunto }, req);
      return json({ ok: true });
    }
    if (action === "func-solicitacao-anexo-url") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const { data: s } = await sb.from("portal_solicitacoes_rh").select("anexo_path,anexo_nome,funcionario_id")
        .eq("id", id).maybeSingle();
      if (!s || s.funcionario_id !== cred.funcionario_id || !s.anexo_path) return json({ error: "Anexo não disponível." }, 404);
      const { data: u } = await sb.storage.from("funcionarios-anexos").createSignedUrl(s.anexo_path, 300);
      return json({ url: u?.signedUrl, nome: s.anexo_nome });
    }

    // ---- AVISOS ----
    if (action === "func-avisos-list") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const { data: f } = await sb.from("funcionarios").select("email,nome").eq("id", cred.funcionario_id).maybeSingle();
      const email = (f?.email || "").toLowerCase();
      const { data: avisos } = await sb.from("comunicacao_avisos")
        .select("id,titulo,conteudo,prioridade,criado_por,destinatarios_emails,created_at,ativo")
        .eq("ativo", true).order("created_at", { ascending: false }).limit(100);
      const filtered = (avisos ?? []).filter((a: any) => {
        const dest = Array.isArray(a.destinatarios_emails) ? a.destinatarios_emails.map((e: any) => String(e).toLowerCase()) : [];
        return dest.length === 0 || dest.includes(email);
      });
      const ids = filtered.map((a: any) => a.id);
      let leituras: any[] = [];
      if (ids.length && email) {
        const { data: lr } = await sb.from("comunicacao_avisos_leitura").select("aviso_id,lido_em")
          .in("aviso_id", ids).eq("usuario_email", email);
        leituras = lr ?? [];
      }
      const lidos = new Map(leituras.map((l: any) => [l.aviso_id, l.lido_em]));
      return json({
        avisos: filtered.map((a: any) => ({ ...a, lido_em: lidos.get(a.id) || null })),
        me: { nome: f?.nome, email },
      });
    }
    if (action === "func-aviso-marcar-lida") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const id = String(body.id || "");
      const { data: f } = await sb.from("funcionarios").select("email,nome").eq("id", cred.funcionario_id).maybeSingle();
      if (!f?.email) return json({ ok: true });
      const { data: existente } = await sb.from("comunicacao_avisos_leitura")
        .select("id").eq("aviso_id", id).eq("usuario_email", f.email.toLowerCase()).maybeSingle();
      if (!existente) {
        await sb.from("comunicacao_avisos_leitura").insert({
          aviso_id: id, usuario_nome: f.nome, usuario_email: f.email.toLowerCase(),
          lido_em: new Date().toISOString(),
        });
      }
      return json({ ok: true });
    }

    // ---- HOME resumo do funcionário ----
    if (action === "func-home-resumo") {
      if (cred.tipo_acesso !== "funcionario") return json({ error: "Acesso negado." }, 403);
      const [{ count: holCount }, { count: solPend }, { count: ferPend }] = await Promise.all([
        sb.from("portal_holerites").select("id", { count: "exact", head: true }).eq("funcionario_id", cred.funcionario_id).is("visualizado_em", null),
        sb.from("portal_solicitacoes_rh").select("id", { count: "exact", head: true }).eq("funcionario_id", cred.funcionario_id).in("status", ["aberta", "em_analise"]),
        sb.from("ferias").select("id", { count: "exact", head: true }).eq("funcionario_id", cred.funcionario_id).in("status", ["solicitada", "pendente"]),
      ]);
      return json({
        holerites_nao_lidos: holCount ?? 0,
        solicitacoes_pendentes: solPend ?? 0,
        ferias_pendentes: ferPend ?? 0,
      });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("[portal-api] error:", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

export default __slot.dispatch;
