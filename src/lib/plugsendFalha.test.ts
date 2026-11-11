import { describe, expect, it } from "vitest";
import { falhaPlugsend } from "./plugsendFalha";

describe("falhas da PlugSend", () => {
  it("identifica a sessão desconectada recebida na consulta de grupos", () => {
    const result = falhaPlugsend(503, { error: true, message: "WhatsApp disconnected: session is not reconnectable" });
    expect(result.success).toBe(false);
    expect(result.code).toBe("WHATSAPP_DESCONECTADO");
  });
  it("não atribui toda indisponibilidade a uma sessão desconectada", () => {
    expect(falhaPlugsend(503, { message: "Service unavailable" }).code).toBe("PLUGSEND_INDISPONIVEL");
  });
  it("não devolve dados brutos do provedor", () => {
    const result = falhaPlugsend(401, { message: "provider-private-details", token: "not-a-real-token" });
    expect(JSON.stringify(result)).not.toContain("provider-private-details");
    expect(JSON.stringify(result)).not.toContain("not-a-real-token");
  });
});