import { Link } from "@/lib/router-compat";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, FolderPlus, FileSignature, GraduationCap } from "lucide-react";

const items = [
  { to: "/portal/candidato/ficha", label: "Ficha Cadastral", icon: ClipboardList },
  { to: "/portal/candidato/documentos", label: "Enviar Documentos", icon: FolderPlus },
  { to: "/portal/candidato/termos", label: "Assinar Termos", icon: FileSignature },
  { to: "/portal/candidato/admissional", label: "Exame Admissional & Integração", icon: GraduationCap },
];

export default function PortalCandHome() {
  return (
    <PortalLayout requireTipo="candidato">
      <h1 className="text-2xl font-semibold mb-2">Processo de Admissão</h1>
      <p className="text-sm text-muted-foreground mb-6">Complete cada etapa abaixo. O RH será notificado a cada envio.</p>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="hover:shadow-md transition">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PortalLayout>
  );
}
