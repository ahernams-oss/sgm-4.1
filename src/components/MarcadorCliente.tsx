import { Building2 } from "lucide-react";

export function MarcadorCliente() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" title="Destinado a cliente">
      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
      Cliente
    </span>
  );
}