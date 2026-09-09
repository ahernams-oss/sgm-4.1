import React, { useState, useEffect, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { Stethoscope, Search, Trash2, Upload, FileText, Bell, AlertTriangle, Plus, FileDown, FileSpreadsheet, Download } from "lucide-react";
import { gerarPdfExames } from "@/lib/gerarPdfExames";
import { gerarExcelExames } from "@/lib/gerarExcelExames";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIPOS_EXAME = [
  "Admissional", "Periódico", "Retorno ao Trabalho",
  "Mudança de Função", "Demissional", "Complementar",
];

interface ExamePeriodico {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_telefone: string;
  funcionario_email: string;
  tipo_exame: string;
  data_realizacao: string | null;
  data_vencimento: string;
  resultado: string;
  observacoes: string;
  clinica: string;
  anexo_aso_url: string;
  notificado_30d: boolean;
  notificado_20d: boolean;
  notificado_10d: boolean;
  created_at: string;
}

import PaginationControls, { paginate } from "@/components/PaginationControls";

const getStatusVencimento = (dataVencimento: string) => {
  const hoje = new Date();
  const venc = new Date(dataVencimento + "T00:00:00");
  const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (diffDays <= 10) return { label: `${diffDays}d`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (diffDays <= 20) return { label: `${diffDays}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  if (diffDays <= 30) return { label: `${diffDays}d`, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "OK", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
};

const ExamesPage = () => {
  const [exames, setExames] = useState<ExamePeriodico[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploading, setUploading] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const fetchExames = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exames_periodicos")
      .select("*")
      .order("data_vencimento", { ascending: true });

    if (error) {
      console.error("Erro ao buscar exames:", error);
      toast.error("Erro ao carregar exames.");
    } else {
      setExames((data as unknown as ExamePeriodico[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExames();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exames_periodicos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover exame.");
    } else {
      toast.success("Exame removido.");
      fetchExames();
    }
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const handleUploadASO = async (exame: ExamePeriodico, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB).");
      return;
    }
    setUploading(true);
    const filePath = `${exame.funcionario_id}/${exame.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("exames-aso")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar arquivo.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("exames-aso").getPublicUrl(filePath);
    await supabase
      .from("exames_periodicos")
      .update({ anexo_aso_url: urlData.publicUrl } as any)
      .eq("id", exame.id);

    toast.success("ASO anexado com sucesso.");
    setUploading(false);
    fetchExames();
  };

  const handleDownloadASO = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao baixar arquivo");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = url.split("/").pop() || "aso.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Erro ao baixar o ASO.");
    }
  };

  const filtered = useMemo(() => {
    let result = exames;
    if (filtroTipo !== "todos") {
      result = result.filter((e) => e.tipo_exame === filtroTipo);
    }
    if (filtroStatus !== "todos") {
      result = result.filter((e) => {
        const status = getStatusVencimento(e.data_vencimento);
        if (filtroStatus === "vencido") return status.label === "Vencido";
        if (filtroStatus === "proximo") return status.label !== "Vencido" && status.label !== "OK";
        if (filtroStatus === "ok") return status.label === "OK";
        return true;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.funcionario_nome.toLowerCase().includes(s) ||
          e.tipo_exame.toLowerCase().includes(s) ||
          (e.clinica && e.clinica.toLowerCase().includes(s))
      );
    }
    return result;
  }, [exames, search, filtroStatus, filtroTipo]);

  const { paginated, totalPages, safePage } = paginate(filtered, page, pageSize);
  const resetPage = () => setPage(1);

  const getNotificacaoStatus = (exame: ExamePeriodico) => {
    const flags = [];
    if (exame.notificado_30d) flags.push("30d");
    if (exame.notificado_20d) flags.push("20d");
    if (exame.notificado_10d) flags.push("10d");
    return flags.length > 0 ? flags.join(", ") : "—";
  };

  // Contadores
  const vencidos = exames.filter((e) => getStatusVencimento(e.data_vencimento).label === "Vencido").length;
  const proximos = exames.filter((e) => {
    const s = getStatusVencimento(e.data_vencimento);
    return s.label !== "Vencido" && s.label !== "OK";
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exames Periódicos</h1>
            <p className="text-sm text-muted-foreground">
              Controle de exames ocupacionais de todos os funcionários
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {vencidos > 0 && (
            <Badge variant="destructive" className="text-xs">
              {vencidos} vencido(s)
            </Badge>
          )}
          {proximos > 0 && (
            <Badge className="bg-amber-100 text-amber-700 text-xs">
              {proximos} próximo(s)
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {filtered.length} registro(s)
          </Badge>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => gerarPdfExames(filtered)}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => gerarExcelExames(filtered)}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por funcionário, tipo ou clínica..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>
        <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); resetPage(); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de Exame" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {TIPOS_EXAME.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); resetPage(); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="proximo">Próximos ao Vencimento</SelectItem>
            <SelectItem value="ok">Em Dia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando exames...</p>
      ) : paginated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum exame encontrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Realização</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Avisos</TableHead>
                <TableHead>ASO</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((exame) => {
                const status = getStatusVencimento(exame.data_vencimento);
                return (
                  <TableRow key={exame.id}>
                    <TableCell className="font-medium">{exame.funcionario_nome}</TableCell>
                    <TableCell>{exame.tipo_exame}</TableCell>
                    <TableCell>
                      {exame.data_realizacao ? exame.data_realizacao.split("-").reverse().join("/") : "—"}
                    </TableCell>
                    <TableCell>{exame.data_vencimento.split("-").reverse().join("/")}</TableCell>
                    <TableCell>
                      <Badge className={`${status.className} text-xs font-medium`}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{exame.resultado || "—"}</TableCell>
                    <TableCell>{exame.clinica || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Bell className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{getNotificacaoStatus(exame)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {exame.anexo_aso_url ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDownloadASO(exame.anexo_aso_url)}
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="Baixar ASO"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                          <Upload className="h-4 w-4" />
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={uploading}
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleUploadASO(exame, e.target.files[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => requestDelete(exame.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> Avisos automáticos
        </p>
        <p>O sistema enviará avisos por WhatsApp 30, 20 e 10 dias antes do vencimento de cada exame.</p>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
};

export default ExamesPage;
