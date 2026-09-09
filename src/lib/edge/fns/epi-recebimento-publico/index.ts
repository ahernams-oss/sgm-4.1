import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes as any);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração do serviço indisponível" }, 500);
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corpo da requisição inválido" }, 400);
    }
    const action = body?.action as "verify" | "confirm";
    const token = String(body?.token || "");
    if (!token) return json({ error: "Token obrigatório" }, 400);
    if (action !== "verify" && action !== "confirm") return json({ error: "Ação inválida" }, 400);

    const { data: rec, error: recErr } = await supabase
      .from("epis_recebimentos")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (recErr || !rec) return json({ error: "Link inválido" }, 404);

    if (new Date(rec.expires_at) < new Date()) {
      return json({ error: "Link expirado" }, 410);
    }
    if (rec.status === "confirmado") {
      return json({ error: "Recebimento já confirmado" }, 409);
    }

    const { data: func } = await supabase
      .from("funcionarios")
      .select("id, nome, cpf, data_nascimento, epis")
      .eq("id", rec.funcionario_id)
      .maybeSingle();
    if (!func) return json({ error: "Funcionário não encontrado" }, 404);

    const cpfInput = onlyDigits(String(body?.cpf || ""));
    const dobInput = String(body?.dataNascimento || "").trim();
    const cpfOk = cpfInput && cpfInput === onlyDigits(func.cpf || "");
    const dobOk = dobInput && dobInput === (func.data_nascimento || "");

    if (!cpfOk || !dobOk) {
      return json({ error: "CPF ou data de nascimento não conferem" }, 401);
    }

    // Snapshot EPIs a confirmar (interseção pelos ids salvos)
    const epis = (func.epis as any[]) || [];
    const alvoIds: string[] = rec.epis_ids || [];
    const episAlvo = epis.filter((e) => alvoIds.includes(e.id));

    if (action === "verify") {
      if (!rec.cpf_verificado) {
        await supabase
          .from("epis_recebimentos")
          .update({ cpf_verificado: true, verificado_em: new Date().toISOString(), status: "verificado" })
          .eq("id", rec.id);
      }
      return json({
        funcionario: { nome: func.nome },
        epis: episAlvo.map((e) => ({
          id: e.id,
          descricao: e.descricao,
          ca: e.ca,
          quantidade: e.quantidade,
        })),
      });
    }

    if (action === "confirm") {
      if (body?.confirmacaoEnvio !== true) {
        return json({ error: "Confirmação final obrigatória para registrar as fotos" }, 400);
      }
      const selfie = String(body?.selfieBase64 || "");
      const selfie2 = String(body?.selfieBase64_2 || "");
      if (!selfie || !selfie2) return json({ error: "São necessárias 2 selfies" }, 400);

      const uploadOne = async (b64: string, suffix: string) => {
        const bytes = base64ToBytes(b64);
        if (bytes.length < 4000) throw new Error("Imagem inválida");
        const hash = await sha256(bytes);
        const path = `${rec.funcionario_id}/${rec.id}-${Date.now()}-${suffix}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("epi-recebimentos-selfies")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error("Falha ao gravar selfie: " + upErr.message);
        return { path, hash };
      };

      let f1, f2;
      try {
        f1 = await uploadOne(selfie, "1");
        f2 = await uploadOne(selfie2, "2");
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const episAtualizados = epis.map((e) =>
        alvoIds.includes(e.id) && !e.dataEntrega ? { ...e, dataEntrega: todayStr } : e
      );

      const { error: funcErr } = await supabase
        .from("funcionarios")
        .update({ epis: episAtualizados })
        .eq("id", rec.funcionario_id);
      if (funcErr) return json({ error: "Falha ao atualizar a data de entrega dos EPIs" }, 500);

      const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
      const ua = req.headers.get("user-agent") || "";

      const { error: recUpdateErr } = await supabase
        .from("epis_recebimentos")
        .update({
          status: "confirmado",
          confirmado_em: nowIso,
          selfie_path: f1.path,
          selfie_hash: f1.hash,
          selfie_path_2: f2.path,
          selfie_hash_2: f2.hash,
          ip,
          user_agent: ua,
          epis_snapshot: episAlvo,
        })
        .eq("id", rec.id);
      if (recUpdateErr) return json({ error: "Falha ao registrar o recebimento facial" }, 500);

      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default __slot.dispatch;
