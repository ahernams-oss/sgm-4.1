// Utilitários para detectar cadastros duplicados por nome/código
// - normalize: remove acentos, pontuação, colapsa espaços e passa para minúsculas
// - similarity: 0..1 baseado em Levenshtein
// - findDuplicates: encontra registros idênticos ou semelhantes em uma lista

export function normalize(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  const max = Math.max(na.length, nb.length);
  if (!max) return 1;
  return 1 - levenshtein(na, nb) / max;
}

export interface DuplicateMatch<T> {
  item: T;
  kind: "exato" | "similar";
  campo: "nome" | "codigo";
  score: number; // 1 = exato
}

export interface FindDuplicateOptions<T> {
  nome: (r: T) => string;
  codigo?: (r: T) => string;
  ignoreId?: (r: T) => boolean;
  threshold?: number; // similaridade mínima para "similar" (default 0.88)
}

export function findDuplicates<T>(
  candidato: { nome: string; codigo?: string },
  lista: T[],
  opts: FindDuplicateOptions<T>
): DuplicateMatch<T>[] {
  const threshold = opts.threshold ?? 0.88;
  const nomeCand = normalize(candidato.nome);
  const codCand = normalize(candidato.codigo ?? "");
  const out: DuplicateMatch<T>[] = [];
  for (const r of lista) {
    if (opts.ignoreId?.(r)) continue;
    const nomeR = normalize(opts.nome(r));
    const codR = normalize(opts.codigo?.(r) ?? "");

    if (codCand && codR && codCand === codR) {
      out.push({ item: r, kind: "exato", campo: "codigo", score: 1 });
      continue;
    }
    if (nomeCand && nomeR && nomeCand === nomeR) {
      out.push({ item: r, kind: "exato", campo: "nome", score: 1 });
      continue;
    }
    if (nomeCand && nomeR) {
      const s = similarity(nomeCand, nomeR);
      if (s >= threshold) out.push({ item: r, kind: "similar", campo: "nome", score: s });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// Encontra pares de duplicidade dentro da própria lista (auditoria completa)
export function scanDuplicates<T extends { id: string }>(
  lista: T[],
  opts: FindDuplicateOptions<T>
): Array<{ a: T; b: T; kind: "exato" | "similar"; campo: "nome" | "codigo"; score: number }> {
  const threshold = opts.threshold ?? 0.88;
  const out: Array<{ a: T; b: T; kind: "exato" | "similar"; campo: "nome" | "codigo"; score: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      const na = normalize(opts.nome(a));
      const nb = normalize(opts.nome(b));
      const ca = normalize(opts.codigo?.(a) ?? "");
      const cb = normalize(opts.codigo?.(b) ?? "");
      if (ca && cb && ca === cb) { out.push({ a, b, kind: "exato", campo: "codigo", score: 1 }); seen.add(key); continue; }
      if (na && nb && na === nb) { out.push({ a, b, kind: "exato", campo: "nome", score: 1 }); seen.add(key); continue; }
      if (na && nb) {
        const s = similarity(na, nb);
        if (s >= threshold) { out.push({ a, b, kind: "similar", campo: "nome", score: s }); seen.add(key); }
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ============================================================
// Higher-level helpers to unify usage across cadastros
// ============================================================

export type DuplicateEvaluation<T> =
  | { status: "ok"; exact?: undefined; similar: DuplicateMatch<T>[] }
  | { status: "exact"; exact: DuplicateMatch<T>; similar: DuplicateMatch<T>[] }
  | { status: "similar"; exact?: undefined; similar: DuplicateMatch<T>[] };

/**
 * Avalia duplicidades de um candidato contra uma lista.
 * Retorna status "exact" (bloquear), "similar" (confirmar) ou "ok".
 */
export function evaluateDuplicates<T>(
  candidato: { nome: string; codigo?: string },
  lista: T[],
  opts: FindDuplicateOptions<T>
): DuplicateEvaluation<T> {
  const matches = findDuplicates(candidato, lista, opts);
  const exact = matches.find((m) => m.kind === "exato");
  if (exact) return { status: "exact", exact, similar: matches };
  if (matches.length) return { status: "similar", similar: matches };
  return { status: "ok", similar: [] };
}

export interface GuardDuplicatesArgs<T> {
  candidate: { nome: string; codigo?: string };
  list: T[];
  options: FindDuplicateOptions<T>;
  onExact: (match: DuplicateMatch<T>) => void;
  onSimilar: (matches: DuplicateMatch<T>[]) => void;
  onOk: () => void;
}

/**
 * Fluxo padrão de "salvar com checagem de duplicidade":
 *  - se houver exato → onExact (mostra erro/bloqueio)
 *  - se houver similar → onSimilar (abre confirmação)
 *  - caso contrário → onOk (persiste)
 */
export function guardDuplicates<T>(args: GuardDuplicatesArgs<T>): void {
  const r = evaluateDuplicates(args.candidate, args.list, args.options);
  if (r.status === "exact") return args.onExact(r.exact);
  if (r.status === "similar") return args.onSimilar(r.similar);
  return args.onOk();
}

export interface GroupedScanInput<T> {
  contexto: string;
  items: T[];
}

export interface GroupedDuplicatePair<T> {
  a: T;
  b: T;
  kind: "exato" | "similar";
  campo: "nome" | "codigo";
  score: number;
  contexto: string;
}

/**
 * Executa scanDuplicates em múltiplos escopos e devolve pares
 * anotados com o "contexto" de origem (ex.: nome do grupo pai).
 */
export function scanDuplicatesGrouped<T extends { id: string }>(
  groups: GroupedScanInput<T>[],
  opts: FindDuplicateOptions<T>
): GroupedDuplicatePair<T>[] {
  const out: GroupedDuplicatePair<T>[] = [];
  for (const g of groups) {
    const pares = scanDuplicates(g.items, opts);
    for (const p of pares) out.push({ ...p, contexto: g.contexto });
  }
  return out;
}
