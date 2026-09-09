import { useMemo, useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { Cliente } from "@/contexts/ClientesContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

type TipoEntidade = "Cliente" | "Fornecedor";

interface CampoDef {
  key: string;
  label: string;
  grupo: "Dados básicos" | "Contato" | "Endereço" | "Financeiro";
  width?: number;
  get: (c: Cliente) => string;
}

const CAMPOS: CampoDef[] = [
  { key: "nome", label: "Razão Social", grupo: "Dados básicos", width: 40, get: c => c.nome || "" },
  { key: "nomeFantasia", label: "Nome Fantasia", grupo: "Dados básicos", width: 35, get: c => c.nomeFantasia || "" },
  { key: "cnpj", label: "CNPJ", grupo: "Dados básicos", width: 25, get: c => c.cnpj || "" },
  { key: "inscricaoEstadual", label: "Inscrição Estadual", grupo: "Dados básicos", width: 22, get: c => c.inscricaoEstadual || "" },
  { key: "inscricaoMunicipal", label: "Inscrição Municipal", grupo: "Dados básicos", width: 22, get: c => c.inscricaoMunicipal || "" },
  { key: "contato", label: "Responsável", grupo: "Contato", width: 25, get: c => c.contato || "" },
  { key: "telefones", label: "Telefones", grupo: "Contato", width: 30, get: c => (c.telefones || []).join(", ") },
  { key: "email", label: "E-mail", grupo: "Contato", width: 30, get: c => c.email || "" },
  { key: "emailCompras", label: "E-mail Compras", grupo: "Contato", width: 30, get: c => c.emailCompras || "" },
  { key: "cep", label: "CEP", grupo: "Endereço", width: 18, get: c => c.cep || "" },
  { key: "logradouro", label: "Logradouro", grupo: "Endereço", width: 35, get: c => `${c.logradouro || ""}${c.numero ? ", " + c.numero : ""}${c.complemento ? " - " + c.complemento : ""}` },
  { key: "bairro", label: "Bairro", grupo: "Endereço", width: 22, get: c => c.bairro || "" },
  { key: "cidadeUf", label: "Cidade/UF", grupo: "Endereço", width: 25, get: c => c.cidade ? `${c.cidade}/${c.uf}` : "" },
  { key: "banco", label: "Banco (1º)", grupo: "Financeiro", width: 22, get: c => c.informacoesFinanceiras?.[0]?.banco || "" },
  { key: "agencia", label: "Agência", grupo: "Financeiro", width: 14, get: c => c.informacoesFinanceiras?.[0]?.agencia || "" },
  { key: "conta", label: "Conta", grupo: "Financeiro", width: 18, get: c => c.informacoesFinanceiras?.[0]?.conta || "" },
  { key: "chavePix", label: "Chave PIX", grupo: "Financeiro", width: 30, get: c => c.informacoesFinanceiras?.[0]?.chavePix || "" },
];

const GRUPOS: CampoDef["grupo"][] = ["Dados básicos", "Contato", "Endereço", "Financeiro"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoEntidade;
  todos: Cliente[];
  filtrados: Cliente[];
  selecionados: Cliente[];
}

export default function RelatorioClienteFornecedorDialog({ open, onOpenChange, tipo, todos, filtrados, selecionados }: Props) {
  const temSel = selecionados.length > 0;
  const [escopo, setEscopo] = useState<"selecionados" | "filtrados" | "todos">(temSel ? "selecionados" : "filtrados");
  const [camposSel, setCamposSel] = useState<string[]>(["nome", "cnpj", "contato", "telefones", "email", "cidadeUf"]);

  const dados = useMemo(() => {
    if (escopo === "selecionados") return selecionados;
    if (escopo === "filtrados") return filtrados;
    return todos;
  }, [escopo, selecionados, filtrados, todos]);

  const campos = useMemo(() => CAMPOS.filter(c => camposSel.includes(c.key)), [camposSel]);

  const toggleCampo = (key: string) =>
    setCamposSel(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleGrupo = (grupo: CampoDef["grupo"]) => {
    const keys = CAMPOS.filter(c => c.grupo === grupo).map(c => c.key);
    const all = keys.every(k => camposSel.includes(k));
    setCamposSel(prev => all ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])));
  };

  const validar = () => {
    if (campos.length === 0) { toast.error("Selecione ao menos um campo."); return false; }
    if (dados.length === 0) { toast.error("Nenhum registro no escopo selecionado."); return false; }
    return true;
  };

  const titulo = `Relatório de ${tipo === "Cliente" ? "Clientes" : "Fornecedores"}`;

  const handlePdf = async () => {
    if (!validar()) return;
    const doc = new (await getJsPDF())({ compress: true, orientation: campos.length > 5 ? "landscape" : "portrait" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 107);
    doc.rect(0, 0, pw, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(titulo, 14, 12);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 12, { align: "right" });
    doc.text(`Total: ${dados.length} registro(s)`, pw - 14, 22, { align: "right" });
    doc.text(`Escopo: ${escopo === "selecionados" ? "Selecionados" : escopo === "filtrados" ? "Filtrados" : "Todos"}`, 14, 22);
    doc.setTextColor(30, 30, 30);

    (await getAutoTable())(doc, {
      startY: 34,
      head: [campos.map(c => c.label)],
      body: dados.map(d => campos.map(c => c.get(d))),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    const pages = doc.getNumberOfPages();
    const ph = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    }
    doc.save(`${titulo.replace(/\s+/g, "_").toLowerCase()}.pdf`);
    toast.success("PDF gerado!");
    onOpenChange(false);
  };

  const handleExcel = async () => {
    if (!validar()) return;
    const linhas = dados.map(d => {
      const obj: Record<string, string> = {};
      campos.forEach(c => { obj[c.label] = c.get(d); });
      return obj;
    });
    const ws = (await getXLSX()).utils.json_to_sheet(linhas);
    ws["!cols"] = campos.map(c => ({ wch: c.width || 20 }));
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, titulo.substring(0, 31));
    (await getXLSX()).writeFile(wb, `${titulo.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
    toast.success("Excel gerado!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo} — Personalizado</DialogTitle>
          <DialogDescription>
            Escolha as informações que deseja visualizar e o formato de exportação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Escopo dos dados</Label>
            <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as any)} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="selecionados" id="esc-sel" disabled={!temSel} />
                <Label htmlFor="esc-sel" className={`text-sm font-normal cursor-pointer ${!temSel ? "opacity-50" : ""}`}>
                  Apenas selecionados ({selecionados.length})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="filtrados" id="esc-flt" />
                <Label htmlFor="esc-flt" className="text-sm font-normal cursor-pointer">
                  Resultado filtrado atual ({filtrados.length})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id="esc-tdo" />
                <Label htmlFor="esc-tdo" className="text-sm font-normal cursor-pointer">
                  Todos os {tipo === "Cliente" ? "clientes" : "fornecedores"} ({todos.length})
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Campos do relatório ({camposSel.length})</Label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCamposSel(CAMPOS.map(c => c.key))}>Marcar todos</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCamposSel([])}>Limpar</Button>
              </div>
            </div>
            <ScrollArea className="h-64 border rounded-md p-3">
              <div className="space-y-3">
                {GRUPOS.map(grupo => {
                  const itens = CAMPOS.filter(c => c.grupo === grupo);
                  const allG = itens.every(c => camposSel.includes(c.key));
                  const someG = itens.some(c => camposSel.includes(c.key));
                  return (
                    <div key={grupo}>
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox
                          checked={allG ? true : someG ? "indeterminate" : false}
                          onCheckedChange={() => toggleGrupo(grupo)}
                        />
                        <Label className="text-xs font-semibold uppercase tracking-wide text-primary cursor-pointer" onClick={() => toggleGrupo(grupo)}>
                          {grupo}
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-6">
                        {itens.map(c => (
                          <div key={c.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`f-${c.key}`}
                              checked={camposSel.includes(c.key)}
                              onCheckedChange={() => toggleCampo(c.key)}
                            />
                            <Label htmlFor={`f-${c.key}`} className="text-sm font-normal cursor-pointer">
                              {c.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={handleExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={handlePdf} className="gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
