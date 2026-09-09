import { useState } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { OrdemServico, useOrdensServico } from "@/contexts/OrdensServicoContext";

const LABELS: Record<number, string> = {
  5: "Excelente",
  4: "Ótima",
  3: "Regular",
  2: "Ruim",
  1: "Péssimo",
};

interface Props {
  os: OrdemServico;
}

export function AvaliacaoOs({ os }: Props) {
  const { usuarioLogado } = useAuth();
  const { updateOrdem } = useOrdensServico();
  const [estrelas, setEstrelas] = useState<number>(os.avaliacao ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [justificativa, setJustificativa] = useState<string>(os.avaliacaoJustificativa ?? "");
  const [salvando, setSalvando] = useState(false);

  const jaAvaliada = !!os.avaliacao;
  const exigeJustificativa = estrelas > 0 && estrelas <= 3;

  const handleSalvar = async () => {
    if (!estrelas) {
      toast.error("Selecione de 1 a 5 estrelas");
      return;
    }
    if (exigeJustificativa && !justificativa.trim()) {
      toast.error("Justificativa obrigatória para avaliações de 1, 2 ou 3 estrelas");
      return;
    }
    setSalvando(true);
    try {
      await updateOrdem(os.id, {
        avaliacao: estrelas,
        avaliacao_justificativa: exigeJustificativa ? justificativa.trim() : "",
        avaliacao_data: new Date().toISOString(),
        avaliacao_usuario: usuarioLogado?.nome || "Cliente",
      });
      toast.success("Avaliação registrada com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao registrar avaliação: " + (e?.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  const valorAtivo = hover || estrelas;

  if (jaAvaliada) {
    return (
      <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
        <h4 className="text-sm font-semibold">Avaliação do Cliente</h4>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-6 w-6 ${n <= (os.avaliacao || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
            />
          ))}
          <span className="ml-2 text-sm font-medium">
            {os.avaliacao} - {LABELS[os.avaliacao || 0]}
          </span>
        </div>
        {os.avaliacaoJustificativa && (
          <div className="text-sm">
            <span className="font-medium">Justificativa: </span>
            <span className="text-muted-foreground">{os.avaliacaoJustificativa}</span>
          </div>
        )}
        {os.avaliacaoUsuario && (
          <div className="text-xs text-muted-foreground">
            Avaliado por {os.avaliacaoUsuario}
            {os.avaliacaoData ? ` em ${new Date(os.avaliacaoData).toLocaleString("pt-BR")}` : ""}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Avaliação do Cliente (opcional)</h4>
        <p className="text-xs text-muted-foreground">
          5 = Excelente · 4 = Ótima · 3 = Regular · 2 = Ruim · 1 = Péssimo
        </p>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setEstrelas(n)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 ${n <= valorAtivo ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
            />
          </button>
        ))}
        {valorAtivo > 0 && (
          <span className="ml-3 text-sm font-medium">{valorAtivo} - {LABELS[valorAtivo]}</span>
        )}
      </div>
      {exigeJustificativa && (
        <div className="space-y-1">
          <Label className="text-sm">
            Justificativa <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Descreva o motivo da avaliação..."
            rows={3}
            maxLength={500}
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={!estrelas || salvando} size="sm">
          <Send className="h-4 w-4 mr-1" />
          {salvando ? "Enviando..." : "Enviar Avaliação"}
        </Button>
      </div>
    </div>
  );
}
