import { createContext, type Context } from "react";

// Mantém a mesma identidade de um contexto quando o código é recarregado na
// pré-visualização; sem isso a tela perde o Provider e fica em branco.
const escopo = globalThis as typeof globalThis & { __sgmContextos?: Map<string, Context<unknown>> };

export function contextoEstavel<T>(chave: string, valorPadrao: T): Context<T> {
  const mapa = (escopo.__sgmContextos ??= new Map());
  let ctx = mapa.get(chave) as Context<T> | undefined;
  if (!ctx) { ctx = createContext<T>(valorPadrao); mapa.set(chave, ctx as Context<unknown>); }
  return ctx;
}
