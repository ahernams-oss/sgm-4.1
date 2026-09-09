import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileDown, ArrowDownToLine, ArrowUpFromLine, Camera, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FuncionarioCombobox from "@/components/FuncionarioCombobox";
import { useFuncionarios, EpiItem } from "@/contexts/FuncionariosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useCargos } from "@/contexts/CargosContext";
import { useEpisDevolucoes } from "@/contexts/EpisDevolucoesContext";
import { gerarPdfProntuarioEpi, ProntuarioEvento } from "@/lib/gerarPdfProntuarioEpi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (d: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const BUCKET = "epi-recebimentos-selfies";

interface Evidencia {
  paths: string[];
  hashes: string[];
  confirmadoEm?: string;
  ip?: string;
}

type EventoUI = ProntuarioEvento & { evidencia?: Evidencia };

const signedUrl = async (path: string): Promise<string | null> => {
  const { data } = await (supabase as any).storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl || null;
};

const urlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export default function ProntuarioEpis() {
  const { funcionarios } = useFuncionarios();
  const { clientes } = useClientes();
  const { cargos } = useCargos();
  const { devolucoes } = useEpisDevolucoes();

  const [funcionarioId, setFuncionarioId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [devRows, setDevRows] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ urls: string[]; ev: EventoUI } | null>(null);
  const [gerando, setGerando] = useState(false);

  const func = funcionarios.find((f) => f.id === funcionarioId);
  const clienteNome = clientes.find((c) => c.id === func?.clienteId)?.nome || "—";
  const cargoNome = cargos.find((c: any) => c.id === func?.cargoId)?.nome || "—";

  const epis = ((func?.epis as EpiItem[] | null) || []);
  const devsFunc = useMemo(
    () => devolucoes.filter((d) => d.funcionarioId === funcionarioId),
    [devolucoes, funcionarioId]
  );

  useEffect(() => {
    if (!funcionarioId) { setRecebimentos([]); setDevRows([]); return; }
    (async () => {
      const [rec, dev] = await Promise.all([
        (supabase as any).from("epis_recebimentos").select("*").eq("funcionario_id", funcionarioId),
        (supabase as any).from("epis_devolucoes").select("*").eq("funcionario_id", funcionarioId),
      ]);
      setRecebimentos(rec.data || []);
      setDevRows(dev.data || []);
    })();
  }, [funcionarioId]);

  const evidenciaDe = (r: any): Evidencia | undefined => {
    const paths = [r?.selfie_path, r?.selfie_path_2].filter(Boolean) as string[];
    const hashes = [r?.selfie_hash, r?.selfie_hash_2].filter(Boolean) as string[];
    if (!paths.length && !hashes.length) return undefined;
    return { paths, hashes, confirmadoEm: r?.confirmado_em || r?.verificado_em || "", ip: r?.ip || "" };
  };

  const evidenciaEntrega = useMemo(() => {
    const map: Record<string, Evidencia> = {};
    recebimentos.forEach((r) => {
      const ev = evidenciaDe(r);
      if (!ev) return;
      (r.epis_ids || []).forEach((id: string) => { map[id] = ev; });
    });
    return map;
  }, [recebimentos]);

  const evidenciaDevolucao = useMemo(() => {
    const map: Record<string, Evidencia> = {};
    devRows.forEach((r) => {
      const ev = evidenciaDe(r);
      if (ev) map[r.id] = ev;
    });
    return map;
  }, [devRows]);

  const devolvidoPorItem = useMemo(() => {
    const map: Record<string, number> = {};
    devsFunc.forEach((d) => { map[d.epiItemId] = (map[d.epiItemId] || 0) + Number(d.quantidade || 0); });
    return map;
  }, [devsFunc]);

  const emAberto = useMemo(
    () =>
      epis
        .map((e) => ({
          descricao: e.descricao,
          ca: e.ca || "",
          quantidade: Number(e.quantidade || 0) - (devolvidoPorItem[e.id] || 0),
          dataEntrega: e.dataEntrega || "",
          dataVencimento: e.dataVencimento || "",
          motivo: (e as any).motivo || "",
          pedido: (e as any).pedido || "",
        }))
        .filter((e) => e.quantidade > 0),
    [epis, devolvidoPorItem]
  );

  const eventos: EventoUI[] = useMemo(() => {
    const list: EventoUI[] = [];
    epis.forEach((e) => {
      if (!e.dataEntrega) return;
      list.push({
        data: e.dataEntrega,
        tipo: "Entrega",
        descricao: e.descricao,
        ca: e.ca || "",
        quantidade: Number(e.quantidade || 0),
        detalhe: [
          e.dataVencimento ? `Vencimento: ${fmt(e.dataVencimento)}` : "",
          (e as any).motivo ? `Motivo: ${(e as any).motivo}` : "",
          (e as any).pedido ? `Pedido: ${(e as any).pedido}` : "",
        ].filter(Boolean).join(" • "),
        evidencia: evidenciaEntrega[e.id],
      });
    });
    devsFunc.forEach((d) => {
      list.push({
        data: d.dataDevolucao,
        tipo: "Devolução",
        descricao: d.descricao,
        ca: d.ca,
        quantidade: Number(d.quantidade || 0),
        detalhe: [d.motivo, d.condicao, d.destino, d.observacao].filter(Boolean).join(" • "),
        evidencia: evidenciaDevolucao[d.id],
      });
    });
    return list
      .filter((e) => (!de || e.data >= de) && (!ate || e.data <= ate))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [epis, devsFunc, de, ate, evidenciaEntrega, evidenciaDevolucao]);

  const abrirFotos = async (ev: EventoUI) => {
    const paths = ev.evidencia?.paths || [];
    if (!paths.length) { toast.error("Sem registro fotográfico."); return; }
    const urls = (await Promise.all(paths.map(signedUrl))).filter(Boolean) as string[];
    if (!urls.length) { toast.error("Falha ao carregar as fotos."); return; }
    setPreview({ urls, ev });
  };

  const baixarFoto = async (url: string, nome: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Falha ao baixar a foto.");
    }
  };

  const exportar = async () => {
    if (!func) { toast.error("Selecione um funcionário."); return; }
    setGerando(true);
    try {
      const comFotos = await Promise.all(
        [...eventos].reverse().map(async (e) => {
          const paths = e.evidencia?.paths || [];
          const urls = (await Promise.all(paths.map(signedUrl))).filter(Boolean) as string[];
          const fotos = (await Promise.all(urls.map(urlToDataUrl))).filter(Boolean) as string[];
          const { evidencia, ...rest } = e;
          return {
            ...rest,
            fotos,
            hashes: evidencia?.hashes || [],
            confirmadoEm: evidencia?.confirmadoEm,
            ip: evidencia?.ip,
          } as ProntuarioEvento;
        })
      );
      await gerarPdfProntuarioEpi({
        funcionarioNome: func.nome,
        cpf: func.cpf,
        cargoNome,
        clienteNome,
        admissao: func.dataAdmissao,
        eventos: comFotos,
        emAberto,
      });
      toast.success("Prontuário gerado.");
    } catch (e: any) {
      toast.error("Falha ao gerar PDF: " + (e?.message || ""));
    } finally {
      setGerando(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prontuário de EPIs</h1>
            <p className="text-sm text-muted-foreground">Histórico contínuo de recebimento e recolhimento por funcionário</p>
          </div>
        </div>
        <Button size="sm" onClick={exportar} disabled={!func || gerando}>
          <FileDown className="h-4 w-4 mr-1" /> Gerar prontuário (PDF)
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[320px]">
          <label className="text-xs text-muted-foreground">Funcionário</label>
          <FuncionarioCombobox
            value={funcionarioId}
            onChange={setFuncionarioId}
            options={[...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Período de</label>
          <Input type="date" className="w-[160px]" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Período até</label>
          <Input type="date" className="w-[160px]" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDe(""); setAte(""); }}>Limpar período</Button>
      </div>

      {!func ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione um funcionário para visualizar o prontuário.</p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{func.nome}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">CPF:</span> {func.cpf || "—"}</div>
              <div><span className="text-muted-foreground">Cargo:</span> {cargoNome}</div>
              <div><span className="text-muted-foreground">Cliente:</span> {clienteNome}</div>
              <div><span className="text-muted-foreground">Admissão:</span> {fmt(func.dataAdmissao)}</div>
              <div><span className="text-muted-foreground">Entregas:</span> {epis.length}</div>
              <div><span className="text-muted-foreground">Devoluções:</span> {devsFunc.length}</div>
              <div><span className="text-muted-foreground">Em posse:</span> {emAberto.reduce((s, e) => s + e.quantidade, 0)} item(ns)</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">EPIs em posse do funcionário</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead className="w-32 text-center">CA</TableHead>
                    <TableHead className="w-20 text-center">Qtd</TableHead>
                    <TableHead className="w-32 text-center">Entrega</TableHead>
                    <TableHead className="w-32 text-center">Vencimento</TableHead>
                    <TableHead className="w-28 text-center">Pedido</TableHead>
                    <TableHead className="w-40">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emAberto.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.descricao}</TableCell>
                      <TableCell className="text-center">{e.ca || "—"}</TableCell>
                      <TableCell className="text-center">{e.quantidade}</TableCell>
                      <TableCell className="text-center">{fmt(e.dataEntrega)}</TableCell>
                      <TableCell className="text-center">{fmt(e.dataVencimento)}</TableCell>
                      <TableCell className="text-center">{e.pedido || "—"}</TableCell>
                      <TableCell className="text-xs">{e.motivo || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {emAberto.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum EPI em posse.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="text-[11px] text-muted-foreground mt-2">
                <strong>Motivo:</strong> 1 - Admissão · 2 - Reposição por desgaste · 3 - Reposição por perda · 4 - Mudança de função · 5 - Extravio · 6 - Demissão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Histórico contínuo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {eventos.map((ev, i) => (
                  <div key={i} className="flex gap-3 border-l-2 border-border pl-4 relative">
                    <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full flex items-center justify-center ${ev.tipo === "Entrega" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                      {ev.tipo === "Entrega" ? <ArrowDownToLine className="h-2.5 w-2.5" /> : <ArrowUpFromLine className="h-2.5 w-2.5" />}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ev.tipo === "Entrega" ? "default" : "destructive"}>{ev.tipo}</Badge>
                        <span className="text-sm font-medium">{ev.descricao}</span>
                        {ev.ca && <span className="text-xs text-muted-foreground">CA {ev.ca}</span>}
                        <span className="text-xs text-muted-foreground">Qtd {ev.quantidade}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{fmt(ev.data)}</span>
                      </div>
                      {ev.detalhe && <p className="text-xs text-muted-foreground mt-0.5">{ev.detalhe}</p>}
                      {ev.evidencia ? (
                        <div className="mt-1.5 rounded-md border border-dashed p-2 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">Reconhecimento facial</Badge>
                            {ev.evidencia.confirmadoEm && (
                              <span className="text-[11px] text-muted-foreground">
                                Confirmado em {new Date(ev.evidencia.confirmadoEm).toLocaleString("pt-BR")}
                              </span>
                            )}
                            {ev.evidencia.ip && <span className="text-[11px] text-muted-foreground">IP {ev.evidencia.ip}</span>}
                            {ev.evidencia.paths.length > 0 && (
                              <Button size="sm" variant="outline" className="h-6 px-2 ml-auto" onClick={() => abrirFotos(ev)}>
                                <Camera className="h-3 w-3 mr-1" /> Ver fotos ({ev.evidencia.paths.length})
                              </Button>
                            )}
                          </div>
                          {ev.evidencia.hashes.map((h, hi) => (
                            <p key={hi} className="text-[10px] font-mono text-muted-foreground break-all">
                              Hash foto {hi + 1}: {h}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {eventos.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">Sem movimentações no período.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Registro fotográfico — {preview?.ev.tipo} de {preview?.ev.descricao}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preview?.urls.map((u, i) => (
              <div key={i} className="space-y-1">
                <img src={u} alt={`Registro facial ${i + 1}`} className="w-full rounded-md border" />
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  Hash: {preview.ev.evidencia?.hashes[i] || "—"}
                </p>
                <Button size="sm" variant="outline" className="h-7"
                  onClick={() => baixarFoto(u, `epi-${preview.ev.tipo.toLowerCase()}-${i + 1}.jpg`)}>
                  <Download className="h-3 w-3 mr-1" /> Baixar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

