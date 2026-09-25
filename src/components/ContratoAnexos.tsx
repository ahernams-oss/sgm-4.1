import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Eye, Download, Trash2 } from "lucide-react";
import type { ContratoAnexo } from "@/contexts/ClientesContext";

const BUCKET = "contratos-anexos";
export const MAX_ANEXOS_CONTRATO = 10;

async function urlAssinada(path: string, download?: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600, download ? { download } : undefined);
  if (error || !data) { toast.error("Não foi possível abrir o documento."); return null; }
  return data.signedUrl;
}

export default function ContratoAnexos({ value, onChange }: { value: ContratoAnexo[]; onChange: (v: ContratoAnexo[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const restantes = MAX_ANEXOS_CONTRATO - value.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const lista = Array.from(files);
    if (lista.length > restantes) toast.warning(`Limite de ${MAX_ANEXOS_CONTRATO} documentos. Apenas ${restantes} serão enviados.`);
    setEnviando(true);
    const novos: ContratoAnexo[] = [];
    for (const file of lista.slice(0, restantes)) {
      const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) { toast.error(`Falha ao enviar ${file.name}`); continue; }
      novos.push({ id: crypto.randomUUID(), nome: file.name, path, tamanho: file.size, enviadoEm: new Date().toISOString() });
    }
    setEnviando(false);
    if (novos.length) { onChange([...value, ...novos]); toast.success(`${novos.length} documento(s) anexado(s). Salve o contrato para confirmar.`); }
    if (inputRef.current) inputRef.current.value = "";
  };

  const abrir = async (a: ContratoAnexo, baixar = false) => {
    const url = await urlAssinada(a.path, baixar ? a.nome : undefined);
    if (url) window.open(url, "_blank");
  };

  const remover = async (a: ContratoAnexo) => {
    await supabase.storage.from(BUCKET).remove([a.path]);
    onChange(value.filter(x => x.id !== a.id));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        <Button type="button" size="sm" variant="outline" disabled={enviando || restantes <= 0} onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5 mr-1" />
          {enviando ? "Enviando..." : "Anexar documentos"}
        </Button>
        <span className="text-xs text-muted-foreground">{value.length} de {MAX_ANEXOS_CONTRATO} documentos</span>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {value.map(a => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1 truncate" title={a.nome}>{a.nome}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{(a.tamanho / 1024).toFixed(0)} KB</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Visualizar" onClick={() => abrir(a)}><Eye className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Baixar" onClick={() => abrir(a, true)}><Download className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remover" onClick={() => remover(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
