export function falhaPlugsend(status: number, body: unknown) {
  const message = body && typeof body === "object" && "message" in body ? String(body.message) : "";
  if (status === 503 && /whatsapp disconnected|session is not reconnectable/i.test(message)) {
    return {
      success: false as const,
      code: "WHATSAPP_DESCONECTADO",
      error: "WhatsApp desconectado. Vincule novamente o aparelho na PlugSend e clique em Atualizar.",
    };
  }
  return {
    success: false as const,
    code: "PLUGSEND_INDISPONIVEL",
    error: status === 401 || status === 403
      ? "A PlugSend recusou a conexão. Confira a configuração da integração."
      : "A PlugSend não conseguiu concluir a solicitação. Tente novamente mais tarde.",
  };
}