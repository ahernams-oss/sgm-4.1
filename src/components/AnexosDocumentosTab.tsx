import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Trash2, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AnexoDocumento } from "@/contexts/FuncionariosContext";

interface Props {
  anexos: AnexoDocumento[];
  onChange: (anexos: AnexoDocumento[]) => void;
  funcionarioId?: string;
}

export function AnexosDocumentosTab({ anexos, onChange, funcionarioId }: Props) {
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!data) {
      toast.error("A data é obrigatória para anexar um documento");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }

    setUploading(true);
    try {
      const ts = Date.now();
      const folder = funcionarioId || "novo";
      const path = `${folder}/${ts}_${file.name}`;
      const { error } = await supabase.storage.from("funcionarios-anexos").upload(path, file);
      if (error) throw error;

      const novo: AnexoDocumento = {
        id: crypto.randomUUID(),
        nome: file.name,
        path,
        tamanho: file.size,
        data,
        descricao,
      };
      onChange([...anexos, novo]);
      setDescricao("");
      setData("");
      toast.success("Documento anexado com sucesso");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (idx: number) => {
    const anexo = anexos[idx];
    await supabase.storage.from("funcionarios-anexos").remove([anexo.path]);
    onChange(anexos.filter((_, i) => i !== idx));
    toast.success("Documento removido");
  };

  const handleDownload = (anexo: AnexoDocumento) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/funcionarios-anexos/${anexo.path}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Data *</Label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Descrição</Label>
          <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do documento" />
        </div>
        <div>
          <label className={`inline-flex items-center gap-2 cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Button type="button" variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Selecionar Arquivo"}
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {anexos.length > 0 ? (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anexos.map((a, idx) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[200px]">{a.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>{a.descricao || "-"}</TableCell>
                  <TableCell>{a.data ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(a)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento anexado</p>
      )}
    </div>
  );
}
