import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Gate de ativação sob demanda para os Providers globais.
 *
 * Os Providers são montados uma única vez em App.tsx, mas suas queries só
 * disparam quando algum componente realmente consome o contexto (ou seja,
 * quando o hook `useXxx()` correspondente é montado). Isso evita dezenas de
 * requisições no carregamento inicial do app.
 */

const activated = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Usado dentro do Provider: retorna true quando o contexto passa a ser consumido. */
export function useProviderGate(key: string): boolean {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => activated.has(key),
    () => false,
  );
  return snapshot;
}

/** Usado dentro do hook `useXxx()`: marca o provider como ativo. */
export function useActivateProvider(key: string, enabled: boolean = true): void {
  const [, force] = useState(0);
  useEffect(() => {
    if (enabled && !activated.has(key)) {
      activated.add(key);
      emit();
      force((n) => n + 1);
    }
  }, [key, enabled]);
}


/** Ativa manualmente (uso raro: fora de componentes React). */
export function activateProvider(key: string): void {
  if (!activated.has(key)) {
    activated.add(key);
    emit();
  }
}

/**
 * Gate de carregamento por filtro (telas de alto volume).
 *
 * Enquanto a tela "dona" do gate estiver montada sem nenhum filtro selecionado,
 * a query principal do contexto correspondente fica desativada — nada é buscado
 * no banco. Ao selecionar qualquer filtro, o carregamento é liberado.
 */
const loadGates = new Map<string, boolean>(); // key -> satisfied (há filtro)

export function setLoadGate(key: string, satisfied: boolean): void {
  if (loadGates.get(key) !== satisfied) {
    loadGates.set(key, satisfied);
    emit();
  }
}

export function clearLoadGate(key: string): void {
  if (loadGates.delete(key)) emit();
}

export function isLoadAllowed(key: string): boolean {
  return loadGates.get(key) !== false;
}

/** Usado dentro do Provider: reage ao estado do gate. */
export function useLoadGateAllowed(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isLoadAllowed(key),
    () => true,
  );
}

/**
 * Usado na tela dona do gate, no topo do componente (antes dos hooks de dados).
 * Registro síncrono: garante que a query principal exija filtro a partir do
 * primeiro render, antes de qualquer hook de dados ativar o provider.
 * A liberação acontece via `setLoadGate` quando a tela aplica um filtro.
 */
export function ensureLoadGate(key: string): void {
  if (!loadGates.has(key)) loadGates.set(key, false);
}

/** Aplica o gate a um array de queries do `useQueries`, preservando os tipos. */
export function gateQueries<T extends readonly unknown[]>(queries: readonly [...T], enabled: boolean): [...T] {
  return (queries as readonly any[]).map((q) => ({ ...(q as object), enabled })) as unknown as [...T];
}
