import { Filter } from "lucide-react";

interface Props {
  titulo?: string;
  descricao?: string;
}

/**
 * Estado exibido no lugar da grade quando a tela exige ao menos um filtro
 * selecionado antes de carregar os registros do banco.
 */
export default function GradeRequerFiltro({ titulo, descricao }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Filter className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {titulo ?? "Selecione ao menos um filtro para carregar os registros"}
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          {descricao ??
            "Use os filtros acima (busca, cliente, status, período etc.). Nenhuma consulta é feita até que um filtro seja aplicado, otimizando o carregamento."}
        </p>
      </div>
    </div>
  );
}
