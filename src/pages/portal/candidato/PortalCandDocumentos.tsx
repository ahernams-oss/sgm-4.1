import { useEffect, useRef, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall, fileToBase64 } from "@/lib/portalClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  "RG", "CPF", "CTPS", "CNH", "Título de Eleitor", "Reservista", "Comprovante de Residência",
  "Comprovante Escolaridade", "Certidão de Nascimento/Casamento", "Certidão de Nascimento/Filho",
  "Cartão de vacinação filhos", "Carteira do Conselho de Classe", "Outros",
];

type FilaItem = { id: string; tipo: string; file: File };

export default function PortalCandDocumentos() {
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState("RG");
  const [tipoCustom, setTipoCustom] = useState("");
  const [fila, setFila] = useState<FilaItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => portalCall<{ documentos: any[] }>("cand-doc-list").then((r) => setDocs(r.documentos));
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const adicionarArquivos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (tipo === "Outros" && !tipoCustom.trim()) {
      toast.error("Informe o nome do documento para o tipo \"Outros\".");
      return;
    }
    const tipoFinal = tipo === "Outros" ? tipoCustom.trim() : tipo;
    const novos: FilaItem[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" excede 10MB.`);
        continue;
      }
      novos.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tipo: tipoFinal, file });
    }
    if (novos.length) setFila((f) => [...f, ...novos]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removerFila = (id: string) => setFila((f) => f.filter((x) => x.id !== id));
  const alterarTipoFila = (id: string, novoTipo: string) =>
    setFila((f) => f.map((x) => (x.id === id ? { ...x, tipo: novoTipo } : x)));

  const enviarFila = async () => {
    if (fila.length === 0) return toast.error("Adicione ao menos um documento.");
    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const item of fila) {
      try {
        const b64 = await fileToBase64(item.file);
        await portalCall("cand-doc-upload", {
          tipo_documento: item.tipo,
          nome_arquivo: item.file.name,
          content_type: item.file.type,
          arquivo_base64: b64,
        });
        ok++;
      } catch (e: any) {
        fail++;
        toast.error(`Falha ao enviar "${item.file.name}": ${e.message}`);
      }
    }
    setUploading(false);
    if (ok) toast.success(`${ok} documento(s) enviado(s).`);
    setFila([]);
    await load().catch(() => {});
  };

  return (
    <PortalLayout requireTipo="candidato">
      <h1 className="text-2xl font-semibold mb-4">Envio de Documentos</h1>
      <Card className="mb-4">
        <CardHeader><CardTitle>Adicionar documentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); setTipoCustom(""); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {tipo === "Outros" && (
              <div className="md:col-span-2">
                <Label>Nome do documento</Label>
                <input
                  type="text"
                  value={tipoCustom}
                  onChange={(e) => setTipoCustom(e.target.value)}
                  placeholder="Ex: Declaração de residência"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                />
              </div>
            )}
            <div className={`flex gap-2 ${tipo === "Outros" ? "md:col-span-3" : "md:col-span-2"}`}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => adicionarArquivos(e.target.files)}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar arquivo(s)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-3">
              Formatos aceitos: PDF, JPG, PNG. Tamanho máximo 10MB por arquivo.
            </p>
          </div>

          {fila.length > 0 && (
            <div className="border rounded-md divide-y">
              <div className="px-3 py-2 text-sm font-medium bg-muted/40">
                Aguardando envio ({fila.length})
              </div>
              {fila.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <select
                    value={item.tipo}
                    onChange={(e) => alterarTipoFila(item.id, e.target.value)}
                    className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                  >
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{item.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removerFila(item.id)}
                    disabled={uploading}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={enviarFila} disabled={uploading || fila.length === 0}>
              <Upload className="w-4 h-4 mr-1" />
              {uploading ? "Enviando..." : `Enviar ${fila.length > 0 ? `(${fila.length})` : ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Documentos enviados</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>}
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="text-sm font-medium">{d.tipo_documento}</div>
                  <div className="text-xs text-muted-foreground">{d.nome_arquivo} • {new Date(d.enviado_em).toLocaleString("pt-BR")}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${d.status === "aprovado" ? "bg-green-100 text-green-800" : d.status === "reprovado" ? "bg-red-100 text-red-800" : "bg-muted"}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
