import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { portalCall } from "@/lib/portalClient";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  treinamentoId: string | null;
  titulo?: string;
  onValidado: (id: string, assinadoEm: string, hash: string) => void;
}

export default function ValidacaoCertificadoDialog({ open, onOpenChange, treinamentoId, titulo, onValidado }: Props) {
  const [aceite, setAceite] = useState(false);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const reset = () => { setSenha(""); setAceite(false); };

  const confirmar = async () => {
    if (!treinamentoId) return;
    if (!aceite) { toast.error("Marque o aceite para validar o certificado."); return; }
    if (senha.length < 4) { toast.error("Informe sua senha do portal."); return; }
    setSalvando(true);
    try {
      const r = await portalCall<{ assinado_em: string; hash: string }>("assinar-certificado", {
        id: treinamentoId,
        senha,
        aceite: true,
      });
      toast.success("Certificado validado eletronicamente.");
      onValidado(treinamentoId, r.assinado_em, r.hash);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao validar certificado.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Validação eletrônica do certificado</DialogTitle>
          <DialogDescription>
            {titulo ? `${titulo}. ` : ""}
            A validação é registrada com autenticação de senha e código SHA-256, conforme MP 2.200-2/2001.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox id="aceite-certificado" checked={aceite} onCheckedChange={(v) => setAceite(v === true)} />
            <Label htmlFor="aceite-certificado" className="text-sm font-normal leading-snug cursor-pointer">
              Declaro que participei e concluí este treinamento e confirmo a autenticidade das informações
              deste certificado, assinando-o eletronicamente.
            </Label>
          </div>
          <div>
            <Label htmlFor="senha-certificado">Confirme sua senha do portal</Label>
            <Input id="senha-certificado" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </div>
          <p className="text-xs text-muted-foreground">
            Serão registrados data/hora, endereço IP, dispositivo e um código de verificação SHA-256 exclusivo deste certificado.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando || !aceite}>
            {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Validar eletronicamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
