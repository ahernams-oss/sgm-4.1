import { useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Monitor, Wrench, Lock } from "lucide-react";

const fmtDate = (d?: string) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export default function EquipamentoPublico() {
  const { id } = useParams<{ id: string }>();
  const [equip, setEquip] = useState<any>(null);
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [execucoes, setExecucoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: eq } = await supabase.from("equipamentos").select("*").eq("id", id).maybeSingle();
      if (!eq) { setNotFound(true); setLoading(false); return; }
      setEquip(eq);
      const [{ data: ss }, { data: ats }, { data: exs }] = await Promise.all([
        supabase.from("solicitacoes_servicos")
          .select("id, numero, descricao_servicos, situacao, tipo, prioridade, data_hora_solicitacao, created_at")
          .eq("equipamento_id", id).order("created_at", { ascending: false }),
        supabase.from("pmoc_atividades")
          .select("id, descricao, periodicidade, ultima_execucao, proxima_execucao, ativa")
          .eq("equipamento_id", id),
        supabase.from("pmoc_atividades_execucoes")
          .select("id, atividade_id, atividade_descricao, periodicidade, data_execucao, proxima_execucao, status, data_confirmacao")
          .eq("equipamento_id", id).order("data_execucao", { ascending: false }),
      ]);
      setManutencoes(ss || []);
      setAtividades(ats || []);
      setExecucoes(exs || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-destructive">Equipamento não encontrado.</div>;

  const statusManutencao = (proxima?: string | null) => {
    if (!proxima) return { label: "Sem agendamento", variant: "outline" as const };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const prox = new Date(proxima); prox.setHours(0, 0, 0, 0);
    const diff = Math.round((prox.getTime() - hoje.getTime()) / 86400000);
    if (diff < 0) return { label: `Vencida há ${Math.abs(diff)}d`, variant: "destructive" as const };
    if (diff <= 2) return { label: `Vence em ${diff}d`, variant: "secondary" as const };
    return { label: `Em dia (${diff}d)`, variant: "default" as const };
  };

  const Info = ({ label, value }: { label: string; value: any }) => (
    <div className="border-b border-border/50 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || "-"}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Monitor className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{equip.equipamento || "Equipamento"}</h1>
            {equip.tag && <p className="text-xs text-muted-foreground font-mono">TAG: {equip.tag}</p>}
          </div>
          <Badge variant="outline" className="ml-auto gap-1"><Lock className="h-3 w-3" />Somente leitura</Badge>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Informações do Equipamento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <Info label="Cliente" value={equip.cliente_nome} />
            <Info label="Local" value={equip.local_descricao} />
            <Info label="Pavimento" value={equip.pavimento_descricao} />
            <Info label="Setor" value={equip.setor_descricao} />
            <Info label="Situação" value={<Badge variant={equip.situacao === "Ativo" ? "default" : equip.situacao === "Em Manutenção" ? "secondary" : "destructive"}>{equip.situacao}</Badge>} />
            <Info label="Modelo" value={equip.modelo} />
            <Info label="Fabricante" value={equip.fabricante} />
            <Info label="Capacidade (BTU)" value={equip.capacidade_btu} />
            <Info label="Tensão" value={equip.tensao} />
            <Info label="Série" value={equip.serie} />
          </CardContent>
        </Card>

        {(() => {
          const fotos: string[] = Array.isArray(equip.fotos) ? equip.fotos : (equip.fotos ? (() => { try { return JSON.parse(equip.fotos); } catch { return []; } })() : []);
          const list = fotos.length > 0 ? fotos : (equip.foto_url ? [equip.foto_url] : []);
          if (list.length === 0) return null;
          return (
            <Card>
              <CardHeader><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {list.map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i+1}`} className="h-32 w-32 object-cover rounded border" /></a>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Plano de Manutenção PMOC ({atividades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Última execução</TableHead>
                    <TableHead>Próxima execução</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atividades.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma atividade no PMOC.</TableCell></TableRow>
                  ) : atividades.map(a => {
                    const st = statusManutencao(a.proxima_execucao);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm text-left">{a.descricao}</TableCell>
                        <TableCell className="text-sm text-left">{a.periodicidade || "-"}</TableCell>
                        <TableCell className="text-sm text-left">{fmtDate(a.ultima_execucao)}</TableCell>
                        <TableCell className="text-sm text-left">{fmtDate(a.proxima_execucao)}</TableCell>
                        <TableCell className="text-left"><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Histórico de Execuções PMOC ({execucoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data execução</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {execucoes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma execução registrada.</TableCell></TableRow>
                  ) : execucoes.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm text-left">{fmtDate(e.data_execucao)}</TableCell>
                      <TableCell className="text-sm text-left">{e.atividade_descricao || "-"}</TableCell>
                      <TableCell className="text-sm text-left">{e.periodicidade || "-"}</TableCell>
                      <TableCell className="text-sm text-left">{fmtDate(e.proxima_execucao)}</TableCell>
                      <TableCell className="text-left">
                        <Badge variant={e.status === "Confirmada" ? "default" : e.status === "Rejeitada" ? "destructive" : "secondary"} className="text-xs">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Solicitações de Serviços (SS) ({manutencoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manutencoes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma manutenção registrada.</TableCell></TableRow>
                  ) : manutencoes.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs text-left">{m.numero || "-"}</TableCell>
                      <TableCell className="text-sm text-left">{fmtDate(m.data_hora_solicitacao || m.created_at)}</TableCell>
                      <TableCell className="text-sm text-left">{m.tipo || "-"}</TableCell>
                      <TableCell className="text-sm max-w-md truncate text-left">{m.descricao_servicos || "-"}</TableCell>
                      <TableCell className="text-left"><Badge variant="outline" className="text-xs">{m.situacao}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Visualização pública somente leitura.</p>
      </div>
    </div>
  );
}
