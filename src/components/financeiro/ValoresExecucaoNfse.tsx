import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarValorExecucaoNfse } from "@/lib/valoresExecucaoNfse";

export function ValoresExecucaoNfse({ maoObra, material, onChange }: {
  maoObra: string;
  material: string;
  onChange: (maoObra: string, material: string) => void;
}) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="space-y-1">
      <Label htmlFor="nfse-mao-obra">VALOR MÃO DE OBRA (R$)</Label>
      <Input id="nfse-mao-obra" inputMode="decimal" placeholder="0,00" value={maoObra}
        onChange={e => onChange(e.target.value, material)}
        onBlur={() => onChange(formatarValorExecucaoNfse(maoObra), material)} />
    </div>
    <div className="space-y-1">
      <Label htmlFor="nfse-material-aplicado">MATERIAL APLICADO (R$)</Label>
      <Input id="nfse-material-aplicado" inputMode="decimal" placeholder="0,00" value={material}
        onChange={e => onChange(maoObra, e.target.value)}
        onBlur={() => onChange(maoObra, formatarValorExecucaoNfse(material))} />
    </div>
  </div>;
}