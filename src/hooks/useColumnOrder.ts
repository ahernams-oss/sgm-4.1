import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Reconcile a user's saved column order with the grid's defaults.
 * Keeps the saved order, drops columns that no longer exist, and inserts new
 * columns next to their default neighbours (not at the end of the list), so a
 * column added later still shows up where the screen defines it.
 */
export function reconcileColumnOrder(defaultKeys: string[], saved: string[]): string[] {
  const seen = new Set<string>();
  const filtered = saved.filter((k) => defaultKeys.includes(k) && !seen.has(k) && seen.add(k));
  const missing = defaultKeys.filter((k) => !filtered.includes(k));
  const result = [...filtered];
  missing.forEach((key) => {
    const defaultIdx = defaultKeys.indexOf(key);
    let anchor = -1;
    for (let i = defaultIdx - 1; i >= 0; i--) {
      const candidate = result.indexOf(defaultKeys[i]);
      if (candidate >= 0) { anchor = candidate; break; }
    }
    result.splice(anchor + 1, 0, key);
  });
  return result;
}

/**
 * Reusable hook that persists per-user column ordering for a grid.
 * Persists in `user_grid_column_prefs` table (one row per user/page).
 */
export function useColumnOrder(pageKey: string, defaultKeys: string[]) {
  const { usuarioLogado } = useAuth();
  const userId = usuarioLogado?.id || null;
  const [order, setOrder] = useState<string[]>(defaultKeys);
  const loadedRef = useRef(false);

  // Reconcile with defaults: keep saved order, drop missing, insert new in place
  const reconcile = useCallback(
    (saved: string[]) => reconcileColumnOrder(defaultKeys, saved),
    [defaultKeys]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_grid_column_prefs")
        .select("column_order")
        .eq("user_id", userId)
        .eq("page_key", pageKey)
        .maybeSingle();
      if (cancelled) return;
      if (data?.column_order && Array.isArray(data.column_order)) {
        setOrder(reconcile(data.column_order as string[]));
      } else {
        setOrder(defaultKeys);
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pageKey]);

  const saveOrder = useCallback(
    async (newOrder: string[]) => {
      setOrder(newOrder);
      if (!userId) return;
      await supabase
        .from("user_grid_column_prefs")
        .upsert(
          { user_id: userId, page_key: pageKey, column_order: newOrder },
          { onConflict: "user_id,page_key" }
        );
    },
    [userId, pageKey]
  );

  const resetOrder = useCallback(() => saveOrder(defaultKeys), [defaultKeys, saveOrder]);

  return { order, setOrder: saveOrder, resetOrder };
}
