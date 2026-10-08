// Roda os testes das funções de servidor contra um Supabase falso em 127.0.0.1.
// Nada vai ao Supabase de produção: bloqueia-rede.mjs barra qualquer acesso fora de 127.0.0.1.
//
//   node src/lib/edge/__tests__/rodar.mjs           ponte e funções direto do código (src/)
//   node src/lib/edge/__tests__/rodar.mjs --build   os mesmos casos contra o servidor do build
//                                                   (.output/server/index.mjs, gere antes com
//                                                   NITRO_PRESET=node-server vite build)
//
// O esbuild (que já vem com o vite) junta o teste e o código de src/ num arquivo só;
// os pacotes de node_modules ficam de fora e são carregados normalmente.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../../../..");
const saida = join(raiz, "node_modules", ".cache", "sgm-testes", "autorizacao.test.mjs");
const bloqueio = pathToFileURL(join(aqui, "bloqueia-rede.mjs")).href;

const aliasArroba = {
  name: "alias-arroba",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) =>
      b.resolve(`./${args.path.slice(2)}`, { resolveDir: join(raiz, "src"), kind: args.kind }),
    );
  },
};

await build({
  entryPoints: [join(aqui, "autorizacao.test.ts")],
  outfile: saida,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  jsx: "automatic",
  plugins: [aliasArroba],
  logLevel: "warning",
});

const r = spawnSync(process.execPath, ["--import", bloqueio, saida], {
  stdio: "inherit",
  cwd: raiz,
  env: {
    ...process.env,
    SGM_TESTE_BLOQUEIO: bloqueio,
    SGM_TESTE_BUILD: process.argv.includes("--build")
      ? join(raiz, ".output", "server", "index.mjs")
      : "",
  },
});
process.exit(r.status ?? 1);
