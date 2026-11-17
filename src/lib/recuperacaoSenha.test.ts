import { describe, expect, test, vi } from "vitest";
import { erroLinkRecuperacao, solicitarRecuperacaoSenha } from "./recuperacaoSenha";

describe("Recuperação de senha sem consultar usuários privados", () => {
  test("solicita e-mail normalizado com retorno para a nova senha na mesma origem", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const result = await solicitarRecuperacaoSenha({ resetPasswordForEmail }, " Pessoa@Lasant.com.br ", "https://reserva.lasant.com.br");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("pessoa@lasant.com.br", { redirectTo: "https://reserva.lasant.com.br/redefinir-senha" });
    expect(result.ok).toBe(true);
  });
  test("não confirma envio recusado", async () => {
    const auth = { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: { message: "SMTP error", status: 500 } }) };
    expect((await solicitarRecuperacaoSenha(auth, "pessoa@lasant.com.br", "https://reserva.lasant.com.br")).ok).toBe(false);
  });
  test("falha de rede não deixa solicitação pendente", async () => {
    const auth = { resetPasswordForEmail: vi.fn().mockRejectedValue(new Error("offline")) };
    expect((await solicitarRecuperacaoSenha(auth, "pessoa@lasant.com.br", "https://reserva.lasant.com.br")).ok).toBe(false);
  });
  test("não envia endereço inválido", async () => {
    const resetPasswordForEmail = vi.fn();
    expect((await solicitarRecuperacaoSenha({ resetPasswordForEmail }, "inválido", "https://reserva.lasant.com.br")).ok).toBe(false);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
  test("reconhece link expirado no hash ou na consulta", () => {
    expect(erroLinkRecuperacao("#error=access_denied&error_code=otp_expired", "")).not.toBeNull();
    expect(erroLinkRecuperacao("", "?error_code=otp_expired")).not.toBeNull();
    expect(erroLinkRecuperacao("#type=recovery", "")).toBeNull();
  });
});