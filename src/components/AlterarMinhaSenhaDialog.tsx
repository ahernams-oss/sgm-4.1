import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { passwordSchema } from "@/lib/passwordPolicy";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AlterarMinhaSenhaDialog({ open, onOpenChange }: Props) {
  const { usuarioLogado } = useAuth();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  const limpar = () => { setAtual(""); setNova(""); setConfirmar(""); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioLogado) return;
    if (nova !== confirmar) return toast.error("As novas senhas não conferem.");
    if (nova === atual) return toast.error("A nova senha deve ser diferente da atual.");
    const r = passwordSchema.safeParse(nova);
    if (!r.success) return toast.error(r.error.issues[0].message);
    setLoading(true);
    try {
      const ok = await verificarSenhaUsuario(usuarioLogado.email, atual);
      if (!ok) return toast.error("Senha atual incorreta.");
      const { data, error } = await supabase.functions.invoke("auth-set-password", {
        body: { userId: usuarioLogado.id, novaSenha: nova },
      });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
        return toast.error(msg || "Não foi possível alterar a senha.");
      }
      toast.success("Senha alterada com sucesso.");
      limpar();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) limpar(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar minha senha</DialogTitle>
          <DialogDescription>Mínimo de 8 caracteres, com letra maiúscula, número e caractere especial.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1"><Label>Senha atual</Label>
            <Input type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required /></div>
          <div className="space-y-1"><Label>Nova senha</Label>
            <Input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required />
            <PasswordStrengthMeter senha={nova} /></div>
          <div className="space-y-1"><Label>Confirmar nova senha</Label>
            <Input type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
