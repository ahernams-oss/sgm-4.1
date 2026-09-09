import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_INTERVAL = 300_000;

/**
 * Controla atualização (manual + automática) dos dashboards.
 * Sem `onRefresh`, invalida todas as queries em cache (recarrega os dados da tela).
 */
export function useDashboardRefresh(onRefresh?: () => void | Promise<void>, intervalMs = DEFAULT_INTERVAL) {
  const qc = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;


  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (cbRef.current) await cbRef.current();
      else await qc.invalidateQueries();
    } finally {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }
  }, [qc]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => { void refresh(); }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, intervalMs, refresh]);

  return { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh };
}
