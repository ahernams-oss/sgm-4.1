import { Badge } from "@/components/ui/badge";

export interface StatusHistoricoItem {
  status: string;
  dataHora: string;
  usuario?: string;
  observacao?: string;
}

interface Props {
  historico?: StatusHistoricoItem[];
}

export default function RequisicaoHistoricoTimeline({ historico }: Props) {
  if (!historico || historico.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de histórico.</p>;
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
      {historico.map((h, idx) => (
        <div key={idx} className="relative">
          <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
          <div>
            <Badge variant="outline" className="text-xs font-medium mb-1">{h.status}</Badge>
            <p className="text-xs text-muted-foreground tabular-nums">{h.dataHora}</p>
            {h.usuario && <p className="text-xs text-muted-foreground">por {h.usuario}</p>}
            {h.observacao && (
              <p className="text-xs text-foreground mt-1 italic border-l-2 border-primary/40 pl-2">
                Justificativa: "{h.observacao}"
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
