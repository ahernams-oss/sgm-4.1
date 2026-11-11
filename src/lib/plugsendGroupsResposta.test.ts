import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/edge/permissao", () => ({
  exigirAcesso: vi.fn(async () => ({ ok: true })),
  podeModulo: vi.fn(),
  pode: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("a consulta desconectada retorna falha recuperável, não HTTP 503", async () => {
  vi.stubEnv("PLUGSEND_TOKEN", "test-only-placeholder");
  const fetchProvider = vi.fn(async () => Response.json({ error: true, message: "WhatsApp disconnected: session is not reconnectable" }, { status: 503 }));
  vi.stubGlobal("fetch", fetchProvider);
  const { default: handler } = await import("./edge/fns/plugsend-groups/index");
  const response = await handler(new Request("http://localhost/api/public/edge/plugsend-groups", {
    method: "POST", body: JSON.stringify({ action: "list", force: false }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: false, code: "WHATSAPP_DESCONECTADO" });
  expect(fetchProvider).toHaveBeenCalledTimes(1);
});