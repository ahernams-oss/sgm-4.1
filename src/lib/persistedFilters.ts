import { useEffect } from "react";

export function loadPersistedFilters<T = Record<string, any>>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function usePersistFilters<T>(key: string, values: T) {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, JSON.stringify(values)]);
}
