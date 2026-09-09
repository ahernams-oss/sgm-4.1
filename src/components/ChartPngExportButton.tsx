import { toPng } from "html-to-image";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import React from "react";

interface ChartPngExportButtonProps {
  filename: string;
  className?: string;
}

/**
 * Botão de exportação de gráfico para PNG.
 * Ao ser clicado, procura o ancestral com `data-chart-card` e captura o conteúdo como imagem.
 */
export function ChartPngExportButton({ filename, className }: ChartPngExportButtonProps) {
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const card = (e.currentTarget as HTMLElement).closest("[data-chart-card]") as HTMLElement | null;
    if (!card) {
      toast.error("Não foi possível localizar o gráfico.");
      return;
    }
    try {
      const dataUrl = await toPng(card, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        filter: (node) => {
          const el = node as HTMLElement;
          return !(el?.dataset && el.dataset.exportIgnore === "true");
        },
      });
      const link = document.createElement("a");
      const safeName = filename.replace(/[^a-z0-9\-_]+/gi, "_");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Gráfico exportado em PNG");
    } catch (err) {
      console.error("Erro ao exportar gráfico:", err);
      toast.error("Falha ao exportar gráfico");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className ?? "h-7 w-7 shrink-0"}
      title="Exportar gráfico em PNG"
      onClick={handleClick}
      data-export-ignore="true"
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  );
}

export default ChartPngExportButton;
