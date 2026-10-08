// Verifica se a senha consta em vazamentos públicos usando a API de faixas do
// Have I Been Pwned (k-anonymity): só os 5 primeiros caracteres do hash SHA-1
// são enviados; a senha nunca sai do servidor.
export async function senhaVazada(senha: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(senha));
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefixo = hex.slice(0, 5);
    const sufixo = hex.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      headers: { "Add-Padding": "true", "User-Agent": "sgm-lasant" },
    });
    if (!res.ok) return false; // falha na consulta não bloqueia o usuário
    const texto = await res.text();
    return texto.split("\n").some((linha) => linha.split(":")[0].trim() === sufixo);
  } catch {
    return false;
  }
}

export const MSG_SENHA_VAZADA =
  "Esta senha já apareceu em vazamentos de dados. Escolha uma senha diferente.";
