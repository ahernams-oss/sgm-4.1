import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudSun, Droplets, Loader2, RefreshCw, Search, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consultarClima } from "@/lib/clima.functions";

export function ClimaInicial() {
  const [entrada, setEntrada] = useState("Rio de Janeiro");
  const [cidade, setCidade] = useState("Rio de Janeiro");
  const consulta = useQuery({ queryKey: ["clima-atual", cidade], queryFn: () => consultarClima({ data: { cidade } }), staleTime: 10 * 60 * 1000, retry: false });
  const clima = consulta.data?.clima;
  const numero = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <section aria-label="Clima atual" className="w-full border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><CloudSun className="h-7 w-7 text-primary" /><div><h2 className="font-semibold">Clima atual</h2><span className="text-xs text-muted-foreground">WeatherAPI.com</span></div></div>
        <form className="flex w-full items-center gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); const valor = entrada.trim(); if (valor.length >= 2) { if (valor === cidade) void consulta.refetch(); else setCidade(valor); } }}>
          <Input aria-label="Cidade para consultar o clima" value={entrada} onChange={e => setEntrada(e.target.value)} minLength={2} maxLength={120} required className="min-w-0 sm:w-64" placeholder="Cidade, estado ou país" />
          <Button type="submit" size="icon" variant="outline" aria-label="Buscar clima" title="Buscar clima" disabled={consulta.isFetching}><Search className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Atualizar clima" title="Atualizar clima" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </form>
      </div>
      {consulta.isFetching && <div role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Consultando clima…</div>}
      {!consulta.isFetching && (consulta.data?.erro || consulta.error) && <p role="alert" className="mt-3 text-sm text-destructive">{consulta.data?.erro || "Não foi possível consultar o clima. Verifique sua sessão e tente novamente."}</p>}
      {clima && <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div><p className="font-medium">{clima.cidade} · {clima.regiao}</p><p className="text-sm text-muted-foreground">{clima.condicao}</p></div>
        <strong className="text-3xl">{numero(clima.temperatura)} °C</strong>
        <span className="text-sm">Sensação {numero(clima.sensacao)} °C</span>
        <span className="flex items-center gap-1 text-sm"><Droplets className="h-4 w-4 text-primary" />{clima.umidade}%</span>
        <span className="flex items-center gap-1 text-sm"><Wind className="h-4 w-4 text-primary" />{numero(clima.vento)} km/h</span>
        <span className="text-xs text-muted-foreground">Atualizado: {clima.atualizado.split(" ")[0]?.split("-").reverse().join("/")} {clima.atualizado.split(" ")[1]} (horário local)</span>
      </div>}
    </section>
  );
}