import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoLasant from "@/assets/Logo_Lasant.png";

/**
 * Página pública para concluir o fluxo de recovery do Supabase Auth.
 * O link enviado por e-mail traz o token no hash (#access_token=...&type=recovery),
 * e o supabase-js já consome esse hash automaticamente, deixando a sessão pronta
 * para chamarmos updateUser({ password }).
 */
export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // Quando o usuário chega via link de recovery, o supabase-js emite
    // PASSWORD_RECOVERY assim que processa o hash da URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPronto(true);
    });
    // Caso o evento já tenha disparado, valida sessão existente.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast.error(error.message || "Não foi possível redefinir a senha.");
        return;
      }
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      await supabase.auth.signOut();
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#5fc4e8] via-[#2563c4] to-[#1e3a8a]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logoLasant} alt="Lasant" className="h-16 w-auto" />
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-[#3a1d6e] text-center">
            Redefinir senha
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Defina uma nova senha para acessar o sistema.
          </p>
        </div>

        {!pronto ? (
          <p className="text-center text-sm text-muted-foreground">
            Validando link de recuperação...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-12 pl-11 pr-11 rounded-full bg-[#ececec] border-transparent"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Confirmar nova senha"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="h-12 pl-11 pr-4 rounded-full bg-[#ececec] border-transparent"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#3a1d6e] hover:bg-[#2e1757] text-white font-semibold"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
