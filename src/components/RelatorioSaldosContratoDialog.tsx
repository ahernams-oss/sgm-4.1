import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet } from "lucide-react";
import { useClientes, type Cliente, type Contrato } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfSaldosContrato, gerarExcelSaldosContrato, type SaldoTransferenciaContrato } from "@/lib/gerarRelatorioSaldosContrato";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const parseBR = (v?: string | number | null): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const fmtBR = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const firstOfMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export default function RelatorioSaldosContratoDialog({ open, onOpenChange }: Props) {
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const clientesLista = useMemo(
    () => (clientes as Cliente[])
      .filter((c) => c.tipo === "Cliente" && (c.contratos || []).length > 0)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
    [clientes]
  );

  const [clienteId, setClienteId] = useState<string>("");
  const [contratoId, setContratoId] = useState<string>("");
  const cliente = clientesLista.find((c) => c.id === clienteId);
  const contratos: Contrato[] = cliente?.contratos || [];
  const contrato = contratos.find((c) => c.id === contratoId);

  const hoje = new Date();
  const [periodoInicio, setPeriodoInicio] = useState<string>(firstOfMonth(new Date(hoje.getFullYear(), 0, 1)));
  const [periodoFim, setPeriodoFim] = useState<string>(firstOfMonth(new Date(hoje.getFullYear(), 11, 1)));
  const [prevFolha, setPrevFolha] = useState<string>("");
  const [prevVariavel, setPrevVariavel] = useState<string>("");
  const [transferencias, setTransferencias] = useState<SaldoTransferenciaContrato[]>([]);

  useEffect(() => {
    if (!contrato) return;
    const folha = parseBR(contrato.maoDeObraMensal);
    const anual = parseBR(contrato.maoDeObraAnual);
    const contratoV = parseBR(contrato.valorContrato);
    const folhaFinal = folha || (anual ? anual / 12 : 0) || (contratoV ? contratoV / 12 : 0);
    const variavel = parseBR(contrato.valorBase);
    setPrevFolha(fmtBR(folhaFinal));
    setPrevVariavel(fmtBR(variavel));
    if (contrato.dataInicio) setPeriodoInicio(contrato.dataInicio.slice(0, 7) + "-01");
    if (contrato.dataFim) setPeriodoFim(contrato.dataFim.slice(0, 7) + "-01");
  }, [contratoId, clienteId, clientes]);

  useEffect(() => {
    let active = true;
    if (!contratoId) { setTransferencias([]); return; }
    const carregarTransferencias = async () => {
      const { data, error } = await supabase
        .from("contrato_transferencias_saldo")
        .select("data, created_at, tipo_saldo, contrato_origem_id, contrato_destino_id, saldo_origem_antes, saldo_origem_depois, saldo_destino_antes, saldo_destino_depois")
        .or(`contrato_origem_id.eq.${contratoId},contrato_destino_id.eq.${contratoId}`)
        .order("data", { ascending: true });
      if (!active) return;
      if (error) {
        setTransferencias([]);
        toast.error("Não foi possível carregar transferências do contrato.");
        return;
      }
      setTransferencias((data as SaldoTransferenciaContrato[]) ?? []);
    };
    carregarTransferencias();
    return () => { active = false; };
  }, [contratoId]);

  const podeGerar = !!cliente && !!contrato && !!periodoInicio && !!periodoFim;

  const doGerar = async (tipo: "pdf" | "excel") => {
    if (!cliente || !contrato) { toast.error("Selecione cliente e contrato."); return; }
    const input = {
      cliente,
      contrato,
      periodoInicio,
      periodoFim,
      prevFolhaMensal: parseBR(prevFolha),
      prevVariavelMensal: parseBR(prevVariavel),
        transferencias,
    };
    if (tipo === "pdf") await gerarPdfSaldosContrato(input, empresa?.logoUrl);
    else gerarExcelSaldosContrato(input);
    toast.success(`Relatório ${tipo.toUpperCase()} gerado.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório de Saldos por Contrato</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setContratoId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {clientesLista.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Contrato</Label>
            <Select value={contratoId} onValueChange={setContratoId} disabled={!cliente}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {contratos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.numero || "—"}{c.descricao ? " — " + c.descricao : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período de (mês)</Label>
              <Input type="month" value={periodoInicio.slice(0, 7)} onChange={(e) => setPeriodoInicio(e.target.value + "-01")} />
            </div>
            <div>
              <Label>Período até (mês)</Label>
              <Input type="month" value={periodoFim.slice(0, 7)} onChange={(e) => setPeriodoFim(e.target.value + "-01")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Previsto Mensal - M.O. Fixa</Label>
              <Input value={prevFolha} onChange={(e) => setPrevFolha(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Previsto Mensal - Variável</Label>
              <Input value={prevVariavel} onChange={(e) => setPrevVariavel(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" disabled={!podeGerar} onClick={() => doGerar("excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button disabled={!podeGerar} onClick={() => doGerar("pdf")}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
