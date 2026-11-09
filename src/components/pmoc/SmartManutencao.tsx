import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, CheckCircle2, CloudUpload, Send, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { gravarPmocSmart } from "@/lib/pmocSmart.functions";
import { proximaSmart, validarFotoSmart, type SmartExecucao } from "@/lib/pmocSmart";
import { fotoPmocSmartUrl } from "@/lib/pmocSmartFotos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SmartManutencao({ execucao, titulo, local, periodicidade, onClose, onSaved }: {
  execucao: SmartExecucao; titulo: string; local: string; periodicidade: string;
  onClose: () => void; onSaved: (e: SmartExecucao) => void;
}) {
  const gravar = useServerFn(gravarPmocSmart);
  const [registro, setRegistro] = useState(execucao);
  const [texto, setTexto] = useState(execucao.observacoes || "");
  const [salvo, setSalvo] = useState(execucao.observacoes || "");
  const [estado, setEstado] = useState<"salvo" | "salvando" | "erro">("salvo");
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pendentes, setPendentes] = useState<File[]>([]);
  const camera = useRef<HTMLInputElement>(null), galeria = useRef<HTMLInputElement>(null);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const bloqueioFoto = useRef(false);
  const editavel = registro.smart && registro.status === "Em execução";
  const sujo = texto !== salvo;
  const ocupado = uploading || estado === "salvando";

  const salvar = (patch: { observacoes?: string; foto?: string }) => {
    setEstado("salvando");
    const tarefa = fila.current.catch(() => undefined).then(async () => {
      const resultado = await gravar({ data: { acao: "salvar", execucaoId: execucao.id, ...patch } });
      setRegistro(resultado); onSaved(resultado);
      if (patch.observacoes !== undefined) setSalvo(patch.observacoes);
      setEstado("salvo"); setErro("");
      return resultado;
    });
    fila.current = tarefa;
    return tarefa.catch((e: Error) => { setEstado("erro"); setErro(e.message); throw e; });
  };
  useEffect(() => {
    if (!editavel || !sujo) return;
    const timer = setTimeout(() => { void salvar({ observacoes: texto }).catch(() => undefined); }, 900);
    return () => clearTimeout(timer);
  }, [texto, editavel]);
  useEffect(() => {
    let ativa = true;
    void Promise.all((registro.fotos || []).map(async (ref) => [ref, await fotoPmocSmartUrl(ref)] as const))
      .then((pares) => { if (ativa) setUrls(Object.fromEntries(pares)); }).catch(() => { if (ativa) setErro("Não foi possível carregar uma foto."); });
    return () => { ativa = false; };
  }, [registro.fotos]);
  useEffect(() => {
    const aviso = (event: BeforeUnloadEvent) => { if (sujo || ocupado || pendentes.length) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo, ocupado, pendentes.length]);

  const enviarFotos = async (arquivos: File[]) => {
    if (!editavel || bloqueioFoto.current) return;
    bloqueioFoto.current = true; setUploading(true); setPendentes([]);
    let quantidade = registro.fotos?.length || 0;
    const falhas: File[] = [];
    for (const arquivo of arquivos) {
      const invalida = validarFotoSmart(arquivo.type, arquivo.size, quantidade);
      if (invalida) { toast.error(invalida); continue; }
      try {
        const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
        const path = `${registro.equipamento_id}/${registro.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("pmoc-smart-fotos").upload(path, arquivo, { contentType: arquivo.type, upsert: false });
        if (error) throw new Error("Não foi possível enviar a foto. Verifique sua conexão.");
        await salvar({ foto: `pmoc-smart-fotos/${path}` });
        quantidade++;
      } catch (e) { falhas.push(arquivo); setErro(e instanceof Error ? e.message : "Falha no envio."); }
    }
    setPendentes(falhas); setUploading(false); bloqueioFoto.current = false;
  };
  const fechar = async () => {
    if (ocupado || pendentes.length) { toast.error("Aguarde ou tente salvar novamente antes de fechar."); return; }
    try { if (sujo) await salvar({ observacoes: texto }); onClose(); } catch { /* mantém o formulário aberto */ }
  };
  const finalizar = async () => {
    if (!editavel || ocupado || pendentes.length) return;
    try {
      if (sujo) await salvar({ observacoes: texto });
      setEstado("salvando");
      const resultado = await gravar({ data: { acao: "finalizar", execucaoId: registro.id, proxima: proximaSmart(periodicidade) } });
      onSaved(resultado); toast.success("Manutenção enviada para confirmação."); onClose();
    } catch (e) { setEstado("erro"); setErro(e instanceof Error ? e.message : "Não foi possível finalizar."); }
  };
  return <Dialog open onOpenChange={(aberto) => { if (!aberto) void fechar(); }}>
    <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-4 sm:p-6" onInteractOutside={(e) => { if (ocupado || sujo || pendentes.length) e.preventDefault(); }}>
      <DialogHeader><DialogTitle className="pr-6 break-words">{titulo}</DialogTitle><DialogDescription className="break-words">{local}</DialogDescription></DialogHeader>
      <div className="flex items-center gap-2 border-b border-border pb-3 text-sm text-muted-foreground" aria-live="polite">
        {ocupado ? <Loader2 className="size-4 animate-spin" /> : estado === "erro" ? <AlertTriangle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
        {ocupado ? "Salvando…" : sujo ? "Alterações pendentes" : estado === "erro" ? "Falha ao salvar" : "Salvo"}
      </div>
      <div className="space-y-2"><Label htmlFor="smart-observacoes">Observações da manutenção</Label><Textarea id="smart-observacoes" value={texto} disabled={!editavel} maxLength={10000} onChange={(e) => setTexto(e.target.value)} className="min-h-32 text-base" /></div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><Label>Fotos</Label><span className="text-sm text-muted-foreground">{registro.fotos?.length || 0} / 6</span></div>
        {editavel && <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-12" disabled={uploading || (registro.fotos?.length || 0) >= 6} onClick={() => camera.current?.click()}><Camera className="size-5" />Tirar foto</Button><Button variant="outline" className="min-h-12" disabled={uploading || (registro.fotos?.length || 0) >= 6} onClick={() => galeria.current?.click()}><ImagePlus className="size-5" />Anexar fotos</Button></div>}
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void enviarFotos(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void enviarFotos(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <div className="grid grid-cols-3 gap-2">{(registro.fotos || []).map((foto, i) => <a key={foto} href={urls[foto]} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-md border border-border bg-muted" aria-label={`Foto ${i + 1}`}>{urls[foto] ? <img src={urls[foto]} alt={`Manutenção, foto ${i + 1}`} className="h-full w-full object-cover" /> : <CloudUpload className="m-auto mt-6 size-6 text-muted-foreground" />}</a>)}</div>
      </div>
      {erro && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{erro}</p><Button variant="outline" disabled={ocupado} onClick={() => { if (pendentes.length) void enviarFotos(pendentes); else void salvar({ observacoes: texto }).catch(() => undefined); }}><RefreshCw className="size-4" />Tentar novamente</Button></div>}
      {editavel && <Button className="min-h-12 w-full" disabled={ocupado || !!pendentes.length || estado === "erro"} onClick={() => void finalizar()}><Send className="size-5" />Enviar para confirmação</Button>}
      <Button variant="outline" className="min-h-11 w-full" disabled={ocupado || !!pendentes.length} onClick={() => void fechar()}>Fechar</Button>
    </DialogContent>
  </Dialog>;
}