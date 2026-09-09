import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, MoreVertical, Download, CheckCircle2, ArrowRight } from "lucide-react";
import { useModuleManifest } from "@/hooks/useModuleManifest";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

const Passo = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
      {n}
    </span>
    <span>{children}</span>
  </li>
);

export default function InstalarOrcamentos() {
  useModuleManifest({
    manifest: "/manifest-orcamentos.json",
    appleTitle: "Orçamentos",
    appleTouchIcon: "/icon-orcamentos-192.png",
  });

  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore - iOS Safari
      window.navigator.standalone === true;
    setInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-md">
            <img src="/icon-orcamentos-512.png" alt="App Orçamentos Lasant" className="w-full h-full object-cover" width={80} height={80} />
          </div>
          <CardTitle className="text-2xl">Instalar Orçamentos</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            App dedicado ao módulo de <strong>Orçamentos e Memória de Cálculo</strong>, otimizado para celular e tablet.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {installed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary border border-primary/30">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">App já instalado neste dispositivo!</span>
            </div>
          )}

          {!installed && deferredPrompt && (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="w-4 h-4 mr-2" />
              Instalar agora
            </Button>
          )}

          {!installed && platform === "ios" && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Como instalar no iPhone / iPad
              </h3>
              <ol className="space-y-3 text-sm">
                <Passo n={1}>Abra esta página no <strong>Safari</strong> (não funciona no Chrome do iOS).</Passo>
                <Passo n={2}>Toque em <Share className="inline w-4 h-4 mx-1" /> <strong>Compartilhar</strong>.</Passo>
                <Passo n={3}>Escolha <Plus className="inline w-4 h-4 mx-1" /> <strong>Adicionar à Tela de Início</strong>.</Passo>
                <Passo n={4}>Confirme em <strong>Adicionar</strong>. O ícone "Orçamentos" aparecerá na tela inicial.</Passo>
              </ol>
            </div>
          )}

          {!installed && platform === "android" && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Como instalar no Android
              </h3>
              <ol className="space-y-3 text-sm">
                <Passo n={1}>Abra esta página no <strong>Chrome</strong>.</Passo>
                <Passo n={2}>Toque no menu <MoreVertical className="inline w-4 h-4 mx-1" /> no canto superior direito.</Passo>
                <Passo n={3}>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</Passo>
                <Passo n={4}>Confirme em <strong>Instalar</strong>.</Passo>
              </ol>
            </div>
          )}

          {!installed && platform === "desktop" && !deferredPrompt && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Abra esta página no <strong>celular ou tablet</strong> para instalar o app de Orçamentos.</p>
              <p>
                No computador, use o ícone <Download className="inline w-4 h-4 mx-1" /> na barra de endereço do Chrome/Edge.
              </p>
            </div>
          )}

          <Button asChild variant="outline" className="w-full">
            <Link to="/app/orcamentos">
              Abrir Orçamentos agora <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

          <div className="pt-4 border-t text-xs text-muted-foreground text-center">
            App.lasant.com.br · Módulo Orçamentos / Memória de Cálculo
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
