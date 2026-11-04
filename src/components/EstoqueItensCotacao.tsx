import { useMemo } from "react";
import { MapPin, Package } from "lucide-react";
import { useEstoque } from "@/contexts/EstoqueContext";
import type { ItemRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Badge } from "@/components/ui/badge";

/** Mostra, para cada item da requisição, o saldo em estoque e onde ele está guardado. */
export default function EstoqueItensCotacao({ itens }: { itens: ItemRequisicaoCompras[] }) {
  const { getSaldos } = useEstoque();
  const saldos = useMemo(() => getSaldos().filter(s => s.quantidade > 0), [getSaldos]);

  if (!itens.length) return null;
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-sm font-medium">
        <Package className="h-4 w-4" /> Estoque dos itens pedidos
      </div>
      <div className="max-h-72 divide-y overflow-y-auto">
        {itens.map(item => {
          const locais = saldos.filter(s => item.materialId && s.materialId === item.materialId);
          const total = locais.reduce((t, s) => t + s.quantidade, 0);
          return (
            <div key={item.id} className="px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{item.descricao}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">Pedido: {item.quantidade} {item.unidadeMedida}</span>
              </div>
              {total > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge variant={total >= item.quantidade ? "default" : "secondary"}>Em estoque: {total} {item.unidadeMedida}</Badge>
                  {locais.map(l => (
                    <span key={l.local} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                      <MapPin className="h-3 w-3" />{l.local || "Sem local"}: {l.quantidade}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Sem estoque disponível</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
