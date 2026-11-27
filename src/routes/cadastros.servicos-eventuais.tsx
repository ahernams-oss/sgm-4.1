import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";
import { RotaProtegida } from "@/components/RotaProtegida";

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
        <section className="w-full px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold">Serv. Eventuais</h1>
        </section>
      </RotaProtegida>
    </App>
  );
}