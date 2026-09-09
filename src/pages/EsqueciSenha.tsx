import { useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const EsqueciSenha = () => {
  const { resetSenha } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    const result = await resetSenha(email);
    setLoading(false);

    if (result.ok) {
      setEnviado(true);
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/Logo_Lasant.png"
            alt="Lasant Logo"
            className="h-16 w-auto mb-4"
          />
          <h1 className="text-xl font-bold text-foreground">Recuperar Senha</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Informe seu e-mail e enviaremos uma senha temporária
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
          {enviado ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">
                  Verifique seu e-mail
                </h2>
                <p className="text-sm text-muted-foreground">
                  Se o endereço estiver cadastrado, você receberá uma senha
                  temporária em alguns instantes.
                </p>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  E-mail cadastrado
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <KeyRound className="h-4 w-4" />
                {loading ? "Enviando..." : "Enviar senha temporária"}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar ao login
              </Link>
            </form>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Após acessar com a senha temporária, altere-a no seu cadastro.
        </p>
      </div>
    </div>
  );
};

export default EsqueciSenha;
