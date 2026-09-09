import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos de inatividade
const AVISO_MS = 30 * 1000; // aviso nos últimos 30 segundos

const EVENTOS = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

const formatar = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const InatividadeMonitor = () => {
  const { isAuthenticated, logout } = useAuth();
  const ultimaAtividade = useRef<number>(Date.now());
  const [restante, setRestante] = useState(TIMEOUT_MS);

  const registrarAtividade = useCallback(() => {
    ultimaAtividade.current = Date.now();
    setRestante(TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    registrarAtividade();
    EVENTOS.forEach((ev) =>
      window.addEventListener(ev, registrarAtividade, { passive: true })
    );

    const intervalo = window.setInterval(() => {
      const decorrido = Date.now() - ultimaAtividade.current;
      const falta = TIMEOUT_MS - decorrido;
      setRestante(falta);
      if (falta <= 0) {
        window.clearInterval(intervalo);
        logout();
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalo);
      EVENTOS.forEach((ev) => window.removeEventListener(ev, registrarAtividade));
    };
  }, [isAuthenticated, logout, registrarAtividade]);

  if (!isAuthenticated) return null;

  const mostrarAviso = restante <= AVISO_MS && restante > 0;

  return (
    <AlertDialog open={mostrarAviso}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sessão prestes a expirar</AlertDialogTitle>
          <AlertDialogDescription>
            Por inatividade, você será desconectado em{" "}
            <span className="font-semibold text-destructive">{formatar(restante)}</span>.
            Clique em continuar para permanecer conectado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={registrarAtividade}>
            Continuar conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InatividadeMonitor;
