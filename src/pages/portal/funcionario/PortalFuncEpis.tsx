import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { portalCall } from "@/lib/portalClient";
import { HardHat, CheckCircle2, Clock } from "lucide-react";

interface EpiItem {
  id: string;
  descricao: string;
  ca?: string;
  quantidade: number;
  dataEntrega?: string;
  dataVencimento?: string;
  pedido?: string;
  motivo?: string;
}

const MOTIVOS: Record<string, string> = {
  "1": "1 - Substituição por dano",
  "2": "2 - Extravio",
  "3": "3 - Vencimento do CA",
  "4": "4 - Novo colaborador",
  "5": "5 - Mudança de função",
  "6": "6 - Outros",
};
const motivoLabel = (m?: string) => (m && MOTIVOS[m] ? MOTIVOS[m] : m || "—");
interface Recebimento {
  id: string;
  status: string;
  confirmado_em: string | null;
  epis_ids: string[];
  epis_snapshot: any[] | null;
  created_at: string;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const s = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
};
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function PortalFuncEpis() {
  const [loading, setLoading] = useState(true);
  const [epis, setEpis] = useState<EpiItem[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await portalCall<{ epis: EpiItem[]; recebimentos: Recebimento[] }>("func-epis");
        setEpis(res.epis || []);
        setRecebimentos(res.recebimentos || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recebidos = epis.filter((e) => !!e.dataEntrega);
  const pendentes = epis.filter((e) => !e.dataEntrega);

  return (
    <PortalLayout requireTipo="funcionario">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary/10 p-2.5 rounded-xl">
          <HardHat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Meus EPIs</h1>
          <p className="text-sm text-muted-foreground">Equipamentos de Proteção Individual recebidos e pendentes</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Recebidos
                <Badge variant="secondary">{recebidos.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recebidos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum EPI recebido ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-16">Quant.</TableHead>
                      <TableHead>E.P.I</TableHead>
                      <TableHead className="text-center w-24">CA</TableHead>
                      <TableHead className="text-center w-28">Data Entrega</TableHead>
                      <TableHead className="text-center w-28">Vencimento</TableHead>
                      <TableHead className="text-center w-28">Nº do Pedido</TableHead>
                      <TableHead className="w-40">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recebidos.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-center">{String(e.quantidade).padStart(2, "0")}</TableCell>
                        <TableCell className="font-medium">{e.descricao}</TableCell>
                        <TableCell className="text-center">{e.ca || "—"}</TableCell>
                        <TableCell className="text-center">{fmtDate(e.dataEntrega)}</TableCell>
                        <TableCell className="text-center">{fmtDate(e.dataVencimento)}</TableCell>
                        <TableCell className="text-center">{e.pedido || "—"}</TableCell>
                        <TableCell>{motivoLabel(e.motivo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {recebidos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Motivos: 1 - Substituição por dano | 2 - Extravio | 3 - Vencimento do CA | 4 - Novo colaborador | 5 - Mudança de função | 6 - Outros
                </p>
              )}
            </CardContent>
          </Card>

          {pendentes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" /> Pendentes de recebimento
                  <Badge variant="secondary">{pendentes.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-16">Quant.</TableHead>
                      <TableHead>E.P.I</TableHead>
                      <TableHead className="text-center w-24">CA</TableHead>
                      <TableHead className="text-center w-28">Nº do Pedido</TableHead>
                      <TableHead className="w-40">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-center">{String(e.quantidade).padStart(2, "0")}</TableCell>
                        <TableCell className="font-medium">{e.descricao}</TableCell>
                        <TableCell className="text-center">{e.ca || "—"}</TableCell>
                        <TableCell className="text-center">{e.pedido || "—"}</TableCell>
                        <TableCell>{motivoLabel(e.motivo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  A confirmação de recebimento é feita por um link exclusivo enviado por WhatsApp pelo RH.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico de confirmações</CardTitle>
            </CardHeader>
            <CardContent>
              {recebimentos.filter((r) => r.status === "confirmado").length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma confirmação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Confirmado em</TableHead>
                      <TableHead>EPIs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recebimentos.filter((r) => r.status === "confirmado").map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{fmtDateTime(r.confirmado_em)}</TableCell>
                        <TableCell>
                          {(r.epis_snapshot || []).map((e: any) => `${e.descricao}${e.ca ? ` (CA ${e.ca})` : ""}`).join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
