import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Eye, Trash2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import type { AnexoDocumento } from "@/contexts/FuncionariosContext";

export const CONSELHOS_CLASSE = [
  "CREA", "CAU", "CRM", "CREMERJ", "COREN", "CRO", "CRP", "CRF", "CRN", "CREFITO",
  "CRC", "OAB", "CRMV", "CRBM", "CRESS", "CONFEA", "CFT/CRT", "Outro",
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Props {
  conselhoClasse: string;
  conselhoNumero: string;
  conselhoDataExpedicao: string;
  conselhoUf: string;
  conselhoAnexos: AnexoDocumento[];
  onChange: (field: string, value: any) => void;
}

export function ConselhoClasseSection({
  conselhoClasse, conselhoNumero, conselhoDataExpedicao, conselhoUf, conselhoAnexos, onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const anexos = conselhoAnexos ?? [];

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const novos: AnexoDocumento[] = [...anexos];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: máximo 5MB.`); continue; }
      const path = `conselho/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const { error } = await supabase.storage.from("funcionarios-anexos").upload(path, file);
      if (error) { toast.error(`Erro ao enviar ${file.name}.`); continue; }
      novos.push({
        id: crypto.randomUUID(), nome: file.name, path,
        tamanho: file.size, data: new Date().toISOString(), descricao: "Conselho de Classe",
      });
    }
    onChange("conselhoAnexos", novos);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const visualizar = async (a: AnexoDocumento) => {
    const { data, error } = await supabase.storage.from("funcionarios-anexos").download(a.path);
    if (error || !data) { toast.error("Erro ao abrir documento."); return; }
    window.open(URL.createObjectURL(data), "_blank");
  };

  const remover = async (a: AnexoDocumento) => {
    await supabase.storage.from("funcionarios-anexos").remove([a.path]);
    onChange("conselhoAnexos", anexos.filter((x) => x.id !== a.id));
  };

  return (
    <div className="mt-6 p-4 border border-border rounded-lg bg-muted/20">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-primary" /> Conselho de Classe
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>Conselho de Classe</Label>
          <Select value={conselhoClasse || undefined} onValueChange={(v) => onChange("conselhoClasse", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {CONSELHOS_CLASSE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nº de Registro</Label>
          <Input value={conselhoNumero} onChange={(e) => onChange("conselhoNumero", e.target.value)} placeholder="Ex.: 2021123456" />
        </div>
        <div className="space-y-1.5">
          <Label>Data de Expedição</Label>
          <Input type="date" value={conselhoDataExpedicao} onChange={(e) => onChange("conselhoDataExpedicao", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>UF de Expedição</Label>
          <Select value={conselhoUf || undefined} onValueChange={(v) => onChange("conselhoUf", v)}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Paperclip className="h-4 w-4 mr-2" /> {uploading ? "Enviando..." : "Anexar documento"}
          </Button>
          <span className="text-xs text-muted-foreground">PDF ou imagem, até 5MB cada</span>
        </div>
        {anexos.length > 0 && (
          <div className="mt-3 space-y-2">
            {anexos.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="text-sm truncate">{a.nome}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => visualizar(a)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remover(a)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
