import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, MoreVertical, Download, CheckCircle2 } from "lucide-react";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default function Instalar() {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-md">
            <img src="/icon-512.png" alt="SGM Lasant" className="w-full h-full object-cover" />
          </div>
          <CardTitle className="text-2xl">Instalar SGM Lasant</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Tenha o sistema na tela inicial do seu celular, com acesso rápido e em tela cheia.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {installed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200">
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
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Abra este site no <strong>Safari</strong> (não funciona em Chrome no iOS).</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Toque no botão <Share className="inline w-4 h-4 mx-1" /> <strong>Compartilhar</strong> na barra inferior.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Role e toque em <Plus className="inline w-4 h-4 mx-1" /> <strong>Adicionar à Tela de Início</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <span>Confirme em <strong>Adicionar</strong>. Pronto!</span>
                </li>
              </ol>
            </div>
          )}

          {!installed && platform === "android" && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Como instalar no Android
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Abra este site no <strong>Chrome</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Toque no menu <MoreVertical className="inline w-4 h-4 mx-1" /> no canto superior direito.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <span>Confirme em <strong>Instalar</strong>.</span>
                </li>
              </ol>
            </div>
          )}

          {!installed && platform === "desktop" && !deferredPrompt && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Abra esta página no seu <strong>celular</strong> para instalar o app na tela inicial.</p>
              <p>No computador, você pode instalar pelo ícone <Download className="inline w-4 h-4 mx-1" /> na barra de endereço do Chrome/Edge.</p>
            </div>
          )}

          <div className="pt-4 border-t text-xs text-muted-foreground text-center">
            App.lasant.com.br · SGM Lasant
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
