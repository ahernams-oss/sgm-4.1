import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useClientes } from "@/contexts/ClientesContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

interface Props {
  tipo: "Cliente" | "Fornecedor";
}

const COLUNAS_TEMPLATE = [
  "nome", "nomeFantasia", "cnpj", "inscricaoEstadual", "inscricaoMunicipal",
  "esfera", "descricao", "contato", "email", "emailCompras",
  "telefone1", "telefone2", "telefone3",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
];

const COLUNAS_LABEL: Record<string, string> = {
  nome: "Razão Social *", nomeFantasia: "Nome Fantasia", cnpj: "CNPJ",
  inscricaoEstadual: "Inscrição Estadual", inscricaoMunicipal: "Inscrição Municipal",
  esfera: "Esfera", descricao: "Descrição", cap: "CAP", contato: "Contato", email: "E-mail",
  emailCompras: "E-mail Compras", telefone1: "Telefone 1", telefone2: "Telefone 2",
  telefone3: "Telefone 3", cep: "CEP", logradouro: "Logradouro", numero: "Número",
  complemento: "Complemento", bairro: "Bairro", cidade: "Cidade", uf: "UF",
};

export default function ImportClientesFornecedores({ tipo }: Props) {
  const { addCliente } = useClientes();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const ws = (await getXLSX()).utils.aoa_to_sheet([COLUNAS_TEMPLATE.map(c => COLUNAS_LABEL[c] || c)]);
    ws["!cols"] = COLUNAS_TEMPLATE.map(() => ({ wch: 20 }));
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Modelo");
    (await getXLSX()).writeFile(wb, `modelo_${tipo.toLowerCase()}s.xlsx`, { compression: true });
    toast.success("Template baixado!");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = (await getXLSX()).read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
        if (raw.length < 2) { toast.error("Arquivo vazio ou sem dados."); return; }

        const header = raw[0].map(h => {
          const entry = Object.entries(COLUNAS_LABEL).find(([, v]) => v.replace(" *", "").toLowerCase() === String(h).trim().toLowerCase());
          if (entry) return entry[0];
          const direct = COLUNAS_TEMPLATE.find(c => c.toLowerCase() === String(h).trim().toLowerCase());
          return direct || String(h).trim();
        });

        const rows = raw.slice(1).filter(r => r.some(c => c)).map(r => {
          const obj: Record<string, string> = {};
          header.forEach((col, i) => { obj[col] = String(r[i] ?? "").trim(); });
          return obj;
        });

        setPreview(rows);
        setOpen(true);
      } catch { toast.error("Erro ao ler arquivo."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    const valid = preview.filter(r => r.nome?.trim());
    if (valid.length === 0) { toast.error("Nenhum registro com nome preenchido."); return; }

    setImporting(true);
    let success = 0;
    for (const row of valid) {
      try {
        const telefones = [row.telefone1, row.telefone2, row.telefone3].filter(t => t);
        await addCliente({
          tipo, nome: row.nome || "", nomeFantasia: row.nomeFantasia || "",
          cnpj: row.cnpj || "", inscricaoEstadual: row.inscricaoEstadual || "",
          inscricaoMunicipal: row.inscricaoMunicipal || "", esfera: row.esfera || "",
          descricao: row.descricao || "", cap: row.cap || "", contato: row.contato || "",
          email: row.email || "", emailCompras: row.emailCompras || "",
          emailEngenharia: "", emailOsCc: "", emailOsBcc: "",
          emailSsCc: "", emailSsBcc: "",
          telefones, telefoneCelular: "", celulares: "", telefonesWhatsapp: "",
          cep: row.cep || "", logradouro: row.logradouro || "",
          numero: row.numero || "", complemento: row.complemento || "",
          bairro: row.bairro || "", cidade: row.cidade || "", uf: row.uf || "",
          endereco: "", dataInicioContrato: "",
          relLinha1: "", relLinha2: "", relLinha3: "", relLinha4: "",
          grupoWhatsapp: "", logoUrl: "", modeloOsId: "",
          informacoesFinanceiras: [], locais: [], locaisEntrega: [], contratos: [],
        });
        success++;
      } catch { /* skip */ }
    }
    toast.success(`${success} ${tipo.toLowerCase()}(es) importado(s) com sucesso!`);
    setImporting(false);
    setPreview([]);
    setOpen(false);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5 mr-1" /> Modelo
        </Button>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" /> Importar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Pré-visualização da Importação
            </DialogTitle>
            <DialogDescription>
              {preview.length} registro(s) encontrado(s). Confira os dados antes de importar.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[50vh] border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Nome</th>
                  <th className="p-2 text-left">CNPJ</th>
                  <th className="p-2 text-left">Contato</th>
                  <th className="p-2 text-left">Cidade/UF</th>
                  <th className="p-2 text-left">Telefone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((r, i) => (
                  <tr key={i} className={r.nome?.trim() ? "" : "opacity-40"}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-medium">{r.nome || "—"}</td>
                    <td className="p-2">{r.cnpj || "—"}</td>
                    <td className="p-2">{r.contato || "—"}</td>
                    <td className="p-2">{r.cidade ? `${r.cidade}/${r.uf}` : "—"}</td>
                    <td className="p-2">{r.telefone1 || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setOpen(false); setPreview([]); }}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importando..." : `Importar ${preview.filter(r => r.nome?.trim()).length} registro(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
