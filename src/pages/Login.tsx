import { useState } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import logoLasant from "@/assets/Logo_Lasant.png";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      const success = await login(email, senha, lembrar);
      if (success) {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      } else {
        toast.error("E-mail ou senha inválidos.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #5fc4e8 0%, #3a9fd6 35%, #2563c4 70%, #1e3a8a 100%)",
      }}
    >
      {/* Listras diagonais sutis no fundo */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0, transparent 60px, rgba(255,255,255,0.08) 60px, rgba(255,255,255,0.08) 120px)",
        }}
      />

      <div className="relative w-full max-w-6xl flex bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[640px]">
      {/* Coluna esquerda - Formulário */}
      <div className="flex-1 flex flex-col px-4 sm:px-6 sm:px-12 lg:px-20 py-8 lg:py-10 overflow-y-auto">
        {/* Topo: Logo + LOG IN */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-2xl mx-auto">
          <img
            src={logoLasant}
            alt="Lasant Construções"
            className="h-20 w-auto"
          />
          <span className="text-base font-semibold tracking-[0.2em] text-foreground border-b-2 border-foreground pb-1">
            LOG IN
          </span>
        </div>

        {/* Conteúdo central */}
        <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto py-10">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl sm:text-4xl font-serif font-semibold text-[#3a1d6e] leading-tight">
              LASANT CONSTRUÇÕES
            </h1>
            <h2 className="text-xl sm:text-2xl sm:text-3xl font-serif font-medium text-[#3a1d6e] mt-3">
              Log in - SGM
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-12 pl-11 pr-4 rounded-full bg-[#ececec] border-transparent focus-visible:ring-2 focus-visible:ring-[#3a1d6e]/30"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                type={showSenha ? "text" : "password"}
                placeholder="Password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                className="h-12 pl-11 pr-11 rounded-full bg-[#ececec] border-transparent focus-visible:ring-2 focus-visible:ring-[#3a1d6e]/30"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Lembrar / Esqueci */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={lembrar}
                  onCheckedChange={(v) => setLembrar(v === true)}
                  className="rounded-sm"
                />
                <span className="italic">Lembrar</span>
              </label>
              <Link
                to="/esqueci-senha"
                className="text-sm italic text-foreground hover:underline"
              >
                Esqueci a senha
              </Link>
            </div>

            {/* Botão */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#3a1d6e] hover:bg-[#2e1757] text-white font-semibold text-base mt-4 shadow-md"
            >
              {loading ? "Entrando..." : "Log in"}
            </Button>

            <p className="text-xs italic text-muted-foreground text-center pt-2">
              Para acesso, contate a empresa.
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <Link
                to="/portal-fornecedor"
                className="inline-flex items-center justify-center h-11 px-8 rounded-full bg-[#f5a623] hover:bg-[#e69612] text-[#3a1d6e] font-semibold text-sm shadow-md transition-colors"
              >
                Portal do fornecedor
              </Link>
              <Link
                to="/portal"
                className="inline-flex items-center justify-center h-11 px-8 rounded-full bg-[#3a1d6e] hover:bg-[#2e1757] text-white font-semibold text-sm shadow-md transition-colors"
              >
                Portal do funcionário
              </Link>
            </div>

          </form>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          © {new Date().getFullYear()} LASANT CONSTRUÇÕES — Todos os direitos reservados
        </p>
      </div>

      {/* Coluna direita - Painel decorativo */}
      <div className="hidden lg:block relative w-[42%] xl:w-[45%] overflow-hidden">
        {/* Camada roxa diagonal */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1a0a3e 0%, #2d1167 35%, #3a1d6e 60%, #4a2585 100%)",
            clipPath: "polygon(15% 0, 100% 0, 85% 100%, 0 100%)",
          }}
        >
          {/* Listras diagonais sutis */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0, transparent 40px, rgba(255,255,255,0.08) 40px, rgba(255,255,255,0.08) 80px)",
            }}
          />
        </div>

        {/* Camada vermelha sobreposta */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #8b2a3a 0%, #a83e4f 50%, #c45565 100%)",
            clipPath: "polygon(55% 0, 100% 0, 100% 100%, 35% 100%)",
            opacity: 0.92,
          }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 80px)",
            }}
          />
        </div>

        {/* Texto sobreposto */}
        <div className="absolute inset-0 flex flex-col justify-center px-12 xl:px-16">
          <div className="text-white font-serif leading-tight space-y-2">
            <div className="text-5xl xl:text-6xl font-light">Gestão</div>
            <div className="text-2xl sm:text-3xl xl:text-4xl font-light pl-12">de</div>
            <div className="text-4xl xl:text-5xl font-light pl-20">Manutenção</div>
            <div className="text-2xl sm:text-3xl xl:text-4xl font-light pl-12">e</div>
            <div className="text-4xl xl:text-5xl font-light pl-24">Obras</div>
            <div className="text-2xl sm:text-3xl xl:text-4xl font-light pl-12 pt-2">Também</div>
            <div className="text-4xl xl:text-5xl font-light pl-20">Suprimentos</div>
            <div className="text-2xl sm:text-3xl xl:text-4xl font-light pl-12">e</div>
            <div className="text-4xl xl:text-5xl font-light pl-24">Muito +</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Login;
