import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { portalCall } from "@/lib/portalClient";

interface Props {
  funcionario: { id: string; nome: string } | null;
  onClose: () => void;
}

export default function RedefinirSenhaPortalDialog({ funcionario, onClose }: Props) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fechar = () => { setSenha(""); setConfirma(""); onClose(); };

  const salvar = async () => {
    if (!funcionario) return;
    if (senha.length < 8) { toast.error("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { toast.error("As senhas não conferem."); return; }
    setSalvando(true);
    try {
      await portalCall("admin-portal-redefinir-senha", { funcionario_id: funcionario.id, novaSenha: senha });
      toast.success("Senha do portal redefinida. Informe a nova senha ao funcionário.");
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível redefinir a senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!funcionario} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha do portal</DialogTitle>
          <DialogDescription>{funcionario?.nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Confirmar nova senha</Label>
            <Input type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres. O bloqueio por tentativas também é liberado.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Redefinir senha"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
