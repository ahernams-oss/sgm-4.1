import { useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function PortalPerfil() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova !== nova2) return toast.error("Senhas não coincidem.");
    if (nova.length < 8) return toast.error("Mínimo 8 caracteres.");
    setLoading(true);
    try {
      await portalCall("change-password", { senhaAtual: atual, novaSenha: nova });
      toast.success("Senha alterada com sucesso.");
      setAtual(""); setNova(""); setNova2("");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-2xl font-semibold mb-4">Perfil</h1>
      <Card>
        <CardHeader><CardTitle>Alterar Senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4 max-w-sm">
            <div><Label>Senha atual</Label><Input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} required /></div>
            <div><Label>Nova senha</Label><Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} required /></div>
            <div><Label>Confirmar nova</Label><Input type="password" value={nova2} onChange={(e) => setNova2(e.target.value)} required /></div>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Alterar senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
