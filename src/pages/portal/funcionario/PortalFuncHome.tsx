import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Shield, FolderOpen, UserCog,
  CalendarDays, GraduationCap, MessageSquare, Megaphone,
} from "lucide-react";

const items = [
  { to: "/portal/funcionario/holerites", label: "Holerites e Comprovantes", icon: FileText },
  { to: "/portal/funcionario/ferias", label: "Férias", icon: CalendarDays },
  { to: "/portal/funcionario/documentos", label: "Meus Documentos", icon: FolderOpen },
  { to: "/portal/funcionario/epis", label: "Confirmar EPIs (Facial)", icon: Shield },
  { to: "/portal/funcionario/treinamentos", label: "Treinamentos", icon: GraduationCap },
  { to: "/portal/funcionario/solicitacoes", label: "Solicitações ao RH", icon: MessageSquare },
  { to: "/portal/funcionario/avisos", label: "Avisos", icon: Megaphone },
  { to: "/portal/funcionario/perfil", label: "Perfil / Alterar Senha", icon: UserCog },
];

interface Resumo {
  holerites_nao_lidos: number;
  solicitacoes_pendentes: number;
  ferias_pendentes: number;
}

export default function PortalFuncHome() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    portalCall<Resumo>("func-home-resumo").then(setResumo).catch(() => {});
  }, []);

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-xl sm:text-2xl font-semibold mb-6">Bem-vindo</h1>

      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <ResumoCard label="Holerites novos" value={resumo.holerites_nao_lidos} to="/portal/funcionario/holerites" />
          <ResumoCard label="Solicitações em aberto" value={resumo.solicitacoes_pendentes} to="/portal/funcionario/solicitacoes" />
          <ResumoCard label="Férias em análise" value={resumo.ferias_pendentes} to="/portal/funcionario/ferias" />
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="hover:shadow-md transition">
              <CardContent className="p-4 sm:p-6 flex items-center gap-4">
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

function ResumoCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
