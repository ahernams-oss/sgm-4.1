import { useState } from "react";
import { useNavigate, Link, Navigate } from "@/lib/router-compat";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { portalStore, PortalUser } from "@/lib/portalClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, Wrench } from "lucide-react";
import bgImage from "@/assets/Tela_Inicial_SGM-2.png.asset.json";

// Token JWT falso (apenas DEV) com expiração longa, para o portalStore aceitar a sessão
const devToken = () => {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 8 * 3600, dev: true })}.dev`;
};



const fmtCpf = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function PortalLogin() {
  const { user, login } = usePortalAuth();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user)
    return <Navigate to={user.tipo === "funcionario" ? "/portal/funcionario" : "/portal/candidato"} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(cpf, senha);
      toast.success("Bem-vindo!");
    } catch (err: any) {
      toast.error(err.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  const entrarDev = (tipo: PortalUser["tipo"]) => {
    const u: PortalUser = {
      tipo,
      nome: tipo === "funcionario" ? "Funcionário DEV" : "Candidato DEV",
      cpf: "00000000000",
    };
    portalStore.set(devToken(), u);
    window.dispatchEvent(new Event("storage"));
    toast.success(`Modo DEV: entrando como ${tipo}`);
    navigate(tipo === "funcionario" ? "/portal/funcionario" : "/portal/candidato");
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage.url})` }}
    >
      {/* Overlay sutil para melhorar leitura do card */}
      <div className="absolute inset-0 bg-white/10" />


      <div className="relative w-full max-w-md">
        {/* Card glassmorphism */}
        <div
          className="rounded-3xl border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl px-8 sm:px-10 py-10"
          style={{
            background:
              "linear-gradient(160deg, rgba(15,32,60,0.72) 0%, rgba(10,22,44,0.78) 100%)",
          }}
        >
          {/* Títulos */}
          <div className="text-center mb-8">

            <h1 className="text-4xl font-bold text-white tracking-tight">Portal LASANT</h1>
            <p className="text-sky-300/90 text-sm mt-2 font-medium">
              Colaboradores e Candidatos
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {/* CPF */}
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">CPF</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/80 z-10" />
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(fmtCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="h-12 pl-11 rounded-xl bg-white/5 border-white/20 text-white font-bold placeholder:text-slate-500/70 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:border-sky-400/60"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label className="text-white/90 text-sm font-medium">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/80 z-10" />
                <Input
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="h-12 pl-11 pr-11 rounded-xl bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:border-sky-400/60"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-300/80 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 rounded-xl text-white font-semibold text-base border-0 shadow-[0_10px_30px_-8px_rgba(56,189,248,0.6)] hover:shadow-[0_12px_36px_-6px_rgba(56,189,248,0.75)] transition-all"
              style={{
                background:
                  "linear-gradient(180deg, #3b9dff 0%, #1f6fe0 50%, #1857b8 100%)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            {/* Links */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <Link
                to="/portal/cadastrar-senha"
                className="text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors"
              >
                Primeiro acesso? Criar senha
              </Link>
              <Link
                to="/portal/esqueci-senha"
                className="text-white/60 hover:text-white/90 text-sm transition-colors"
              >
                Esqueci minha senha
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-white/60 hover:text-white/90 text-sm transition-colors mt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao portal principal
              </Link>
            </div>
          </form>

          {/* Selo de confiança */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-sky-400/80" />
            <p className="text-white/70 text-xs tracking-wide">
              Segurança <span className="text-sky-400/70 mx-1">•</span> Confiança
              <span className="text-sky-400/70 mx-1">•</span> Inovação
            </p>
          </div>

          {/* Acesso DEV — visível apenas em ambiente de desenvolvimento */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-4 border-t border-dashed border-amber-400/40">
              <p className="text-amber-300/90 text-xs font-semibold text-center mb-3 flex items-center justify-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Modo DEV (sem senha)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-amber-400/50 text-amber-200 hover:bg-amber-400/10"
                  onClick={() => entrarDev("funcionario")}
                >
                  Funcionário
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-amber-400/50 text-amber-200 hover:bg-amber-400/10"
                  onClick={() => entrarDev("candidato")}
                >
                  Candidato
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
