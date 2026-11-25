import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

export const Route = createFileRoute("/obras/previsao-tempo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Previsão do tempo | SGM Lasant" },
      { name: "description", content: "Consulta meteorológica por cidade para as obras da Lasant no SGM." },
      { property: "og:title", content: "Previsão do tempo | SGM Lasant" },
      { property: "og:description", content: "Consulte temperatura, sensação térmica, umidade e vento no SGM Lasant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});