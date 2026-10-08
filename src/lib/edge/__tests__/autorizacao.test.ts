// Testes da autorização por perfil nas funções de servidor (src/lib/edge/permissao.ts),
// passando pela ponte de verdade (src/routes/api/public/edge/$name.ts).
// Supabase falso em 127.0.0.1: Auth com JWKS (tokens ES256 assinados aqui), Admin API,
// Storage e um PostgREST em memória. Qualquer acesso fora de 127.0.0.1 é bloqueado.
// Rodar com: node src/lib/edge/__tests__/rodar.mjs [--build]
/* eslint-disable @typescript-eslint/no-explicit-any -- o Supabase falso lida com linhas e corpos sem tipo */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID, webcrypto } from "node:crypto";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------- rede: só 127.0.0.1
// bloqueia-rede.mjs (carregado com --import pelo rodar.mjs) troca o fetch e anota aqui
// cada tentativa de sair de 127.0.0.1.
const bloqueados: string[] = (globalThis as any).__redeBloqueada;
if (!Array.isArray(bloqueados)) throw new Error("Rode pelo rodar.mjs (falta o bloqueio de rede).");

// ---------------------------------------------------------------- chaves e tokens
const b64url = (b: ArrayBuffer | string) =>
  Buffer.from(typeof b === "string" ? b : new Uint8Array(b)).toString("base64url");

const ES256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const chaveProjeto = await webcrypto.subtle.generateKey(ES256, true, ["sign", "verify"]);
const chaveIntrusa = await webcrypto.subtle.generateKey(ES256, true, ["sign", "verify"]);
const jwkPublica = {
  ...(await webcrypto.subtle.exportKey("jwk", chaveProjeto.publicKey)),
  kid: "chave-teste",
  alg: "ES256",
  use: "sig",
};

async function assinar(payload: Record<string, unknown>, chave = chaveProjeto.privateKey) {
  const h = b64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "chave-teste" }));
  const p = b64url(JSON.stringify(payload));
  const sig = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    chave,
    new TextEncoder().encode(`${h}.${p}`),
  );
  return `${h}.${p}.${b64url(sig)}`;
}

function tokenDe(
  apelido: string,
  email: string | null,
  extra: Record<string, unknown> = {},
  chave?: CryptoKey,
) {
  const agora = Math.floor(Date.now() / 1000);
  return assinar(
    {
      sub: conta(apelido),
      email,
      role: "authenticated",
      aud: "authenticated",
      iat: agora,
      exp: agora + 3600,
      is_anonymous: false,
      ...extra,
    },
    chave,
  );
}

// ---------------------------------------------------------------- dados do SGM falso
type Linha = Record<string, any>;

// Contas de auth.users têm id UUID; aqui cada uma vem de um apelido ("a-dir" etc.).
const conta = (apelido: string) => {
  const h = createHash("md5").update(apelido).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const cargos = [
  { id: "c-dir", nome: "Diretor" },
  { id: "c-coord", nome: " Coordenador Técnico " },
  { id: "c-aux", nome: "Auxiliar Administrativo" },
];
const perfis = [
  {
    id: "p-comum",
    nome: "Comum",
    permissoes: { "ordem_servico.criar": true, "auditoria.visualizar": false },
  },
  {
    id: "p-usuarios",
    nome: "Admin de usuários",
    permissoes: {
      "usuarios.editar": true,
      "usuarios.resetar_senha": true,
      "usuarios.gerenciar_acessos": true,
    },
  },
  { id: "p-auditor", nome: "Auditor", permissoes: { "auditoria.visualizar": true } },
  { id: "p-medicoes", nome: "Medições", permissoes: { "medicoes.exportar_excel": true } },
  { id: "p-emp-ver", nome: "Empresa (ver)", permissoes: { "empresa.visualizar": true } },
  { id: "p-emp-editar", nome: "Empresa (editar)", permissoes: { "empresa.editar": true } },
  { id: "p-forn", nome: "Fornecedores", permissoes: { "fornecedores.criar": true } },
  { id: "p-os-excluir", nome: "Exclui OS", permissoes: { "ordem_servico.excluir": true } },
  // chaves parecidas que NÃO dão acesso
  {
    id: "p-quase",
    nome: "Quase",
    permissoes: { "auditoriax.ver": true, usuarios: false, "empresa.editar": false },
  },
];

function usuario(
  id: string,
  nome: string,
  email: string,
  auth: string | null,
  cargo: string,
  perfil: string | null,
): Linha {
  return {
    id,
    nome,
    email,
    auth_user_id: auth && conta(auth),
    cargo_id: cargo,
    perfil_acesso_id: perfil,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const usuarios: Linha[] = [
  usuario("u-dir", "Ana Diretora", "ana@lasant.com.br", "a-dir", "c-dir", null),
  usuario("u-coord", "Carlos Coordenador", "carlos@lasant.com.br", "a-coord", "c-coord", null),
  usuario("u-comum", "Bruno Comum", "bruno@lasant.com.br", "a-comum", "c-aux", "p-comum"),
  usuario("u-comum2", "Bia Comum", "bia@lasant.com.br", "a-comum2", "c-aux", "p-comum"),
  usuario("u-adminu", "Rita Usuários", "rita@lasant.com.br", "a-adminu", "c-aux", "p-usuarios"),
  usuario("u-auditor", "Otto Auditor", "otto@lasant.com.br", "a-auditor", "c-aux", "p-auditor"),
  usuario("u-medicoes", "Mara Medições", "mara@lasant.com.br", "a-medicoes", "c-aux", "p-medicoes"),
  usuario("u-empver", "Vera Empresa", "vera@lasant.com.br", "a-empver", "c-aux", "p-emp-ver"),
  usuario("u-empedit", "Edu Empresa", "edu@lasant.com.br", "a-empedit", "c-aux", "p-emp-editar"),
  usuario("u-forn", "Fábio Fornecedores", "fabio@lasant.com.br", "a-forn", "c-aux", "p-forn"),
  usuario("u-osdel", "Olga OS", "olga@lasant.com.br", "a-osdel", "c-aux", "p-os-excluir"),
  usuario("u-quase", "Quim Quase", "quim@lasant.com.br", "a-quase", "c-aux", "p-quase"),
  // sem vínculo: acha pelo e-mail (o _ não pode virar curinga e pegar a isca)
  usuario("u-semvinc", "João Sem Vínculo", "Joao_Silva@lasant.com.br", null, "c-aux", "p-comum"),
  usuario("u-isca", "Isca", "joaoXsilva@lasant.com.br", null, "c-dir", null),
  // vínculo com conta apagada: vale o e-mail
  usuario("u-velho", "Vítor Vínculo Velho", "vitor@lasant.com.br", "a-apagada", "c-aux", "p-comum"),
  // vínculo com outra conta que existe: e-mail igual não basta
  usuario("u-outro", "Olavo Outra Conta", "olavo@lasant.com.br", "a-olavo-viva", "c-dir", null),
];

const contasVivas = new Set<string>(
  [
    "a-dir",
    "a-coord",
    "a-comum",
    "a-comum2",
    "a-adminu",
    "a-auditor",
    "a-medicoes",
    "a-empver",
    "a-empedit",
    "a-forn",
    "a-osdel",
    "a-quase",
    "a-semvinc",
    "a-vitor-nova",
    "a-olavo-viva",
    "a-intrusa",
    "a-ninguem",
  ].map(conta),
);

const db: Record<string, Linha[]> = {
  cargos,
  perfis_acesso: perfis,
  usuarios,
  usuarios_credenciais: usuarios.map((u) => ({ usuario_id: u.id, senha: `hash-original-${u.id}` })),
  auditoria: [
    {
      id: "aud-1",
      created_at: "2026-10-01T10:00:00Z",
      usuario_id: "u-dir",
      modulo: "usuarios",
      acao: "update",
      dados_antes: {},
      dados_depois: {},
    },
  ],
  auditoria_historico: [],
  login_auditoria: [
    {
      id: "log-1",
      created_at: new Date().toISOString(),
      email: "ana@lasant.com.br",
      ip: "10.0.0.1",
      sucesso: true,
    },
  ],
  empresa_dados_bancarios: [
    {
      empresa_id: "emp-1",
      banco: "001",
      agencia: "1234",
      conta: "5678-9",
      tipo_conta: "corrente",
      chave_pix: "12.345.678/0001-90",
    },
  ],
  empresa_credenciais: [{ empresa_id: "emp-1", certificado_a1_senha: "senha-do-certificado" }],
  ordens_servico: [{ id: "os-1" }, { id: "os-2" }],
  mfa_otps: [],
  clientes_credenciais: [],
  email_send_log: [],
};

// ---------------------------------------------------------------- Supabase falso
const rotasInesperadas: string[] = [];

function padraoIlike(p: string): RegExp {
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) re += p[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%" || c === "*") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is");
}

function casa(v: any, expr: string): boolean {
  let neg = false;
  if (expr.startsWith("not.")) {
    neg = true;
    expr = expr.slice(4);
  }
  const i = expr.indexOf(".");
  const op = expr.slice(0, i);
  const val = expr.slice(i + 1);
  let ok: boolean;
  switch (op) {
    case "eq":
      ok = v != null && String(v) === val;
      break;
    case "neq":
      ok = String(v) !== val;
      break;
    case "is":
      ok = val === "null" ? v == null : String(v) === val;
      break;
    case "ilike":
      ok = v != null && padraoIlike(val).test(String(v));
      break;
    case "gte":
      ok = v != null && String(v) >= val;
      break;
    case "lte":
      ok = v != null && String(v) <= val;
      break;
    case "in":
      ok = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.replace(/^"|"$/g, ""))
        .includes(String(v));
      break;
    default:
      throw new Error(`operador ${op} não existe no PostgREST falso`);
  }
  return neg ? !ok : ok;
}

const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function filtrar(linhas: Linha[], q: URLSearchParams) {
  return linhas.filter((r) =>
    [...q].every(([col, expr]) => RESERVADOS.has(col) || casa(r[col], expr)),
  );
}

function projetar(r: Linha, select: string | null) {
  if (!select || select === "*") return { ...r };
  const out: Linha = {};
  for (const c of select.split(",")) out[c] = r[c] ?? null;
  return out;
}

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => ok(s));
  });
}

function responder(
  res: ServerResponse,
  status: number,
  corpo?: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(corpo === undefined ? "" : JSON.stringify(corpo));
}

async function postgrest(req: IncomingMessage, res: ServerResponse, url: URL) {
  const tabela = decodeURIComponent(url.pathname.replace("/rest/v1/", ""));
  const linhas = db[tabela];
  if (!linhas)
    return responder(res, 404, { code: "42P01", message: `relation "${tabela}" does not exist` });
  const q = url.searchParams;
  const prefer = String(req.headers["prefer"] ?? "");
  const representacao = prefer.includes("return=representation");

  if (req.method === "GET" || req.method === "HEAD") {
    let achadas = filtrar(linhas, q);
    const total = achadas.length;
    const ordem = q.get("order");
    if (ordem) {
      const [col, dir] = ordem.split(",")[0].split(".");
      achadas = [...achadas].sort(
        (a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1),
      );
    }
    const offset = Number(q.get("offset") ?? 0);
    const limit = q.has("limit") ? Number(q.get("limit")) : achadas.length;
    achadas = achadas.slice(offset, offset + limit);
    const headers: Record<string, string> = {};
    if (prefer.includes("count=exact"))
      headers["Content-Range"] = `${offset}-${offset + achadas.length - 1}/${total}`;
    if (req.method === "HEAD") return responder(res, 200, undefined, headers);
    return responder(
      res,
      200,
      achadas.map((r) => projetar(r, q.get("select"))),
      headers,
    );
  }

  const texto = await lerCorpo(req);
  if (req.method === "POST") {
    const corpo = JSON.parse(texto || "{}");
    const novas = Array.isArray(corpo) ? corpo : [corpo];
    const conflito = q.get("on_conflict");
    const gravadas: Linha[] = [];
    for (const n of novas) {
      const existente =
        prefer.includes("resolution=merge-duplicates") && conflito
          ? linhas.find((r) => conflito.split(",").every((k) => String(r[k]) === String(n[k])))
          : undefined;
      if (existente) {
        Object.assign(existente, n);
        gravadas.push(existente);
      } else {
        const linha = { id: randomUUID(), created_at: new Date().toISOString(), ...n };
        linhas.push(linha);
        gravadas.push(linha);
      }
    }
    return representacao ? responder(res, 201, gravadas) : responder(res, 201);
  }
  if (req.method === "PATCH") {
    const corpo = JSON.parse(texto || "{}");
    const achadas = filtrar(linhas, q);
    for (const r of achadas) Object.assign(r, corpo);
    return representacao ? responder(res, 200, achadas) : responder(res, 204);
  }
  if (req.method === "DELETE") {
    const achadas = new Set(filtrar(linhas, q));
    db[tabela] = linhas.filter((r) => !achadas.has(r));
    return representacao ? responder(res, 200, [...achadas]) : responder(res, 204);
  }
  return responder(res, 405, { message: "método não suportado" });
}

let idasAoJwks = 0;

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  try {
    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      idasAoJwks++;
      return responder(res, 200, { keys: [jwkPublica] });
    }
    const admin = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
    if (admin && req.method === "GET") {
      const id = decodeURIComponent(admin[1]);
      if (contasVivas.has(id))
        return responder(res, 200, { id, aud: "authenticated", role: "authenticated" });
      return responder(res, 404, {
        code: 404,
        error_code: "user_not_found",
        msg: "User not found",
      });
    }
    if (url.pathname.startsWith("/rest/v1/")) return await postgrest(req, res, url);
    if (url.pathname.startsWith("/storage/v1/")) {
      if (req.method === "GET")
        return responder(res, 404, {
          statusCode: "404",
          error: "not_found",
          message: "Object not found",
        });
      await lerCorpo(req);
      return responder(res, 200, []);
    }
    rotasInesperadas.push(`${req.method} ${url.pathname}`);
    return responder(res, 404, { message: "rota inexistente no Supabase falso" });
  } catch (e) {
    console.error("[supabase falso]", e);
    return responder(res, 500, { message: String(e) });
  }
});
await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
const porta = (servidor.address() as AddressInfo).port;

// ---------------------------------------------------------------- ambiente do servidor
const PUBLICA = "sb_publishable_chave-de-teste";
const SERVICO = "chave-service-role-de-teste";
process.env["SUPABASE_URL"] = `http://127.0.0.1:${porta}`;
process.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLICA;
process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICO;
process.env["CRON_SECRET"] = "segredo-do-cron-de-teste";
delete process.env["SUPABASE_ANON_KEY"];
delete process.env["RESEND_API_KEY"];
delete process.env["EMAIL_FROM"];

// ---------------------------------------------------------------- servidor do build (--build)
// Mesmo ambiente, só com o necessário (nada do ambiente de quem roda o teste vaza para ele).
const arquivoBuild = process.env["SGM_TESTE_BUILD"];
let baseBuild = "";
let app: ChildProcess | undefined;
if (arquivoBuild) {
  const livre = createServer();
  await new Promise<void>((ok) => livre.listen(0, "127.0.0.1", ok));
  const portaApp = (livre.address() as AddressInfo).port;
  await new Promise((ok) => livre.close(ok));

  app = spawn(process.execPath, ["--import", process.env["SGM_TESTE_BLOQUEIO"]!, arquivoBuild], {
    env: {
      PATH: process.env["PATH"],
      SystemRoot: process.env["SystemRoot"],
      TEMP: process.env["TEMP"],
      TMP: process.env["TMP"],
      NODE_ENV: "production",
      PORT: String(portaApp),
      HOST: "127.0.0.1",
      SUPABASE_URL: process.env["SUPABASE_URL"],
      SUPABASE_PUBLISHABLE_KEY: PUBLICA,
      SUPABASE_SERVICE_ROLE_KEY: SERVICO,
      CRON_SECRET: process.env["CRON_SECRET"],
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const repassar = (d: Buffer) => {
    const texto = String(d);
    for (const m of texto.matchAll(/rede bloqueada: (\S+)/g)) bloqueados.push(m[1]);
    process.stdout.write(texto.replace(/^(?=.)/gm, "[build] "));
  };
  app.stdout!.on("data", repassar);
  app.stderr!.on("data", repassar);
  baseBuild = `http://127.0.0.1:${portaApp}`;
  for (let i = 0; ; i++) {
    try {
      await fetch(`${baseBuild}/api/public/edge/nao-existe`);
      break;
    } catch {
      if (i > 150) throw new Error("O servidor do build não subiu.");
      await new Promise((ok) => setTimeout(ok, 200));
    }
  }
}
console.log(
  baseBuild
    ? `Contra o servidor do build (${arquivoBuild})`
    : "Ponte e funções direto do código (src/)",
);

// Só agora carrega a ponte (os clientes do Supabase leem o ambiente na primeira chamada).
const { Route } = await import("@/routes/api/public/edge/$name");
const ponte = (Route as any).options.server.handlers.POST as (a: {
  request: Request;
  params: { name: string };
}) => Promise<Response>;
const regra = await import("@/lib/permissoes");

// ---------------------------------------------------------------- chamadas
type Chamada = {
  token?: string | null;
  body?: unknown;
  query?: string;
  method?: string;
  headers?: Record<string, string>;
};

// Igual ao supabase.functions.invoke do front: apikey publishable e Bearer da sessão (ou a publishable).
async function chamar(
  nome: string,
  { token, body, query = "", method, headers = {} }: Chamada = {},
) {
  const h = new Headers(headers);
  if (!h.has("apikey")) h.set("apikey", PUBLICA);
  if (!h.has("authorization")) h.set("authorization", `Bearer ${token ?? PUBLICA}`);
  let corpo: BodyInit | undefined;
  if (body instanceof FormData) corpo = body;
  else if (body !== undefined) {
    h.set("content-type", "application/json");
    corpo = JSON.stringify(body);
  }
  const request = new Request(`http://sgm.test/api/public/edge/${nome}${query}`, {
    method: method ?? (corpo !== undefined ? "POST" : "GET"),
    headers: h,
    body: corpo,
  });
  const resposta = baseBuild
    ? await fetch(`${baseBuild}/api/public/edge/${nome}${query}`, {
        method: request.method,
        headers: h,
        body: corpo,
      })
    : await ponte({ request, params: { name: nome } });
  const texto = await resposta.text();
  let data: any = texto;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    /* texto puro */
  }
  return { status: resposta.status, data };
}

const servico = { headers: { apikey: SERVICO, authorization: `Bearer ${SERVICO}` } };

const T = {
  dir: await tokenDe("a-dir", "ana@lasant.com.br"),
  coord: await tokenDe("a-coord", "carlos@lasant.com.br"),
  comum: await tokenDe("a-comum", "bruno@lasant.com.br"),
  adminu: await tokenDe("a-adminu", "rita@lasant.com.br"),
  auditor: await tokenDe("a-auditor", "otto@lasant.com.br"),
  medicoes: await tokenDe("a-medicoes", "mara@lasant.com.br"),
  empver: await tokenDe("a-empver", "vera@lasant.com.br"),
  empedit: await tokenDe("a-empedit", "edu@lasant.com.br"),
  forn: await tokenDe("a-forn", "fabio@lasant.com.br"),
  osdel: await tokenDe("a-osdel", "olga@lasant.com.br"),
  quase: await tokenDe("a-quase", "quim@lasant.com.br"),
  semvinc: await tokenDe("a-semvinc", "joao_silva@lasant.com.br"),
  vitor: await tokenDe("a-vitor-nova", "vitor@lasant.com.br"),
  intrusa: await tokenDe("a-intrusa", "olavo@lasant.com.br"),
  ninguem: await tokenDe("a-ninguem", "ninguem@lasant.com.br"),
  forjado: await tokenDe("a-dir", "ana@lasant.com.br", {}, chaveIntrusa.privateKey),
  vencido: await tokenDe("a-dir", "ana@lasant.com.br", { exp: Math.floor(Date.now() / 1000) - 60 }),
};

const senhaDe = (id: string) =>
  db.usuarios_credenciais.find((c) => c.usuario_id === id)?.senha as string;
const SENHA_BOA = "NovaSenha#2026";

// ---------------------------------------------------------------- mini runner
let falhas = 0;
let total = 0;
async function caso(nome: string, fn: () => Promise<void> | void) {
  total++;
  try {
    await fn();
    console.log(`  ok  ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`  XX  ${nome}\n        ${(e as Error).message}`);
  }
}
function confere(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function status(r: { status: number; data: any }, esperado: number) {
  confere(
    r.status === esperado,
    `esperava ${esperado}, veio ${r.status}: ${JSON.stringify(r.data)}`,
  );
}

// ================================================================ regra (front = servidor)
console.log("\nRegra de permissão (src/lib/permissoes.ts)");
await caso(
  "cargos de acesso total iguais aos do front, sem diferenciar maiúsculas e espaços",
  () => {
    for (const c of [
      "Diretor Geral Lasant",
      " Gerente Executivo  Lasant ",
      "Coordenador Técnico Lasant",
      "coordenador tecnico lasant",
      "COORDENADOR ADMINISTRATIVO LASANT",
    ])
      confere(regra.cargoTemAcessoTotal(c), `${c} deveria ter acesso total`);
    for (const c of ["Diretor", "Gerente Executivo", "Coordenador Técnico", "Coordenador Administrativo",
      "Coordenador de Departamento", "Gerente", "Coordenador", "Auxiliar Administrativo", "", null, undefined])
      confere(!regra.cargoTemAcessoTotal(c), `${c} não deveria ter acesso total`);
  },
);
await caso("tem(): só a chave exata e verdadeira", () => {
  const p = { "usuarios.editar": true, "usuarios.excluir": false };
  confere(regra.temPermissao(false, p, "usuarios.editar"), "usuarios.editar");
  confere(!regra.temPermissao(false, p, "usuarios.excluir"), "chave false");
  confere(!regra.temPermissao(false, p, "usuarios"), "módulo não é ação");
  confere(regra.temPermissao(true, {}, "qualquer.coisa"), "acesso total libera tudo");
});
await caso("temModulo(): prefixo com ponto, não pedaço do nome", () => {
  confere(
    regra.temPermissaoNoModulo(false, { "auditoria.visualizar": true }, "auditoria"),
    "subchave",
  );
  confere(
    !regra.temPermissaoNoModulo(false, { "auditoriax.ver": true }, "auditoria"),
    "auditoriax não é auditoria",
  );
  confere(
    !regra.temPermissaoNoModulo(false, { "auditoria.visualizar": false }, "auditoria"),
    "subchave false",
  );
});

// ================================================================ ponte (PR #1 continua igual)
console.log("\nPonte /api/public/edge (continua como no PR #1)");
await caso("sem sessão (só a chave publishable) → 401", async () =>
  status(await chamar("audit-read", { body: {} }), 401),
);
await caso("JWT assinado por outra chave → 401", async () =>
  status(await chamar("audit-read", { token: T.forjado, body: {} }), 401),
);
await caso("JWT vencido → 401", async () =>
  status(await chamar("audit-read", { token: T.vencido, body: {} }), 401),
);
await caso("rotina sem x-cron-secret, mesmo com JWT de Diretor → 401", async () =>
  status(await chamar("check-parcelas-vencimento", { token: T.dir, body: {} }), 401),
);

// ================================================================ quem é o usuário
console.log("\nQuem é o usuário do SGM por trás do JWT");
await caso("sem vínculo: acha pelo e-mail exato (com _) e não pela isca", async () => {
  const r = await chamar("auth-set-password", {
    token: T.semvinc,
    body: { userId: "u-semvinc", novaSenha: SENHA_BOA },
  });
  status(r, 200);
  confere(senhaDe("u-semvinc").startsWith("$2"), "senha do u-semvinc não foi gravada");
  confere(senhaDe("u-isca") === "hash-original-u-isca", "mexeu na isca");
});
await caso("sem vínculo pelo e-mail: não ganha as permissões da isca (Diretor)", async () =>
  status(await chamar("audit-read", { token: T.semvinc, body: {} }), 403),
);
await caso("vínculo com conta apagada: vale o e-mail", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.vitor,
      body: { userId: "u-velho", novaSenha: SENHA_BOA },
    }),
    200,
  ),
);
await caso("e-mail igual ao de usuário ligado a OUTRA conta viva → 403", async () => {
  const r = await chamar("auth-set-password", {
    token: T.intrusa,
    body: { userId: "u-outro", novaSenha: SENHA_BOA },
  });
  status(r, 403);
  confere(senhaDe("u-outro") === "hash-original-u-outro", "trocou a senha");
});
await caso("conta de login sem usuário no SGM → 403", async () =>
  status(await chamar("audit-read", { token: T.ninguem, body: {} }), 403),
);

// ================================================================ auth-set-password
console.log("\nauth-set-password");
await caso("comum troca a própria senha → 200", async () => {
  status(
    await chamar("auth-set-password", {
      token: T.comum,
      body: { userId: "u-comum", novaSenha: SENHA_BOA },
    }),
    200,
  );
  confere(senhaDe("u-comum").startsWith("$2"), "não gravou hash bcrypt");
});
await caso(
  "comum, própria senha fraca com skipPolicy → 400 (a política vale para a própria)",
  async () =>
    status(
      await chamar("auth-set-password", {
        token: T.comum,
        body: { userId: "u-comum", novaSenha: "123", skipPolicy: true },
      }),
      400,
    ),
);
await caso("comum troca a senha da Diretora → 403 e a senha fica igual", async () => {
  status(
    await chamar("auth-set-password", {
      token: T.comum,
      body: { userId: "u-dir", novaSenha: SENHA_BOA },
    }),
    403,
  );
  confere(senhaDe("u-dir") === "hash-original-u-dir", "trocou a senha da Diretora");
});
await caso("comum troca a senha de outro comum → 403", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.comum,
      body: { userId: "u-comum2", novaSenha: SENHA_BOA },
    }),
    403,
  ),
);
await caso("perfil com chaves parecidas (usuarios: false) → 403", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.quase,
      body: { userId: "u-comum2", novaSenha: SENHA_BOA },
    }),
    403,
  ),
);
await caso("admin de usuários troca a senha de um comum → 200", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.adminu,
      body: { userId: "u-comum2", novaSenha: SENHA_BOA },
    }),
    200,
  ),
);
await caso("admin de usuários pode usar skipPolicy (senha temporária) → 200", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.adminu,
      body: { userId: "u-comum2", novaSenha: "temp", skipPolicy: true },
    }),
    200,
  ),
);
await caso("admin de usuários (sem acesso total) troca a senha da Diretora → 403", async () => {
  status(
    await chamar("auth-set-password", {
      token: T.adminu,
      body: { userId: "u-dir", novaSenha: SENHA_BOA },
    }),
    403,
  );
  confere(senhaDe("u-dir") === "hash-original-u-dir", "trocou a senha da Diretora");
});
await caso("admin de usuários, userId inexistente → 404", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.adminu,
      body: { userId: "nao-existe", novaSenha: SENHA_BOA },
    }),
    404,
  ),
);
await caso("Coordenador Técnico (acesso total) troca a senha da Diretora → 200", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.coord,
      body: { userId: "u-dir", novaSenha: SENHA_BOA },
    }),
    200,
  ),
);
await caso("Diretora troca a própria senha → 200", async () =>
  status(
    await chamar("auth-set-password", {
      token: T.dir,
      body: { userId: "u-dir", novaSenha: SENHA_BOA },
    }),
    200,
  ),
);
await caso("service role troca qualquer senha → 200", async () =>
  status(
    await chamar("auth-set-password", {
      ...servico,
      body: { userId: "u-coord", novaSenha: SENHA_BOA },
    }),
    200,
  ),
);

// ================================================================ auditoria
console.log("\naudit-read / audit-write / admin-login-audit");
await caso("audit-read: comum → 403", async () =>
  status(await chamar("audit-read", { token: T.comum, body: {} }), 403),
);
await caso("audit-read: perfil com auditoria.visualizar → 200 com a lista", async () => {
  const r = await chamar("audit-read", { token: T.auditor, body: {} });
  status(r, 200);
  confere(r.data?.ok && r.data.total === 1, JSON.stringify(r.data));
});
await caso("audit-read: Diretora → 200", async () =>
  status(await chamar("audit-read", { token: T.dir, body: { id: "aud-1" } }), 200),
);
await caso(
  "audit-write: comum tentando gravar em nome da Diretora → grava como ele mesmo",
  async () => {
    const r = await chamar("audit-write", {
      token: T.comum,
      body: {
        usuario_id: "u-dir",
        usuario_nome: "Ana Diretora",
        usuario_email: "ana@lasant.com.br",
        modulo: "usuarios",
        acao: "delete",
      },
    });
    status(r, 200);
    const ultima = db.auditoria[db.auditoria.length - 1];
    confere(
      ultima.usuario_id === "u-comum" &&
        ultima.usuario_nome === "Bruno Comum" &&
        ultima.usuario_email === "bruno@lasant.com.br",
      JSON.stringify(ultima),
    );
  },
);
await caso("audit-write: service role informa o usuário livremente", async () => {
  status(
    await chamar("audit-write", {
      ...servico,
      body: { usuario_id: "u-dir", usuario_nome: "Rotina", modulo: "x", acao: "insert" },
    }),
    200,
  );
  confere(db.auditoria[db.auditoria.length - 1].usuario_nome === "Rotina", "não manteve o corpo");
});
await caso(
  "audit-write: conta sem usuário no SGM → grava com o e-mail da conta, sem usuario_id",
  async () => {
    status(
      await chamar("audit-write", {
        token: T.ninguem,
        body: { usuario_id: "u-dir", usuario_nome: "Ana", modulo: "x", acao: "update" },
      }),
      200,
    );
    const ultima = db.auditoria[db.auditoria.length - 1];
    confere(
      ultima.usuario_id === null && ultima.usuario_email === "ninguem@lasant.com.br",
      JSON.stringify(ultima),
    );
  },
);
await caso("admin-login-audit: comum → 403", async () =>
  status(await chamar("admin-login-audit", { token: T.comum, body: {} }), 403),
);
await caso("admin-login-audit: usuarios.gerenciar_acessos → 200", async () =>
  status(await chamar("admin-login-audit", { token: T.adminu, body: { dias: 7 } }), 200),
);

// ================================================================ empresa
console.log("\nempresa-dados-bancarios / empresa-certificado-a1 / validar-certificado-a1");
const getBanco = (token: string) =>
  chamar("empresa-dados-bancarios", { token, query: "?action=get&empresaId=emp-1", method: "GET" });
const salvarBanco = (token: string) =>
  chamar("empresa-dados-bancarios", {
    token,
    query: "?action=save",
    body: { empresaId: "emp-1", banco: "999", agencia: "0", conta: "0" },
  });
await caso("dados bancários: comum lê → 403", async () => status(await getBanco(T.comum), 403));
await caso("dados bancários: Medições lê (planilha de pagamento) → 200", async () => {
  const r = await getBanco(T.medicoes);
  status(r, 200);
  confere(r.data?.dados?.agencia === "1234", JSON.stringify(r.data));
});
await caso("dados bancários: empresa.visualizar lê → 200", async () =>
  status(await getBanco(T.empver), 200),
);
await caso("dados bancários: Medições grava → 403 e nada muda", async () => {
  status(await salvarBanco(T.medicoes), 403);
  confere(db.empresa_dados_bancarios[0].banco === "001", "gravou");
});
await caso("dados bancários: empresa.visualizar grava → 403", async () =>
  status(await salvarBanco(T.empver), 403),
);
await caso("dados bancários: empresa.editar grava → 200", async () => {
  status(await salvarBanco(T.empedit), 200);
  confere(db.empresa_dados_bancarios[0].banco === "999", "não gravou");
});
await caso("certificado A1: comum remove → 403 e a senha do certificado fica", async () => {
  status(
    await chamar("empresa-certificado-a1", {
      token: T.comum,
      query: "?action=remove",
      body: { empresaId: "emp-1", path: "emp-1/cert.pfx" },
    }),
    403,
  );
  confere(db.empresa_credenciais.length === 1, "apagou a credencial");
});
await caso("certificado A1: empresa.editar grava a senha → 200", async () =>
  status(
    await chamar("empresa-certificado-a1", {
      token: T.empedit,
      query: "?action=set-senha",
      body: { empresaId: "emp-1", senha: "nova" },
    }),
    200,
  ),
);
await caso("validar certificado: comum → 403", async () =>
  status(
    await chamar("validar-certificado-a1", {
      token: T.comum,
      body: { storagePath: "emp-1/cert.pfx", senha: "x" },
    }),
    403,
  ),
);
await caso(
  "validar certificado: empresa.editar passa (e esbarra no arquivo que não existe) → 400",
  async () => {
    const r = await chamar("validar-certificado-a1", {
      token: T.empedit,
      body: { storagePath: "emp-1/cert.pfx", senha: "x" },
    });
    status(r, 400);
    confere(String(r.data?.error).includes("baixar o certificado"), JSON.stringify(r.data));
  },
);

// ================================================================ senhas de terceiros
console.log("\nsend-email-senha-temporaria / fornecedor-set-senha / migrate-users-to-auth");
const emailSenha = {
  recipientEmail: "alguem@exemplo.com",
  templateData: { nomeUsuario: "X", senhaTemporaria: "Y" },
};
await caso("e-mail de senha temporária: comum → 403", async () =>
  status(await chamar("send-email-senha-temporaria", { token: T.comum, body: emailSenha }), 403),
);
await caso(
  "e-mail de senha temporária: usuarios.resetar_senha passa (e para no envio, sem Resend no teste) → 500",
  async () =>
    status(await chamar("send-email-senha-temporaria", { token: T.adminu, body: emailSenha }), 500),
);
await caso("e-mail de senha temporária: módulo Fornecedores passa → 500 no envio", async () =>
  status(await chamar("send-email-senha-temporaria", { token: T.forn, body: emailSenha }), 500),
);
await caso("senha do portal do fornecedor: comum → 403", async () => {
  status(
    await chamar("fornecedor-set-senha", { token: T.comum, body: { fornecedorId: "f-1" } }),
    403,
  );
  confere(db.clientes_credenciais.length === 0, "gravou");
});
await caso("senha do portal do fornecedor: módulo Fornecedores → 200", async () => {
  const r = await chamar("fornecedor-set-senha", { token: T.forn, body: { fornecedorId: "f-1" } });
  status(r, 200);
  confere(
    typeof r.data?.senha === "string" && db.clientes_credenciais.length === 1,
    JSON.stringify(r.data),
  );
});
await caso("migração de contas: admin de usuários (sem acesso total) → 403", async () =>
  status(
    await chamar("migrate-users-to-auth", { token: T.adminu, body: { mode: "preview" } }),
    403,
  ),
);
await caso("migração de contas: Diretora, modo preview → 200", async () => {
  const r = await chamar("migrate-users-to-auth", { token: T.dir, body: { mode: "preview" } });
  status(r, 200);
  confere(r.data?.pending === 2, JSON.stringify(r.data));
});
await caso("migração de contas: service role, modo preview → 200", async () =>
  status(await chamar("migrate-users-to-auth", { ...servico, body: { mode: "preview" } }), 200),
);

// ================================================================ ações em nome de alguém
console.log("\ndelete-ordem-servico / códigos de confirmação");
await caso("excluir OS: comum mandando o userId da Diretora → 403 e a OS fica", async () => {
  status(
    await chamar("delete-ordem-servico", {
      token: T.comum,
      body: { userId: "u-dir", osId: "os-1" },
    }),
    403,
  );
  confere(
    db.ordens_servico.some((o) => o.id === "os-1"),
    "apagou a OS",
  );
});
await caso("excluir OS: perfil com ordem_servico.excluir → 200 e a OS sai", async () => {
  status(
    await chamar("delete-ordem-servico", {
      token: T.osdel,
      body: { userId: "u-osdel", osId: "os-1" },
    }),
    200,
  );
  confere(!db.ordens_servico.some((o) => o.id === "os-1"), "não apagou");
});
await caso("excluir OS: Coordenador Técnico (acesso total, antes ficava de fora) → 200", async () =>
  status(
    await chamar("delete-ordem-servico", {
      token: T.coord,
      body: { userId: "u-coord", osId: "os-2" },
    }),
    200,
  ),
);
await caso("código de aprovação (WhatsApp): pedir para outra pessoa → 403", async () =>
  status(
    await chamar("mfa-send-otp", {
      token: T.comum,
      body: { usuario_id: "u-dir", purpose: "aprovacao_lote_cotacoes" },
    }),
    403,
  ),
);
await caso("código de aprovação: conferir o de outra pessoa → 403", async () =>
  status(
    await chamar("mfa-verify-otp", {
      token: T.comum,
      body: { usuario_id: "u-dir", purpose: "aprovacao_lote_cotacoes", code: "123456" },
    }),
    403,
  ),
);
await caso("código de aprovação: conferir o próprio → passa (não há código pendente)", async () => {
  const r = await chamar("mfa-verify-otp", {
    token: T.comum,
    body: { usuario_id: "u-comum", purpose: "aprovacao_lote_cotacoes", code: "123456" },
  });
  status(r, 200);
  confere(
    r.data?.success === false && String(r.data?.error).includes("Nenhum código"),
    JSON.stringify(r.data),
  );
});
await caso("assinatura eletrônica: pedir código para outra pessoa → 403", async () =>
  status(
    await chamar("assinatura-otp", {
      token: T.comum,
      body: { action: "send", usuario_id: "u-dir", purpose: "assinatura:os:1:executante" },
    }),
    403,
  ),
);
await caso(
  "assinatura eletrônica: conferir o próprio → passa (não há código pendente)",
  async () => {
    const r = await chamar("assinatura-otp", {
      token: T.comum,
      body: {
        action: "verify",
        usuario_id: "u-comum",
        purpose: "assinatura:os:1:executante",
        code: "1",
      },
    });
    status(r, 200);
    confere(String(r.data?.error).includes("Nenhum código"), JSON.stringify(r.data));
  },
);

// ================================================================ fim
await caso("nada saiu de 127.0.0.1", () =>
  confere(bloqueados.length === 0, `tentou acessar: ${bloqueados.join(", ")}`),
);
await caso("o JWKS foi buscado uma vez só (cache do auth-js)", () =>
  confere(idasAoJwks === 1, `${idasAoJwks} idas`),
);

app?.kill();
servidor.close();
if (rotasInesperadas.length)
  console.log(
    `\nRotas que o Supabase falso não conhece: ${[...new Set(rotasInesperadas)].join(", ")}`,
  );
console.log(`\n${total - falhas}/${total} casos passaram`);
process.exit(falhas ? 1 : 0);
