import { Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HistoricoEntry {
  situacao: string;
  data: string;
  usuario: string;
}

interface WorkflowHistoricoProps {
  historico: HistoricoEntry[];
  situacaoCores?: Record<string, string>;
}

export default function WorkflowHistorico({ historico, situacaoCores = {} }: WorkflowHistoricoProps) {
  if (!historico || historico.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Nenhum registro de histórico.</p>;
  }

  const sorted = [...historico].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="space-y-2">
      {sorted.map((entry, i) => {
        const cor = situacaoCores[entry.situacao];
        return (
          <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-muted/40 border">
            <div className="mt-0.5">
              <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: cor || "hsl(var(--primary))" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={cor ? { borderColor: cor, color: cor } : {}}
                >
                  {entry.situacao}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.data).toLocaleString("pt-BR")}
                </span>
                {entry.usuario && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {entry.usuario}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
