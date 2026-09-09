import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { getCotacaoTokenClient } from "@/lib/supabaseScoped";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertCircle, Clock, FileText, ArrowLeft } from "lucide-react";

interface ConviteItem {
  itemId: string;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
}

interface Convite {
  id: string;
  token: string;
  cotacao_numero: number;
  fornecedor_nome: string;
  comprador: string;
  itens: ConviteItem[];
  status: string;
  expires_at: string;
}

interface ItemProposta extends ConviteItem {
  precoUnitario: number;
  naoTem?: boolean;
}

export default function PropostaFornecedorPage() {
  const { token } = useParams<{ token: string }>();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redirectSecs, setRedirectSecs] = useState(3);
  const navigate = useNavigate();

  // Form state
  const [itens, setItens] = useState<ItemProposta[]>([]);
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [validadeProposta, setValidadeProposta] = useState("");
  const [observacao, setObservacao] = useState("");
  const [valorFrete, setValorFrete] = useState<number | "">("");
  const [valorOperacao, setValorOperacao] = useState<number | "">("");
  const [valorSeguro, setValorSeguro] = useState<number | "">("");

  useEffect(() => {
    if (!token) return;
    loadConvite();
  }, [token]);

  const loadConvite = async () => {
    setLoading(true);
    const db = getCotacaoTokenClient(token!);
    const { data, error: err } = await db
      .from("cotacao_convites")
      .select("*")
      .eq("token", token)
      .maybeSingle();


    if (err || !data) {
      setError("Convite não encontrado ou inválido.");
      setLoading(false);
      return;
    }

    if (data.status === "respondido") {
      setSubmitted(true);
      setConvite(data as unknown as Convite);
      setLoading(false);
      return;
    }

    if (data.status === "recusado") {
      setError("Esta cotação foi recusada e não pode mais receber proposta.");
      setLoading(false);
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setError("Este convite expirou.");
      setLoading(false);
      return;
    }

    const conviteData = data as unknown as Convite;
    setConvite(conviteData);
    const parsedItens = (Array.isArray(conviteData.itens) ? conviteData.itens : JSON.parse(conviteData.itens as unknown as string)) as ConviteItem[];
    setItens(parsedItens.map(i => ({ ...i, precoUnitario: 0, naoTem: false })));
    setLoading(false);
  };

  const subtotalItens = useMemo(() => itens.reduce((s, i) => s + (i.naoTem ? 0 : i.precoUnitario * i.quantidade), 0), [itens]);
  const valorTotal = useMemo(
    () => subtotalItens + (Number(valorFrete) || 0) + (Number(valorOperacao) || 0) + (Number(valorSeguro) || 0),
    [subtotalItens, valorFrete, valorOperacao, valorSeguro]
  );

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSubmit = async () => {
    if (itens.every(i => i.naoTem)) {
      setError("Marque ao menos um item com preço.");
      return;
    }
    if (itens.some(i => !i.naoTem && i.precoUnitario <= 0)) {
      setError("Preencha o preço dos itens disponíveis ou marque-os como indisponíveis.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // Insert proposal
      const db = getCotacaoTokenClient(token!);
      const { error: insertErr } = await db.from("cotacao_propostas_externas").insert({
        convite_id: convite!.id,
        condicao_pagamento: condicaoPagamento,
        prazo_entrega: prazoEntrega,
        validade_proposta: validadeProposta,
        observacao,
        valor_frete: Number(valorFrete) || 0,
        valor_operacao: Number(valorOperacao) || 0,
        valor_seguro: Number(valorSeguro) || 0,
        itens: itens.map(i => ({
          itemId: i.itemId,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeMedida: i.unidadeMedida,
          precoUnitario: i.naoTem ? 0 : i.precoUnitario,
          naoTem: !!i.naoTem,
        })),
        valor_total: valorTotal,
      });

      if (insertErr) throw insertErr;

      // Update convite status
      await db.from("cotacao_convites").update({ status: "respondido" }).eq("id", convite!.id);


      setSubmitted(true);
    } catch (e: any) {
      setError("Erro ao enviar proposta. Tente novamente.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (error && !convite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <SubmittedScreen
        numero={convite?.cotacao_numero}
        subtotal={subtotalItens}
        frete={Number(valorFrete) || 0}
        operacao={Number(valorOperacao) || 0}
        seguro={Number(valorSeguro) || 0}
        total={valorTotal}
        onDone={() => navigate("/portal-fornecedor")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portal-fornecedor">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Portal do Fornecedor
            </Link>
          </Button>
        </div>
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-xl">
                  Cotação COT-{String(convite?.cotacao_numero).padStart(4, "0")}
                </CardTitle>
                <CardDescription>
                  Prezado(a) <strong>{convite?.fornecedor_nome}</strong>, preencha seus preços para esta cotação.
                  <br />
                  <span className="text-xs">Comprador: {convite?.comprador}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Itens e Preços */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens e Preços Unitários</CardTitle>
            <CardDescription>Informe o preço unitário para cada item solicitado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Não tem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20 text-center">Qtd</TableHead>
                    <TableHead className="w-16 text-center">Un</TableHead>
                    <TableHead className="w-40">Preço Unitário *</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, idx) => (
                    <TableRow key={item.itemId} className={item.naoTem ? "opacity-60" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!item.naoTem}
                          onCheckedChange={(c) => {
                            const checked = c === true;
                            setItens(prev => prev.map((it, i) => i === idx ? { ...it, naoTem: checked, precoUnitario: checked ? 0 : it.precoUnitario } : it));
                          }}
                          aria-label="Marcar como não disponível"
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                      <TableCell className="text-center">{item.quantidade}</TableCell>
                      <TableCell className="text-center">{item.unidadeMedida}</TableCell>
                      <TableCell>
                        {item.naoTem ? (
                          <span className="text-xs italic text-muted-foreground">Não disponível</span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            value={item.precoUnitario || ""}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setItens(prev => prev.map((it, i) => i === idx ? { ...it, precoUnitario: val } : it));
                            }}
                            className="h-9"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.naoTem ? "—" : formatCurrency(item.precoUnitario * item.quantidade)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-right mt-3 space-y-1">
              <div className="text-sm text-muted-foreground">
                Subtotal itens: {formatCurrency(subtotalItens)} • Frete: {formatCurrency(Number(valorFrete) || 0)} • Operação: {formatCurrency(Number(valorOperacao) || 0)} • Seguro: {formatCurrency(Number(valorSeguro) || 0)}
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                Total: {formatCurrency(valorTotal)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Dados Complementares */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Complementares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Condição de Pagamento</Label>
                <Input
                  value={condicaoPagamento}
                  onChange={e => setCondicaoPagamento(e.target.value)}
                  placeholder="Ex: 30/60/90 dias"
                />
              </div>
              <div>
                <Label>Prazo de Entrega</Label>
                <Input
                  value={prazoEntrega}
                  onChange={e => setPrazoEntrega(e.target.value)}
                  placeholder="Ex: 15 dias úteis"
                />
              </div>
              <div>
                <Label>Validade da Proposta</Label>
                <Input
                  type="date"
                  value={validadeProposta}
                  onChange={e => setValidadeProposta(e.target.value)}
                />
              </div>
              <div>
                <Label>Custos de Frete (R$)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={valorFrete}
                  onChange={e => setValorFrete(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Custos de Operação (R$)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={valorOperacao}
                  onChange={e => setValorOperacao(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Custo de Seguro (R$)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={valorSeguro}
                  onChange={e => setValorSeguro(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Informações adicionais sobre sua proposta..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar Proposta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubmittedScreen({
  numero,
  subtotal,
  frete,
  operacao,
  seguro,
  total,
  onDone,
}: {
  numero?: number;
  subtotal?: number;
  frete?: number;
  operacao?: number;
  seguro?: number;
  total?: number;
  onDone: () => void;
}) {
  const [secs, setSecs] = useState(3);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  useEffect(() => {
    if (secs <= 0) { onDone(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onDone]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Proposta Enviada!</h2>
          <p className="text-muted-foreground">
            Sua proposta para a cotação COT-{String(numero).padStart(4, "0")} foi recebida com sucesso.
            O comprador será notificado automaticamente.
          </p>
          {(total !== undefined) && (
            <div className="rounded-lg border bg-muted/40 p-3 text-left space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal itens</span><span>{fmt(subtotal || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{fmt(frete || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Operação</span><span>{fmt(operacao || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Seguro</span><span>{fmt(seguro || 0)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{fmt(total)}</span></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Retornando ao Portal do Fornecedor em {secs}s...</p>
          <Button size="sm" onClick={onDone}>Voltar agora</Button>
        </CardContent>
      </Card>
    </div>
  );
}

