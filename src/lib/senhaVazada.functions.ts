// Verificação de senha vazada para fluxos que trocam a senha direto pelo
// cliente Supabase (ex.: redefinição por e-mail). Usa a mesma consulta
// anônima ao Have I Been Pwned das funções de servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MSG_SENHA_VAZADA, senhaVazada } from "@/lib/edge/fns/_shared/senha-vazada";

export const verificarSenhaVazada = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ senha: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const vazada = await senhaVazada(data.senha);
    return { vazada, mensagem: vazada ? MSG_SENHA_VAZADA : null };
  });
