import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SGM 5.1 — Sistema de Gestão" },
      {
        name: "description",
        content:
          "SGM 5.1: base do sistema de gestão, pronta para receber módulos de serviços, compras, estoque e pessoas.",
      },
      { property: "og:title", content: "SGM 5.1 — Sistema de Gestão" },
      {
        property: "og:description",
        content:
          "Base do SGM 5.1, pronta para receber os módulos de serviços, compras, estoque e pessoas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Projeto iniciado
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-foreground">
          SGM 5.1
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Estrutura criada e pronta. Aguardando as coordenadas para montar os
          módulos.
        </p>
      </div>
    </main>
  );
}
