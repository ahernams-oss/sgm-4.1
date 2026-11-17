interface RecuperacaoAuth {
  resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: { message: string; status?: number } | null }>;
}

export async function solicitarRecuperacaoSenha(auth: RecuperacaoAuth, email: string, origin: string) {
  const normalizado = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return { ok: false, message: "Informe um e-mail válido." };
  }
  try {
    const { error } = await auth.resetPasswordForEmail(normalizado, {
      redirectTo: `${new URL(origin).origin}/redefinir-senha`,
    });
    if (error) return {
      ok: false,
      message: error.status === 429
        ? "Aguarde alguns minutos antes de solicitar outro link."
        : "Não foi possível enviar o link de recuperação. Tente novamente.",
    };
    return { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha." };
  } catch {
    return { ok: false, message: "Não foi possível enviar o link de recuperação. Verifique sua conexão e tente novamente." };
  }
}

export function erroLinkRecuperacao(hash: string, search: string) {
  const params = [new URLSearchParams(hash.replace(/^#/, "")), new URLSearchParams(search)];
  return params.some((p) => p.has("error") || p.has("error_code"))
    ? "Este link expirou ou não é válido. Solicite um novo link de recuperação."
    : null;
}