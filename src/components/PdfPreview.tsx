import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Worker via CDN (mesma versão do pacote)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  file: Blob | string | null;
}

export default function PdfPreview({ file }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [width, setWidth] = useState<number | undefined>();

  useEffect(() => {
    const update = () => setWidth(Math.min(window.innerWidth * 0.7, 900));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!file) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 p-2 border-b bg-background">
        <Button size="sm" variant="ghost" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">Página {pageNumber} de {numPages || "—"}</span>
        <Button size="sm" variant="ghost" onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-2" />
        <Button size="sm" variant="ghost" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-muted flex justify-center p-4">
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageNumber(1); }}
          loading={<div className="flex items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando…</div>}
          error={<div className="text-destructive">Falha ao carregar PDF</div>}
        >
          <Page pageNumber={pageNumber} scale={scale} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
        </Document>
      </div>
    </div>
  );
}
