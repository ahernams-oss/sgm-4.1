import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "@/lib/router-compat";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { portalCall } from "@/lib/portalClient";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import logoLasant from "@/assets/Logo_Lasant.png";

interface Props {
  children: ReactNode;
  requireTipo?: "funcionario" | "candidato";
}

const TERMOS_PATH = "/portal/candidato/termos";
export const TERMO_OK_KEY = "portalTermoLgpdOk";

export default function PortalLayout({ children, requireTipo }: Props) {
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const isCand = user?.tipo === "candidato";
  const [termoOk, setTermoOk] = useState<boolean | null>(() =>
    typeof window !== "undefined" && sessionStorage.getItem(TERMO_OK_KEY) === user?.cpf ? true : null,
  );

  useEffect(() => {
    if (!isCand || termoOk) return;
    let alive = true;
    portalCall<{ termos: { tipo_termo: string }[] }>("termos-list")
      .then((r) => {
        const ok = (r.termos || []).some((t) => t.tipo_termo === "lgpd");
        if (ok && user) sessionStorage.setItem(TERMO_OK_KEY, user.cpf);
        if (alive) setTermoOk(ok);
      })
      .catch(() => { if (alive) setTermoOk(true); }); // erro de rede/sessão: não trava a tela
    return () => { alive = false; };
  }, [isCand, termoOk, user, loc.pathname]);

  if (!user) return <Navigate to="/portal" replace state={{ from: loc.pathname }} />;
  if (requireTipo && user.tipo !== requireTipo) {
    return <Navigate to={user.tipo === "funcionario" ? "/portal/funcionario" : "/portal/candidato"} replace />;
  }
  if (isCand && termoOk === false && loc.pathname !== TERMOS_PATH) {
    return <Navigate to={TERMOS_PATH} replace />;
  }
  if (isCand && termoOk === null && loc.pathname !== TERMOS_PATH) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }
  const bloqueado = isCand && termoOk !== true;

  const menuFunc = [
    { to: "/portal/funcionario", label: "Início" },
    { to: "/portal/funcionario/holerites", label: "Holerites" },
    { to: "/portal/funcionario/ferias", label: "Férias" },
    { to: "/portal/funcionario/documentos", label: "Documentos" },
    { to: "/portal/funcionario/epis", label: "EPIs" },
    { to: "/portal/funcionario/treinamentos", label: "Treinamentos" },
    { to: "/portal/funcionario/solicitacoes", label: "Solicitações RH" },
    { to: "/portal/funcionario/avisos", label: "Avisos" },
    { to: "/portal/funcionario/perfil", label: "Perfil" },
  ];
  const menuCand = [
    { to: "/portal/candidato", label: "Início" },
    { to: "/portal/candidato/ficha", label: "Ficha" },
    { to: "/portal/candidato/documentos", label: "Documentos" },
    { to: "/portal/candidato/termos", label: "Termos" },
    { to: "/portal/candidato/admissional", label: "Admissional" },
  ];
  const menu = user.tipo === "funcionario" ? menuFunc : bloqueado ? menuCand.filter((m) => m.to === TERMOS_PATH) : menuCand;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 h-14 flex flex-wrap items-center justify-between gap-2 relative">
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="font-semibold tracking-tight text-lg">Portal de RH</span>
          </div>
          <div className="flex items-center gap-3 text-sm ml-auto">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{user.nome}</span>
            <Button size="sm" variant="secondary" onClick={() => { logout(); navigate("/portal"); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto text-sm items-center">
          <Link to={user.tipo === "funcionario" ? "/portal/funcionario" : "/portal/candidato"} className="flex items-center">
            <img src={logoLasant} alt="Lasant" className="h-9 w-auto mr-[6cm]" />
          </Link>
          {menu.map((m: any) => {
            const active = loc.pathname === m.to;
            return (
              <Link key={m.to} to={m.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-t-md whitespace-nowrap ${active ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}>
                <span>{m.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>
      <footer className="text-xs text-muted-foreground text-center py-4">
        © LASANT — Portal do Colaborador
      </footer>
    </div>
  );
}
