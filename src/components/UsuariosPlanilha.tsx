import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Usuario } from "@/contexts/UsuariosContext";
import { cabecalhoClientesLocais, colunasUsuarios, conferirUsuarios, linhasClientesLocais, linhasUsuariosSchema, type CatalogosUsuarios, type ConferenciaUsuario, type LinhaUsuario } from "@/lib/usuariosPlanilha";
import { importarUsuariosPlanilha } from "@/lib/usuariosPlanilha.functions";

type Props = { usuarios: Usuario[]; existentes: Usuario[]; catalogos: CatalogosUsuarios; podeImportar: boolean };
export default function UsuariosPlanilha({ usuarios, existentes, catalogos, podeImportar }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [linhas, setLinhas] = useState<LinhaUsuario[]>([]);
  const [conferencia, setConferencia] = useState<ConferenciaUsuario[]>([]);
  const [concluido, setConcluido] = useState(false);
  const importar = useServerFn(importarUsuariosPlanilha);
  const qc = useQueryClient();
  const novos = conferencia.filter(c => c.situacao === "Novo").length;

  async function baixar(modelo: boolean) {
    setOcupado(true);
    try {
      const { Workbook } = await import("exceljs");
      const book = new Workbook();
      book.creator = "SGM Lasant";
      const sheet = book.addWorksheet("Usuários", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRow([...colunasUsuarios, ...(!modelo ? ["Situação"] : [])]);
      const nome = (id: string, refs: CatalogosUsuarios["cargos"]) => refs.find(r => r.id === id)?.nome ?? id;
      if (!modelo) usuarios.forEach(u => sheet.addRow([u.nome, u.email, nome(u.cargoId, catalogos.cargos), nome(u.perfilAcessoId, catalogos.perfis), u.telefone, u.matricula, u.ramal, u.destinadoCliente ? "Cliente" : "Interno", u.clientesPermitidos.join("; "), (u.locaisPermitidos ?? []).join("; "), u.limiteAprovacaoCompras, u.limiteAprovacaoOS, u.ativo === false ? "Inativo" : "Ativo"]));
      sheet.columns.forEach((col, i) => { col.width = [36, 40, 36, 30, 24, 18, 14, 16, 45, 45, 24, 24, 16][i] ?? 25; });
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(sheet.rowCount, 1), column: sheet.columnCount } };
      const instrucoes = book.addWorksheet("Instruções");
      ["Nome, E-mail e Cargo são obrigatórios. Cargo e Perfil de Acesso aceitam nome exato ou ID cadastrado.", "Somente novos e-mails são importados. Cadastros existentes nunca são alterados.", "Não inclua senhas. Após importar, defina a senha no cadastro do usuário.", "Tipo: Interno ou Cliente. Clientes e Locais: IDs separados por ponto e vírgula.", "Na aba Clientes e Locais os nomes aparecem apenas como referência; na importação informe os IDs.", "Locais devem pertencer aos clientes selecionados. Campos vazios não liberam todos os clientes.", "Limites em reais, positivos ou zero; zero significa sem limite de aprovação.", "Até 500 linhas por importação. Situação é informativa na exportação; não altera o acesso na importação."].forEach(t => instrucoes.addRow([t]));
      instrucoes.getColumn(1).width = 110;
      for (const [titulo, refs] of [["Cargos", catalogos.cargos], ["Perfis", catalogos.perfis]] as const) {
        const ref = book.addWorksheet(titulo); ref.addRow(["ID", "Nome"]); refs.forEach(r => ref.addRow([r.id, r.nome])); ref.getColumn(1).width = 40; ref.getColumn(2).width = 45;
      }
      const clientes = book.addWorksheet("Clientes e Locais"); clientes.addRow(cabecalhoClientesLocais);
      linhasClientesLocais(catalogos).forEach(linha => clientes.addRow(linha));
      clientes.columns.forEach((c, i) => { c.width = [40, 45, 40, 45][i] ?? 40; });
      book.eachSheet(s => s.eachRow((row, i) => { row.font = { name: "Arial", size: 11, bold: i === 1 }; row.alignment = { vertical: "top", wrapText: true }; }));
      const buffer = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = modelo ? "modelo_usuarios.xlsx" : "usuarios.xlsx"; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error("Não foi possível gerar a planilha."); } finally { setOcupado(false); }
  }

  async function lerArquivo(file?: File) {
    if (!file || !podeImportar) return;
    setOcupado(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("A planilha deve ter até 5 MB.");
      if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error("Selecione uma planilha XLSX ou CSV.");
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellFormula: true, sheetRows: 502 });
      const sheet = book.Sheets["Usuários"] ?? book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("Planilha vazia.");
      if (Object.values(sheet).some(c => c && typeof c === "object" && "f" in c && c.f)) throw new Error("Remova as fórmulas antes de importar.");
      const dados = linhasUsuariosSchema.safeParse(XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }));
      if (!dados.success) throw new Error("Informe de 1 a 500 linhas válidas, com os cabeçalhos do modelo.");
      setLinhas(dados.data); setConferencia(conferirUsuarios(dados.data, catalogos, existentes.map(u => u.email))); setConcluido(false); setAberto(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao ler a planilha."); }
    finally { setOcupado(false); if (input.current) input.current.value = ""; }
  }

  async function confirmar() {
    if (!podeImportar || ocupado || concluido) return;
    setOcupado(true);
    try {
      const resultado = await importar({ data: linhas });
      setConferencia(resultado.conferencia); setConcluido(true);
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(`${resultado.importados} usuário(s) importado(s). Defina as senhas no cadastro.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao importar usuários."); }
    finally { setOcupado(false); }
  }

  return <>
    <Button variant="outline" disabled={ocupado} onClick={() => baixar(false)}><Download className="mr-2 h-4 w-4" />Exportar Excel</Button>
    {podeImportar && <>
      <Button variant="outline" disabled={ocupado} onClick={() => baixar(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Planilha modelo</Button>
      <Button variant="outline" disabled={ocupado} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Importar usuários</Button>
      <input ref={input} type="file" className="hidden" accept=".xlsx,.csv" aria-label="Planilha de usuários" onChange={e => lerArquivo(e.target.files?.[0])} />
    </>}
    <Dialog open={aberto} onOpenChange={v => { if (!ocupado) setAberto(v); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>{concluido ? "Resultado da importação" : "Conferir usuários"}</DialogTitle><DialogDescription>Cadastros existentes e senhas são preservados. Novos usuários ficam sem senha até sua definição no cadastro.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">{novos} novos · {conferencia.filter(c => c.situacao === "Ignorado").length} ignorados · {conferencia.filter(c => c.situacao === "Erro").length} com erro</p>
        <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Nome / E-mail</TableHead><TableHead>Situação</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader><TableBody>{conferencia.map(c => <TableRow key={c.linha}><TableCell>{c.linha}</TableCell><TableCell className="break-all">{c.nome}<br />{c.email}</TableCell><TableCell>{concluido && c.situacao === "Novo" ? "Importado" : c.situacao}</TableCell><TableCell className="max-w-xs whitespace-normal">{c.motivo}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={ocupado} onClick={() => setAberto(false)}>{concluido ? "Fechar" : "Cancelar"}</Button>{!concluido && <Button disabled={ocupado || !novos || !podeImportar} onClick={confirmar}>{ocupado ? "Importando…" : `Importar ${novos} usuário(s)`}</Button>}</div>
      </DialogContent>
    </Dialog>
  </>;
}