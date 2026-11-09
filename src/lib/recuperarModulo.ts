export function erroModuloDesatualizado(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(error.message);
}

export function recuperarModulo(error: Error, storage: Pick<Storage, "getItem" | "setItem">, reload: () => void): boolean {
  if (!erroModuloDesatualizado(error)) return false;
  const key = "sgm:modulo-recuperado";
  try {
    // Each unavailable chunk gets only one attempt, preventing reload loops.
    const chunkKey = `${key}:${error.message}`;
    if (storage.getItem(key) === error.message || storage.getItem(chunkKey)) return false;
    storage.setItem(chunkKey, "1");
    storage.setItem(key, error.message);
  } catch {
    return false;
  }
  reload();
  return true;
}

// Vite can reject a preload before React's route error boundary sees it.
// Listen only for module-loading errors; never retry application actions.
export function observarFalhasModulo(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  recover: (error: Error) => boolean,
): () => void {
  const handler = (event: Event) => {
    const detail = event as Event & { payload?: unknown; reason?: unknown };
    const error = detail.payload ?? detail.reason;
    if (error instanceof Error && erroModuloDesatualizado(error) && recover(error)) {
      event.preventDefault();
    }
  };
  target.addEventListener("vite:preloadError", handler);
  target.addEventListener("unhandledrejection", handler);
  return () => {
    target.removeEventListener("vite:preloadError", handler);
    target.removeEventListener("unhandledrejection", handler);
  };
}