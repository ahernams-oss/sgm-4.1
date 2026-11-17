import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { erroLinkRecuperacao } from "@/lib/recuperacaoSenha";
import logoLasant from "@/assets/Logo_Lasant.png";

/**
 * Página pública para concluir o fluxo de recovery do Supabase Auth.
 * O link enviado por e-mail traz o token no hash (#access_token=...&type=recovery),
 * e o supabase-js já consome esse hash automaticamente, deixando a sessão pronta
 * para atualizar a credencial do SGM pela ação autenticada existente.
 */
export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const erro = erroLinkRecuperacao(window.location.hash, window.location.search);
    if (erro) { setErroLink(erro); return; }
    const timeout = window.setTimeout(() => {
      if (!cancelled) { cancelled = true; setErroLink("A validação demorou mais que o esperado. Solicite um novo link."); }
    }, 20000);
    // getUser aguarda o processamento do link e valida a sessão no provedor.
    const validar = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) {
          setErroLink("Este link expirou ou não é válido. Solicite um novo link de recuperação.");
          return;
        }
        const { data: usuario, error: usuarioError } = await supabase.from("usuarios")
          .select("id, ativo").eq("auth_user_id", data.user.id).maybeSingle();
        if (cancelled) return;
        if (usuarioError || !usuario || usuario.ativo === false) {
          setErroLink("Não foi possível validar seu acesso ao SGM. Procure o administrador.");
          return;
        }
        setUsuarioId(usuario.id);
        setPronto(true);
      } catch {
        if (!cancelled) setErroLink("Não foi possível validar o link. Verifique sua conexão e solicite um novo link.");
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void validar();
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pronto || !usuarioId) return;
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
      // O login SGM valida usuarios_credenciais, não a senha do Supabase Auth.
      // A ação existente valida sessão, vínculo próprio e política no servidor.
      const { data, error } = await supabase.functions.invoke("auth-set-password", {
        body: { userId: usuarioId, novaSenha: senha },
      });
      if (error || !data?.ok) {
        toast.error(error?.message || data?.error || "Não foi possível redefinir a senha.");
        return;
      }
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      await supabase.auth.signOut();
      navigate("/login");
    } catch {
      toast.error("Não foi possível redefinir a senha. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logoLasant} alt="Lasant" className="h-16 w-auto" />
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-foreground text-center">
            Redefinir senha
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Defina uma nova senha para acessar o sistema.
          </p>
        </div>

        {erroLink ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-sm text-destructive">{erroLink}</p>
            <Button onClick={() => navigate("/esqueci-senha")} className="w-full">Solicitar novo link</Button>
          </div>
        ) : !pronto ? (
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
                className="h-12 pl-11 pr-11 bg-muted"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Confirmar nova senha"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="h-12 pl-11 pr-4 bg-muted"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 font-semibold"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
