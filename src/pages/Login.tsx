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
    <div className="login-canvas relative flex min-h-screen w-full items-center justify-center overflow-hidden p-1.5 sm:p-2">
      <div className="login-stripes pointer-events-none absolute inset-0" />

      <div className="relative flex min-h-[calc(100dvh-0.75rem)] w-full overflow-hidden rounded-[1.6rem] bg-card shadow-2xl sm:min-h-[calc(100dvh-1rem)]">
      {/* Coluna esquerda - Formulário */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-10 lg:basis-[61%] lg:px-[7.5%] lg:py-10 xl:px-[8%]">
        {/* Topo: Logo + LOG IN */}
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-6">
          <img
            src={logoLasant}
            alt="Lasant Construções"
            className="h-auto w-40 object-contain sm:w-48 lg:w-52"
          />
          <span className="border-b-2 border-foreground pb-1 text-sm font-semibold tracking-[0.24em] text-foreground sm:text-base">
            LOG IN
          </span>
        </div>

        {/* Conteúdo central */}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8 lg:py-6">
          <div className="mb-9 text-center lg:mb-10">
            <h1 className="text-2xl font-semibold leading-tight text-login-brand sm:text-3xl lg:text-4xl">
              LASANT CONSTRUÇÕES
            </h1>
            <h2 className="mt-3 text-xl font-normal text-login-brand sm:text-2xl lg:text-3xl">
              Log in - SGM
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <User className="absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-login-field-foreground" />
              <Input
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-12 rounded-full border-transparent bg-login-field pl-12 pr-5 text-login-field-foreground shadow-none placeholder:text-login-field-foreground/80 focus-visible:ring-2 focus-visible:ring-login-brand/30 sm:h-14"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-login-field-foreground" />
              <Input
                type={showSenha ? "text" : "password"}
                placeholder="Password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                className="h-12 rounded-full border-transparent bg-login-field pl-12 pr-12 text-login-field-foreground shadow-none placeholder:text-login-field-foreground/80 focus-visible:ring-2 focus-visible:ring-login-brand/30 sm:h-14"
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full text-login-field-foreground hover:bg-transparent hover:text-foreground"
                tabIndex={-1}
                aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {/* Lembrar / Esqueci */}
            <div className="flex items-center justify-between gap-4 px-2 pt-1">
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
              className="mt-4 h-12 w-full rounded-full bg-login-brand text-base font-semibold text-login-brand-foreground shadow-md hover:bg-login-brand/90 sm:h-14"
            >
              {loading ? "Entrando..." : "Log in"}
            </Button>

            <p className="text-xs italic text-muted-foreground text-center pt-2">
              Para acesso, contate a empresa.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
              <Link
                to="/portal-fornecedor"
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-login-brand shadow-md transition-colors hover:bg-accent/90"
              >
                Portal do fornecedor
              </Link>
              <Link
                to="/portal"
                className="inline-flex h-12 items-center justify-center rounded-full bg-login-brand px-6 text-sm font-semibold text-login-brand-foreground shadow-md transition-colors hover:bg-login-brand/90"
              >
                Portal do funcionário
              </Link>
            </div>

          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} LASANT CONSTRUÇÕES — Todos os direitos reservados
        </p>
      </div>

      {/* Coluna direita - Painel decorativo */}
      <div className="relative hidden basis-[39%] overflow-hidden lg:block">
        {/* Camada roxa diagonal */}
        <div className="login-panel-purple absolute inset-0">
          {/* Listras diagonais sutis */}
          <div className="login-stripes absolute inset-0" />
        </div>

        {/* Camada vermelha sobreposta */}
        <div className="login-panel-red absolute inset-0">
          <div className="login-stripes absolute inset-0" />
        </div>

        {/* Texto sobreposto */}
        <div className="absolute inset-0 flex flex-col justify-center px-[8%] xl:px-[10%]">
          <div className="space-y-1 leading-[1.04] text-login-brand-foreground">
            <div className="text-5xl font-light xl:text-6xl">Gestão</div>
            <div className="pl-[12%] text-3xl font-light xl:text-4xl">de</div>
            <div className="pl-[20%] text-4xl font-light xl:text-5xl">Manutenção</div>
            <div className="pl-[12%] text-3xl font-light xl:text-4xl">e</div>
            <div className="pl-[24%] text-4xl font-light xl:text-5xl">Obras</div>
            <div className="pl-[12%] pt-2 text-3xl font-light xl:text-4xl">Também</div>
            <div className="pl-[20%] text-4xl font-light xl:text-5xl">Suprimentos</div>
            <div className="pl-[12%] text-3xl font-light xl:text-4xl">e</div>
            <div className="pl-[24%] text-4xl font-light xl:text-5xl">Muito +</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Login;
