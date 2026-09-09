import { useState, useEffect, useCallback } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

function storageKey(pageKey: string) {
  return `column-visibility-${pageKey}`;
}

/**
 * Reusable hook that persists per-user column visibility for a grid.
 * Persists in localStorage (per device/browser).
 */
export function useColumnVisibility(pageKey: string, columns: ColumnDef[]) {
  const defaultVisibility = useCallback(() => {
    const map: Record<string, boolean> = {};
    columns.forEach(c => {
      map[c.key] = c.defaultVisible !== false;
    });
    return map;
  }, [columns]);

  const [visibility, setVisibilityState] = useState<Record<string, boolean>>(defaultVisibility);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(pageKey));
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        const base = defaultVisibility();
        Object.keys(saved).forEach(k => {
          if (k in base) base[k] = !!saved[k];
        });
        setVisibilityState(base);
      }
    } catch {
      // ignore parse errors
    }
  }, [pageKey, defaultVisibility]);

  const setVisibility = useCallback(
    (newVisibility: Record<string, boolean>) => {
      setVisibilityState(newVisibility);
      try {
        localStorage.setItem(storageKey(pageKey), JSON.stringify(newVisibility));
      } catch {
        // ignore storage errors
      }
    },
    [pageKey]
  );

  const toggle = useCallback(
    (key: string) => {
      const next = { ...visibility, [key]: !visibility[key] };
      setVisibility(next);
    },
    [visibility, setVisibility]
  );

  const reset = useCallback(() => {
    setVisibility(defaultVisibility());
  }, [defaultVisibility, setVisibility]);

  return { visibility, setVisibility, toggle, reset };
}
