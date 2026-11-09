import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";
export const Route = createFileRoute("/pmoc/operacao-smart")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Operação SMART PMOC — SGM Lasant" },
    { name: "description", content: "Manutenções PMOC por etapa, registros de execução e fotos da operação Lasant." },
    { property: "og:title", content: "Operação SMART PMOC — SGM Lasant" },
    { property: "og:description", content: "Acompanhamento de manutenção PMOC e registros de campo Lasant." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: App,
});