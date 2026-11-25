import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudSun, Droplets, Loader2, RefreshCw, Search, Wind, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consultarClima } from "@/lib/clima.functions";
import { alertaSevero } from "@/lib/clima";

export function ClimaInicial({ local, onRemover }: { local?: string; onRemover?: () => void } = {}) {
  const [entrada, setEntrada] = useState("Rio de Janeiro");
  const [cidade, setCidade] = useState("Rio de Janeiro");
  const consulta = useQuery({ queryKey: ["clima-atual", local ?? cidade, Boolean(local)], queryFn: () => consultarClima({ data: { cidade: local ?? cidade, alertas: Boolean(local) } }), staleTime: 10 * 60 * 1000, refetchInterval: local ? 10 * 60 * 1000 : false, retry: false });
  const clima = consulta.data?.clima;
  const numero = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <section aria-label="Clima atual" className="w-full border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><CloudSun className="h-7 w-7 text-primary" /><div><h2 className="font-semibold">{local ?? "Clima atual"}</h2><span className="text-xs text-muted-foreground">WeatherAPI.com</span></div></div>
        <form className="flex w-full items-center gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); const valor = entrada.trim(); if (valor.length >= 2) { if (valor === cidade) void consulta.refetch(); else setCidade(valor); } }}>
          {!local && <><Input aria-label="Cidade para consultar o clima" value={entrada} onChange={e => setEntrada(e.target.value)} minLength={2} maxLength={120} required className="min-w-0 sm:w-64" placeholder="Cidade, estado ou país" />
          <Button type="submit" size="icon" variant="outline" aria-label="Buscar clima" title="Buscar clima" disabled={consulta.isFetching}><Search className="h-4 w-4" /></Button></>}
          <Button type="button" size="icon" variant="ghost" aria-label="Atualizar clima" title="Atualizar clima" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}><RefreshCw className="h-4 w-4" /></Button>
          {onRemover && <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${local}`} title="Remover local" onClick={onRemover}><X className="h-4 w-4" /></Button>}
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
      {local && clima && <div className="mt-4 space-y-3">
        {!clima.alertasDisponiveis && <p role="status" className="text-sm text-muted-foreground">Alertas meteorológicos indisponíveis nesta consulta.</p>}
        {clima.alertasDisponiveis && clima.alertas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta informado pela WeatherAPI para este local.</p>}
        {clima.alertas.map((alerta, indice) => <div key={`${alerta.headline}-${indice}`} role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><h3 className="font-semibold">{alertaSevero(alerta.severity) ? "Alerta de evento severo" : "Alerta meteorológico"}</h3><p className="break-words font-medium">{alerta.headline || alerta.event}</p></div></div>
          <p className="mt-2 text-sm">Severidade: {alerta.severity || "Não informada"}</p>
          {alerta.areas && <p className="mt-1 break-words text-sm">Áreas: {alerta.areas}</p>}
          <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">Detalhes e orientações</summary><div className="mt-2 space-y-2 whitespace-pre-wrap break-words"><p>{alerta.desc}</p><p>{alerta.instruction}</p><p>Início: {alerta.effective || "Não informado"} · Validade: {alerta.expires || "Não informada"}</p></div></details>
        </div>)}
      </div>}
    </section>
  );
}