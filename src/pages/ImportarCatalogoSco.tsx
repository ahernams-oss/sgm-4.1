import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrcamentosSco } from "@/contexts/OrcamentosScoContext";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

function parseNum(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function readRows(file: File): Promise<any[][]> {
  const buf = await file.arrayBuffer();
  const wb = (await getXLSX()).read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return (await getXLSX()).utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
}

function parseElementares(rows: any[][], referencia: string) {
  const out: any[] = [];
  for (const r of rows) {
    const cod = r[0] ? String(r[0]).trim() : "";
    if (!/^[A-Z]{3}\d/.test(cod)) continue;
    out.push({
      codigo: cod,
      descricao: String(r[1] ?? "").slice(0, 1500),
      unidade: r[2] ? String(r[2]).trim() : "",
      grupo: cod.slice(0, 3),
      reutilizado: r[3] ? String(r[3]).trim() : "",
      preco: parseNum(r[4]),
      referencia,
    });
  }
  return out;
}

function parseServicos(rows: any[][], referencia: string) {
  const out: any[] = [];
  let cap = "", capD = "", sec = "", secD = "", sub = "", subD = "";
  for (const r of rows) {
    const c0 = r[0] ? String(r[0]).trim() : "";
    const c1 = r[1] ? String(r[1]).trim() : "";
    const c2 = r[2] ? String(r[2]).trim() : "";
    const c3 = r[3] ? String(r[3]).trim() : "";
    const c4 = r[4] ? String(r[4]).trim() : "";
    const c5 = r[5];
    let m = c0.match(/^([A-Z]{2})\s+(.+)$/);
    if (m && !r[1]) { cap = m[1]; capD = m[2].slice(0, 300); continue; }
    m = c1.match(/^([A-Z]{2})\s+(\d+)\s+(.+)$/);
    if (m && !r[2]) { sec = `${m[1]} ${m[2]}`; secD = m[3].slice(0, 300); continue; }
    m = c2.match(/^([A-Z]{2})\s+(\d+\.\d+)\s+(.+)$/);
    if (m && !r[3]) { sub = `${m[1]} ${m[2]}`; subD = m[3].slice(0, 300); continue; }
    m = c2.match(/^([A-Z]{2}\s+\d+\.\d+\.\d+)(?:\s*\([^)]+\))?\s*$/);
    if (m) {
      out.push({
        codigo: c2, descricao: c3.slice(0, 1500), unidade: c4.slice(0, 20),
        preco: parseNum(c5),
        capitulo: cap, capitulo_descricao: capD,
        secao: sec, secao_descricao: secD,
        subsecao: sub, subsecao_descricao: subD,
        referencia,
      });
    }
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.codigo) ? false : (seen.add(x.codigo), true)));
}

function parseComposicoes(rows: any[][], referencia: string) {
  const out: any[] = [];
  let serv = "";
  for (const r of rows) {
    const c0 = r[0] ? String(r[0]).trim() : "";
    const c1 = r[1] ? String(r[1]).trim() : "";
    const c2 = r[2] ? String(r[2]).trim() : "";
    const c3 = r[3] ? String(r[3]).trim() : "";
    const c4 = r[4] ? String(r[4]).trim() : "";
    const c5 = r[5];
    const m = c0.match(/^([A-Z]{2}\s+\d+\.\d+\.\d+)(?:\s*\([^)]+\))?\s*$/);
    if (m) { serv = c0; continue; }
    if (serv && c2 && /^[A-Z]{3}\d/.test(c2)) {
      out.push({
        servico_codigo: serv,
        elementar_codigo: c2,
        elementar_descricao: c1.slice(0, 1000),
        unidade: c4.slice(0, 20),
        reutilizado: c3.slice(0, 20),
        quantidade: parseNum(c5),
        referencia,
      });
    }
  }
  return out;
}

async function chunkUpsert(table: string, rows: any[], opts: { onConflict?: string } = {}, onProgress?: (done: number, total: number) => void) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const q = opts.onConflict
      ? supabase.from(table as any).upsert(chunk, { onConflict: opts.onConflict })
      : supabase.from(table as any).insert(chunk);
    const { error } = await q;
    if (error) throw new Error(`${table}@${i}: ${error.message}`);
    onProgress?.(Math.min(i + size, rows.length), rows.length);
  }
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ImportarCatalogoSco() {
  const nav = useNavigate();
  const { countCatalog } = useOrcamentosSco();
  const { tem } = usePermissao();
  const podeImportar = tem("orcamentos_sco.importar_catalogo");
  const [counts, setCounts] = useState({ elementares: 0, servicos: 0, composicoes: 0 });
  const [fgv04, setFgv04] = useState<File | null>(null);
  const [fgv06, setFgv06] = useState<File | null>(null);
  const [fgv07, setFgv07] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const now = new Date();
  const [mes, setMes] = useState<string>(MESES[now.getMonth()]);
  const [ano, setAno] = useState<string>(String(now.getFullYear()));

  const refresh = () => countCatalog().then(setCounts);
  useEffect(() => { refresh(); }, []);

  const importar = async () => {
    if (!podeImportar) { toast.error("Você não possui permissão para importar o catálogo."); return; }
    if (!fgv04 && !fgv06 && !fgv07) { toast.error("Selecione ao menos um arquivo"); return; }
    if (!mes || !ano) { toast.error("Informe mês e ano da tabela de preços"); return; }
    const referencia = `${mes}/${ano}`;
    setLoading(true);
    try {
      const result: Record<string, number> = {};

      if (fgv04) {
        setProgress("Lendo FGV04...");
        const rows = await readRows(fgv04);
        const parsed = parseElementares(rows, referencia);
        setProgress(`Apagando elementares de ${referencia}...`);
        await supabase.from("sco_elementares").delete().eq("referencia", referencia);
        await chunkUpsert("sco_elementares", parsed, { onConflict: "codigo,referencia" }, (d, t) =>
          setProgress(`Elementares (${referencia}): ${d}/${t}`));
        result.elementares = parsed.length;
      }

      if (fgv06) {
        setProgress("Lendo FGV06...");
        const rows = await readRows(fgv06);
        const parsed = parseServicos(rows, referencia);
        setProgress(`Apagando serviços de ${referencia}...`);
        await supabase.from("sco_servicos").delete().eq("referencia", referencia);
        await chunkUpsert("sco_servicos", parsed, { onConflict: "codigo,referencia" }, (d, t) =>
          setProgress(`Serviços (${referencia}): ${d}/${t}`));
        result.servicos = parsed.length;
      }

      if (fgv07) {
        setProgress("Lendo FGV07...");
        const rows = await readRows(fgv07);
        const parsed = parseComposicoes(rows, referencia);
        setProgress(`Apagando composições de ${referencia}...`);
        await supabase.from("sco_composicoes").delete().eq("referencia", referencia);
        await chunkUpsert("sco_composicoes", parsed, {}, (d, t) =>
          setProgress(`Composições (${referencia}): ${d}/${t}`));
        result.composicoes = parsed.length;
      }

      toast.success(`Importação concluída (${referencia}): ${JSON.stringify(result)}`);
      await refresh();
      setFgv04(null); setFgv06(null); setFgv07(null);
      setProgress("");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + (e.message || e));
    } finally { setLoading(false); }
  };


  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav("/orcamentos")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl sm:text-2xl font-serif font-bold">Importar Catálogo SCO/FGV</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Estado atual</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
          <div><div className="text-xl sm:text-2xl font-bold" style={{ color: "#673ab7" }}>{counts.elementares}</div><div className="text-xs text-muted-foreground">Elementares</div></div>
          <div><div className="text-xl sm:text-2xl font-bold" style={{ color: "#673ab7" }}>{counts.servicos}</div><div className="text-xs text-muted-foreground">Serviços</div></div>
          <div><div className="text-xl sm:text-2xl font-bold" style={{ color: "#673ab7" }}>{counts.composicoes}</div><div className="text-xs text-muted-foreground">Composições</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Carregar planilhas FGV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md border" style={{ borderColor: "#673ab7" }}>
            <div>
              <Label>Mês da tabela</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <div>
            <Label>FGV04 — Itens Elementares (.xlsx)</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFgv04(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>FGV06 — Itens de Serviço (.xlsx)</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFgv06(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>FGV07 — Composições (.xlsx)</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFgv07(e.target.files?.[0] || null)} />
          </div>
          <p className="text-xs text-muted-foreground">A importação substitui apenas a tabela da referência informada (Mês/Ano), preservando outras versões. O processamento é feito no navegador em lotes — pode levar alguns minutos para o FGV07.</p>
          {progress && <p className="text-xs font-semibold" style={{ color: "#673ab7" }}>{progress}</p>}
          {podeImportar && <Button onClick={importar} disabled={loading} style={{ background: "#673ab7" }}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {loading ? "Importando..." : "Importar"}
          </Button>}
        </CardContent>
      </Card>
    </div>
  );
}
