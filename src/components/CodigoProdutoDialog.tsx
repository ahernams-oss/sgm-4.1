import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { conteudoCodigoProduto } from "@/lib/codigoProduto";

interface Props {
  item: { codigo: string; descricao: string } | null;
  onOpenChange: (v: boolean) => void;
}

export default function CodigoProdutoDialog({ item, onOpenChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!item) return;
    const valor = conteudoCodigoProduto(item.codigo);
    const t = setTimeout(() => {
      if (svgRef.current) JsBarcode(svgRef.current, valor, { format: "CODE128", height: 60, fontSize: 14, margin: 4 });
    }, 0);
    QRCode.toDataURL(valor, { width: 180, margin: 1 }).then(setQr);
    return () => clearTimeout(t);
  }, [item]);

  const imprimir = () => {
    if (!item || !svgRef.current) return;
    const w = window.open("", "_blank", "width=420,height=360");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    w.document.write(`<html><head><title>Etiqueta ${esc(item.codigo)}</title><style>body{font-family:Arial;margin:8px;text-align:center}.r{display:flex;gap:12px;align-items:center;justify-content:center}p{font-size:12px;margin:4px 0}</style></head><body>
      <p><b>${esc(item.descricao)}</b></p><div class="r">${svgRef.current.outerHTML}<img src="${qr}" width="110"/></div>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Código de barras e QR Code</DialogTitle></DialogHeader>
        {item && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-center font-medium">{item.codigo} — {item.descricao}</p>
            <svg ref={svgRef} />
            {qr && <img src={qr} alt={`QR Code ${item.codigo}`} className="w-40 h-40" />}
          </div>
        )}
        <DialogFooter><Button onClick={imprimir}><Printer className="h-4 w-4 mr-2" />Imprimir etiqueta</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
