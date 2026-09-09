import { lerArquivoBase64 } from "@/lib/compressFile";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Upload, FileText, X, Lock, FileDown, Receipt } from "lucide-react";
import type { Cliente, Contrato, Faturamento } from "@/contexts/ClientesContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { gerarPdfMedicaoControle } from "@/lib/gerarPdfMedicaoControle";
import { gerarContaReceberDeFaturamento } from "@/lib/financeiroFromPC";

const emptyFaturamento: Omit<Faturamento, "id"> = {
  periodoInicio: "",
  periodoFim: "",
  dataEmissaoNf: "",
  xmlNfNome: "",
  xmlNfConteudo: "",
  numeroNf: "",
  processoNf: "",
  chaveNf: "",
  numeroMedicao: "",
  descricao: "",
  valorBruto: "",
  valorLiquido: "",
  valorFolha: "",
  valeTransporte: "",
  valeAlimentacao: "",
  custoFixo: "",
  foraFolha: "",
  provisaoFerias: "",
  provisao13: "",
  valorVariavel: "",
  anexoNfUrl: "",
  anexoNfNome: "",
  pago: false,
  dataPagamento: "",
};

interface Props {
  faturamentos: Faturamento[];
  onChange: (faturamentos: Faturamento[]) => void | Promise<boolean | void>;
  contratoNumero: string;
  cliente?: Cliente;
  contrato?: Contrato;
}

export default function FaturamentoSection({ faturamentos, onChange, contratoNumero, cliente, contrato }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Faturamento, "id">>(emptyFaturamento);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeVerValorFolha = tem("clientes.ver_valor_folha");
  const { ordens } = useOrdensServico();
  const { empresa } = useEmpresa();

  const handleGerarRelatorio = async (f: Faturamento) => {
    if (!cliente || !contrato) { toast.error("Dados do contrato indisponíveis."); return; }
    const doc = await gerarPdfMedicaoControle({
      cliente, contrato, faturamento: f, ordens,
      empresaNome: empresa?.razaoSocial || empresa?.nomeFantasia || "",
    });
    doc.save(`Medicao_${contrato.numero}_${f.numeroMedicao || f.id.slice(0, 6)}.pdf`);
  };

  const update = <K extends keyof Omit<Faturamento, "id">>(field: K, value: Omit<Faturamento, "id">[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Valores monetários em formato BR ────────────────────────────────────────
  // Aceita apenas dígitos, ponto e vírgula durante a digitação; normaliza no blur.
  const parseMoney = (v: string): number | null => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    // BR: "1.234,56" | US: "1234.56" | "1234" | "1234,5"
    const normalized = s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;
    const num = Number(normalized);
    return isFinite(num) ? num : null;
  };
  const formatMoneyBR = (num: number) =>
    num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handleMoneyChange = (field: keyof Omit<Faturamento, "id">) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mantém somente dígitos, vírgula e ponto durante a digitação (permite editar livremente)
    const cleaned = e.target.value.replace(/[^\d.,-]/g, "");
    update(field, cleaned as never);
  };
  const handleMoneyBlur = (field: keyof Omit<Faturamento, "id">) => (e: React.FocusEvent<HTMLInputElement>) => {
    const num = parseMoney(e.target.value);
    if (num === null) { update(field, "" as never); return; }
    update(field, formatMoneyBR(num) as never);
  };

  const handleImportXml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml")) {
      toast.error("Selecione um arquivo XML válido.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      // Try to extract NF number and value from XML
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const getTag = (...names: string[]) => {
          const all = xmlDoc.getElementsByTagName("*");
          for (const n of names) {
            const nLower = n.toLowerCase();
            for (let i = 0; i < all.length; i++) {
              const el = all[i];
              const local = (el.localName || el.nodeName || "").toLowerCase();
              if (local === nLower) {
                const txt = el.textContent?.trim();
                if (txt) return txt;
              }
            }
          }
          return "";
        };
        // Busca tag contida dentro de um pai específico (ex: Numero dentro de InfNfse)
        const getTagInParent = (parentName: string, ...childNames: string[]) => {
          const all = xmlDoc.getElementsByTagName("*");
          const pLower = parentName.toLowerCase();
          for (let i = 0; i < all.length; i++) {
            const el = all[i];
            const local = (el.localName || el.nodeName || "").toLowerCase();
            if (local === pLower) {
              const children = el.getElementsByTagName("*");
              for (const cn of childNames) {
                const cLower = cn.toLowerCase();
                for (let j = 0; j < children.length; j++) {
                  const c = children[j];
                  const cLocal = (c.localName || c.nodeName || "").toLowerCase();
                  if (cLocal === cLower) {
                    const txt = c.textContent?.trim();
                    if (txt) return txt;
                  }
                }
              }
            }
          }
          return "";
        };

        // NFe (nota fiscal eletrônica de produto) e NFSe (serviços - ABRASF / municipais)
        // Prioriza Numero dentro de InfNfse/Nfse para não pegar o número do RPS
        const nNF =
          getTagInParent("InfNfse", "Numero", "NumeroNfse") ||
          getTagInParent("Nfse", "Numero", "NumeroNfse") ||
          getTag("NumeroNfse", "numero_nfse", "nNF") ||
          getTag("Numero");
        // Valor Bruto = Valor dos Serviços (ValorServicos) na NFS-e
        const vServ = getTag("ValorServicos", "valor_servicos", "vServ", "ValorServico", "valor_servico");
        const vNF = vServ || getTag("vNF", "ValorTotal", "valor_total", "ValorBruto", "valor_bruto");
        const vLiq = getTag("vLiq", "ValorLiquidoNfse", "valor_liquido_nfse", "ValorLiquido", "valor_liquido") || vNF;
        const dhEmi = getTag("dhEmi", "DataEmissao", "data_emissao", "DataEmissaoRps");
        const dataEmi = dhEmi ? dhEmi.substring(0, 10) : "";

        // Converte valores do formato XML (1234.56) para BR (1234,56)
        const toBR = (v: string) => {
          if (!v) return "";
          const num = Number(String(v).replace(",", "."));
          if (!isFinite(num)) return "";
          return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        const vNFbr = toBR(vNF);
        const vLiqBr = toBR(vLiq);

        // Chave: NFe (chNFe / infNFe@Id), NFSe (CodigoVerificacao) ou nome do arquivo (chave de 44+ dígitos)
        let chave = getTag("chNFe", "ChaveAcesso", "chave_acesso", "CodigoVerificacao", "codigo_verificacao", "codigoVerificacao");
        if (!chave) {
          const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
          const id = infNFe?.getAttribute("Id") || "";
          chave = id.replace(/^NFe/i, "");
        }
        if (!chave) {
          const m = file.name.match(/\d{40,}/);
          if (m) chave = m[0];
        }

        // Fallback: extrai número do nome do arquivo (ex: "NFSe.382_..." ou "NFS-e 382...")
        let nNFFinal = nNF;
        if (!nNFFinal) {
          const m = file.name.match(/(?:NFS?-?e|NFe|nota)[^\d]*(\d{1,15})/i);
          if (m) nNFFinal = m[1];
        }

        setForm((prev) => ({
          ...prev,
          xmlNfNome: file.name,
          xmlNfConteudo: content.substring(0, 5000),
          ...(nNFFinal && !prev.numeroNf ? { numeroNf: nNFFinal } : {}),
          ...(chave && !prev.chaveNf ? { chaveNf: chave } : {}),
          
          ...(vNFbr && (!prev.valorBruto || prev.valorBruto === "0,00") ? { valorBruto: vNFbr } : {}),
          ...(vLiqBr && (!prev.valorLiquido || prev.valorLiquido === "0,00") ? { valorLiquido: vLiqBr } : {}),
          ...(dataEmi && !prev.dataEmissaoNf ? { dataEmissaoNf: dataEmi } : {}),
        }));


        toast.success("XML importado! Dados extraídos automaticamente.");
      } catch {
        setForm((prev) => ({ ...prev, xmlNfNome: file.name, xmlNfConteudo: content.substring(0, 5000) }));
        toast.success("XML importado.");
      }

    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAnexoNf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const base64 = await lerArquivoBase64(file);
    setForm((prev) => ({
      ...prev,
      anexoNfUrl: base64,
      anexoNfNome: file.name,
    }));
    toast.success("NF anexada.");
  };

  const handleSave = async () => {
    if (!form.periodoInicio || !form.periodoFim) {
      toast.error("Informe o período do faturamento.");
      return;
    }
    // Normaliza todos os campos monetários para formato BR e valida
    const moneyFields: (keyof Omit<Faturamento, "id">)[] = [
      "valorBruto", "valorLiquido", "valorFolha", "valorVariavel",
      "valeAlimentacao", "valeTransporte", "custoFixo", "foraFolha",
      "provisaoFerias", "provisao13",
    ];
    const normalizedForm = { ...form };
    for (const field of moneyFields) {
      const raw = (form as any)[field];
      if (raw === "" || raw === undefined || raw === null) continue;
      const num = parseMoney(String(raw));
      if (num === null) {
        toast.error(`Valor inválido no campo monetário.`);
        return;
      }
      (normalizedForm as any)[field] = formatMoneyBR(num);
    }

    let savedId = editingId;
    let nextFaturamentos: Faturamento[];
    if (editingId) {
      nextFaturamentos = faturamentos.map((f) => (f.id === editingId ? { ...f, ...normalizedForm } : f));
    } else {
      const novo: Faturamento = { id: crypto.randomUUID(), ...normalizedForm };
      savedId = novo.id;
      nextFaturamentos = [...faturamentos, novo];
    }

    const ok = await onChange(nextFaturamentos);
    if (ok === false) {
      toast.error("Não foi possível gravar o faturamento.");
      return;
    }
    toast.success(editingId ? "Faturamento atualizado!" : "Faturamento adicionado!");

    // gera/atualiza Conta a Receber se houver NF e valor
    if (savedId && (normalizedForm.numeroNf || normalizedForm.numeroMedicao) && (normalizedForm.valorLiquido || normalizedForm.valorBruto)) {
      gerarContaReceberDeFaturamento(
        { id: savedId, ...normalizedForm },
        { clienteId: cliente?.id, clienteNome: cliente?.nome || cliente?.nomeFantasia, contratoId: contrato?.id, contratoNumero: contratoNumero }
      );
    }
    setForm(emptyFaturamento);
    setEditingId(null);
  };

  const handleEdit = (f: Faturamento) => {
    setEditingId(f.id);
    const { id, ...rest } = f;
    setForm(rest);
  };

  const handleDelete = async (id: string) => {
    const ok = await onChange(faturamentos.filter((f) => f.id !== id));
    if (ok === false) {
      toast.error("Não foi possível remover o faturamento.");
      return;
    }
    toast.success("Faturamento removido.");
    if (editingId === id) {
      setForm(emptyFaturamento);
      setEditingId(null);
    }
  };

  const formatCurrency = (val: string) => {
    if (val === undefined || val === null || val === "") return "—";
    // Aceita formato BR ("1.234,56") ou US ("1234.56")
    const s = String(val).trim();
    const normalized = s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;
    const num = parseFloat(normalized);
    if (isNaN(num)) return s;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-muted/30">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Faturamento — Contrato {contratoNumero}
      </h3>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="field-label">Período Início *</label>
          <Input type="date" value={form.periodoInicio} onChange={(e) => update("periodoInicio", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Período Fim *</label>
          <Input type="date" value={form.periodoFim} onChange={(e) => update("periodoFim", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Data Emissão NF</label>
          <div className="flex gap-2">
            <Input type="date" value={form.dataEmissaoNf} onChange={(e) => update("dataEmissaoNf", e.target.value)} className="flex-1" />
            <label className="cursor-pointer">
              <input type="file" accept=".xml" className="hidden" onChange={handleImportXml} />
              <Button type="button" variant="outline" size="icon" asChild title="Importar XML da NF">
                <span><Upload className="h-4 w-4" /></span>
              </Button>
            </label>
          </div>
          {form.xmlNfNome && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> {form.xmlNfNome}
              <button type="button" onClick={() => setForm(p => ({ ...p, xmlNfNome: "", xmlNfConteudo: "" }))} className="text-destructive hover:text-destructive/80">
                <X className="h-3 w-3" />
              </button>
            </p>
          )}
        </div>
        <div>
          <label className="field-label">Nº Medição</label>
          <Input placeholder="Nº da medição" value={form.numeroMedicao} onChange={(e) => update("numeroMedicao", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Nº Nota Fiscal</label>
          <Input placeholder="Nº da NF" value={form.numeroNf} onChange={(e) => update("numeroNf", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Processo da NF</label>
          <Input placeholder="Nº do processo" value={form.processoNf || ""} onChange={(e) => update("processoNf", e.target.value)} />
        </div>
        <div className="sm:col-span-2 md:col-span-3">
          <label className="field-label">Chave da Nota Fiscal</label>
          <Input placeholder="Chave de acesso (44 dígitos)" maxLength={44} value={form.chaveNf} onChange={(e) => update("chaveNf", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Descrição</label>
          <Input placeholder="Descrição do faturamento" value={form.descricao} onChange={(e) => update("descricao", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Valor Bruto</label>
          <Input inputMode="decimal" placeholder="0,00" value={form.valorBruto} onChange={handleMoneyChange("valorBruto")} onBlur={handleMoneyBlur("valorBruto")} />
        </div>
        <div>
          <label className="field-label">Valor Líquido</label>
          <Input inputMode="decimal" placeholder="0,00" value={form.valorLiquido} onChange={handleMoneyChange("valorLiquido")} onBlur={handleMoneyBlur("valorLiquido")} />
        </div>
        {podeVerValorFolha && (
          <div>
            <label className="field-label flex items-center gap-1">
              <Lock className="h-3 w-3 text-primary" /> Valor Folha
            </label>
            <Input inputMode="decimal" placeholder="0,00" value={form.valorFolha} onChange={handleMoneyChange("valorFolha")} onBlur={handleMoneyBlur("valorFolha")} />
          </div>
        )}
        {podeVerValorFolha && (
          <div>
            <label className="field-label">Valor da Variável</label>
            <Input inputMode="decimal" placeholder="0,00" value={form.valorVariavel || ""} onChange={handleMoneyChange("valorVariavel")} onBlur={handleMoneyBlur("valorVariavel")} />
          </div>
        )}
        {podeVerValorFolha && (
          <>
            <div>
              <label className="field-label">Vale Alimentação</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.valeAlimentacao} onChange={handleMoneyChange("valeAlimentacao")} onBlur={handleMoneyBlur("valeAlimentacao")} />
            </div>
            <div>
              <label className="field-label">Custo Fixo</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.custoFixo} onChange={handleMoneyChange("custoFixo")} onBlur={handleMoneyBlur("custoFixo")} />
            </div>
            <div>
              <label className="field-label">Fora Folha</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.foraFolha} onChange={handleMoneyChange("foraFolha")} onBlur={handleMoneyBlur("foraFolha")} />
            </div>
            <div>
              <label className="field-label">Provisão de Férias</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.provisaoFerias} onChange={handleMoneyChange("provisaoFerias")} onBlur={handleMoneyBlur("provisaoFerias")} />
            </div>
            <div>
              <label className="field-label">Provisão de 13º Salário</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.provisao13} onChange={handleMoneyChange("provisao13")} onBlur={handleMoneyBlur("provisao13")} />
            </div>
            <div>
              <label className="field-label">Vale Transporte</label>
              <Input inputMode="decimal" placeholder="0,00" value={form.valeTransporte} onChange={handleMoneyChange("valeTransporte")} onBlur={handleMoneyBlur("valeTransporte")} />
            </div>
          </>
        )}
        <div>
          <label className="field-label">Anexar NF</label>
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleAnexoNf} />
            <Button type="button" variant="outline" size="sm" asChild className="w-full gap-2">
              <span><Upload className="h-3.5 w-3.5" /> {form.anexoNfNome || "Selecionar arquivo"}</span>
            </Button>
          </label>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.pago}
              onCheckedChange={(v) => update("pago", !!v)}
              id="pago"
            />
            <label htmlFor="pago" className="text-sm font-medium cursor-pointer">Pago</label>
          </div>
          {form.pago && (
            <div className="flex-1">
              <label className="field-label">Data Pagamento</label>
              <Input type="date" value={form.dataPagamento} onChange={(e) => update("dataPagamento", e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" type="button" onClick={handleSave}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {editingId ? "Salvar Alterações" : "Adicionar Faturamento"}
        </Button>
        {editingId && (
          <Button size="sm" variant="outline" type="button" onClick={() => { setForm(emptyFaturamento); setEditingId(null); }}>
            Cancelar
          </Button>
        )}
      </div>

      {/* List */}
      {faturamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum faturamento cadastrado.</p>
      ) : (
        <div className="divide-y divide-border">
          {faturamentos.map((f) => (
            <div key={f.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <p className="font-medium text-foreground">
                  Medição {f.numeroMedicao || "—"}
                </p>
                <p className="text-muted-foreground truncate sm:col-span-2">{f.descricao || "—"}</p>
                <p className="text-muted-foreground tabular-nums">
                  {f.periodoInicio ? new Date(f.periodoInicio + "T00:00:00").toLocaleDateString("pt-BR") : "—"} a{" "}
                  {f.periodoFim ? new Date(f.periodoFim + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
                <p className="text-muted-foreground">
                  NF: {f.numeroNf || "—"} {f.processoNf ? `| Processo: ${f.processoNf}` : ""}
                </p>
                <p className="text-muted-foreground">Bruto: {formatCurrency(f.valorBruto)}</p>
                <p className="text-muted-foreground">Líquido: {formatCurrency(f.valorLiquido)}</p>
                <p className="text-muted-foreground">Variável: {formatCurrency(f.valorVariavel)}</p>
                {podeVerValorFolha && (
                  <p className="text-primary font-medium flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Folha: {formatCurrency(f.valorFolha)}
                  </p>
                )}
                {podeVerValorFolha && (
                  <>
                    <p className="text-muted-foreground">VT: {formatCurrency(f.valeTransporte)}</p>
                    <p className="text-muted-foreground">Vale Alim.: {formatCurrency(f.valeAlimentacao)}</p>
                    <p className="text-muted-foreground">Custo Fixo: {formatCurrency(f.custoFixo)}</p>
                    <p className="text-muted-foreground">Fora Folha: {formatCurrency(f.foraFolha)}</p>
                    <p className="text-muted-foreground">Prov. Férias: {formatCurrency(f.provisaoFerias)}</p>
                    <p className="text-muted-foreground">Prov. 13º: {formatCurrency(f.provisao13)}</p>
                  </>
                )}
                <p className="text-muted-foreground">
                  Emissão: {f.dataEmissaoNf ? new Date(f.dataEmissaoNf + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
                <p className={`font-medium ${f.pago ? "text-emerald-600" : "text-amber-600"}`}>
                  {f.pago ? `Pago em ${f.dataPagamento ? new Date(f.dataPagamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}` : "Pendente"}
                </p>
                {f.anexoNfNome && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {f.anexoNfNome}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" type="button" onClick={() => handleGerarRelatorio(f)} className="text-xs gap-1" title="Relatório de Medição (PDF)">
                  <FileDown className="h-3.5 w-3.5" /> Relatório
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-xs gap-1"
                  title="Emitir NFS-e (homologação)"
                  onClick={() => {
                    const params = new URLSearchParams({
                      faturamentoId: f.id,
                      clienteId: cliente?.id || "",
                      contrato: contratoNumero || "",
                      valor: String(f.valorBruto || ""),
                      descricao: f.descricao || `Medição ${f.numeroMedicao || ""}`.trim(),
                    });
                    navigate(`/financeiro/nfse?emitir=1&${params.toString()}`);
                  }}
                >
                  <Receipt className="h-3.5 w-3.5" /> NFS-e
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => handleEdit(f)} className="text-xs">Editar</Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => requestDelete(f.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={() => { if (deleteId) { handleDelete(deleteId); cancelDelete(); } }} />
    </div>
  );
}
