import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface PregaoAnexoEdital {
  id: string;
  pregao_id: string;
  nome: string;
  descricao: string | null;
  url: string;
  storage_path: string | null;
  tamanho_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  pregaoId: string;
  podeEditar: boolean;
}

const fmtSize = (b: number | null) => {
  if (!b) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

export default function EditalAnexosTab({ pregaoId, podeEditar }: Props) {
  const { usuarioLogado } = useAuth();
  const [anexos, setAnexos] = useState<PregaoAnexoEdital[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [descricao, setDescricao] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pregao_anexos_edital" as any)
      .select("*")
      .eq("pregao_id", pregaoId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar anexos.");
    else setAnexos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (pregaoId) load(); }, [pregaoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${pregaoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pregao-edital").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("pregao-edital").getPublicUrl(path);
      const { error: insErr } = await supabase.from("pregao_anexos_edital" as any).insert({
        pregao_id: pregaoId,
        nome: file.name,
        descricao: descricao || null,
        url: pub.publicUrl,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type,
        uploaded_by: usuarioLogado?.nome || null,
      });
      if (insErr) throw insErr;
      toast.success("Anexo enviado.");
      setDescricao("");
      e.target.value = "";
      await load();
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (a: PregaoAnexoEdital) => {
    if (!confirm(`Remover anexo "${a.nome}"?`)) return;
    if (a.storage_path) await supabase.storage.from("pregao-edital").remove([a.storage_path]);
    const { error } = await supabase.from("pregao_anexos_edital" as any).delete().eq("id", a.id);
    if (error) toast.error("Erro ao remover.");
    else { toast.success("Anexo removido."); load(); }
  };

  const handleDownload = async (a: PregaoAnexoEdital) => {
    try {
      const res = await fetch(a.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = a.nome;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(a.url, "_blank");
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Anexos do Edital
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Documentos (edital, anexos técnicos, planilhas) que ficarão disponíveis para o fornecedor visualizar e baixar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {podeEditar && (
          <div className="grid grid-cols-12 gap-2 p-3 bg-muted/30 rounded-lg items-end">
            <div className="col-span-8">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Edital v1, Anexo I - Planilha técnica..." />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Arquivo</Label>
              <label className="flex items-center justify-center gap-2 w-full h-10 px-3 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent">
                <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Selecionar arquivo"}
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>}
            {!loading && anexos.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum anexo enviado.</TableCell></TableRow>
            )}
            {anexos.map((a, idx) => (
              <TableRow key={a.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                <TableCell className="font-medium">{a.nome}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.descricao || "-"}</TableCell>
                <TableCell>{fmtSize(a.tamanho_bytes)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.uploaded_by || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(a)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {podeEditar && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleDelete(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
