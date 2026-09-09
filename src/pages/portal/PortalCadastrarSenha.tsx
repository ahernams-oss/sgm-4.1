import { useState } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const fmtCpf = (v: string) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function PortalCadastrarSenha() {
  const { signup, logout } = usePortalAuth();
  const [cpf, setCpf] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== senha2) return toast.error("As senhas não coincidem.");
    if (senha.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres.");
    setLoading(true);
    try {
      await signup(cpf, dataNasc, senha);
      toast.success("Cadastro realizado com sucesso.");
      logout();
      navigate("/portal");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-center">Criar senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(fmtCpf(e.target.value))} required /></div>
            <div><Label>Data de Nascimento</Label><Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} required /></div>
            <div><Label>Nova Senha (mín. 8)</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
            <div><Label>Confirmar Senha</Label><Input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar acesso"}</Button>
            <div className="text-sm text-center"><Link to="/portal" className="text-muted-foreground hover:underline">Voltar ao login</Link></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
