import { lerArquivoBase64 } from "@/lib/compressFile";
import React, { useState, useRef } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { Plus, AlertTriangle, Trash2, FileDown, Upload, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NrFuncionario } from "@/contexts/FuncionariosContext";
import { useNrsCatalogo } from "@/contexts/NrsCatalogoContext";
import { toast } from "sonner";

const addDias = (data: string, dias: number | null | undefined) => {
  if (!data || dias == null) return "";
  const d = new Date(data + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().slice(0, 10);
};

const fmtData = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-foreground/80">{label}{required && " *"}</Label>
    {children}
  </div>
);

interface Props {
  nrs: NrFuncionario[];
  onChange: (nrs: NrFuncionario[]) => void;
}

export function NRsFuncionarioTab({ nrs, onChange }: Props) {
  const { nrs: catalogo } = useNrsCatalogo();
  const [novaNr, setNovaNr] = useState({ numero: "", descricao: "", dataEntrega: "", dataValidade: "" });

  const selecionarNr = (codigo: string) => {
    const cat = catalogo.find((c) => c.codigo === codigo);
    setNovaNr((p) => ({
      ...p,
      numero: codigo,
      descricao: cat?.descricao ?? p.descricao,
      dataValidade: addDias(p.dataEntrega, cat?.validadeDias),
    }));
  };

  const alterarDataEntrega = (data: string) => {
    const cat = catalogo.find((c) => c.codigo === novaNr.numero);
    setNovaNr((p) => ({ ...p, dataEntrega: data, dataValidade: addDias(data, cat?.validadeDias) }));
  };
  const [pendingFile, setPendingFile] = useState<{ base64: string; nome: string; tipo: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formFileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { deleteId: deleteNrId, requestDelete: requestDeleteNr, cancelDelete: cancelDeleteNr } = useDoubleConfirmDelete();

  const addNr = () => {
    if (!novaNr.numero || !novaNr.descricao) {
      toast.error("Preencha o número e a descrição da NR.");
      return;
    }
    const nova: NrFuncionario = {
      id: crypto.randomUUID(),
      numero: novaNr.numero,
      descricao: novaNr.descricao,
      dataEntrega: novaNr.dataEntrega,
      dataValidade: novaNr.dataValidade || undefined,
      ...(pendingFile ? { anexoBase64: pendingFile.base64, anexoNome: pendingFile.nome, anexoTipo: pendingFile.tipo } : {}),
    };
    onChange([...nrs, nova]);
    setNovaNr({ numero: "", descricao: "", dataEntrega: "", dataValidade: "" });
    setPendingFile(null);
    if (formFileRef.current) formFileRef.current.value = "";
    toast.success("NR adicionada!");
  };

  const handleFormFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 2MB).");
      e.target.value = "";
      return;
    }
    const base64 = await lerArquivoBase64(file);
    setPendingFile({ base64, nome: file.name, tipo: file.type });
  };

  const removeNr = (id: string) => {
    onChange(nrs.filter((n) => n.id !== id));
    toast.success("NR removida.");
  };

  const handleUploadClick = (id: string) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 2MB).");
      return;
    }
    e.target.value = "";
    const base64 = await lerArquivoBase64(file);
    onChange(nrs.map((n) =>
      n.id === uploadingId
        ? { ...n, anexoBase64: base64, anexoNome: file.name, anexoTipo: file.type }
        : n
    ));
    toast.success("Anexo adicionado!");
    setUploadingId(null);
  };

  const downloadAnexo = (nr: NrFuncionario) => {
    if (!nr.anexoBase64 || !nr.anexoNome) return;
    const link = document.createElement("a");
    link.href = nr.anexoBase64;
    link.download = nr.anexoNome;
    link.click();
  };

  const removeAnexo = (id: string) => {
    onChange(nrs.map((n) =>
      n.id === id
        ? { ...n, anexoBase64: undefined, anexoNome: undefined, anexoTipo: undefined }
        : n
    ));
    toast.success("Anexo removido.");
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Avisos automáticos</p>
        <p>O sistema enviará avisos por WhatsApp 30, 20 e 10 dias antes do vencimento de cada NR.</p>
        <p>Os avisos são verificados automaticamente todos os dias e enviados ao WhatsApp RH, SEGTRAB e Compras.</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Número da NR *</Label>
          <Select value={novaNr.numero} onValueChange={selecionarNr}>
            <SelectTrigger><SelectValue placeholder="Selecione a NR" /></SelectTrigger>
            <SelectContent>
              {catalogo.length === 0 ? (
                <SelectItem value="__none" disabled>Nenhuma NR cadastrada</SelectItem>
              ) : (
                catalogo.map((nr) => (
                  <SelectItem key={nr.id} value={nr.codigo}>{nr.codigo}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Descrição *</Label>
          <Input
            value={novaNr.descricao}
            onChange={(e) => setNovaNr((p) => ({ ...p, descricao: e.target.value }))}
            placeholder="Ex: Equipamentos de Proteção Individual"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Data de Conclusão</Label>
          <Input
            type="date"
            value={novaNr.dataEntrega}
            onChange={(e) => alterarDataEntrega(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Validade</Label>
          <Input type="date" value={novaNr.dataValidade} readOnly className="bg-muted/40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Anexo</Label>
          <Input
            ref={formFileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFormFileChange}
            className="text-xs"
          />
        </div>
        <Button type="button" onClick={addNr} className="shadow-md">
          <Plus className="h-4 w-4 mr-1" /> Adicionar NR
        </Button>
      </div>

      {nrs.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data Conclusão</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nrs.map((nr) => (
                <TableRow key={nr.id}>
                  <TableCell className="font-medium">{nr.numero}</TableCell>
                  <TableCell>{nr.descricao}</TableCell>
                  <TableCell>{fmtData(nr.dataEntrega)}</TableCell>
                  <TableCell>{fmtData(nr.dataValidade)}</TableCell>
                  <TableCell>
                    {nr.anexoBase64 ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadAnexo(nr)}
                          className="h-7 text-xs gap-1"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          {nr.anexoNome}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeAnexo(nr.id)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUploadClick(nr.id)}
                        className="h-7 text-xs gap-1"
                      >
                        <Upload className="h-3.5 w-3.5" /> Anexar
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => requestDeleteNr(nr.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma NR cadastrada para este funcionário.
        </div>
      )}
      <DoubleConfirmDelete open={!!deleteNrId} onOpenChange={(open) => !open && cancelDeleteNr()} onConfirm={() => { if (deleteNrId) { removeNr(deleteNrId); cancelDeleteNr(); } }} />
    </div>
  );
}
