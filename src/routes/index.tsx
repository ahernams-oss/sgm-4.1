import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

export const Route = createFileRoute("/")({
  codeSplitGroupings: [],
  ssr: false,
  head: () => ({
    meta: [
      { title: "SGM 4.1 - Sistema de Gestão Lasant" },
      {
        name: "description",
        content:
          "SGM 4.1 - Sistema de Gestão Lasant: gestão de obras, engenharia, compras, RH, financeiro e licitações em um único sistema.",
      },
      { property: "og:title", content: "SGM 4.1 - Sistema de Gestão Lasant" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "SGM 4.1 - Sistema de Gestão Lasant: gestão de obras, engenharia, compras, RH, financeiro e licitações em um único sistema.",
      },
    ],
  }),
  component: App,
});
