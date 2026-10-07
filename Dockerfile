# syntax=docker/dockerfile:1
# SGM 4.1 (TanStack Start + Nitro) em contêiner Node.
#
# Etapa 1: bun instala e builda. NITRO_PRESET=node-server faz o Nitro gerar um servidor Node
#          em .output/ (fora do sandbox da Lovable a config respeita essa variável; dentro
#          dela a variável é ignorada, então os builds da Lovable continuam iguais).
# Etapa 2: imagem enxuta só com Node e a pasta .output.
#
# Build local:  docker build -t sgm .
# Rodar:        docker run -p 3000:3000 --env-file .env -e SUPABASE_SERVICE_ROLE_KEY=... sgm
# Detalhes e variáveis em DEPLOY.md.

FROM oven/bun:1 AS build
WORKDIR /app
ENV NITRO_PRESET=node-server \
    NODE_ENV=production \
    CI=true

# Dependências primeiro, para aproveitar o cache entre builds.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

# As variáveis VITE_* são embutidas no bundle na hora do build. O .env do repositório já
# traz os valores; estes ARGs só servem para sobrescrevê-los se necessário. Vazios são
# descartados para não anular o .env.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
RUN for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID; do \
      eval "val=\${$v}"; [ -z "$val" ] && unset "$v"; \
    done; \
    bun run build \
    && test -f .output/server/index.mjs \
    || { echo "ERRO: .output/server/index.mjs não foi gerado (o preset node-server não foi aplicado?)"; exit 1; }

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", ".output/server/index.mjs"]
