import { expect, test, vi } from "vitest";
import { recuperarModulo } from "./recuperarModulo";

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