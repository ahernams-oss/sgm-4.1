import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, X, MapPin, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FotoLaudo, FotoMarcador } from "@/contexts/LaudosCondenacaoContext";

interface Props {
  fotos: FotoLaudo[];
  onChange: (fotos: FotoLaudo[]) => void;
}

const MAX_FOTOS = 10;

export function FotosLaudoEditor({ fotos, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleUpload = async (files: FileList) => {
    if (fotos.length + files.length > MAX_FOTOS) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por laudo.`);
      return;
    }
    setUploading(true);
    try {
      const novos: FotoLaudo[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: máx 5MB`);
          continue;
        }
        const ts = Date.now();
        const path = `laudos-condenacao/${ts}_${file.name}`;
        const { error } = await supabase.storage.from("documentos").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("documentos").getPublicUrl(path);
        novos.push({ path, url: data.publicUrl, descricao: "", marcadores: [] });
      }
      onChange([...fotos, ...novos]);
      toast.success(`${novos.length} foto(s) enviada(s).`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = async (idx: number) => {
    const f = fotos[idx];
    await supabase.storage.from("documentos").remove([f.path]);
    onChange(fotos.filter((_, i) => i !== idx));
  };

  const updateFoto = (idx: number, patch: Partial<FotoLaudo>) => {
    onChange(fotos.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Fotografias ({fotos.length}/{MAX_FOTOS})</Label>
        <label className={uploading ? "opacity-50 pointer-events-none" : ""}>
          <Button type="button" variant="outline" size="sm" asChild>
            <span><Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando..." : "Adicionar fotos"}</span>
          </Button>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleUpload(e.target.files)} />
        </label>
      </div>

      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded border-dashed">Nenhuma foto adicionada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fotos.map((f, idx) => (
            <div key={idx} className="border rounded-lg p-2 space-y-2">
              <div className="relative">
                <img src={f.url} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover rounded" />
                {f.marcadores.length > 0 && (
                  <div className="absolute inset-0">
                    {f.marcadores.map((m) => (
                      <div
                        key={m.n}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow"
                        style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                      >
                        {m.n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Descrição da foto"
                value={f.descricao}
                onChange={e => updateFoto(idx, { descricao: e.target.value })}
                className="text-sm"
              />
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setEditIndex(idx)}>
                  <MapPin className="h-3 w-3 mr-1" />Marcadores ({f.marcadores.length})
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeFoto(idx)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editIndex !== null && (
        <MarcadoresDialog
          foto={fotos[editIndex]}
          onSave={(marcadores) => {
            updateFoto(editIndex, { marcadores });
            setEditIndex(null);
          }}
          onClose={() => setEditIndex(null)}
        />
      )}
    </div>
  );
}

function MarcadoresDialog({ foto, onSave, onClose }: { foto: FotoLaudo; onSave: (m: FotoMarcador[]) => void; onClose: () => void }) {
  const [marcadores, setMarcadores] = useState<FotoMarcador[]>(foto.marcadores);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMarcadores(foto.marcadores), [foto]);

  const handleClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const nextN = marcadores.length > 0 ? Math.max(...marcadores.map(m => m.n)) + 1 : 1;
    setMarcadores([...marcadores, { n: nextN, x, y, tipo: "circulo", legenda: "" }]);
  };

  const updateLegenda = (n: number, legenda: string) => {
    setMarcadores(marcadores.map(m => (m.n === n ? { ...m, legenda } : m)));
  };
  const removeMarcador = (n: number) => setMarcadores(marcadores.filter(m => m.n !== n));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marcadores na foto — clique na imagem para adicionar</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div ref={imgRef} onClick={handleClick} className="relative cursor-crosshair select-none">
              <img src={foto.url} alt="Foto" className="w-full rounded border" draggable={false} />
              {marcadores.map(m => (
                <div
                  key={m.n}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-destructive text-white text-sm font-bold flex items-center justify-center border-2 border-white shadow"
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                >
                  {m.n}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <Label className="text-sm">Legendas ({marcadores.length})</Label>
            {marcadores.length === 0 && <p className="text-xs text-muted-foreground">Clique na foto para adicionar marcadores numerados.</p>}
            {marcadores.map(m => (
              <div key={m.n} className="flex gap-2 items-center">
                <div className="w-8 h-8 shrink-0 rounded-full bg-destructive text-white text-sm font-bold flex items-center justify-center">{m.n}</div>
                <Input value={m.legenda} onChange={e => updateLegenda(m.n, e.target.value)} placeholder={`Descrição do item ${m.n}`} className="text-sm" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeMarcador(m.n)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(marcadores)}>Salvar marcadores</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
