import { useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { HardHat, Camera, CheckCircle2, Loader2 } from "lucide-react";

type Etapa = "identificar" | "capturar" | "revisar" | "concluido";

interface DevolucaoInfo {
  id: string;
  descricao: string;
  ca?: string;
  quantidade?: number;
  motivo?: string;
  condicao?: string;
  destino?: string;
  dataDevolucao?: string;
}

const fmt = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export default function DevolverEpis() {
  const { token } = useParams();
  const [etapa, setEtapa] = useState<Etapa>("identificar");
  const [cpf, setCpf] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [funcionarioNome, setFuncionarioNome] = useState("");
  const [devolucao, setDevolucao] = useState<DevolucaoInfo | null>(null);
  const [selfies, setSelfies] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [fotoProcessando, setFotoProcessando] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!cameraAtiva || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      toast.error("Não foi possível iniciar a prévia da câmera. Use o botão para enviar uma foto.");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraAtiva(false);
      fileInputRef.current?.click();
    });
  }, [cameraAtiva]);

  const addSelfie = (dataUrl: string) => setSelfies((prev) => (prev.length >= 2 ? prev : [...prev, dataUrl]));

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selfies.length >= 2 || fotoProcessando) return;
    setFotoProcessando(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const img = new Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const context = canvas.getContext("2d");
        if (!context) {
          setFotoProcessando(false);
          toast.error("Não foi possível processar a foto capturada.");
          return;
        }
        context.drawImage(img, 0, 0, w, h);
        addSelfie(canvas.toDataURL("image/jpeg", 0.85));
        setFotoProcessando(false);
      };
      img.onerror = () => {
        setFotoProcessando(false);
        toast.error("Não foi possível carregar a foto capturada.");
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setFotoProcessando(false);
      toast.error("Não foi possível ler a foto capturada.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const invoke = async (action: "verify" | "confirm", body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("epi-devolucao-publico", {
      body: { action, token, cpf, dataNascimento: dob, ...body },
    });
    if (error) {
      // Extrai a mensagem real retornada pela função (invoke não expõe o corpo em erros HTTP)
      let msg = (data as any)?.error || error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const parsed = await ctx.json();
          if (parsed?.error) msg = parsed.error;
        } else if (ctx && typeof ctx.text === "function") {
          const txt = await ctx.text();
          const parsed = JSON.parse(txt);
          if (parsed?.error) msg = parsed.error;
        }
      } catch { /* mantém msg padrão */ }
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };


  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !dob) { toast.error("Informe CPF e data de nascimento."); return; }
    setLoading(true);
    try {
      const r = await invoke("verify", {});
      setFuncionarioNome(r.funcionario?.nome || "");
      setDevolucao(r.devolucao || null);
      setEtapa("capturar");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const iniciarCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_indisponivel");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } } });
      streamRef.current = stream;
      setCameraAtiva(true);
    } catch {
      toast.error("Não foi possível acessar a câmera. Use o botão para enviar uma foto.");
      fileInputRef.current?.click();
    }
  };

  const capturar = () => {
    const v = videoRef.current;
    if (!v || selfies.length >= 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) { toast.error("Não foi possível processar a foto capturada."); return; }
    context.drawImage(v, 0, 0);
    addSelfie(canvas.toDataURL("image/jpeg", 0.85));
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraAtiva(false);
  };

  const confirmar = async () => {
    if (etapa !== "revisar") { toast.error("Revise as fotos antes de confirmar o envio."); return; }
    if (selfies.length < 2) { toast.error("Capture as 2 selfies antes de confirmar."); return; }
    if (!confirmado) { toast.error("Marque a confirmação antes de enviar."); return; }
    setConfirmDialogOpen(false);
    setLoading(true);
    try {
      await invoke("confirm", { confirmacaoEnvio: true, selfieBase64: selfies[0], selfieBase64_2: selfies[1] });
      toast.success("Devolução de EPI confirmada com sucesso!");
      setEtapa("concluido");
      setTimeout(() => {
        try { window.close(); } catch {}
        window.location.replace("about:blank");
      }, 3500);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4">
      <Card className="w-full max-w-lg mt-8 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <HardHat className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Confirmação de Devolução de EPIs</CardTitle>
        </CardHeader>
        <CardContent>
          {etapa === "identificar" && (
            <form className="space-y-4" onSubmit={verify}>
              <p className="text-sm text-muted-foreground">Para sua segurança, confirme seus dados.</p>
              <div>
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" required />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
            </form>
          )}

          {etapa === "capturar" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm">Olá, <strong>{funcionarioNome}</strong>.</p>
                <p className="text-sm text-muted-foreground">Você está confirmando a devolução do seguinte EPI:</p>
                {devolucao && (
                  <div className="mt-2 border rounded-md p-2 text-sm">
                    <div className="font-medium">{devolucao.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      Qtd: {devolucao.quantidade || 1}{devolucao.ca ? ` · CA ${devolucao.ca}` : ""} · Data: {fmt(devolucao.dataDevolucao)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Motivo: {devolucao.motivo || "—"} · Condição: {devolucao.condicao || "—"} · Destino: {devolucao.destino || "—"}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
                {cameraAtiva ? (
                  <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
                ) : selfies.length > 0 ? (
                  <img src={selfies[selfies.length - 1]} alt="Selfie" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-white/70 text-sm">Nenhuma foto capturada</div>
                )}
              </div>

              {selfies.length > 0 && (
                <div className="flex gap-2 justify-center">
                  {selfies.map((s, i) => (
                    <div key={i} className="relative">
                      <img src={s} alt={`Selfie ${i + 1}`} className="h-16 w-16 object-cover rounded border-2 border-green-500" />
                      <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{i + 1}</span>
                    </div>
                  ))}
                  {Array.from({ length: 2 - selfies.length }).map((_, i) => (
                    <div key={`p-${i}`} className="h-16 w-16 rounded border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-xs text-muted-foreground">
                      {selfies.length + i + 1}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                {selfies.length < 2
                  ? `Capture ${2 - selfies.length} foto${selfies.length === 1 ? "" : "s"} para confirmar (${selfies.length}/2)`
                  : "As 2 fotos foram capturadas. Confirme a devolução."}
              </p>

              <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFileSelected} />

              <div className="flex gap-2">
                {selfies.length < 2 && !cameraAtiva && (
                  <Button type="button" className="w-full" onClick={iniciarCamera} disabled={fotoProcessando}>
                    {fotoProcessando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                    {fotoProcessando ? "Processando foto..." : `Abrir Câmera (Foto ${selfies.length + 1})`}
                  </Button>
                )}
                {cameraAtiva && (
                  <Button type="button" className="w-full" onClick={capturar}>
                    Capturar Foto {selfies.length + 1}
                  </Button>
                )}
                {selfies.length >= 2 && !cameraAtiva && (
                  <>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setSelfies([])}>Refazer</Button>
                    <Button type="button" className="flex-1" onClick={() => { setConfirmado(false); setEtapa("revisar"); }}>
                      Avançar para Revisão
                    </Button>
                  </>
                )}
              </div>

              {selfies.length >= 2 && !cameraAtiva && (
                <p className="text-xs text-center text-muted-foreground">
                  As fotos estão apenas nesta tela. Elas só serão registradas após a revisão e confirmação final.
                </p>
              )}
            </div>
          )}

          {etapa === "revisar" && (
            <div className="space-y-4">
              <p className="text-sm">Confira as fotos capturadas antes de confirmar a devolução.</p>
              <div className="grid grid-cols-2 gap-2">
                {selfies.map((s, i) => (
                  <div key={i} className="border rounded overflow-hidden">
                    <img src={s} alt={`Selfie ${i + 1}`} className="w-full h-40 object-cover" />
                    <div className="text-center text-xs py-1 bg-muted">Foto {i + 1}</div>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm p-3 border rounded-md bg-muted/30">
                <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
                <span>Declaro que devolvi o EPI listado e que as fotos acima são minhas.</span>
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setConfirmado(false); setEtapa("capturar"); }}>
                  Voltar
                </Button>
                <Button type="button" className="flex-1" onClick={() => setConfirmDialogOpen(true)} disabled={loading || !confirmado}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Confirmação"}
                </Button>
              </div>
            </div>
          )}

          {etapa === "concluido" && (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p className="font-medium">Devolução confirmada!</p>
              <p className="text-sm text-muted-foreground">Obrigado, {funcionarioNome}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar confirmação de devolução?</AlertDialogTitle>
            <AlertDialogDescription>
              Somente após confirmar aqui as 2 fotos serão registradas e vinculadas à devolução do EPI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmar} disabled={loading || !confirmado}>
              {loading ? "Enviando..." : "Sim, enviar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
