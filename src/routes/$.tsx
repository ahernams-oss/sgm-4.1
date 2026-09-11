import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

export const Route = createFileRoute("/$")({
  codeSplitGroupings: [],
  ssr: false,
  head: () => ({
    meta: [
      { title: "SGM 5.1 — Sistema de Gestão Multissistêmico" },
      {
        name: "description",
        content:
          "SGM 5.1: gestão de obras, engenharia, compras, RH, financeiro e licitações em um único sistema.",
      },
      { property: "og:title", content: "SGM 5.1" },
      {
        property: "og:description",
        content: "Sistema de gestão multissistêmico para obras, manutenção e administração.",
      },
    ],
  }),
  component: App,
});
