import { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert, ArrowLeft, FileSignature } from "lucide-react";
import { gerarHashRdo } from "@/lib/assinaturaHash";
import { gerarHashOs } from "@/lib/assinaturaHashOs";
import { gerarHashPc } from "@/lib/assinaturaHashPc";
import { gerarHashLaudo } from "@/lib/assinaturaHashLaudo";
import { gerarHashBoletim } from "@/lib/assinaturaHashBoletim";

type Tipo = "rdo" | "os" | "pc" | "laudo" | "boletim";

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const labelPapel = (tipo: Tipo, p: string) => {
  if (tipo === "rdo") return p === "responsavel" ? "Responsável Técnico" : "Fiscalização";
  if (tipo === "pc") return "Aprovador";
  if (tipo === "laudo") return "Responsável Técnico";
  if (tipo === "boletim")
    return p === "responsavel" ? "Responsável Técnico" : p === "fiscalizacao" ? "Fiscalização" : "Gestor do Contrato";
  return p === "fiscal" ? "Fiscal do Contrato" : "Solicitante";
};

export default function VerificarAssinatura() {
  const { codigo: codigoParam } = useParams();
  const [codigo, setCodigo] = useState(codigoParam || "");
  const [busca, setBusca] = useState(!!codigoParam);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [assinatura, setAssinatura] = useState<any>(null);
  const [documento, setDocumento] = useState<any>(null);
  const [todasAssinaturas, setTodasAssinaturas] = useState<any[]>([]);
  const [hashAtual, setHashAtual] = useState<string>("");
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const buscar = async (cod: string) => {
    if (!cod) return;
    setLoading(true);
    setNaoEncontrado(false);
    setAssinatura(null);
    setDocumento(null);
    setTodasAssinaturas([]);
    setHashAtual("");
    setTipo(null);
    try {
      const codTrim = cod.trim();

      // 1. Tenta RDO
      const { data: assRdo } = await supabase
        .from("rdo_assinaturas")
        .select("*")
        .eq("codigo_verificador", codTrim)
        .maybeSingle();

      if (assRdo) {
        setTipo("rdo");
        setAssinatura(assRdo);
        const { data: r } = await supabase.from("rdos").select("*").eq("id", assRdo.rdo_id).maybeSingle();
        setDocumento(r);
        const { data: outras } = await supabase
          .from("rdo_assinaturas").select("*").eq("rdo_id", assRdo.rdo_id).order("signed_at");
        setTodasAssinaturas(outras || []);
        if (r) {
          try { setHashAtual(await gerarHashRdo(r as any)); } catch { /* ignore */ }
        }
        return;
      }

      // 2. Tenta OS
      const { data: assOs } = await supabase
        .from("os_assinaturas")
        .select("*")
        .eq("codigo_verificador", codTrim)
        .maybeSingle();

      if (assOs) {
        setTipo("os");
        setAssinatura(assOs);
        const { data: o } = await supabase.from("ordens_servico").select("*").eq("id", assOs.os_id).maybeSingle();
        setDocumento(o);
        const { data: outras } = await supabase
          .from("os_assinaturas").select("*").eq("os_id", assOs.os_id).order("signed_at");
        setTodasAssinaturas(outras || []);
        if (o) {
          try { setHashAtual(await gerarHashOs(o as any)); } catch { /* ignore */ }
        }
        return;
      }

      // 3. Tenta PC (Ordem de Compra)
      const { data: assPc } = await supabase
        .from("pc_assinaturas")
        .select("*")
        .eq("codigo_verificador", codTrim)
        .maybeSingle();

      if (assPc) {
        setTipo("pc");
        setAssinatura(assPc);
        const { data: p } = await supabase.from("pedidos_compra").select("*").eq("id", assPc.pedido_id).maybeSingle();
        setDocumento(p);
        const { data: outras } = await supabase
          .from("pc_assinaturas").select("*").eq("pedido_id", assPc.pedido_id).order("signed_at");
        setTodasAssinaturas(outras || []);
        if (p) {
          try {
            const pedidoMapped: any = {
              numero: p.numero, cotacaoId: p.cotacao_id, requisicaoId: p.requisicao_id,
              requisicaoNumero: p.requisicao_numero, dataCriacao: p.data_criacao,
              comprador: p.comprador, fornecedorId: p.fornecedor_id, fornecedorNome: p.fornecedor_nome,
              itens: p.itens, condicaoPagamento: p.condicao_pagamento, prazoEntrega: p.prazo_entrega,
              localEntrega: p.local_entrega, observacoes: p.observacoes, valorTotal: Number(p.valor_total) || 0,
            };
            setHashAtual(await gerarHashPc(pedidoMapped));
          } catch { /* ignore */ }
        }
        return;
      }

      // 4. Tenta Laudo de Condenação
      const { data: assLaudo } = await (supabase as any)
        .from("equipamentos_laudos_assinaturas")
        .select("*")
        .eq("codigo_verificador", codTrim)
        .maybeSingle();

      if (assLaudo) {
        setTipo("laudo");
        setAssinatura(assLaudo);
        const { data: l } = await (supabase as any)
          .from("equipamentos_laudos_condenacao")
          .select("*").eq("id", assLaudo.laudo_id).maybeSingle();
        setDocumento(l);
        const { data: outras } = await (supabase as any)
          .from("equipamentos_laudos_assinaturas")
          .select("*").eq("laudo_id", assLaudo.laudo_id).order("signed_at");
        setTodasAssinaturas(outras || []);
        if (l) {
          try {
            const laudoMapped: any = {
              numero: l.numero, equipamento_id: l.equipamento_id, equipamento_tag: l.equipamento_tag,
              equipamento_nome: l.equipamento_nome, tipo: l.tipo, marca: l.marca, modelo: l.modelo,
              serie: l.serie, patrimonio: l.patrimonio, ano_fabricacao: l.ano_fabricacao,
              data_aquisicao: l.data_aquisicao, localizacao: l.localizacao,
              estado_conservacao: l.estado_conservacao, data_emissao: l.data_emissao,
              data_inspecao: l.data_inspecao, local_inspecao: l.local_inspecao,
              responsavel_tecnico: l.responsavel_tecnico, registro_profissional: l.registro_profissional,
              historico: l.historico, insp_condicoes_fisicas: l.insp_condicoes_fisicas,
              insp_condicoes_eletricas: l.insp_condicoes_eletricas,
              insp_condicoes_mecanicas: l.insp_condicoes_mecanicas,
              insp_funcionalidade: l.insp_funcionalidade,
              motivos_condenacao: l.motivos_condenacao,
              custo_reparo: Number(l.custo_reparo) || 0,
              valor_residual: Number(l.valor_residual) || 0,
              valor_novo_equivalente: Number(l.valor_novo_equivalente) || 0,
              parecer: l.parecer, conclusao_condicoes: l.conclusao_condicoes,
            };
            setHashAtual(await gerarHashLaudo(laudoMapped));
          } catch { /* ignore */ }
        }
        return;
      }

      // 5. Tenta Boletim de Medição
      const { data: assBol } = await (supabase as any)
        .from("boletim_assinaturas")
        .select("*")
        .eq("codigo_verificador", codTrim)
        .maybeSingle();

      if (assBol) {
        setTipo("boletim");
        setAssinatura(assBol);
        const { data: b } = await (supabase as any)
          .from("boletins_medicao").select("*").eq("id", assBol.boletim_id).maybeSingle();
        setDocumento(b);
        const { data: outras } = await (supabase as any)
          .from("boletim_assinaturas").select("*").eq("boletim_id", assBol.boletim_id).order("signed_at");
        setTodasAssinaturas(outras || []);
        if (b) {
          try { setHashAtual(await gerarHashBoletim(b as any)); } catch { /* ignore */ }
        }
        return;
      }

      setNaoEncontrado(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codigoParam) buscar(codigoParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam]);

  const integro = assinatura && hashAtual && assinatura.hash_documento === hashAtual;
  const documentoCancelado =
    (tipo === "os" && documento?.situacao === "Cancelada") ||
    (tipo === "pc" && documento?.status === "Cancelado");
  const valida = integro && !documentoCancelado;

  const renderDocumento = () => {
    if (!documento) return null;
    if (tipo === "rdo") {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conteúdo do RDO</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="font-semibold">Cliente:</span> {documento.cliente_nome}</p>
            <p><span className="font-semibold">Obra:</span> {documento.obra}</p>
            <p><span className="font-semibold">Data:</span> {documento.data_rdo ? new Date(documento.data_rdo + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</p>
            <p><span className="font-semibold">Responsável:</span> {documento.responsavel}</p>
            <p><span className="font-semibold">Avanço Físico:</span> {(Number(documento.avanco_fisico_geral) || 0).toFixed(2)}%</p>
            <p><span className="font-semibold">Status:</span> {documento.status}</p>
          </CardContent>
        </Card>
      );
    }
    if (tipo === "pc") {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conteúdo da Ordem de Compra</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="font-semibold">Fornecedor:</span> {documento.fornecedor_nome || "-"}</p>
            <p><span className="font-semibold">Comprador:</span> {documento.comprador || "-"}</p>
            <p><span className="font-semibold">Data:</span> {documento.data_criacao ? new Date(documento.data_criacao).toLocaleString("pt-BR") : "-"}</p>
            <p><span className="font-semibold">Valor Total:</span> {Number(documento.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            <p><span className="font-semibold">Status:</span>{" "}
              <Badge variant="outline" className={documento.status === "Cancelado" ? "bg-red-100 text-red-800 border-red-300" : "bg-muted"}>
                {documento.status || "-"}
              </Badge>
            </p>
          </CardContent>
        </Card>
      );
    }
    if (tipo === "laudo") {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conteúdo do Laudo de Condenação</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="font-semibold">Equipamento:</span> {documento.equipamento_nome || "-"} {documento.equipamento_tag ? `(${documento.equipamento_tag})` : ""}</p>
            <p><span className="font-semibold">Marca/Modelo:</span> {documento.marca || "-"} / {documento.modelo || "-"}</p>
            <p><span className="font-semibold">Nº de série:</span> {documento.serie || "-"}</p>
            <p><span className="font-semibold">Localização:</span> {documento.localizacao || "-"}</p>
            <p><span className="font-semibold">Responsável Técnico:</span> {documento.responsavel_tecnico || "-"}{documento.registro_profissional ? ` — ${documento.registro_profissional}` : ""}</p>
            <p><span className="font-semibold">Data de emissão:</span> {documento.data_emissao ? new Date(documento.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</p>
            <p><span className="font-semibold">Parecer:</span>{" "}
              <Badge variant="outline" className={documento.parecer === "APROVADO PARA CONDENAÇÃO" ? "bg-red-100 text-red-800 border-red-300" : "bg-muted"}>
                {documento.parecer || "-"}
              </Badge>
            </p>
          </CardContent>
        </Card>
      );
    }
    if (tipo === "boletim") {
      const totalContrato = Number(documento.valor_total_contrato) || 0;
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conteúdo do Boletim de Medição</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="font-semibold">Boletim:</span> {String(documento.numero || "").padStart(2, "0")}/{documento.ano || "-"}</p>
            <p><span className="font-semibold">Cliente:</span> {documento.cliente_nome || "-"}</p>
            <p><span className="font-semibold">Obra:</span> {documento.obra || "-"}</p>
            <p><span className="font-semibold">Contrato:</span> {documento.contrato_numero || "-"} | <span className="font-semibold">Processo:</span> {documento.processo_numero || "-"}</p>
            <p><span className="font-semibold">Valor total do contrato:</span> {totalContrato.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            <p><span className="font-semibold">Responsável Técnico:</span> {documento.responsavel_tecnico || "-"}</p>
            <p><span className="font-semibold">Status:</span>{" "}
              <Badge variant="outline" className={documento.status === "Cancelado" ? "bg-red-100 text-red-800 border-red-300" : "bg-muted"}>
                {documento.status || "-"}
              </Badge>
            </p>
          </CardContent>
        </Card>
      );
    }
    // OS
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Conteúdo da Ordem de Serviço</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="font-semibold">Cliente:</span> {documento.cliente_nome || documento.clienteNome || "-"}</p>
          <p><span className="font-semibold">Solicitante:</span> {documento.solicitante || "-"}</p>
          <p><span className="font-semibold">Descrição:</span> {documento.descricao_servicos || documento.descricaoServicos || "-"}</p>
          <p><span className="font-semibold">Data Início:</span> {documento.data_inicio || documento.dataInicio || "-"}</p>
          <p><span className="font-semibold">Prioridade:</span> {documento.prioridade || "-"}</p>
          <p><span className="font-semibold">Situação:</span>{" "}
            <Badge variant="outline" className={
              documento.situacao === "Validada" ? "bg-green-100 text-green-800 border-green-300" :
              documento.situacao === "Cancelada" ? "bg-red-100 text-red-800 border-red-300" :
              "bg-muted"
            }>
              {documento.situacao || "-"}
            </Badge>
          </p>
        </CardContent>
      </Card>
    );
  };

  const tituloDocumento = tipo === "rdo"
    ? `RDO Nº ${assinatura?.rdo_numero ?? ""}`
    : tipo === "pc"
    ? `Ordem de Compra OC-${String(assinatura?.pedido_numero ?? "").padStart(4, "0")}`
    : tipo === "laudo"
    ? `Laudo de Condenação Nº ${assinatura?.laudo_numero ?? ""}`
    : `OS Nº ${assinatura?.os_numero ?? ""}`;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            Verificação de Assinatura Eletrônica
          </h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Buscar por código verificador</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Digite o código verificador"
              onKeyDown={e => e.key === "Enter" && (setBusca(true), buscar(codigo))}
            />
            <Button onClick={() => { setBusca(true); buscar(codigo); }} disabled={loading || !codigo}>
              {loading ? "Verificando..." : "Verificar"}
            </Button>
          </CardContent>
        </Card>

        {busca && naoEncontrado && (
          <Card className="border-destructive">
            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-6 w-6" />
              <div>
                <p className="font-semibold">Assinatura não encontrada</p>
                <p className="text-sm text-muted-foreground">
                  O código informado não corresponde a nenhuma assinatura registrada no sistema (RDO ou Ordem de Serviço).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {assinatura && tipo && (
          <>
            <Card className={
              valida ? "border-2 border-green-500" :
              documentoCancelado ? "border-2 border-red-500" :
              "border-2 border-amber-500"
            }>
              <CardHeader className="pb-2 flex-row items-center gap-2">
                {valida
                  ? <ShieldCheck className="h-6 w-6 text-green-600" />
                  : <ShieldAlert className={`h-6 w-6 ${documentoCancelado ? "text-red-600" : "text-amber-600"}`} />}
                <CardTitle className="text-base">
                  {valida && "Assinatura Válida e Documento Íntegro"}
                  {!valida && documentoCancelado && "Documento Cancelado — Assinatura Expirada"}
                  {!valida && !documentoCancelado && "Assinatura registrada — verifique a integridade"}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    valida ? "ml-auto bg-green-100 text-green-800 border-green-300" :
                    documentoCancelado ? "ml-auto bg-red-100 text-red-800 border-red-300" :
                    "ml-auto bg-amber-100 text-amber-800 border-amber-300"
                  }
                >
                  {valida ? "Válida" : documentoCancelado ? "Expirada" : "Atenção"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {documentoCancelado && (
                  <p className="text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-2">
                    Este documento foi <strong>cancelado</strong> após a assinatura. A assinatura é considerada <strong>expirada</strong> e não tem mais validade jurídica.
                  </p>
                )}
                {!integro && hashAtual && !documentoCancelado && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                    O conteúdo do documento foi modificado após a assinatura. O hash atual não confere com o hash assinado.
                  </p>
                )}
                <p><span className="font-semibold">Documento:</span> {tituloDocumento}</p>
                <p><span className="font-semibold">Papel:</span> {labelPapel(tipo, assinatura.papel)}</p>
                <p><span className="font-semibold">Signatário:</span> {assinatura.signatario_nome}</p>
                {assinatura.signatario_email && <p><span className="font-semibold">E-mail:</span> {assinatura.signatario_email}</p>}
                {assinatura.signatario_cargo && <p><span className="font-semibold">Cargo:</span> {assinatura.signatario_cargo}</p>}
                {assinatura.signatario_matricula && <p><span className="font-semibold">Matrícula:</span> {assinatura.signatario_matricula}</p>}
                <p><span className="font-semibold">Data/Hora da assinatura:</span> {fmtDateTime(assinatura.signed_at)}</p>
                {assinatura.ip_origem && <p><span className="font-semibold">IP de origem:</span> {assinatura.ip_origem}</p>}
                <p className="italic text-muted-foreground mt-2 text-xs">{assinatura.base_legal}</p>
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p className="text-xs"><span className="font-semibold">Código verificador:</span>{" "}
                    <code className="bg-muted px-1 rounded">{assinatura.codigo_verificador}</code>
                  </p>
                  <p className="text-xs break-all"><span className="font-semibold">Hash assinado:</span>{" "}
                    <code className="bg-muted px-1 rounded">{assinatura.hash_documento}</code>
                  </p>
                  {hashAtual && (
                    <p className="text-xs break-all"><span className="font-semibold">Hash atual:</span>{" "}
                      <code className="bg-muted px-1 rounded">{hashAtual}</code>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {renderDocumento()}

            {todasAssinaturas.length > 1 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Outras assinaturas neste documento</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {todasAssinaturas.filter(a => a.id !== assinatura.id).map(a => (
                    <div key={a.id} className="border rounded p-2">
                      <p><strong>{labelPapel(tipo, a.papel)}:</strong> {a.signatario_nome} — {fmtDateTime(a.signed_at)}</p>
                      <p className="text-xs text-muted-foreground">Código: {a.codigo_verificador}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
