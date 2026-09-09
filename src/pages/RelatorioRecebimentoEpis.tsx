import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { toast } from "sonner";
import { Eye, Search, FileDown, Download } from "lucide-react";
import { gerarPdfEpiFacial } from "@/lib/gerarPdfEpiFacial";
import PaginationControls, { paginate } from "@/components/PaginationControls";

interface Recebimento {
  id: string; funcionario_id: string; token: string; status: string;
  epis_snapshot: any[]; selfie_path: string | null; selfie_hash: string | null;
  selfie_path_2: string | null; selfie_hash_2: string | null;
  ip: string | null; user_agent: string | null; telefone_envio: string | null;
  confirmado_em: string | null; created_at: string; expires_at: string;
  cpf_verificado: boolean; verificado_em: string | null;
}

export default function RelatorioRecebimentoEpis() {
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const [rows, setRows] = useState<Recebimento[]>([]);
  const [filtro, setFiltro] = useState("");
  const [preview, setPreview] = useState<{ urls: string[]; row: Recebimento } | null>(null);
  const [loading, setLoading] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("epis_recebimentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar."); else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const nomeFunc = (id: string) => funcionarios.find((f) => f.id === id)?.nome || "—";

  const signedUrl = async (path: string): Promise<string | null> => {
    const { data } = await (supabase as any).storage
      .from("epi-recebimentos-selfies")
      .createSignedUrl(path, 300);
    return data?.signedUrl || null;
  };

  const abrirSelfie = async (r: Recebimento) => {
    const paths = [r.selfie_path, r.selfie_path_2].filter(Boolean) as string[];
    if (paths.length === 0) { toast.error("Sem selfie."); return; }
    const urls = (await Promise.all(paths.map(signedUrl))).filter(Boolean) as string[];
    if (urls.length === 0) { toast.error("Falha ao carregar selfie."); return; }
    setPreview({ urls, row: r });
  };

  const baixarSelfie = async (path: string, nome: string) => {
    const url = await signedUrl(path);
    if (!url) { toast.error("Falha ao gerar link."); return; }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Falha no download."); }
  };

  const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const gerarPdf = async (r: Recebimento) => {
    const func = funcionarios.find((f) => f.id === r.funcionario_id);
    if (!func) { toast.error("Funcionário não encontrado."); return; }
    setGerandoPdf(r.id);
    try {
      let selfieDataUrl: string | null = null;
      if (r.selfie_path) {
        const { data } = await (supabase as any).storage
          .from("epi-recebimentos-selfies")
          .createSignedUrl(r.selfie_path, 300);
        if (data?.signedUrl) selfieDataUrl = await fetchImageAsDataUrl(data.signedUrl);
      }
      const cargoNome = cargos.find((c: any) => c.id === func.cargoId)?.nome || "";
      const clienteNome = clientes.find((c: any) => c.id === func.clienteId)?.nomeFantasia || clientes.find((c: any) => c.id === func.clienteId)?.nome || "";
      await gerarPdfEpiFacial(func, r, { cargoNome, clienteNome, selfieDataUrl });
      toast.success("PDF gerado.");
    } catch (e: any) {
      toast.error("Falha ao gerar PDF: " + (e?.message || ""));
    } finally {
      setGerandoPdf(null);
    }
  };

  const filtered = rows.filter((r) => {
    const nome = nomeFunc(r.funcionario_id).toLowerCase();
    return !filtro || nome.includes(filtro.toLowerCase()) || r.status.includes(filtro.toLowerCase());
  });

  const { paginated, safePage } = paginate(filtered, page, pageSize);


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Relatório de Recebimento de EPIs (Reconhecimento Facial)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar funcionário/status..." value={filtro} onChange={(e) => { setFiltro(e.target.value); setPage(1); }} />
            </div>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>Atualizar</Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Confirmado em</TableHead>
                  <TableHead>EPIs</TableHead>
                  <TableHead>CPF verif.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="w-16">Selfie</TableHead>
                  <TableHead className="w-16">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nomeFunc(r.funcionario_id)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{r.confirmado_em ? new Date(r.confirmado_em).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs">{(r.epis_snapshot || []).length}</TableCell>
                    <TableCell>{r.cpf_verificado ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "confirmado" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.ip || "—"}</TableCell>
                    <TableCell>
                      {r.selfie_path && (
                        <Button variant="ghost" size="icon" onClick={() => abrirSelfie(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar Ficha de EPI (PDF)"
                        disabled={gerandoPdf === r.id}
                        onClick={() => gerarPdf(r)}
                      >
                        <FileDown className={`h-4 w-4 ${gerandoPdf === r.id ? "animate-pulse" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={safePage}
            totalItems={filtered.length}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante Facial</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className={`grid gap-3 ${preview.urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {preview.urls.map((u, i) => {
                  const path = i === 0 ? preview.row.selfie_path : preview.row.selfie_path_2;
                  const hash = i === 0 ? preview.row.selfie_hash : preview.row.selfie_hash_2;
                  const nomeArq = `selfie-${nomeFunc(preview.row.funcionario_id).replace(/\s+/g, "_")}-${i + 1}.jpg`;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="relative">
                        <img src={u} alt={`selfie ${i + 1}`} className="w-full rounded-md border" />
                        <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">Foto {i + 1}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => path && baixarSelfie(path, nomeArq)}
                      >
                        <Download className="h-4 w-4 mr-1" /> Baixar Foto {i + 1}
                      </Button>
                      {hash && <div className="text-[10px] break-all text-muted-foreground"><code>{hash}</code></div>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
                <div><span className="text-muted-foreground">Funcionário:</span> {nomeFunc(preview.row.funcionario_id)}</div>
                <div><span className="text-muted-foreground">Confirmado em:</span> {preview.row.confirmado_em ? new Date(preview.row.confirmado_em).toLocaleString("pt-BR") : "—"}</div>
                <div><span className="text-muted-foreground">IP:</span> {preview.row.ip || "—"}</div>
                <div className="truncate" title={preview.row.user_agent || ""}><span className="text-muted-foreground">User Agent:</span> {preview.row.user_agent || "—"}</div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">EPIs recebidos:</div>
                  <ul className="list-disc pl-5">
                    {(preview.row.epis_snapshot || []).map((e: any, i: number) => (
                      <li key={i}>{e.descricao} {e.ca ? `(CA ${e.ca})` : ""} — Qtd {e.quantidade || 1}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
