import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileSpreadsheet } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { gerarPdfEstoque, gerarExcelEstoque } from "@/lib/gerarRelatorioEstoque";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface PedidoItem {
  itemId?: string;
  descricao?: string;
  quantidade?: number;
  precoUnitario?: number;
  valorTotal?: number;
  unidadeMedida?: string;
}

interface PedidoRow {
  numero: number;
  data_criacao: string | null;
  created_at: string;
  fornecedor_nome: string | null;
  itens: PedidoItem[] | null;
  status: string;
}

interface Material {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string | null;
  categoria_id: string | null;
}

interface CompraHist {
  data: string;
  preco: number;
  quantidade: number;
  fornecedor: string;
  pedido: number;
  rawDate: number;
}

interface LinhaBanco {
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  grupoId: string;
  grupoNome: string;
  ultimas: CompraHist[];
  media: number;
  ultimoPreco: number;
}

const STATUS_VALIDOS = ["Comprado", "Entregue", "Entregue Parcial", "Emitido"];

const formatMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
};

export default function BancoPrecos() {
  const { empresa } = useEmpresa();
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [reqItemToMaterial, setReqItemToMaterial] = useState<Map<string, string>>(new Map());
  const [materialToGrupo, setMaterialToGrupo] = useState<Map<string, { id: string; nome: string }>>(new Map());
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [grupoFilter, setGrupoFilter] = useState<string>("__all__");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, m, r, gRes, sgRes, clRes] = await Promise.all([
        supabase
          .from("pedidos_compra")
          .select("numero, data_criacao, created_at, fornecedor_nome, itens, status")
          .in("status", STATUS_VALIDOS)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("materiais_servicos").select("id, codigo, descricao, unidade_medida, categoria_id"),
        supabase.from("requisicoes_compras").select("itens").limit(2000),
        supabase.from("categorias_compras_grupos").select("id, nome").order("nome"),
        supabase.from("categorias_compras_subgrupos").select("id, grupo_id"),
        supabase.from("categorias_compras_classes").select("id, sub_grupo_id"),
      ]);
      const mats = (m.data as Material[]) || [];
      setPedidos((p.data as any) || []);
      setMateriais(mats);
      setGrupos((gRes.data as any) || []);

      const reqMap = new Map<string, string>();
      ((r.data as any[]) || []).forEach((rc) => {
        const itens = Array.isArray(rc.itens) ? rc.itens : [];
        itens.forEach((it: any) => {
          if (it?.id && it?.materialId) reqMap.set(String(it.id), String(it.materialId));
        });
      });
      setReqItemToMaterial(reqMap);

      // Build chain: class -> subgroup -> group
      const subgrupoToGrupo = new Map<string, string>();
      ((sgRes.data as any[]) || []).forEach((sg) => subgrupoToGrupo.set(String(sg.id), String(sg.grupo_id)));
      const classeToGrupo = new Map<string, string>();
      ((clRes.data as any[]) || []).forEach((cl) => {
        const gid = subgrupoToGrupo.get(String(cl.sub_grupo_id));
        if (gid) classeToGrupo.set(String(cl.id), gid);
      });
      const grupoById = new Map<string, string>();
      ((gRes.data as any[]) || []).forEach((g) => grupoById.set(String(g.id), g.nome));

      const matGrupo = new Map<string, { id: string; nome: string }>();
      mats.forEach((mat) => {
        if (!mat.categoria_id) return;
        const gid = classeToGrupo.get(String(mat.categoria_id));
        if (gid) matGrupo.set(mat.id, { id: gid, nome: grupoById.get(gid) || "" });
      });
      setMaterialToGrupo(matGrupo);

      setLoading(false);
    })();
  }, []);

  const matById = useMemo(() => {
    const map = new Map<string, Material>();
    materiais.forEach((m) => map.set(m.id, m));
    return map;
  }, [materiais]);

  const matByDesc = useMemo(() => {
    const map = new Map<string, Material>();
    materiais.forEach((m) => map.set(m.descricao.toUpperCase().trim(), m));
    return map;
  }, [materiais]);

  const linhas = useMemo<LinhaBanco[]>(() => {
    const tsIni = dataIni ? new Date(dataIni + "T00:00:00").getTime() : -Infinity;
    const tsFim = dataFim ? new Date(dataFim + "T23:59:59").getTime() : Infinity;

    const agrup = new Map<string, CompraHist[]>();

    for (const ped of pedidos) {
      const itens = Array.isArray(ped.itens) ? ped.itens : [];
      const dataISO = ped.created_at;
      const ts = new Date(dataISO).getTime();
      if (ts < tsIni || ts > tsFim) continue;
      for (const it of itens) {
        const desc = (it.descricao || "").toUpperCase().trim();
        let materialId = reqItemToMaterial.get(String(it.itemId || "")) || "";
        if (!materialId && desc) {
          const m = matByDesc.get(desc);
          if (m) materialId = m.id;
        }
        const key = materialId || (desc ? `desc:${desc}` : "");
        if (!key) continue;
        const preco = Number(it.precoUnitario) || 0;
        if (preco <= 0) continue;
        const arr = agrup.get(key) || [];
        arr.push({
          data: dataISO,
          preco,
          quantidade: Number(it.quantidade) || 0,
          fornecedor: ped.fornecedor_nome || "-",
          pedido: ped.numero,
          rawDate: ts,
        });
        agrup.set(key, arr);
      }
    }

    const out: LinhaBanco[] = [];
    agrup.forEach((compras, key) => {
      compras.sort((a, b) => b.rawDate - a.rawDate);
      const ultimas = compras.slice(0, 10);
      const media = ultimas.reduce((s, c) => s + c.preco, 0) / ultimas.length;

      let codigo = "-";
      let descricao = "";
      let unidade = "";
      let grupoId = "";
      let grupoNome = "";
      if (key.startsWith("desc:")) {
        descricao = key.slice(5);
      } else {
        const mat = matById.get(key);
        if (mat) {
          codigo = mat.codigo;
          descricao = mat.descricao;
          unidade = mat.unidade_medida || "";
        } else {
          descricao = "(material removido)";
        }
        const g = materialToGrupo.get(key);
        if (g) {
          grupoId = g.id;
          grupoNome = g.nome;
        }
      }
      out.push({
        itemId: key,
        codigo,
        descricao,
        unidade,
        grupoId,
        grupoNome,
        ultimas,
        media,
        ultimoPreco: ultimas[0].preco,
      });
    });

    return out.sort((a, b) => a.descricao.localeCompare(b.descricao));
  }, [pedidos, matById, matByDesc, reqItemToMaterial, materialToGrupo, dataIni, dataFim]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (q && !(l.descricao.toLowerCase().includes(q) || l.codigo.toLowerCase().includes(q))) return false;
      if (grupoFilter !== "__all__") {
        if (grupoFilter === "__none__") {
          if (l.grupoId) return false;
        } else if (l.grupoId !== grupoFilter) return false;
      }
      return true;
    });
  }, [linhas, busca, grupoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const pageData = filtradas.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [busca, pageSize, dataIni, dataFim, grupoFilter]);

  function buildExportRows() {
    const columns = [
      "Código",
      "Descrição",
      "UN",
      "Grupo",
      "Qtd. Compras",
      "Última Compra",
      "Último Preço",
      "Preço Médio",
      "Últimas 10 (data — preço — fornecedor)",
    ];
    const rows = filtradas.map((l) => [
      l.codigo,
      l.descricao,
      l.unidade,
      l.grupoNome || "-",
      String(l.ultimas.length),
      formatDate(l.ultimas[0].data),
      formatMoney(l.ultimoPreco),
      formatMoney(l.media),
      l.ultimas
        .map((c) => `${formatDate(c.data)} ${formatMoney(c.preco)} (${c.fornecedor})`)
        .join(" | "),
    ]);
    return { columns, rows };
  }

  function filtrosTexto() {
    const parts: string[] = [];
    if (dataIni) parts.push(`De: ${formatDate(dataIni)}`);
    if (dataFim) parts.push(`Até: ${formatDate(dataFim)}`);
    if (grupoFilter !== "__all__") {
      const g = grupos.find((x) => x.id === grupoFilter);
      parts.push(`Grupo: ${grupoFilter === "__none__" ? "Sem grupo" : g?.nome || "-"}`);
    }
    if (busca) parts.push(`Busca: ${busca}`);
    return parts.join(" | ");
  }

  function handleExportPdf() {
    const { columns, rows } = buildExportRows();
    gerarPdfEstoque("Banco de Preços", columns, rows, filtrosTexto(), empresa?.logoUrl);
  }

  function handleExportExcel() {
    const { columns, rows } = buildExportRows();
    gerarExcelEstoque("Banco de Preços", columns, rows, filtrosTexto());
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Banco de Preços</h1>
          <p className="text-muted-foreground">
            Histórico de preços de compra por material/serviço, com média das últimas 10 aquisições.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={filtradas.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={filtradas.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Buscar</Label>
            <Input
              placeholder="Código ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div>
            <Label>Data inicial</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Data final</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Grupo de material</Label>
            <Select value={grupoFilter} onValueChange={setGrupoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                <SelectItem value="__none__">Sem grupo</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {loading ? "Carregando..." : `${filtradas.length} item(ns)`}
            </div>
            {(busca || dataIni || dataFim || grupoFilter !== "__all__") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusca("");
                  setDataIni("");
                  setDataFim("");
                  setGrupoFilter("__all__");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">UN</TableHead>
                <TableHead className="w-40">Grupo</TableHead>
                <TableHead>Últimas 10 compras (data / preço)</TableHead>
                <TableHead className="w-32 text-right">Último preço</TableHead>
                <TableHead className="w-32 text-right">Preço médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma compra encontrada.
                  </TableCell>
                </TableRow>
              )}
              {pageData.map((l) => (
                <TableRow key={l.itemId}>
                  <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                  <TableCell className="font-medium">{l.descricao}</TableCell>
                  <TableCell>{l.unidade}</TableCell>
                  <TableCell className="text-xs">{l.grupoNome || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {l.ultimas.map((c, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="font-normal"
                          title={`Pedido #${c.pedido} — ${c.fornecedor} — Qtd: ${c.quantidade}`}
                        >
                          {formatDate(c.data)} · {formatMoney(c.preco)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(l.ultimoPreco)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatMoney(l.media)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtradas.length > 0 && (
        <PaginationControls
          currentPage={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalItems={filtradas.length}
        />
      )}
    </div>
  );
}
