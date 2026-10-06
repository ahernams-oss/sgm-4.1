import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePmoc } from "@/contexts/PmocContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfOsPmocEquipamento, type OsPmocRow } from "@/lib/gerarPdfOsPmoc";

const corStatus = (s: string) =>
  s === "Concluída" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
  : s === "Cancelada" ? "bg-red-100 text-red-800 border-red-300"
  : "bg-amber-100 text-amber-800 border-amber-300";

export default function PmocOrdensServico() {
  const { planos, atividades } = usePmoc();
  const { equipamentos } = useEquipamentos();
  const { empresa } = useEmpresa();
  const [ordens, setOrdens] = useState<OsPmocRow[]>([]);
  const [busca, setBusca] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("numero") || "" : "");
  const [status, setStatus] = useState("todos");
  const [cliente, setCliente] = useState("todos");
  const [local, setLocal] = useState("todos");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");

  const carregar = async () => {
    const { data, error } = await (supabase as any).from("pmoc_ordens_servico").select("*").order("numero", { ascending: false });
    if (error) { toast.error("Erro ao carregar O.S. PMOC", { description: error.message }); return; }
    setOrdens(data || []);
  };
  useEffect(() => { carregar(); }, []);

  // Cliente da OS: prioriza o cadastro do equipamento; cai para a unidade da OS.
  const clienteDaOs = (o: OsPmocRow) => {
    const eq = equipamentos.find((e) => e.id === o.equipamento_id);
    return (eq?.clienteNome || o.unidade || "").trim();
  };
  const localDaOs = (o: OsPmocRow) => {
    const eq = equipamentos.find((e) => e.id === o.equipamento_id);
    return (eq?.localDescricao || o.local_descricao || o.unidade || "").trim();
  };

  const clientesOptions = useMemo(
    () => Array.from(new Set(ordens.map(clienteDaOs).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [ordens, equipamentos]
  );
  const locaisOptions = useMemo(() => {
    const fonte = cliente !== "todos" ? ordens.filter((o) => clienteDaOs(o) === cliente) : ordens;
    return Array.from(new Set(fonte.map(localDaOs).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [ordens, equipamentos, cliente]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    return ordens.filter((o) => {
      if (status !== "todos" && o.status !== status) return false;
      if (cliente !== "todos" && clienteDaOs(o) !== cliente) return false;
      if (local !== "todos" && localDaOs(o) !== local) return false;
      const d = (o.data_conclusao || o.data_abertura || "").slice(0, 10);
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      return !q || [String(o.numero), o.equipamento_nome, o.unidade, o.descricao, o.tecnico_responsavel].some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [ordens, equipamentos, busca, status, cliente, local, ini, fim]);

  const relatorio = async (o: OsPmocRow) => {
    const plano = planos.find((p) => p.id === o.plano_id);
    const equipamento = equipamentos.find((e) => e.id === o.equipamento_id);
    const ativs = atividades.filter((a) => a.planoId === o.plano_id && (!a.equipamentoId || a.equipamentoId === o.equipamento_id));
    const doEquip = ordens.filter((x) => x.equipamento_id === o.equipamento_id && (!o.plano_id || x.plano_id === o.plano_id));
    try {
      await downloadPdfOsPmocEquipamento({
        equipamento, equipamentoNome: o.equipamento_nome, plano, atividades: ativs, ordens: doEquip,
        inicio: plano?.vigenciaInicio || undefined,
        ordemSelecionada: o,
        empresaLogoUrl: empresa?.logoUrl || undefined,
      });
    } catch (e: any) { toast.error("Erro ao gerar relatório", { description: e.message }); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> O.S. PMOC</CardTitle>
          <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Aguardando Confirmação">Aguardando Confirmação</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Buscar nº, equipamento, cliente, técnico..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Select value={cliente} onValueChange={(v) => { setCliente(v); setLocal("todos"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientesOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={local} onValueChange={setLocal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os locais</SelectItem>
                {locaisOptions.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Equipamento</TableHead>
                  <TableHead>Cliente</TableHead><TableHead>Local</TableHead><TableHead>Setor</TableHead>
                  <TableHead>Serviço</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Executor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Relatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma O.S. PMOC encontrada. Elas são geradas ao registrar uma manutenção em Gerenciar Operação.</TableCell></TableRow>
                )}
                {filtradas.map((o) => {
                  const eq = equipamentos.find((e) => e.id === o.equipamento_id);
                  const local = eq?.localDescricao || o.local_descricao || o.unidade || "";
                  const setor = eq?.setorDescricao || "";
                  return (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold">OS-PMOC-{String(o.numero).padStart(4, "0")}</TableCell>
                    <TableCell>{new Date(o.data_conclusao || o.data_abertura).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{o.equipamento_nome || "—"}</TableCell>
                    <TableCell>{o.unidade || "—"}</TableCell>
                    <TableCell>{local || "—"}</TableCell>
                    <TableCell>{setor || "—"}</TableCell>
                    <TableCell>{o.descricao}</TableCell>
                    <TableCell>{o.tipo}</TableCell>
                    <TableCell>{o.tecnico_responsavel || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={corStatus(o.status)}>{o.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => relatorio(o)}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
