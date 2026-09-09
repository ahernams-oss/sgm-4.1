import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PortalAdmissional() {
  return (
    <PortalLayout requireTipo="candidato">
      <h1 className="text-2xl font-semibold mb-4">Exame Admissional</h1>

      <Card className="mb-4">
        <CardHeader><CardTitle>Exame Admissional</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>O agendamento do exame admissional é realizado pelo RH após o envio da ficha e dos documentos.</p>
          <p>Você receberá as informações (clínica, endereço, data e horário) por WhatsApp no número cadastrado.</p>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
