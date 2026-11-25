import { ClimaInicial } from "@/components/ClimaInicial";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { locaisClimaSchema, localClimaSchema } from "@/lib/clima";
import { useAuth } from "@/contexts/AuthContext";

export default function PrevisaoTempo() {
  const { usuarioLogado } = useAuth();
  const [locais, setLocais] = useState<string[]>(["Rio de Janeiro"]);
  const [entrada, setEntrada] = useState("");
  const [erro, setErro] = useState("");
  const [carregado, setCarregado] = useState(false);
  const chave = `sgm-clima-locais-${usuarioLogado?.id ?? ""}`;
  useEffect(() => {
    setCarregado(false);
    let salvos: string[] = ["Rio de Janeiro"];
    try { const valor = localStorage.getItem(chave); if (valor) { const resultado = locaisClimaSchema.safeParse(JSON.parse(valor)); if (resultado.success) salvos = resultado.data; } } catch { /* Armazenamento indisponível. */ }
    setLocais(salvos);
    setCarregado(true);
  }, [chave]);
  function atualizar(novos: string[]) {
    setLocais(novos);
    try { localStorage.setItem(chave, JSON.stringify(novos)); } catch { /* Mantém os locais nesta sessão. */ }
  }
  return (
    <div className="w-full space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6"><h1 className="text-2xl font-semibold">Previsão do tempo</h1><span className="text-sm text-muted-foreground">{locais.length}/5 locais</span></div>
      <form className="flex flex-wrap items-center gap-2 px-4 sm:px-6" onSubmit={e => {
        e.preventDefault(); setErro("");
        const resultado = localClimaSchema.safeParse(entrada);
        if (!resultado.success) { setErro("Informe um local entre 2 e 120 caracteres."); return; }
        if (!locaisClimaSchema.safeParse([...locais, resultado.data]).success) { setErro("É permitido adicionar até 5 locais."); return; }
        if (locais.some(l => l.localeCompare(resultado.data, "pt-BR", { sensitivity: "base" }) === 0)) { setErro("Este local já foi adicionado."); return; }
        atualizar([...locais, resultado.data]); setEntrada("");
      }}>
        <Input aria-label="Novo local" placeholder="Cidade, estado ou país" value={entrada} onChange={e => setEntrada(e.target.value)} minLength={2} maxLength={120} required disabled={locais.length >= 5 || !carregado} className="w-full sm:w-80" />
        <Button type="submit" disabled={locais.length >= 5 || !carregado}><Plus className="mr-2 h-4 w-4" />Adicionar local</Button>
        {erro && <p role="alert" className="w-full text-sm text-destructive">{erro}</p>}
      </form>
      <div className="space-y-4">{carregado && locais.map(local => <ClimaInicial key={local} local={local} onRemover={() => { atualizar(locais.filter(l => l !== local)); setErro(""); }} />)}</div>
    </div>
  );
}