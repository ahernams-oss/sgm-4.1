import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import { portalCall } from "@/lib/portalClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Eye, Download, FileText, RefreshCw, ShieldCheck, FileCheck, Archive, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { Candidato } from "@/contexts/ProcessoSeletivoContext";

interface DocRow {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  storage_path: string;
  status: "pendente" | "aprovado" | "reprovado";
  observacao: string | null;
  enviado_em: string;
  revisado_em: string | null;
  tamanho_bytes: number | null;
}
interface FichaRow {
  id: string;
  status: "rascunho" | "enviada" | "em_analise" | "aprovada" | "reprovada";
  dados_pessoais: any;
  endereco: any;
  bancarios: any;
  dependentes: any[];
  contatos_emergencia: any[];
  observacoes_rh: string | null;
  enviado_em: string | null;
  revisado_em: string | null;
}
interface TermoRow {
  id: string;
  tipo_termo: string;
  versao_termo: string;
  hash_sha256: string;
  assinado_em: string;
}

interface Props {
  candidato: Candidato;
  onExameChange: (patch: Partial<Candidato["exameAdmissional"]>) => void;
  onDadosBancariosPrefill: (b: Partial<Candidato["dadosBancarios"]>) => void;
  onValidacaoChange?: (data: { ficha: FichaRow | null; docs: DocRow[] }) => void;
}


const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string; icon: any }> = {
    pendente: { cls: "bg-amber-100 text-amber-800 border-amber-300", label: "Pendente", icon: Clock },
    aprovado: { cls: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Aprovado", icon: CheckCircle2 },
    reprovado: { cls: "bg-red-100 text-red-800 border-red-300", label: "Reprovado", icon: XCircle },
    enviada: { cls: "bg-blue-100 text-blue-800 border-blue-300", label: "Enviada", icon: FileCheck },
    em_analise: { cls: "bg-amber-100 text-amber-800 border-amber-300", label: "Em análise", icon: Clock },
    aprovada: { cls: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Aprovada", icon: CheckCircle2 },
    reprovada: { cls: "bg-red-100 text-red-800 border-red-300", label: "Reprovada", icon: XCircle },
    rascunho: { cls: "bg-slate-100 text-slate-700 border-slate-300", label: "Rascunho", icon: Clock },
  };
  const m = map[s] || map.pendente;
  const Icon = m.icon;
  return <Badge variant="outline" className={`${m.cls} gap-1`}><Icon className="h-3 w-3" />{m.label}</Badge>;
};

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR") : "—";

const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm">{value || <span className="text-muted-foreground">—</span>}</span>
  </div>
);

export default function ValidacaoAdmissao({ candidato, onExameChange, onDadosBancariosPrefill, onValidacaoChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [ficha, setFicha] = useState<FichaRow | null>(null);
  const [termos, setTermos] = useState<TermoRow[]>([]);
  const [obsRh, setObsRh] = useState("");
  const [docObs, setDocObs] = useState<Record<string, string>>({});
  const cpf = (candidato.cpf || "").replace(/\D/g, "");

  const cacheKey = cpf ? `validacao_admissao_cache_${cpf}` : "";

  const aplicarDados = useCallback((res: { ficha: FichaRow | null; documentos: DocRow[]; termos: TermoRow[] }) => {
    setDocs(res.documentos || []);
    setFicha(res.ficha);
    setTermos(res.termos || []);
    setObsRh(res.ficha?.observacoes_rh || "");
    const b = res.ficha?.bancarios || {};
    const docsDp = (res.ficha?.dados_pessoais as any)?.documentos || {};
    if ((b && Object.keys(b).length) || Object.keys(docsDp).length) {
      if (!candidato.dadosBancarios?.banco) {
        onDadosBancariosPrefill({
          banco: b.banco || "", agencia: b.agencia || "", conta: b.conta || "",
          tipoConta: b.tipoConta || "",
          pisPasep: b.pisPasep || docsDp.pisPasep || "",
          pix: b.pix || b.chavePix || "",
        });
      }
    }
  }, [candidato.dadosBancarios?.banco, onDadosBancariosPrefill]);

  const carregar = useCallback(async (force = false) => {
    if (!cpf || cpf.length !== 11) return;
    if (!force && cacheKey) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) { aplicarDados(JSON.parse(raw)); return; }
      } catch { /* ignora */ }
    }
    setLoading(true);
    try {
      const res = await portalCall<{ ficha: FichaRow | null; documentos: DocRow[]; termos: TermoRow[] }>(
        "admin-cand-validacao", { cpf },
      );
      aplicarDados(res);
      if (cacheKey) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify(res)); } catch { /* ignora */ }
      }
    } catch (e: any) {
      toast.error("Erro ao carregar dados do portal: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [cpf, cacheKey, aplicarDados]);

  useEffect(() => { carregar(false); }, [carregar]);
  useEffect(() => { onValidacaoChange?.({ ficha, docs }); }, [ficha, docs, onValidacaoChange]);



  const criarUrlLocalDocumento = async (id: string) => {
    const { url, nome } = await portalCall<{ url: string; nome?: string }>("admin-cand-doc-url", { id });
    if (!url) throw new Error("URL do documento não foi gerada.");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Não foi possível carregar o documento.");
    const blob = await res.blob();
    return { objectUrl: URL.createObjectURL(blob), nome };
  };

  const abrirDoc = async (id: string) => {
    const preview = window.open("about:blank", "_blank");
    if (preview) {
      preview.opener = null;
      preview.document.title = "Carregando documento";
      preview.document.body.innerHTML = "<p style='font-family: sans-serif; padding: 24px;'>Carregando documento...</p>";
    }
    try {
      const { objectUrl } = await criarUrlLocalDocumento(id);
      if (preview) {
        preview.location.href = objectUrl;
      } else {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e: any) {
      preview?.close();
      toast.error(e.message);
    }
  };
  const baixarDoc = async (id: string, nome: string) => {
    try {
      const { objectUrl, nome: nomeServidor } = await criarUrlLocalDocumento(id);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = nomeServidor || nome; a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) { toast.error(e.message); }
  };

  const [zipando, setZipando] = useState(false);
  const baixarTodosZip = async () => {
    if (!docs.length) { toast.info("Nenhum documento para baixar."); return; }
    setZipando(true);
    const tid = toast.loading(`Preparando ZIP (0/${docs.length})...`);
    try {
      const zip = new JSZip();
      const usados = new Set<string>();
      let ok = 0;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        try {
          const { url, nome } = await portalCall<{ url: string; nome?: string }>("admin-cand-doc-url", { id: d.id });
          const res = await fetch(url);
          if (!res.ok) throw new Error("fetch falhou");
          const blob = await res.blob();
          const base = (nome || d.nome_arquivo || `doc-${i + 1}`).replace(/[\\/:*?"<>|]/g, "_");
          const tipo = (d.tipo_documento || "Outros").replace(/[\\/:*?"<>|]/g, "_");
          let nomeFinal = `${tipo}/${base}`;
          let n = 1;
          while (usados.has(nomeFinal)) {
            const dot = base.lastIndexOf(".");
            nomeFinal = dot > 0
              ? `${tipo}/${base.slice(0, dot)}_${++n}${base.slice(dot)}`
              : `${tipo}/${base}_${++n}`;
          }
          usados.add(nomeFinal);
          zip.file(nomeFinal, blob);
          ok++;
        } catch { /* pula documento com erro */ }
        toast.loading(`Preparando ZIP (${i + 1}/${docs.length})...`, { id: tid });
      }
      if (!ok) throw new Error("Nenhum documento pôde ser baixado.");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const nomeCand = (candidato.nome || "candidato").replace(/[\\/:*?"<>|]/g, "_");
      const a = document.createElement("a");
      a.href = url; a.download = `documentos_${nomeCand}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP gerado com ${ok} documento(s).`, { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar ZIP.", { id: tid });
    } finally {
      setZipando(false);
    }
  };
  const atualizarCache = (patch: { docs?: DocRow[]; ficha?: FichaRow | null }) => {
    if (!cacheKey) return;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      const cur = raw ? JSON.parse(raw) : { ficha, documentos: docs, termos };
      const next = {
        ficha: patch.ficha !== undefined ? patch.ficha : cur.ficha,
        documentos: patch.docs || cur.documentos,
        termos: cur.termos || termos,
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(next));
    } catch { /* ignora */ }
  };
  const setDocStatus = async (id: string, status: "aprovado" | "reprovado" | "pendente") => {
    const doc = docs.find((d) => d.id === id);
    const motivo = (docObs[id] ?? doc?.observacao ?? "").trim();
    if (status === "reprovado" && !motivo) {
      toast.error("Informe o motivo da reprovação na observação antes de reprovar.");
      return;
    }
    try {
      await portalCall("admin-cand-doc-status", { id, status, observacao: motivo || null });
      const novos = docs.map((d) => d.id === id ? { ...d, status, observacao: motivo || null, revisado_em: new Date().toISOString() } : d);
      setDocs(novos);
      atualizarCache({ docs: novos });
      toast.success("Status atualizado.");

      if (status === "reprovado" && doc) {
        const telefone = (candidato.telefone || "").replace(/\D/g, "");
        if (telefone.length >= 10) {
          const nome = (candidato.nome || "").split(" ")[0] || "";
          const mensagem =
            `Olá${nome ? ", " + nome : ""}! Identificamos uma pendência em sua documentação de admissão:\n\n` +
            `📄 Documento: *${doc.tipo_documento}*\n` +
            `❌ Status: Reprovado\n` +
            `📝 Motivo: ${motivo}\n\n` +
            `Por favor, acesse o Portal do Colaborador e reenvie o documento corrigido. Qualquer dúvida, entre em contato com o RH.`;
          try {
            const { enviarWhatsApp } = await import("@/lib/whatsapp");
            const r = await enviarWhatsApp(telefone, mensagem);
            if (r.success) toast.success("Candidato notificado via WhatsApp.");
            else toast.warning(`Documento reprovado, mas falhou notificar WhatsApp: ${r.error || ""}`);
          } catch (err: any) {
            toast.warning(`Documento reprovado, mas falhou notificar WhatsApp: ${err?.message || ""}`);
          }
        } else {
          toast.warning("Documento reprovado. Candidato sem telefone válido — não foi possível notificar via WhatsApp.");
        }
      }
    } catch (e: any) { toast.error(e.message); }
  };
  const setFichaStatus = async (status: "em_analise" | "aprovada" | "reprovada") => {
    if (!cpf) return;
    try {
      await portalCall("admin-cand-ficha-status", { cpf, status, observacoes_rh: obsRh || null });
      const nova = ficha ? { ...ficha, status, observacoes_rh: obsRh, revisado_em: new Date().toISOString() } : ficha;
      setFicha(nova);
      atualizarCache({ ficha: nova });
      toast.success("Ficha atualizada.");
    } catch (e: any) { toast.error(e.message); }
  };

  const dp = ficha?.dados_pessoais || {};
  const dpDocs = (dp as any)?.documentos || {};
  const uni = (dp as any)?.uniforme || {};
  const pensao = (dp as any)?.pensao_alimenticia || null;
  const en = ficha?.endereco || {};
  const ba = ficha?.bancarios || {};

  const totalDocs = docs.length;
  const aprovDocs = docs.filter((d) => d.status === "aprovado").length;
  const reprDocs = docs.filter((d) => d.status === "reprovado").length;

  // Row is defined at module scope (below) to avoid re-creating the component
  // on every render and to prevent React "cannot give refs to function components" warnings.


  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Validação de admissão · CPF <span className="font-mono">{candidato.cpf || "—"}</span>
          {ficha && statusBadge(ficha.status)}
        </div>
        <Button variant="outline" size="sm" onClick={() => carregar(true)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Termos */}
      <section>
        <h3 className="text-sm font-semibold mb-2">📜 Termos assinados</h3>
        {termos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum termo assinado pelo candidato.</p>
        ) : (
          <div className="space-y-1">
            {termos.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
                <div>
                  <span className="font-medium">{t.tipo_termo}</span>
                  <span className="text-muted-foreground"> · v{t.versao_termo} · {fmtDate(t.assinado_em)}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[220px]" title={t.hash_sha256}>{t.hash_sha256.slice(0, 24)}…</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ficha */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">🧾 Ficha cadastral do portal</h3>
          {ficha && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setFichaStatus("em_analise")}>Em análise</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setFichaStatus("aprovada")}>Aprovar</Button>
              <Button size="sm" variant="destructive" onClick={() => setFichaStatus("reprovada")}>Reprovar</Button>
            </div>
          )}
        </div>
        {!ficha ? (
          <p className="text-xs text-muted-foreground">Candidato ainda não preencheu a ficha no portal.</p>
        ) : (
          <div className="space-y-4 rounded-md border p-3">
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Dados Pessoais</div>
              <div className="flex gap-4">
                <div className="shrink-0">
                  <div className="w-28 h-36 rounded-md border bg-muted overflow-hidden flex items-center justify-center">
                    {dp.foto ? (
                      <img src={dp.foto} alt="Foto do candidato" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground text-center px-1">Sem foto</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                  <Row label="Nome" value={dp.nome} />
                  <Row label="CPF" value={dp.cpf || dpDocs.cpf} />
                  <Row label="Data Nasc." value={dp.dataNasc || dp.dataNascimento} />
                  <Row label="Sexo" value={dp.sexo} />
                  <Row label="Estado Civil" value={dp.estadoCivil} />
                  <Row label="Nacionalidade" value={dp.nacionalidade} />
                  <Row label="Naturalidade" value={dp.naturalidade} />
                  <Row label="Escolaridade" value={dp.escolaridade} />
                  <Row label="Curso/Formação" value={dp.cursoFormacao || dp.formacao} />
                  <Row label="Nome Mãe" value={dp.nomeMae} />
                  <Row label="Nome Pai" value={dp.nomePai} />
                  <Row label="E-mail" value={dp.email} />
                  <Row label="Telefone" value={dp.telefone} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Documentos informados</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Row label="RG" value={dpDocs.rgNumero} />
                <Row label="Órgão/UF" value={[dpDocs.rgOrgao, dpDocs.rgUf].filter(Boolean).join("/")} />
                <Row label="Emissão RG" value={dpDocs.rgEmissao} />
                <Row label="CTPS" value={dpDocs.ctpsNumero} />
                <Row label="Série/UF CTPS" value={[dpDocs.ctpsSerie, dpDocs.ctpsUf].filter(Boolean).join("/")} />
                <Row label="Emissão CTPS" value={dpDocs.ctpsEmissao} />
                <Row label="PIS/PASEP" value={dpDocs.pisPasep} />
                <Row label="Título de Eleitor" value={dpDocs.tituloEleitor} />
                <Row label="Zona/Seção" value={[dpDocs.tituloZona, dpDocs.tituloSecao].filter(Boolean).join("/")} />
                <Row label="CNH" value={dpDocs.cnhNumero} />
                <Row label="Categoria CNH" value={dpDocs.cnhCategoria} />
                <Row label="Validade CNH" value={dpDocs.cnhValidade} />
                <Row label="1ª Habilitação" value={dpDocs.cnhPrimeira} />
                <Row label="Reservista" value={dpDocs.reservistaNumero} />
                <Row label="Cat. Reservista" value={dpDocs.reservistaCategoria} />
                <Row label="Passaporte" value={dpDocs.passaporteNumero} />
                <Row label="Validade Passaporte" value={dpDocs.passaporteValidade} />
                <Row label="Certidão" value={dpDocs.certidaoNumero} />
                <Row label="Tipo Certidão" value={dpDocs.certidaoTipo} />
                <Row label="Emissão Certidão" value={dpDocs.certidaoEmissao} />
                <Row label="Conselho de Classe" value={dpDocs.conselhoClasse} />
                <Row label="Nº Registro Conselho" value={dpDocs.conselhoNumero} />
                <Row label="Expedição Conselho" value={dpDocs.conselhoDataExpedicao} />
                <Row label="UF Conselho" value={dpDocs.conselhoUf} />
              </div>
            </div>

            {uni && Object.values(uni).some(Boolean) && (
              <div>
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Uniforme / Medidas</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Row label="Camisa" value={uni.camisa} />
                  <Row label="Calça" value={uni.calca} />
                  <Row label="Calçado" value={uni.calcado} />
                  <Row label="Peso" value={uni.peso} />
                  <Row label="Altura" value={uni.altura} />
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Endereço</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Row label="CEP" value={en.cep} />
                <Row label="Logradouro" value={en.logradouro} />
                <Row label="Nº" value={en.numero} />
                <Row label="Compl." value={en.complemento} />
                <Row label="Bairro" value={en.bairro} />
                <Row label="Cidade" value={en.cidade} />
                <Row label="UF" value={en.uf} />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Dados Bancários</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Row label="Banco" value={ba.banco} />
                <Row label="Agência" value={ba.agencia} />
                <Row label="Conta" value={ba.conta} />
                <Row label="Tipo" value={ba.tipoConta} />
                <Row label="PIS/PASEP" value={ba.pisPasep || dpDocs.pisPasep} />
                <Row label="PIX" value={ba.pix || ba.chavePix} />
              </div>
            </div>
            {Array.isArray(ficha.dependentes) && ficha.dependentes.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Dependentes ({ficha.dependentes.length})</div>
                <div className="space-y-1">
                  {ficha.dependentes.map((d: any, i: number) => (
                    <div key={i} className="text-xs rounded border px-2 py-1 flex flex-wrap items-center gap-2">
                      <span>{d.nome} · {d.parentesco} · nasc. {d.nascimento || d.dataNascimento || "—"} · CPF {d.cpf || "—"}</span>
                      {d.salario_familia && <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Salário-família</Badge>}
                      {d.incapacidade_trabalho && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Incapacidade p/ trabalho</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Pensão Alimentícia</div>
              {!pensao?.possui ? (
                <p className="text-xs text-muted-foreground">Candidato informou que não há desconto de pensão alimentícia.</p>
              ) : (
                <div className="space-y-3 rounded border p-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Row label="Processo (geral)" value={pensao.processo} />
                    <Row label="Percentual/Valor (geral)" value={pensao.percentualOuValor} />
                    <Row label="Conta bancária" value={pensao.contaBancaria} />
                    <Row label="Início do desconto" value={pensao.dataInicio} />
                    <Row label="Término do desconto" value={pensao.dataTermino} />
                    <Row label="Empresa anterior descontava" value={pensao.empresaAnteriorDescontava} />
                    <Row label="Pode apresentar cópia" value={pensao.podeApresentarCopia} />
                  </div>
                  {(pensao.beneficiarios || []).length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Alimentandos ({pensao.beneficiarios.length})
                      </div>
                      <div className="space-y-1">
                        {pensao.beneficiarios.map((b: any, i: number) => (
                          <div key={i} className="rounded border px-2 py-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Row label="Alimentando" value={b.nome} />
                            <Row label="CPF" value={b.cpf} />
                            <Row label="Processo" value={b.processo || pensao.processo} />
                            <Row label="Representante legal" value={b.representanteNome} />
                            <Row label="CPF do representante" value={b.representanteCpf} />
                            <Row label="Percentual/Valor" value={b.percentualOuValor || pensao.percentualOuValor} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(pensao.anexos || []).length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Documentos anexados ({pensao.anexos.length})
                      </div>
                      <div className="space-y-1">
                        {pensao.anexos.map((a: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                            <span className="truncate">{a.nome || `anexo-${i + 1}`}</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => window.open(a.base64 || a.url, "_blank", "noopener")} title="Visualizar">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Baixar"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = a.base64 || a.url;
                                  link.download = a.nome || `pensao-${i + 1}`;
                                  link.click();
                                }}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pensao.observacoes && <Row label="Observações" value={pensao.observacoes} />}
                </div>
              )}
            </div>

            {Array.isArray(ficha.contatos_emergencia) && ficha.contatos_emergencia.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1 text-muted-foreground">Contatos de Emergência ({ficha.contatos_emergencia.length})</div>
                <div className="space-y-1">
                  {ficha.contatos_emergencia.map((c: any, i: number) => (
                    <div key={i} className="text-xs rounded border px-2 py-1">
                      {c.nome} · {c.parentesco} · {c.telefone}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações do RH</label>
              <Textarea rows={2} value={obsRh} onChange={(e) => setObsRh(e.target.value)} placeholder="Notas internas sobre a validação da ficha…" />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Enviada em {fmtDate(ficha.enviado_em)} · Última revisão {fmtDate(ficha.revisado_em)}
            </div>
          </div>
        )}
      </section>


      {/* Documentos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">📁 Documentos enviados pelo portal</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{aprovDocs} aprov. · {reprDocs} reprov. · {totalDocs} total</span>
            <Button variant="outline" size="sm" onClick={baixarTodosZip} disabled={zipando || docs.length === 0}>
              <Archive className={`h-3.5 w-3.5 mr-1 ${zipando ? "animate-pulse" : ""}`} />
              {zipando ? "Compactando..." : "Baixar todos (ZIP)"}
            </Button>
          </div>
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum documento enviado pelo candidato.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.tipo_documento}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {d.nome_arquivo} · {d.tamanho_bytes ? (d.tamanho_bytes / 1024).toFixed(0) + " KB · " : ""}
                      enviado {fmtDate(d.enviado_em)}
                    </div>
                  </div>
                  {statusBadge(d.status)}
                  <Button variant="ghost" size="sm" onClick={() => abrirDoc(d.id)} title="Visualizar">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => baixarDoc(d.id, d.nome_arquivo)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Observação (opcional)"
                    value={docObs[d.id] ?? d.observacao ?? ""}
                    onChange={(e) => setDocObs((p) => ({ ...p, [d.id]: e.target.value }))}
                  />
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setDocStatus(d.id, "aprovado")}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDocStatus(d.id, "reprovado")}>
                    Reprovar
                  </Button>
                  {d.status !== "pendente" && (
                    <Button size="sm" variant="outline" onClick={() => setDocStatus(d.id, "pendente")}>
                      Reabrir
                    </Button>
                  )}
                </div>
                {d.revisado_em && (
                  <div className="text-[10px] text-muted-foreground">Revisado em {fmtDate(d.revisado_em)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Exame Admissional (editor RH) */}
      <ExameAdmissionalSection candidato={candidato} onExameChange={onExameChange} />
    </div>
  );
}

function ExameAdmissionalSection({
  candidato,
  onExameChange,
}: {
  candidato: Candidato;
  onExameChange: (patch: Partial<Candidato["exameAdmissional"]>) => void;
}) {
  const [clinica, setClinica] = useState("");
  const [endereco, setEndereco] = useState("");
  const [horario, setHorario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const notificar = async () => {
    const telefone = (candidato.telefone || "").replace(/\D/g, "");
    if (telefone.length < 10) {
      toast.error("Candidato sem telefone válido cadastrado.");
      return;
    }
    const data = candidato.exameAdmissional?.dataExame;
    if (!data) {
      toast.error("Informe a Data do Exame antes de notificar.");
      return;
    }
    if (!clinica.trim()) {
      toast.error("Informe a Clínica.");
      return;
    }
    const dataFmt = data.split("-").reverse().join("/");
    const nome = (candidato.nome || "").split(" ")[0] || "";
    const partes = [
      `Olá${nome ? ", " + nome : ""}! Seu *Exame Admissional* foi agendado:`,
      ``,
      `📅 Data: ${dataFmt}${horario ? " às " + horario : ""}`,
      `🏥 Clínica: ${clinica}`,
    ];
    if (endereco.trim()) partes.push(`📍 Endereço: ${endereco}`);
    const obs = candidato.exameAdmissional?.observacoes?.trim();
    if (obs) partes.push(``, `Observações: ${obs}`);
    partes.push(``, `Compareça em jejum se orientado pela clínica e leve um documento com foto.`);
    const mensagem = partes.join("\n");

    setEnviando(true);
    try {
      const { enviarWhatsApp } = await import("@/lib/whatsapp");
      const r = await enviarWhatsApp(telefone, mensagem);
      if (r.success) toast.success("Candidato notificado via WhatsApp.");
      else toast.error("Falha ao enviar WhatsApp: " + (r.error || "erro desconhecido"));
    } catch (e: any) {
      toast.error("Erro ao enviar WhatsApp: " + (e?.message || e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold mb-2">🏥 Exame Admissional</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Data do Exame</label>
          <Input type="date" value={candidato.exameAdmissional?.dataExame || ""}
            onChange={(e) => onExameChange({ dataExame: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Resultado</label>
          <select
            value={candidato.exameAdmissional?.resultado || "pendente"}
            onChange={(e) => onExameChange({ resultado: e.target.value as any })}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="pendente">Pendente</option>
            <option value="apto">Apto</option>
            <option value="inapto">Inapto</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Observações</label>
        <Textarea rows={2} value={candidato.exameAdmissional?.observacoes || ""}
          onChange={(e) => onExameChange({ observacoes: e.target.value })} />
      </div>

      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Notificar candidato via WhatsApp (dados enviados apenas na mensagem)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Clínica</label>
            <Input value={clinica} onChange={(e) => setClinica(e.target.value)} className="mt-1" placeholder="Nome da clínica" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Endereço</label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="mt-1" placeholder="Rua, nº, bairro" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Horário</label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={notificar} disabled={enviando} className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {enviando ? "Enviando..." : "Notificar Candidato (WhatsApp)"}
          </Button>
        </div>
      </div>
    </section>
  );
}


export function validacaoPodeEfetivar(ficha: FichaRow | null, docs: DocRow[]) {
  if (!ficha) return { ok: false, msg: "Ficha do portal não recebida." };
  if (ficha.status !== "aprovada") return { ok: false, msg: "Aprovar a ficha cadastral do portal." };
  if (docs.length === 0) return { ok: false, msg: "Nenhum documento recebido do portal." };
  if (docs.some((d) => d.status === "pendente")) return { ok: false, msg: "Há documentos pendentes de revisão." };
  if (docs.some((d) => d.status === "reprovado")) return { ok: false, msg: "Há documentos reprovados — solicite reenvio ao candidato." };
  return { ok: true, msg: "" };
}
