import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/contexts/ClientesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { FolderOpen, Eye, Download, FileText, Search, X } from "lucide-react";
import type { ContratoAnexo } from "@/contexts/ClientesContext";

const BUCKET = "contratos-anexos";

interface LinhaDoc {
  key: string;
  clienteNome: string;
  clienteCodigo?: number;
  tipo: "Cliente" | "Fornecedor";
  contratoNumero: string;
  contratoDescricao: string;
  anexo: ContratoAnexo;
}

async function urlAssinada(path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 600, download ? { download } : undefined);
  if (error || !data) {
    toast.error("Não foi possível abrir o documento.");
    return null;
  }
  return data.signedUrl;
}

function normalizar(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatData(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DocumentosContratos() {
  const { clientes } = useClientes();
  const [busca, setBusca] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");

  const linhas = useMemo<LinhaDoc[]>(() => {
    const out: LinhaDoc[] = [];
    for (const c of clientes) {
      for (const k of c.contratos || []) {
        for (const a of k.anexos || []) {
          out.push({
            key: `${c.id}_${k.id}_${a.id}`,
            clienteNome: c.nome,
            clienteCodigo: c.codigo,
            tipo: c.tipo || "Cliente",
            contratoNumero: k.numero || "—",
            contratoDescricao: k.descricao || "",
            anexo: a,
          });
        }
      }
    }
    return out.sort((a, b) =>
      (a.clienteNome || "").localeCompare(b.clienteNome || "", "pt-BR") ||
      (a.contratoNumero || "").localeCompare(b.contratoNumero || "", "pt-BR", { numeric: true }) ||
      (a.anexo.nome || "").localeCompare(b.anexo.nome || "", "pt-BR")
    );
  }, [clientes]);

  const clientesComDocs = useMemo(() => {
    const set = new Map<string, { nome: string; codigo?: number }>();
    for (const l of linhas) set.set(l.clienteNome + (l.clienteCodigo ?? ""), { nome: l.clienteNome, codigo: l.clienteCodigo });
    return Array.from(set.values()).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    return linhas.filter((l) => {
      if (clienteFiltro !== "todos" && l.clienteNome !== clienteFiltro) return false;
      if (tipoFiltro !== "todos" && l.tipo !== tipoFiltro) return false;
      if (!q) return true;
      return (
        normalizar(l.clienteNome).includes(q) ||
        normalizar(l.contratoNumero).includes(q) ||
        normalizar(l.contratoDescricao).includes(q) ||
        normalizar(l.anexo.nome).includes(q)
      );
    });
  }, [linhas, busca, clienteFiltro, tipoFiltro]);

  const resumo = useMemo(() => {
    const contratos = new Set(filtradas.map((l) => `${l.clienteNome}_${l.contratoNumero}`));
    const tamanho = filtradas.reduce((s, l) => s + (l.anexo.tamanho || 0), 0);
    return { docs: filtradas.length, contratos: contratos.size, tamanho };
  }, [filtradas]);

  const temFiltro = !!busca || clienteFiltro !== "todos" || tipoFiltro !== "todos";

  const abrir = async (l: LinhaDoc, baixar = false) => {
    const url = await urlAssinada(l.anexo.path, baixar ? l.anexo.nome : undefined);
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" /> Documentos por Contrato
          </h1>
          <p className="text-sm text-muted-foreground">Todos os arquivos anexados aos contratos de clientes e fornecedores, prontos para consulta e download.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documentos</p>
            <p className="text-2xl font-bold">{resumo.docs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contratos com Documentos</p>
            <p className="text-2xl font-bold">{resumo.contratos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamanho Total</p>
            <p className="text-2xl font-bold">{formatBytes(resumo.tamanho)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-xs font-semibold text-foreground/80">Buscar</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, contrato, descrição ou arquivo..."
              className="pl-8 pr-8"
            />
            {busca && (
              <button type="button" onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Cliente / Fornecedor</Label>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {clientesComDocs.map((c) => (
                <SelectItem key={c.nome + (c.codigo ?? "")} value={c.nome}>
                  {c.codigo ? `${c.codigo} - ` : ""}{c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Tipo</Label>
          <div className="flex gap-2">
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Fornecedor">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
            {temFiltro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setBusca(""); setClienteFiltro("todos"); setTipoFiltro("todos"); }}
                title="Limpar filtros"
              >
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Documento</TableHead>
                  <TableHead className="px-4 py-3">Contrato</TableHead>
                  <TableHead className="px-4 py-3">Cliente / Fornecedor</TableHead>
                  <TableHead className="px-4 py-3">Tamanho</TableHead>
                  <TableHead className="px-4 py-3">Enviado em</TableHead>
                  <TableHead className="px-4 py-3 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {temFiltro ? "Nenhum documento encontrado com os filtros aplicados." : "Nenhum documento anexado aos contratos."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[260px]" title={l.anexo.nome}>{l.anexo.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="truncate max-w-[220px]" title={l.contratoDescricao}>
                          <span className="font-semibold">Contrato {l.contratoNumero}</span>
                          {l.contratoDescricao ? <span className="text-muted-foreground"> — {l.contratoDescricao}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="truncate max-w-[220px]" title={l.clienteNome}>
                          {l.clienteCodigo ? <span className="text-muted-foreground mr-1">{l.clienteCodigo} -</span> : null}
                          {l.clienteNome}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap">{formatBytes(l.anexo.tamanho)}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap">{formatData(l.anexo.enviadoEm)}</TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="Visualizar" onClick={() => abrir(l)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Baixar" onClick={() => abrir(l, true)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
