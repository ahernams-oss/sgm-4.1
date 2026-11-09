import { expect, test, vi } from "vitest";
import { observarFalhasModulo, recuperarModulo } from "./recuperarModulo";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("recupera módulo indisponível uma vez sem criar loop", () => {
  const error = new Error("Failed to fetch dynamically imported module: /NfseEmitir-antigo.js");
  const saved = storage();
  const reload = vi.fn();
  expect(recuperarModulo(error, saved, reload)).toBe(true);
  expect(recuperarModulo(error, saved, reload)).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("não recarrega erros de emissão ou validação", () => {
  const reload = vi.fn();
  expect(recuperarModulo(new Error("Falha ao emitir NFS-e"), storage(), reload)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

test("armazenamento bloqueado mantém recuperação manual", () => {
  const reload = vi.fn();
  const saved = { getItem: () => { throw new Error("blocked"); }, setItem: vi.fn() };
  expect(recuperarModulo(new Error("Importing a module script failed"), saved, reload)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

test("não repete a recuperação do mesmo módulo após falha em outro módulo", () => {
  const saved = storage();
  const reload = vi.fn();
  const smart = new Error("Failed to fetch dynamically imported module: /PmocOperacaoSmart-BzCjbsX_.js");
  expect(recuperarModulo(smart, saved, reload)).toBe(true);
  expect(recuperarModulo(new Error("Failed to fetch dynamically imported module: /outro.js"), saved, reload)).toBe(true);
  expect(recuperarModulo(smart, saved, reload)).toBe(false);
  expect(reload).toHaveBeenCalledTimes(2);
});

test.each(["vite:preloadError", "unhandledrejection"])("recupera falha SMART antes da barreira React via %s e remove escuta", (type) => {
  const target = new EventTarget();
  const reload = vi.fn();
  const saved = storage();
  const stop = observarFalhasModulo(target, (error) => recuperarModulo(error, saved, reload));
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { [type === "vite:preloadError" ? "payload" : "reason"]: new Error("Failed to fetch dynamically imported module: /PmocOperacaoSmart-BzCjbsX_.js") });
  target.dispatchEvent(event);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
  stop();
  target.dispatchEvent(event);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("não intercepta nem repete falhas de gravação ou emissão", () => {
  const target = new EventTarget();
  const recover = vi.fn();
  const stop = observarFalhasModulo(target, recover);
  const event = new Event("unhandledrejection", { cancelable: true });
  Object.assign(event, { reason: new Error("Falha ao emitir NFS-e") });
  target.dispatchEvent(event);
  expect(recover).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
  stop();
});