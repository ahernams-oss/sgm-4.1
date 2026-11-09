import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarValorExecucaoNfse } from "@/lib/valoresExecucaoNfse";

export function ValoresExecucaoNfse({ maoObra, material, beneficios, onChange }: {
  maoObra: string;
  material: string;
  beneficios: string;
  onChange: (maoObra: string, material: string, beneficios: string) => void;
}) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    <div className="space-y-1">
      <Label htmlFor="nfse-mao-obra">VALOR MÃO DE OBRA (R$)</Label>
      <Input id="nfse-mao-obra" inputMode="decimal" placeholder="0,00" value={maoObra}
        onChange={e => onChange(e.target.value, material, beneficios)}
        onBlur={() => onChange(formatarValorExecucaoNfse(maoObra), material, beneficios)} />
    </div>
    <div className="space-y-1">
      <Label htmlFor="nfse-material-aplicado">MATERIAL APLICADO (R$)</Label>
      <Input id="nfse-material-aplicado" inputMode="decimal" placeholder="0,00" value={material}
        onChange={e => onChange(maoObra, e.target.value, beneficios)}
        onBlur={() => onChange(maoObra, formatarValorExecucaoNfse(material), beneficios)} />
    </div>
    <div className="space-y-1">
      <Label htmlFor="nfse-beneficios-insumos">BENEFÍCIOS E INSUMOS (R$)</Label>
      <Input id="nfse-beneficios-insumos" inputMode="decimal" placeholder="0,00" value={beneficios}
        onChange={e => onChange(maoObra, material, e.target.value)}
        onBlur={() => onChange(maoObra, material, formatarValorExecucaoNfse(beneficios))} />
    </div>
  </div>;
}