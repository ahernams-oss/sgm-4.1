export function erroModuloDesatualizado(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(error.message);
}

export function recuperarModulo(error: Error, storage: Pick<Storage, "getItem" | "setItem">, reload: () => void): boolean {
  if (!erroModuloDesatualizado(error)) return false;
  const key = "sgm:modulo-recuperado";
  try {
    // Each unavailable chunk gets only one attempt, preventing reload loops.
    if (storage.getItem(key) === error.message) return false;
    storage.setItem(key, error.message);
  } catch {
    return false;
  }
  reload();
  return true;
}