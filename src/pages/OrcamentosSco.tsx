import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, FileSpreadsheet, Pencil, Trash2, Upload, Search } from "lucide-react";
import { useOrcamentosSco } from "@/contexts/OrcamentosScoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { gerarPdfOrcamentoSco } from "@/lib/gerarPdfOrcamentoSco";
import { gerarExcelOrcamentoSco } from "@/lib/gerarExcelOrcamentoSco";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

export default function OrcamentosSco() {
  const nav = useNavigate();
  const { orcamentos, remove, countCatalog } = useOrcamentosSco();
  const { empresa } = useEmpresa() as any;
  const { tem } = usePermissao();
  const podeCriar = tem("orcamentos_sco.criar");
  const podeEditar = tem("orcamentos_sco.editar");
  const podeExcluir = tem("orcamentos_sco.excluir");
  const podeExportar = tem("orcamentos_sco.exportar");
  const podeImportarCat = tem("orcamentos_sco.importar_catalogo");
  const podeVerCat = tem("orcamentos_sco.visualizar_catalogo");
  const [filtro, setFiltro] = useState("");
  const [counts, setCounts] = useState({ elementares: 0, servicos: 0, composicoes: 0 });
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => { countCatalog().then(setCounts); }, [countCatalog]);

  const filtrados = useMemo(() => {
    const t = filtro.toLowerCase();
    if (!t) return orcamentos;
    return orcamentos.filter((o) =>
      String(o.numero).includes(t) ||
      o.titulo.toLowerCase().includes(t) ||
      (o.cliente_nome || "").toLowerCase().includes(t),
    );
  }, [orcamentos, filtro]);

  const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold">Orçamentos SCO</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo: {counts.servicos} serviços • {counts.elementares} elementares • {counts.composicoes} composições
          </p>
        </div>
        <div className="flex gap-2">
          {podeVerCat && <Button variant="outline" onClick={() => nav("/orcamentos/catalogo")}>
            <Search className="h-4 w-4 mr-1" /> Catálogo SCO
          </Button>}
          {podeImportarCat && <Button variant="outline" onClick={() => nav("/orcamentos/importar")}>
            <Upload className="h-4 w-4 mr-1" /> Importar Catálogo
          </Button>}
          {podeCriar && <Button onClick={() => nav("/orcamentos/novo")} style={{ background: "#673ab7" }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Orçamento
          </Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Orçamentos</CardTitle>
          <Input placeholder="Buscar por número, título ou cliente..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-md mt-2" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum orçamento.</TableCell></TableRow>
              )}
              {filtrados.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono">{String(o.numero).padStart(3, "0")}/{new Date(o.created_at).getFullYear()}</TableCell>
                  <TableCell className="font-medium">{o.titulo}</TableCell>
                  <TableCell>{o.cliente_nome || "-"}</TableCell>
                  <TableCell><Badge variant={o.tipo_analise === "analitica" ? "default" : "secondary"}>{o.tipo_analise}</Badge></TableCell>
                  <TableCell>{o.itens.length}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(o.valor_total)}</TableCell>
                  <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {podeExportar && <Button size="icon" variant="ghost" title="PDF" onClick={() => gerarPdfOrcamentoSco(o, empresa?.nome || "")}><FileText className="h-4 w-4" /></Button>}
                      {podeExportar && <Button size="icon" variant="ghost" title="Excel" onClick={() => gerarExcelOrcamentoSco(o)}><FileSpreadsheet className="h-4 w-4" /></Button>}
                      {podeEditar && <Button size="icon" variant="ghost" title="Editar" onClick={() => nav(`/orcamentos/${o.id}`)}><Pencil className="h-4 w-4" /></Button>}
                      {podeExcluir && <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDelId(o.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {delId && (
        <DoubleConfirmDelete
          open={!!delId}
          onOpenChange={(o) => { if (!o) setDelId(null); }}
          onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); setDelId(null); return; } await remove(delId!); setDelId(null); }}
        />
      )}
    </div>
  );
}
