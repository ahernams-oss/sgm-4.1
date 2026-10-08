import { useMemo, useState } from "react";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useProcessoSeletivo } from "@/contexts/ProcessoSeletivoContext";
import { useRequisicoes } from "@/contexts/RequisicaoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet, Users, UserPlus, CalendarClock, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { exportarPdfRH, exportarExcelRH, type RelatorioRH } from "@/lib/gerarRelatoriosRH";
import PaginationControls, { paginate } from "@/components/PaginationControls";

const parseData = (s?: string | null): Date | null => {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};
const fmt = (s?: string | null) => {
  const d = parseData(s);
  return d ? d.toLocaleDateString("pt-BR") : "—";
};
const diasAte = (d: Date) => {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - h.getTime()) / 86400000);
};

const ETAPA: Record<string, string> = {
  entrevista_psicologica: "Psicológica",
  entrevista_tecnica: "Técnica",
  liberacao: "Liberação",
  contratacao: "Contratação",
};

type Aba = "quadro" | "contratacoes" | "agendamentos" | "experiencia";

export default function RelatoriosRH() {
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const { processos } = useProcessoSeletivo();
  const { requisicoes } = useRequisicoes();
  const { empresa } = useEmpresa();

  const [aba, setAba] = useState<Aba>("quadro");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [clienteId, setClienteId] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [diasExp, setDiasExp] = useState("30");
  const [pagina, setPagina] = useState(1);

  const cargoNome = (id: string) => cargos.find((c) => c.id === id)?.nome || "—";
  const clienteNome = (id: string) => {
    const c = clientes.find((x) => x.id === id);
    return c ? c.nomeFantasia || c.nome : "—";
  };
  const noPeriodo = (s?: string | null) => {
    const d = parseData(s);
    if (!dataIni && !dataFim) return true;
    if (!d) return false;
    if (dataIni && d < parseData(dataIni)!) return false;
    if (dataFim && d > parseData(dataFim)!) return false;
    return true;
  };
  const termo = busca.trim().toLowerCase();
  const casa = (...t: (string | undefined)[]) => !termo || t.some((x) => (x || "").toLowerCase().includes(termo));

  const funcsFiltro = useMemo(
    () => funcionarios.filter((f) => (clienteId === "todos" || f.clienteId === clienteId) && casa(f.nome, f.cpf)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funcionarios, clienteId, termo],
  );

  // Quadro
  const quadro = funcsFiltro.filter((f) => status === "todos" || f.status === status);
  const contStatus = (s: string) => funcsFiltro.filter((f) => f.status === s).length;

  // Contratações: candidatos dos processos
  const candidatos = useMemo(() => {
    const out: any[] = [];
    processos.forEach((p) => {
      const req = requisicoes.find((r) => r.id === p.requisicaoId);
      const cargo = cargos.find((c) => c.id === req?.cargoId);
      (p.candidatos || []).forEach((c) => {
        const reprovado = [c.statusPsicologico, c.statusTecnico, c.statusLiberacao].includes("reprovado");
        const situacao = c.contratacaoFinalizada ? "Contratado" : reprovado ? "Reprovado" : "Em andamento";
        out.push({
          ...c,
          rp: req?.numero ?? "—",
          cargo: req?.cargoNome || "—",
          unidade: req?.unidade || "—",
          entrevistador: cargo?.entrevistadorNome || "—",
          situacao,
          dataRef: c.dataContratacao || p.dataCriacao,
        });
      });
    });
    return out;
  }, [processos, requisicoes, cargos]);

  const contratacoes = candidatos.filter(
    (c) => noPeriodo(c.dataRef) && casa(c.nome, c.cpf, c.cargo) && (status === "todos" || c.situacao === status),
  );
  const admissoes = funcsFiltro.filter((f) => (dataIni || dataFim) && noPeriodo(f.dataAdmissao));

  // Agendamentos
  const agendamentos = candidatos
    .filter((c) => c.agendamentoData && noPeriodo(c.agendamentoData) && casa(c.nome, c.cargo, c.agendamentoLocal))
    .sort((a, b) => `${a.agendamentoData}${a.agendamentoHora}`.localeCompare(`${b.agendamentoData}${b.agendamentoHora}`));

  // Experiência e desligamentos
  const limite = Number(diasExp) || 30;
  const experiencias = funcsFiltro
    .filter((f) => f.status !== "Inativo")
    .flatMap((f) => {
      const r: any[] = [];
      const p1 = parseData(f.experienciaPrimeiraEtapa);
      const p2 = parseData(f.experienciaFim);
      if (p1 && !f.experienciaRenovado) r.push({ f, etapa: "1ª etapa", data: p1 });
      if (p2) r.push({ f, etapa: "Fim da experiência", data: p2 });
      return r;
    })
    .map((x) => ({ ...x, dias: diasAte(x.data) }))
    .filter((x) => x.dias >= 0 && x.dias <= limite)
    .sort((a, b) => a.dias - b.dias);
  const desligamentos = funcsFiltro.filter((f) => f.dataDemissao && noPeriodo(f.dataDemissao));

  const filtrosTexto = () => {
    const l: string[] = [];
    l.push(`Período: ${dataIni ? fmt(dataIni) : "início"} a ${dataFim ? fmt(dataFim) : "hoje"}`);
    if (clienteId !== "todos") l.push(`Cliente: ${clienteNome(clienteId)}`);
    if (status !== "todos") l.push(`Situação: ${status}`);
    if (termo) l.push(`Busca: ${busca}`);
    return l;
  };

  const montar = (): RelatorioRH => {
    const base = { titulo: "Relatórios de RH", filtros: filtrosTexto(), empresaLogoUrl: empresa?.logoUrl || undefined };
    if (aba === "quadro")
      return {
        ...base,
        subtitulo: "Quadro de Funcionários",
        arquivo: "rh-quadro-funcionarios",
        resumo: [["Total", quadro.length], ["Ativos", contStatus("Ativo")], ["Férias", contStatus("Férias")], ["Afastados", contStatus("Afastado")], ["Inativos", contStatus("Inativo")]],
        head: ["Nome", "CPF", "Cargo", "Cliente", "Admissão", "Contrato", "Situação"],
        body: quadro.map((f) => [f.nome, f.cpf, cargoNome(f.cargoId), clienteNome(f.clienteId), fmt(f.dataAdmissao), f.tipoContrato, f.status]),
      };
    if (aba === "contratacoes")
      return {
        ...base,
        subtitulo: "Contratações",
        arquivo: "rh-contratacoes",
        resumo: [["Candidatos", contratacoes.length], ["Em andamento", contratacoes.filter((c) => c.situacao === "Em andamento").length], ["Contratados", contratacoes.filter((c) => c.situacao === "Contratado").length], ["Reprovados", contratacoes.filter((c) => c.situacao === "Reprovado").length], ["Admissões no período", admissoes.length]],
        head: ["Candidato", "RP", "Cargo", "Unidade", "Etapa atual", "Psicológica", "Técnica", "Liberação", "Situação", "Data"],
        body: contratacoes.map((c) => [c.nome, c.rp, c.cargo, c.unidade, ETAPA[c.etapaAtual] || "—", c.statusPsicologico || "pendente", c.statusTecnico || "pendente", c.statusLiberacao || "pendente", c.situacao, fmt(c.dataRef)]),
      };
    if (aba === "agendamentos")
      return {
        ...base,
        subtitulo: "Agendamentos de Entrevista",
        arquivo: "rh-agendamentos",
        resumo: [["Agendamentos", agendamentos.length], ["WhatsApp enviado", agendamentos.filter((a) => a.agendamentoEnviadoEm).length]],
        head: ["Data", "Horário", "Local", "Candidato", "Telefone", "Cargo", "RP", "Entrevistador", "WhatsApp"],
        body: agendamentos.map((a) => [fmt(a.agendamentoData), a.agendamentoHora || "—", a.agendamentoLocal || "—", a.nome, a.telefone || "—", a.cargo, a.rp, a.entrevistador, a.agendamentoEnviadoEm ? fmt(a.agendamentoEnviadoEm) : "Não enviado"]),
      };
    return {
      ...base,
      subtitulo: "Experiência e Desligamentos",
      arquivo: "rh-experiencia-desligamentos",
      filtros: [...base.filtros, `Experiência vencendo em até ${limite} dias`],
      resumo: [["Experiências vencendo", experiencias.length], ["Desligamentos no período", desligamentos.length]],
      head: ["Tipo", "Nome", "Cargo", "Cliente", "Admissão", "Data", "Prazo / Situação"],
      body: [
        ...experiencias.map((x) => ["Experiência — " + x.etapa, x.f.nome, cargoNome(x.f.cargoId), clienteNome(x.f.clienteId), fmt(x.f.dataAdmissao), x.data.toLocaleDateString("pt-BR"), x.dias === 0 ? "Vence hoje" : `${x.dias} dia(s)`]),
        ...desligamentos.map((f) => ["Desligamento", f.nome, cargoNome(f.cargoId), clienteNome(f.clienteId), fmt(f.dataAdmissao), fmt(f.dataDemissao), f.status]),
      ],
    };
  };

  const exportar = async (tipo: "pdf" | "xlsx") => {
    try {
      const r = montar();
      if (tipo === "pdf") await exportarPdfRH(r);
      else await exportarExcelRH(r);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o relatório.");
    }
  };

  const opcoesStatus =
    aba === "quadro" ? ["Ativo", "Férias", "Afastado", "Inativo"] : aba === "contratacoes" ? ["Em andamento", "Contratado", "Reprovado"] : [];

  const kpis = [
    { label: "Funcionários ativos", value: contStatus("Ativo"), icon: Users },
    { label: "Candidatos em andamento", value: candidatos.filter((c) => c.situacao === "Em andamento").length, icon: UserPlus },
    { label: "Agendamentos no período", value: agendamentos.length, icon: CalendarClock },
    { label: `Experiências vencendo (${limite}d)`, value: experiencias.length, icon: Hourglass },
  ];

  const Grade = ({ r }: { r: RelatorioRH }) => {
    const { paginated, safePage } = paginate(r.body, pagina);
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>{r.head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={r.head.length} className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow>
              ) : (
                paginated.map((l, i) => (
                  <TableRow key={i}>{l.map((c, j) => <TableCell key={j} className="whitespace-nowrap">{c}</TableCell>)}</TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationControls currentPage={safePage} totalItems={r.body.length} onPageChange={setPagina} />
      </div>
    );
  };

  const rel = montar();

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Relatórios de RH</h1>
          <p className="text-sm text-muted-foreground">Acompanhe funcionários, contratações, agendamentos e prazos de experiência.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportar("pdf")}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          <Button variant="outline" onClick={() => exportar("xlsx")}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border-l-4 border-l-primary">
            <CardContent className="py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold text-primary">{k.value}</p>
              </div>
              <k.icon className="w-5 h-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div><Label>Data inicial</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
          <div><Label>Data final</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {clientes.filter((c) => c.tipo === "Cliente").map((c) => <SelectItem key={c.id} value={c.id}>{c.nomeFantasia || c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {opcoesStatus.length > 0 ? (
            <div>
              <Label>Situação</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {opcoesStatus.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : aba === "experiencia" ? (
            <div><Label>Experiência vencendo em (dias)</Label><Input type="number" min={1} value={diasExp} onChange={(e) => setDiasExp(e.target.value)} /></div>
          ) : <div />}
          <div><Label>Busca</Label><Input placeholder="Nome, CPF, cargo..." value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <Button variant="ghost" onClick={() => { setDataIni(""); setDataFim(""); setClienteId("todos"); setStatus("todos"); setBusca(""); }}>Limpar filtros</Button>
        </CardContent>
      </Card>

      <Tabs value={aba} onValueChange={(v) => { setAba(v as Aba); setStatus("todos"); }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="quadro">Quadro de Funcionários</TabsTrigger>
          <TabsTrigger value="contratacoes">Contratações</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="experiencia">Experiência e Desligamentos</TabsTrigger>
        </TabsList>
        {(["quadro", "contratacoes", "agendamentos", "experiencia"] as Aba[]).map((a) => (
          <TabsContent key={a} value={a} className="space-y-3">
            {rel.resumo && (
              <div className="flex flex-wrap gap-2">
                {rel.resumo.map(([k, v]) => (
                  <span key={k} className="rounded-md border bg-muted/40 px-3 py-1 text-sm"><span className="text-muted-foreground">{k}:</span> <b>{v}</b></span>
                ))}
              </div>
            )}
            {aba === a && <Grade r={rel} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
