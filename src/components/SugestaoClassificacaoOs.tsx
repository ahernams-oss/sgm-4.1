import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sugerirClassificacaoOs } from "@/lib/osClassificacao.functions";
import type { SugestaoClassificacao } from "@/lib/osClassificacao";

export default function SugestaoClassificacaoOs({ descricao, categoria, servico, onAceitar }: {
  descricao: string;
  categoria: string;
  servico: string;
  onAceitar: (sugestao: SugestaoClassificacao) => void;
}) {
  const [resultado, setResultado] = useState<{ descricao: string; sugestao: SugestaoClassificacao | null; erro: boolean } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [dispensada, setDispensada] = useState<string | null>(null);
  useEffect(() => {
    let atual = true;
    setCarregando(false);
    if (descricao.trim().length < 6) return;
    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const sugestao = await sugerirClassificacaoOs({ data: { descricao } });
        if (atual) setResultado({ descricao, sugestao, erro: false });
      } catch {
        if (atual) setResultado({ descricao, sugestao: null, erro: true });
      } finally {
        if (atual) setCarregando(false);
      }
    }, 650);
    return () => { atual = false; clearTimeout(timer); };
  }, [descricao]);

  if (descricao.trim().length < 6 || dispensada === descricao) return null;
  if (carregando) return <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />Consultando histórico validado…</p>;
  if (resultado?.descricao !== descricao) return null;
  if (resultado.erro) return <p className="mt-2 text-xs text-muted-foreground" role="status">Sugestão indisponível. Classificação manual mantida.</p>;
  const sugestao = resultado.sugestao;
  if (!sugestao) return <p className="mt-2 text-xs text-muted-foreground" role="status">Sem correspondência confiável no histórico de 2025–2026.</p>;
  const aplicada = categoria === sugestao.categoria && servico === sugestao.servico;
  return (
    <div className="mt-3 border-l-2 border-primary bg-accent/40 p-3" aria-label="Sugestão de classificação">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 shrink-0 text-primary" />Sugestão do histórico validado</p>
          <p className="break-words text-sm">{sugestao.categoria} → {sugestao.servico}</p>
          <p className="text-xs text-muted-foreground">{sugestao.ocorrencias.toLocaleString("pt-BR")} de {sugestao.total.toLocaleString("pt-BR")} registros semelhantes · {(100 * sugestao.ocorrencias / sugestao.total).toFixed(1).replace(".", ",")}% de concordância · 2025–2026</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Dispensar sugestão" title="Dispensar sugestão" onClick={() => setDispensada(descricao)}><X /></Button>
      </div>
      <Button type="button" className="mt-3" size="sm" variant={aplicada ? "secondary" : "default"} disabled={aplicada} onClick={() => onAceitar(sugestao)}><Check />{aplicada ? "Classificação selecionada" : "Aceitar sugestão"}</Button>
    </div>
  );
}