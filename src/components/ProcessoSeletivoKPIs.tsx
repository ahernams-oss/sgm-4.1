import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, XCircle, CheckCircle2 } from "lucide-react";

export interface CandidatoResumo {
  statusPsicologico?: string;
  statusTecnico?: string;
  statusLiberacao?: string;
  etapaAtual?: string;
  contratacaoFinalizada?: boolean;
}

interface Props {
  candidatos: CandidatoResumo[];
  className?: string;
}

export const contarIndicadoresPS = (candidatos: CandidatoResumo[]) => {
  const total = candidatos.length;
  const reprovados = candidatos.filter(
    (c) =>
      c.statusPsicologico === "reprovado" ||
      c.statusTecnico === "reprovado" ||
      c.statusLiberacao === "reprovado",
  ).length;
  const liberados = candidatos.filter(
    (c) => c.etapaAtual === "contratacao" || c.contratacaoFinalizada,
  ).length;
  const ativos = Math.max(0, total - reprovados - liberados);
  return { total, reprovados, liberados, ativos };
};

const ProcessoSeletivoKPIs = ({ candidatos, className = "" }: Props) => {
  const { total, reprovados, liberados, ativos } = contarIndicadoresPS(candidatos ?? []);

  const cards = [
    { label: "Total de Candidatos", value: total, icon: Users, accent: "border-l-primary", tone: "text-primary" },
    { label: "Em Andamento", value: ativos, icon: Clock, accent: "border-l-amber-500", tone: "text-amber-600" },
    { label: "Reprovados", value: reprovados, icon: XCircle, accent: "border-l-rose-500", tone: "text-rose-600" },
    { label: "Liberados / Contratados", value: liberados, icon: CheckCircle2, accent: "border-l-emerald-500", tone: "text-emerald-600" },
  ];

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {cards.map((card) => (
        <Card key={card.label} className={`bg-card border-l-4 ${card.accent}`}>
          <CardContent className="py-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                {card.label}
              </p>
              <p className={`text-2xl font-bold ${card.tone}`}>{card.value}</p>
            </div>
            <card.icon className={`h-5 w-5 shrink-0 ${card.tone}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProcessoSeletivoKPIs;
