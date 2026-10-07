// Carregado com `node --import` no teste e no servidor do build: o fetch só fala com
// 127.0.0.1, então nada chega ao Supabase de produção nem a outros serviços.
const original = globalThis.fetch;
globalThis.__redeBloqueada = [];

globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  if (url.hostname !== "127.0.0.1") {
    globalThis.__redeBloqueada.push(url.host);
    console.error(`[teste] rede bloqueada: ${url.host}`);
    throw new Error(`rede bloqueada no teste: ${url.host}`);
  }
  return original(input, init);
};
