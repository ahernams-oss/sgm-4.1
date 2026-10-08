// Chamada de uma função de servidor do SGM a partir de outra, dentro do mesmo processo.
// Substitui supabase.functions.invoke(...) e fetch(`${SUPABASE_URL}/functions/v1/...`) no
// servidor: essas chamadas iam para as edge functions do Supabase Cloud, que não existem mais
// no projeto atual (respondem 404). Aqui a função é carregada do registry e recebe uma
// requisição com a service role, como numa chamada servidor para servidor pela ponte.
// Mesma assinatura e retorno do supabase.functions.invoke: invocarFuncao(nome, { body }) devolve
// { data, error }. error vem para respostas fora da faixa 2xx e também quando a função responde
// 200 com { success: false } (a send-whatsapp faz isso quando o PlugSend recusa o envio).

import { edgeFunctions } from "@/lib/edge/registry";

export async function invocarFuncao(
  nome: string,
  opcoes: { body?: unknown } = {},
): Promise<{ data: any; error: Error | null }> {
  const loader = edgeFunctions[nome];
  if (!loader) return { data: null, error: new Error(`Função ${nome} não encontrada`) };

  const servico = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  const req = new Request(`http://interno/api/public/edge/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${servico}`,
      apikey: servico,
    },
    body: JSON.stringify(opcoes.body ?? {}),
  });

  try {
    const mod = await loader();
    const resp = await mod.default(req);
    const texto = await resp.text();
    let data: any = null;
    try {
      data = texto ? JSON.parse(texto) : null;
    } catch {
      data = texto;
    }
    if (!resp.ok || data?.success === false) {
      const msg = (data && (data.error || data.message)) || `Erro ${resp.status} em ${nome}`;
      return { data, error: new Error(msg) };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
