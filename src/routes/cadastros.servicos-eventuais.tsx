import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";
import { RotaProtegida } from "@/components/RotaProtegida";
import ServicosEventuaisCadastro from "@/components/ServicosEventuaisCadastro";

export const Route = createFileRoute("/cadastros/servicos-eventuais")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Serv. Eventuais | SGM Lasant" },
      { name: "description", content: "Serviços eventuais no SGM Lasant." },
      { property: "og:title", content: "Serv. Eventuais | SGM Lasant" },
      { property: "og:description", content: "Serviços eventuais no SGM Lasant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicosEventuais,
});

function ServicosEventuais() {
  return (
    <App>
      <RotaProtegida perm="sco">
        <ServicosEventuaisCadastro />
      </RotaProtegida>
    </App>
  );
}