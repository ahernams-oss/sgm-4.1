import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import PaginationControls from "@/components/PaginationControls";
import { Loader2, FileSpreadsheet, RefreshCw, Upload, Undo2, Printer, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { imprimirHolerite, baixarHolerite, type HoleriteDados } from "@/lib/gerarPdfHolerite";
import { toast } from "sonner";

interface Registro {
  id: string;
  pagina: number;
  cpf_detectado: string | null;
  nome_detectado: string | null;
  funcionario_id: string | null;
  tipo: string;
  valor_liquido: number | null;
  salario_base: number | null;
  horas_trabalhadas: number | null;
  horas_extras: number | null;
  valor_horas_extras: number | null;
  total_proventos: number | null;
  total_descontos: number | null;
  publicado: boolean;
  ignorar: boolean;
  lote: {
    competencia_mes: number;
    competencia_ano: number;
    arquivo_nome: string | null;
  } | null;
}

interface Assinatura {
  assinado_em: string | null;
  assinatura_imagem: string | null;
  assinatura_hash: string | null;
  assinatura_ip: string | null;
}

const TIPOS: Record<string, string> = {
  folha: "Folha Mensal",
  "13o": "13º Salário",
  ferias: "Férias",
  rescisao: "Rescisão",
  outros: "Outros",
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const horas = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;

export default function HoleritesProcessados() {
  const { funcionarios } = useFuncionarios();
  const { empresa } = useEmpresa();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState<string>("todos");
  const [ano, setAno] = useState<string>(String(now.getFullYear()));
  const [tipo, setTipo] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [processando, setProcessando] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [assinaturas, setAssinaturas] = useState<Record<string, Assinatura>>({});
  const [lote, setLote] = useState<{ feito: number; total: number } | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof Registro | "competencia" | "status"; direcao: "asc" | "desc" } | null>(null);


  const alternarSelecao = (id: string, on: boolean) =>
    setSelecionados((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const executarLote = async (acao: "publicar" | "despublicar") => {
    const alvos = registros.filter(
      (r) => selecionados.includes(r.id) && (acao === "publicar" ? !r.publicado && r.funcionario_id : r.publicado)
    );
    if (!alvos.length) {
      toast.error(acao === "publicar" ? "Nenhum item pendente e vinculado selecionado." : "Nenhum item publicado selecionado.");
      return;
    }

    // Resposta imediata: marca na tela e processa em segundo plano
    const ids = alvos.map((a) => a.id);
    setRegistros((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, publicado: acao === "publicar" } : x)));
    setSelecionados([]);
    setLote({ feito: 0, total: alvos.length });
    toast.info(
      `${alvos.length} holerite(s) enviados para ${acao === "publicar" ? "publicação" : "despublicação"} em segundo plano.`,
    );

    void (async () => {
      let ok = 0, falhas = 0;
      for (let i = 0; i < alvos.length; i += 4) {
        const bloco = alvos.slice(i, i + 4);
        await Promise.all(
          bloco.map(async (r) => {
            try {
              const { data, error } = await supabase.functions.invoke("publicar-holerite-item", {
                body: { item_id: r.id, acao },
              });
              const err = error?.message || (data as any)?.error;
              if (err) throw new Error(err);
              ok++;
            } catch {
              falhas++;
              // reverte apenas o item que falhou
              setRegistros((prev) => prev.map((x) => (x.id === r.id ? { ...x, publicado: acao !== "publicar" } : x)));
            }
          })
        );
        setLote({ feito: Math.min(i + 4, alvos.length), total: alvos.length });
      }
      setLote(null);
      if (falhas) toast.error(`${ok} concluído(s), ${falhas} falha(s).`);
      else toast.success(`${ok} holerite(s) ${acao === "publicar" ? "publicados" : "despublicados"}.`);
    })();
  };


  const alternarPublicacao = async (r: Registro) => {
    const acao = r.publicado ? "despublicar" : "publicar";
    if (!r.publicado && !r.funcionario_id) {
      toast.error("Vincule o funcionário no lote antes de publicar.");
      return;
    }
    // Resposta imediata + execução em segundo plano
    setRegistros((prev) => prev.map((x) => (x.id === r.id ? { ...x, publicado: !r.publicado } : x)));
    toast.info(acao === "publicar" ? "Publicando no portal em segundo plano..." : "Despublicando em segundo plano...");

    void (async () => {
      const { data, error } = await supabase.functions.invoke("publicar-holerite-item", {
        body: { item_id: r.id, acao },
      });
      const err = error?.message || (data as any)?.error;
      if (err) {
        setRegistros((prev) => prev.map((x) => (x.id === r.id ? { ...x, publicado: r.publicado } : x)));
        toast.error(err);
        return;
      }
      toast.success(r.publicado ? "Holerite despublicado do portal." : "Holerite publicado no portal.");
    })();
  };


  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_holerites_import_item")
      .select(
        "id,pagina,cpf_detectado,nome_detectado,funcionario_id,tipo,valor_liquido,salario_base,horas_trabalhadas,horas_extras,valor_horas_extras,total_proventos,total_descontos,publicado,ignorar,lote:portal_holerites_import_lote(competencia_mes,competencia_ano,arquivo_nome)"
      )
      .order("created_at", { ascending: false })
      .limit(3000);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRegistros((data || []) as any);

    const { data: assin } = await supabase
      .from("portal_holerites")
      .select("funcionario_id,tipo,competencia_mes,competencia_ano,assinado_em,assinatura_imagem,assinatura_hash,assinatura_ip")
      .not("assinado_em", "is", null)
      .limit(5000);
    const mapa: Record<string, Assinatura> = {};
    (assin || []).forEach((a: any) => {
      mapa[`${a.funcionario_id}|${a.tipo}|${a.competencia_mes}|${a.competencia_ano}`] = a;
    });
    setAssinaturas(mapa);
  };

  useEffect(() => { carregar(); }, []);

  const nomeFuncionario = (r: Registro) => {
    const f = funcionarios.find((x: any) => x.id === r.funcionario_id);
    return f?.nome || r.nome_detectado || "—";
  };

  const assinaturaDe = (r: Registro) =>
    assinaturas[`${r.funcionario_id}|${r.tipo}|${r.lote?.competencia_mes}|${r.lote?.competencia_ano}`];

  const paraHolerite = (r: Registro): HoleriteDados => {
    const f: any = funcionarios.find((x: any) => x.id === r.funcionario_id);
    const a = assinaturaDe(r);
    return {
      competenciaMes: r.lote?.competencia_mes ?? null,
      competenciaAno: r.lote?.competencia_ano ?? null,
      tipo: r.tipo,
      funcionarioNome: nomeFuncionario(r),
      funcionarioCpf: f?.cpf || r.cpf_detectado || "",
      funcionarioCargo: f?.cargoNome || f?.cargo || "",
      salarioBase: r.salario_base,
      horasTrabalhadas: r.horas_trabalhadas,
      horasExtras: r.horas_extras,
      valorHorasExtras: r.valor_horas_extras,
      totalProventos: r.total_proventos,
      totalDescontos: r.total_descontos,
      valorLiquido: r.valor_liquido,
      assinaturaImagem: a?.assinatura_imagem ?? null,
      assinadoEm: a?.assinado_em ?? null,
      assinaturaHash: a?.assinatura_hash ?? null,
      assinaturaIp: a?.assinatura_ip ?? null,
    };
  };


  const imprimirUm = (r: Registro) => imprimirHolerite(paraHolerite(r), empresa as any);

  const nomeArquivo = (r: Registro) =>
    `holerite-${nomeFuncionario(r).replace(/[^\w]+/g, "-").toLowerCase()}-${String(r.lote?.competencia_mes ?? "").padStart(2, "0")}-${r.lote?.competencia_ano ?? ""}.pdf`;

  const baixarUm = (r: Registro) => baixarHolerite(paraHolerite(r), empresa as any, nomeArquivo(r));

  const baixarSelecionados = () => {
    const alvos = registros.filter((r) => selecionados.includes(r.id));
    if (!alvos.length) return;
    baixarHolerite(alvos.map(paraHolerite), empresa as any, "holerites.pdf");
  };

  const imprimirSelecionados = () => {
    const alvos = registros.filter((r) => selecionados.includes(r.id));
    if (!alvos.length) return;
    imprimirHolerite(alvos.map(paraHolerite), empresa as any);
  };

  const anos = useMemo(() => {
    const s = new Set<string>();
    registros.forEach((r) => r.lote && s.add(String(r.lote.competencia_ano)));
    s.add(String(now.getFullYear()));
    return Array.from(s).sort().reverse();
  }, [registros]);

  const semAcento = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    const qDigitos = busca.replace(/\D/g, "");
    const lista = registros.filter((r) => {
      if (r.ignorar) return false;
      if (ano !== "todos" && String(r.lote?.competencia_ano) !== ano) return false;
      if (mes !== "todos" && String(r.lote?.competencia_mes) !== mes) return false;
      if (tipo !== "todos" && r.tipo !== tipo) return false;
      if (!q) return true;
      const nomeOk = semAcento(nomeFuncionario(r)).includes(q);
      const cpfOk =
        qDigitos.length > 0 &&
        (r.cpf_detectado || "").replace(/\D/g, "").includes(qDigitos);
      return nomeOk || cpfOk;
    });

    if (!ordenacao) return lista;

    const dir = ordenacao.direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      let va: any;
      let vb: any;
      switch (ordenacao.coluna) {
        case "competencia":
          va = (a.lote?.competencia_ano ?? 0) * 100 + (a.lote?.competencia_mes ?? 0);
          vb = (b.lote?.competencia_ano ?? 0) * 100 + (b.lote?.competencia_mes ?? 0);
          break;
        case "funcionario_id":
          va = semAcento(nomeFuncionario(a));
          vb = semAcento(nomeFuncionario(b));
          break;
        case "cpf_detectado":
          va = (a.cpf_detectado || "").replace(/\D/g, "");
          vb = (b.cpf_detectado || "").replace(/\D/g, "");
          break;
        case "tipo":
          va = TIPOS[a.tipo] || a.tipo;
          vb = TIPOS[b.tipo] || b.tipo;
          break;
        case "status":
          va = a.publicado ? 1 : 0;
          vb = b.publicado ? 1 : 0;
          break;
        default:
          va = a[ordenacao.coluna];
          vb = b[ordenacao.coluna];
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt-BR", { numeric: true }) * dir;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * dir;
    });
  }, [registros, busca, mes, ano, tipo, funcionarios, ordenacao]);


  useEffect(() => { setPagina(1); }, [busca, mes, ano, tipo, porPagina]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const visiveis = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const soma = (k: keyof Registro) =>
    filtrados.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);

  const exportarCsv = () => {
    const linhas = [
      ["Competência","Funcionário","CPF","Tipo","Salário base","Horas","Horas extras","Valor HE","Proventos","Descontos","Líquido","Publicado"],
      ...filtrados.map((r) => [
        r.lote ? `${String(r.lote.competencia_mes).padStart(2,"0")}/${r.lote.competencia_ano}` : "",
        nomeFuncionario(r), r.cpf_detectado || "", TIPOS[r.tipo] || r.tipo,
        r.salario_base ?? "", r.horas_trabalhadas ?? "", r.horas_extras ?? "",
        r.valor_horas_extras ?? "", r.total_proventos ?? "", r.total_descontos ?? "",
        r.valor_liquido ?? "", r.publicado ? "Sim" : "Não",
      ]),
    ];
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "holerites-processados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cabecalhoOrdenavel = (
    coluna: keyof Registro | "competencia" | "status",
    label: string,
    align: "left" | "right" | "center" = "left"
  ) => {
    const ativo = ordenacao?.coluna === coluna;
    const proxima = ativo && ordenacao.direcao === "asc" ? "desc" : "asc";
    const Icon = ativo ? (ordenacao.direcao === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
      <TableHead className={align === "right" ? "text-right" : align === "center" ? "text-center" : undefined}>
        <button
          type="button"
          onClick={() => setOrdenacao({ coluna, direcao: proxima })}
          className={`flex items-center gap-1 ${alignClass} w-full hover:text-foreground focus:outline-none`}
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${ativo ? "text-foreground" : "text-muted-foreground/60"}`} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Holerites Processados</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {!!selecionados.length && (
            <>
              <span className="text-sm text-muted-foreground">{selecionados.length} selecionado(s)</span>
              <Button size="sm" disabled={!!lote} onClick={() => executarLote("publicar")}>
                {lote ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{lote.feito}/{lote.total}</> : <><Upload className="mr-2 h-4 w-4" />Publicar selecionados</>}
              </Button>
              <Button size="sm" variant="outline" disabled={!!lote} onClick={() => executarLote("despublicar")}>
                <Undo2 className="mr-2 h-4 w-4" />Despublicar selecionados
              </Button>
              <Button size="sm" variant="outline" onClick={imprimirSelecionados}>
                <Printer className="mr-2 h-4 w-4" />Imprimir selecionados
              </Button>
              <Button size="sm" variant="outline" onClick={baixarSelecionados}>
                <Download className="mr-2 h-4 w-4" />Baixar PDF
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="mr-2 h-4 w-4" />Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!filtrados.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Holerites", v: String(filtrados.length) },
          { l: "Total salários", v: money(soma("salario_base")) },
          { l: "Horas extras", v: horas(soma("horas_extras")) },
          { l: "Total líquido", v: money(soma("valor_liquido")) },
        ].map((k) => (
          <Card key={k.l}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{k.l}</p>
              <p className="text-xl font-semibold">{k.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Buscar (nome ou CPF)</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para filtrar…" />
          </div>
          <div>
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPOS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={!!visiveis.length && visiveis.every((v) => selecionados.includes(v.id))}
                          onCheckedChange={(v) =>
                            setSelecionados((prev) =>
                              v ? [...new Set([...prev, ...visiveis.map((x) => x.id)])] : prev.filter((id) => !visiveis.some((x) => x.id === id))
                            )
                          }
                        />
                      </TableHead>
                      {cabecalhoOrdenavel("competencia", "Competência")}
                      {cabecalhoOrdenavel("funcionario_id", "Funcionário")}
                      {cabecalhoOrdenavel("cpf_detectado", "CPF")}
                      {cabecalhoOrdenavel("tipo", "Tipo")}
                      {cabecalhoOrdenavel("salario_base", "Salário base", "right")}
                      {cabecalhoOrdenavel("horas_trabalhadas", "Horas", "right")}
                      {cabecalhoOrdenavel("horas_extras", "Horas extras", "right")}
                      {cabecalhoOrdenavel("valor_horas_extras", "Valor HE", "right")}
                      {cabecalhoOrdenavel("total_proventos", "Proventos", "right")}
                      {cabecalhoOrdenavel("total_descontos", "Descontos", "right")}
                      {cabecalhoOrdenavel("valor_liquido", "Líquido", "right")}
                      {cabecalhoOrdenavel("status", "Status", "center")}
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveis.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selecionados.includes(r.id)}
                            onCheckedChange={(v) => alternarSelecao(r.id, !!v)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.lote ? `${String(r.lote.competencia_mes).padStart(2, "0")}/${r.lote.competencia_ano}` : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{nomeFuncionario(r)}</TableCell>
                        <TableCell className="text-sm">{r.cpf_detectado || "—"}</TableCell>
                        <TableCell className="text-sm">{TIPOS[r.tipo] || r.tipo}</TableCell>
                        <TableCell className="text-right">{money(r.salario_base)}</TableCell>
                        <TableCell className="text-right">{horas(r.horas_trabalhadas)}</TableCell>
                        <TableCell className="text-right">{horas(r.horas_extras)}</TableCell>
                        <TableCell className="text-right">{money(r.valor_horas_extras)}</TableCell>
                        <TableCell className="text-right">{money(r.total_proventos)}</TableCell>
                        <TableCell className="text-right">{money(r.total_descontos)}</TableCell>
                        <TableCell className="text-right font-semibold">{money(r.valor_liquido)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={r.publicado ? "default" : "secondary"}>
                              {r.publicado ? "Publicado" : "Em conferência"}
                            </Badge>
                            {assinaturaDe(r)?.assinado_em && (
                              <Badge
                                variant="outline"
                                title={`Assinado em ${new Date(assinaturaDe(r)!.assinado_em!).toLocaleString("pt-BR")}${assinaturaDe(r)?.assinatura_hash ? ` — SHA-256 ${assinaturaDe(r)!.assinatura_hash}` : ""}`}
                              >
                                Assinado
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Imprimir holerite"
                            onClick={() => imprimirUm(r)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Baixar holerite em PDF"
                            onClick={() => baixarUm(r)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={r.publicado ? "outline" : "default"}
                            className="whitespace-nowrap"
                            disabled={processando === r.id}
                            onClick={() => alternarPublicacao(r)}
                          >
                            {processando === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : r.publicado ? (
                              <><Undo2 className="mr-1 h-4 w-4" />Despublicar</>
                            ) : (
                              <><Upload className="mr-1 h-4 w-4" />Publicar</>
                            )}
                          </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!visiveis.length && (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                          Nenhum holerite processado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                currentPage={pagina}
                totalItems={filtrados.length}
                pageSize={porPagina}
                onPageChange={setPagina}
                onPageSizeChange={setPorPagina}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
