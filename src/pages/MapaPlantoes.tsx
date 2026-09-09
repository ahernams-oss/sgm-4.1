import React, { useState, useMemo } from "react";
import { CalendarClock, FileDown, FileSpreadsheet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { useClientes } from "@/contexts/ClientesContext";
import {
  SIGLAS,
  trabalhaNoDia,
  gerarMapaPlantoesPdf,
  gerarMapaPlantoesExcel,
  TipoJornada,
} from "@/lib/gerarMapaPlantoes";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MapaPlantoes = () => {
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podePdf = tem("mapa_funcionarios.exportar_pdf");
  const podeExcel = tem("mapa_funcionarios.exportar_excel");

  const hoje = new Date();
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const anos = useMemo(() => {
    const base = hoje.getFullYear();
    return [base - 1, base, base + 1];
  }, []);

  const dias = useMemo(() => new Date(ano, mes + 1, 0).getDate(), [ano, mes]);
  const dataRef = useMemo(() => new Date(ano, mes, 1), [ano, mes]);

  const funcionariosFiltrados = useMemo(() => {
    return funcionarios
      .filter((f) => (f.status || "Ativo") === "Ativo")
      .filter((f) => filterCliente === "todos" || f.clienteId === filterCliente)
      .filter((f) => !search || f.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [funcionarios, filterCliente, search]);

  const getCargoNome = (id: string) => cargos.find((c) => c.id === id)?.nome || "—";
  const getClienteNome = (id: string) => clientes.find((c) => c.id === id)?.nome || "—";

  const corPlantao = (jornada: string) => {
    const j = jornada as TipoJornada;
    if (j === "Diarista") return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
    if (j === "Plantão Diurno - PAR") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    if (j === "Plantão Diurno - ÍMPAR") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    if (j === "Plantão Noturno - PAR") return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    if (j === "Plantão Noturno - ÍMPAR") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
    return "bg-muted text-muted-foreground";
  };

  const handlePdf = () => {
    if (!podePdf) { toast.error("Você não possui permissão para exportar PDF."); return; }
    gerarMapaPlantoesPdf({
      funcionarios: funcionariosFiltrados,
      cargos,
      clientes,
      ano,
      mes,
    });
  };

  const handleExcel = () => {
    if (!podeExcel) { toast.error("Você não possui permissão para exportar Excel."); return; }
    gerarMapaPlantoesExcel({
      funcionarios: funcionariosFiltrados,
      cargos,
      clientes,
      ano,
      mes,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Mapa de Plantões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escala mensal baseada na jornada de trabalho dos funcionários ativos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {podeExcel && <Button variant="outline" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>}
          {podePdf && <Button onClick={handlePdf}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>}
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Cliente / Local</Label>
            <Select value={filterCliente} onValueChange={setFilterCliente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {clientes.filter((c: any) => (c.tipo || "Cliente") === "Cliente").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Pesquisar funcionário</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          {(Object.keys(SIGLAS) as TipoJornada[]).map((j) => (
            <Badge key={j} variant="outline" className={`${corPlantao(j)} border-transparent text-[11px]`}>
              <span className="font-bold mr-1">{SIGLAS[j]}</span> {j}
            </Badge>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">
            {MESES[mes]}/{ano} — {funcionariosFiltrados.length} funcionário(s)
          </h2>
        </div>
        {funcionariosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum funcionário ativo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-muted/30 z-10 min-w-[180px]">Funcionário</TableHead>
                  <TableHead className="min-w-[140px]">Cargo</TableHead>
                  <TableHead className="min-w-[140px]">Cliente</TableHead>
                  <TableHead className="min-w-[150px]">Jornada</TableHead>
                  {Array.from({ length: dias }, (_, i) => {
                    const dow = new Date(ano, mes, i + 1).getDay();
                    const fimSemana = dow === 0 || dow === 6;
                    const siglasDow = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                    return (
                      <TableHead
                        key={i}
                        className={`text-center w-9 px-1 text-[11px] ${fimSemana ? "bg-muted/50" : ""}`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[9px] font-normal text-muted-foreground uppercase">{siglasDow[dow]}</span>
                          <span>{i + 1}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionariosFiltrados.map((f) => {
                  const sigla = SIGLAS[(f.jornadaTrabalho as TipoJornada)] || "";
                  const cor = corPlantao(f.jornadaTrabalho);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10">{f.nome}</TableCell>
                      <TableCell className="text-xs">{getCargoNome(f.cargoId)}</TableCell>
                      <TableCell className="text-xs">{f.clienteId ? getClienteNome(f.clienteId) : "—"}</TableCell>
                      <TableCell className="text-xs">{f.jornadaTrabalho || "—"}</TableCell>
                      {Array.from({ length: dias }, (_, i) => {
                        const trabalha = trabalhaNoDia(f.jornadaTrabalho, i + 1, dataRef);
                        const dow = new Date(ano, mes, i + 1).getDay();
                        const fimSemana = dow === 0 || dow === 6;
                        return (
                          <TableCell
                            key={i}
                            className={`text-center px-1 py-1 ${fimSemana ? "bg-muted/30" : ""}`}
                          >
                            {trabalha && sigla ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${cor}`}>
                                {sigla}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapaPlantoes;
