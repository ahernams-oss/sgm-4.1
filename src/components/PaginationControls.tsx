import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [7, 10, 20, 50];

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  return {
    paginated: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    totalPages,
    safePage,
  };
}

export default function PaginationControls({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = PAGE_SIZE,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {onPageSizeChange ? (
          <>
            <span>Mostrando</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 bg-background text-foreground text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>registros</span>
          </>
        ) : (
          <span>
            Página {safePage} de {totalPages} — {totalItems} registro(s)
          </span>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
            Próxima<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
