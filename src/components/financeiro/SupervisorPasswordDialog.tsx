import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { verificarSenhaUsuario } from "@/lib/verifySenha";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo?: string;
  descricao?: string;
  exigirJustificativa?: boolean;
  /** Chamado após validação bem-sucedida. Recebe { email, justificativa } */
  onAuthorized: (info: { email: string; justificativa: string }) => void | Promise<void>;
}

export default function SupervisorPasswordDialog({
  open,
  onOpenChange,
  titulo = "Autorização do supervisor",
  descricao = "Esta ação requer aprovação. Informe o e-mail e senha de um supervisor.",
  exigirJustificativa = true,
  onAuthorized,
}: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setSenha("");
      setJustificativa("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!email.trim() || !senha) {
      toast.error("Informe e-mail e senha do supervisor.");
      return;
    }
    if (exigirJustificativa && justificativa.trim().length < 5) {
      toast.error("Informe a justificativa (mínimo 5 caracteres).");
      return;
    }
    setVerificando(true);
    try {
      const ok = await verificarSenhaUsuario(email, senha);
      if (!ok) {
        toast.error("Credenciais de supervisor inválidas.");
        return;
      }
      await onAuthorized({ email: email.trim().toLowerCase(), justificativa: justificativa.trim() });
      onOpenChange(false);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            {titulo}
          </DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">E-mail do supervisor</label>
            <Input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@empresa.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Senha</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            />
          </div>
          {exigirJustificativa && (
            <div>
              <label className="text-sm font-medium">Justificativa do ajuste *</label>
              <Textarea
                rows={3}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: Correção de valor incorreto, ajuste de data por erro de lançamento..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verificando}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={verificando}>
            {verificando ? "Verificando..." : "Autorizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
