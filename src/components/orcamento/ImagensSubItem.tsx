import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImagemSubItem {
  id: string;
  nome: string;
  path: string;
}

const BUCKET = "memoria-calculo-imagens";
const MAX = 3;

interface Props {
  imagens: ImagemSubItem[];
  onChange: (imgs: ImagemSubItem[]) => void;
  readOnly?: boolean;
  titulo?: string;
}

export default function ImagensSubItem({ imagens, onChange, readOnly, titulo }: Props) {
  const lista = Array.isArray(imagens) ? imagens : [];
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const carregarUrls = async (items: ImagemSubItem[]) => {
    const entries = await Promise.all(items.map(async (i) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(i.path, 3600);
      return [i.id, data?.signedUrl || ""] as const;
    }));
    setUrls(Object.fromEntries(entries));
  };

  const abrir = async () => {
    setOpen(true);
    await carregarUrls(lista);
  };

  const handleUpload = async (files: FileList) => {
    const disponiveis = MAX - lista.length;
    if (disponiveis <= 0) {
      toast.error(`Máximo de ${MAX} imagens por sub-item`);
      return;
    }
    const selecionados = Array.from(files).slice(0, disponiveis);
    setUploading(true);
    try {
      const novos: ImagemSubItem[] = [];
      for (const file of selecionados) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} não é uma imagem`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede 5MB`);
          continue;
        }
        const path = `memoria/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file);
        if (error) throw error;
        novos.push({ id: crypto.randomUUID(), nome: file.name, path });
      }
      if (novos.length) {
        const atualizado = [...lista, ...novos];
        onChange(atualizado);
        await carregarUrls(atualizado);
        toast.success("Imagem(ns) anexada(s)");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const remover = async (img: ImagemSubItem) => {
    await supabase.storage.from(BUCKET).remove([img.path]);
    onChange(lista.filter(i => i.id !== img.id));
    toast.success("Imagem removida");
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar imagens" onClick={abrir}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        {lista.length > 0 && <span className="text-[10px] text-muted-foreground">{lista.length}/{MAX}</span>}
        {!readOnly && lista.length < MAX && (
          <label className={`inline-flex ${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`} title="Anexar imagem">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
              <ImagePlus className="h-3.5 w-3.5" />
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={ev => {
                if (ev.target.files?.length) handleUpload(ev.target.files);
                ev.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Imagens {titulo ? `— ${titulo}` : ""}</DialogTitle>
          </DialogHeader>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma imagem anexada.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {lista.map(img => (
                <div key={img.id} className="border rounded-md overflow-hidden">
                  {urls[img.id] ? (
                    <a href={urls[img.id]} target="_blank" rel="noreferrer">
                      <img src={urls[img.id]} alt={img.nome} className="w-full h-40 object-cover" />
                    </a>
                  ) : (
                    <div className="w-full h-40 bg-muted animate-pulse" />
                  )}
                  <div className="flex items-center justify-between gap-1 px-2 py-1">
                    <span className="truncate text-xs" title={img.nome}>{img.nome}</span>
                    {!readOnly && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remover(img)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
