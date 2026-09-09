import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Link2, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSco } from "@/contexts/ScoContext";
import { useMaterialScoVinculos } from "@/contexts/MaterialScoVinculosContext";
import { MaterialServico } from "@/contexts/MateriaisServicosContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";

interface Props {
  material: MaterialServico | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}

export default function VinculosScoDialog({ material, open, onOpenChange, readOnly }: Props) {
  const { scos } = useSco();
  const { getVinculos, addVinculo, deleteVinculo, definirPadrao, updateVinculo } = useMaterialScoVinculos();
  const { toast } = useToast();
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const [scoId, setScoId] = useState("");
  const [fator, setFator] = useState("1");
  const [obs, setObs] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const vinculos = useMemo(() => (material ? getVinculos(material.id) : []), [material, getVinculos]);

  const handleAdd = async () => {
    if (!material) return;
    const sco = scos.find(s => s.id === scoId);
    if (!sco) { toast({ title: "Selecione um código SCO", variant: "destructive" }); return; }
    if (vinculos.some(v => v.codSco === sco.codSco)) {
      toast({ title: "Este código SCO já está vinculado a este material", variant: "destructive" });
      return;
    }
    const f = Number(String(fator).replace(",", ".")) || 0;
    if (f <= 0) { toast({ title: "Fator de conversão deve ser maior que zero", variant: "destructive" }); return; }
    await addVinculo({
      materialId: material.id,
      scoId: sco.id,
      codSco: sco.codSco,
      descricaoSco: sco.descricaoSco,
      unidadeSco: sco.unidade,
      fatorConversao: f,
      padrao: vinculos.length === 0,
      observacao: obs,
    });
    setScoId(""); setFator("1"); setObs("");
    toast({ title: "Vínculo SCO adicionado" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Vínculos SCO — {material ? `${material.codigo} - ${material.descricao}` : ""}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Relacione este material de estoque aos códigos da tabela pública SCO equivalentes. Na saída de estoque o
            código padrão é sugerido automaticamente e a quantidade é convertida pelo fator informado
            (1 {material?.unidadeMedida || "UN"} do estoque = fator × unidade SCO).
          </p>

          {!readOnly && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-muted/30">
              <div className="md:col-span-6">
                <Label>Código SCO *</Label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                      <span className="truncate">
                        {scoId
                          ? (() => { const s = scos.find(x => x.id === scoId); return s ? `${s.codSco} - ${s.descricaoSco}` : "Selecione..."; })()
                          : "Selecione..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[520px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por código ou descrição SCO..." />
                      <CommandList>
                        <CommandEmpty>Nenhum item SCO encontrado.</CommandEmpty>
                        <CommandGroup>
                          {scos.slice(0, 500).map(s => (
                            <CommandItem
                              key={s.id}
                              value={`${s.codSco} ${s.descricaoSco}`}
                              onSelect={() => { setScoId(s.id); setPopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", scoId === s.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono mr-2">{s.codSco}</span>
                              <span className="truncate">{s.descricaoSco}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-2">
                <Label>Fator *</Label>
                <Input inputMode="decimal" value={fator} onChange={e => setFator(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="1" />
              </div>
              <div className="md:col-span-3">
                <Label>Observação</Label>
                <Input value={obs} onChange={e => setObs(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Button className="w-full" onClick={handleAdd}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código SCO</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Un. SCO</TableHead>
                  <TableHead className="text-center">Fator</TableHead>
                  <TableHead className="text-center">Padrão</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculos.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum código SCO vinculado</TableCell></TableRow>
                ) : vinculos.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">{v.codSco}</TableCell>
                    <TableCell>{v.descricaoSco}</TableCell>
                    <TableCell className="text-center">{v.unidadeSco || "-"}</TableCell>
                    <TableCell className="text-center">
                      {readOnly ? v.fatorConversao : (
                        <Input
                          className="h-8 w-24 mx-auto text-center"
                          inputMode="decimal"
                          defaultValue={String(v.fatorConversao)}
                          onBlur={e => {
                            const f = Number(e.target.value.replace(",", ".")) || 0;
                            if (f > 0 && f !== v.fatorConversao) updateVinculo(v.id, { fatorConversao: f });
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {v.padrao
                        ? <Badge className="bg-primary/10 text-primary border-primary/20">Padrão</Badge>
                        : !readOnly && material && (
                          <Button variant="ghost" size="sm" onClick={() => definirPadrao(material.id, v.id)}>
                            <Star className="h-4 w-4 mr-1" />Definir
                          </Button>
                        )}
                    </TableCell>
                    <TableCell>
                      {!readOnly && (
                        <Button variant="ghost" size="icon" onClick={() => requestDelete(v.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) cancelDelete(); }}
        onConfirm={() => { if (deleteId) deleteVinculo(deleteId); cancelDelete(); }}
        title="Excluir vínculo SCO"
      />
    </>
  );
}
