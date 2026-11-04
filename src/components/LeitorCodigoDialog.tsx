import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLido: (texto: string) => void;
}

/** Lê código de barras ou QR Code pela câmera do celular/computador. */
export default function LeitorCodigoDialog({ open, onOpenChange, onLido }: Props) {
  const [erro, setErro] = useState("");
  const ativo = useRef(false);

  useEffect(() => {
    if (!open) return;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    ativo.current = true;
    setErro("");
    const t = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const s = new Html5Qrcode("leitor-codigo-area");
        scanner = s;
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 160 } }, (texto) => {
          if (!ativo.current) return;
          ativo.current = false;
          onLido(texto);
          onOpenChange(false);
        }, () => {});
      } catch {
        setErro("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
      }
    }, 100);
    return () => {
      clearTimeout(t);
      ativo.current = false;
      if (scanner) scanner.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [open, onLido, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ler código de barras / QR Code</DialogTitle></DialogHeader>
        <div id="leitor-codigo-area" className="w-full min-h-[240px] rounded-md overflow-hidden bg-muted" />
        {erro ? <p className="text-sm text-destructive">{erro}</p> : <p className="text-xs text-muted-foreground">Aponte a câmera para a etiqueta do produto.</p>}
      </DialogContent>
    </Dialog>
  );
}
