import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trophy, Download, Gavel } from "lucide-react";
import { usePregao } from "@/contexts/PregaoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatNumeroAno } from "@/lib/formatNumero";
import { downloadAtaPregao } from "@/lib/gerarPdfAtaPregao";
import { toast } from "sonner";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PregaoResultado() {
  const { id } = useParams();
  const nav = useNavigate();
  const { pregoes, itens, participantes, lances, loadDisputa } = usePregao();
  const { empresa } = useEmpresa();

  const pregao = pregoes.find(p => p.id === id);
  const itensPregao = useMemo(() => itens.filter(i => i.pregaoId === id).sort((a, b) => a.ordem - b.ordem), [itens, id]);
  const partsPregao = useMemo(() => participantes.filter(p => p.pregaoId === id), [participantes, id]);

  useEffect(() => { if (id) loadDisputa(id); }, [id, loadDisputa]);

  if (!pregao) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => nav("/compras/pregao")}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        <p className="text-muted-foreground mt-4">Pregão não encontrado.</p>
      </div>
    );
  }

  const publico = pregao.resultadoPublico || pregao.status === "Homologado";

  async function handleBaixarAta() {
    if (!pregao) return;
    try {
      await downloadAtaPregao({ pregao, itens: itensPregao, participantes: partsPregao, lances, empresa });
    } catch { toast.error("Falha ao gerar ata."); }
  }

  const valorTotal = itensPregao.reduce((s, it) => s + (it.vencedorValor || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => nav("/compras/pregao")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="p-2 rounded-xl bg-primary/10 text-primary"><Trophy className="h-6 w-6" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-semibold truncate">
            Resultado — Pregão {formatNumeroAno(pregao.numero, pregao.createdAt)}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{pregao.status}</Badge>
            {!publico && <Badge variant="outline" className="bg-amber-100 text-amber-900">Resultado ainda não publicado</Badge>}
            <span className="text-xs text-muted-foreground truncate">{pregao.objeto}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleBaixarAta}><Download className="h-4 w-4 mr-1" /> Ata em PDF</Button>
      </div>

      {!publico ? (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Gavel className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>O pregoeiro ainda não publicou o resultado. Os nomes dos licitantes permanecem em sigilo.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-xl">
            <CardHeader className="pb-2"><CardTitle className="text-base">Licitantes Participantes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apelido</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partsPregao.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.apelido}</TableCell>
                      <TableCell>{p.fornecedorNome}</TableCell>
                      <TableCell className="text-xs">{p.fornecedorCnpj}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Vencedores por Item</CardTitle>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Total: {moeda(valorTotal)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Item</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Vencedor</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensPregao.map(it => {
                    const venc = partsPregao.find(p => p.id === it.vencedorParticipanteId);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono">{String(it.ordem).padStart(3, "0")}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{it.descricao}</TableCell>
                        <TableCell className="text-center">{it.quantidade} {it.unidade}</TableCell>
                        <TableCell>{venc ? venc.fornecedorNome : <span className="text-rose-700">{it.status === "Deserto" ? "Deserto" : "—"}</span>}</TableCell>
                        <TableCell className="text-right font-mono">{it.vencedorValorUnitario ? moeda(it.vencedorValorUnitario) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{it.vencedorValor ? moeda(it.vencedorValor) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
