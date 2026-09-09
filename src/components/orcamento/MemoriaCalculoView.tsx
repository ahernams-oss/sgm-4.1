import { Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ImagensSubItem from "./ImagensSubItem";

type Tipo = "area" | "mao_de_obra" | "unidade";

const UNIDADE_LABEL: Record<Tipo, string> = {
  area: "ÁREA",
  mao_de_obra: "TOTAL (h)",
  unidade: "QTD (un)",
};

const UNIDADE_CURTA: Record<Tipo, string> = {
  area: "m²",
  mao_de_obra: "h",
  unidade: "un",
};

const TIPO_LABEL: Record<Tipo, string> = {
  area: "Área",
  mao_de_obra: "Mão de obra",
  unidade: "Unidade",
};

/** Entradas (setores) de uma linha, com compatibilidade com o formato antigo. */
function getEntradas(l: any): any[] {
  if (Array.isArray(l?.entradas) && l.entradas.length) return l.entradas;
  return [{
    setor: l?.setor || "",
    funcionario: l?.funcionario,
    quantidade: l?.quantidade,
    comprimento: l?.comprimento,
    largura: l?.largura,
    altura: l?.altura,
    hrDia: l?.hrDia,
    dias: l?.dias,
  }];
}

function calcEntrada(tipo: Tipo, e: any): number {
  if (tipo === "area") {
    const alt = Number(e.altura) || 0;
    return (Number(e.quantidade) || 0) * (Number(e.comprimento) || 0) * (Number(e.largura) || 0) * (alt > 0 ? alt : 1);
  }
  if (tipo === "mao_de_obra") return (Number(e.hrDia) || 0) * (Number(e.dias) || 0);
  return Number(e.quantidade) || 0;
}

function calcLinha(tipo: Tipo, l: any): number {
  return getEntradas(l).reduce((s, e) => s + calcEntrada(tipo, e), 0);
}

const unidadeLinha = (l: any, t: Tipo) => (l?.unidade || "").trim() || UNIDADE_CURTA[t];

const nf = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MemoriaCalculoView({ grupos }: { grupos: any[] }) {
  const lista = Array.isArray(grupos) ? grupos : [];

  if (!lista.length) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma memória de cálculo cadastrada neste orçamento.</p>;
  }

  return (
    <div className="space-y-4">
      {lista.map((g: any, gi: number) => {
        const tipoGrupo: Tipo = (g.tipo || "unidade") as Tipo;
        const linhas: any[] = Array.isArray(g.linhas) ? g.linhas : [];
        const tipoDe = (l: any): Tipo => ((l?.tipo || tipoGrupo) as Tipo);
        const tipos = linhas.length ? linhas.map(tipoDe) : [tipoGrupo];
        const hasArea = tipos.includes("area");
        const hasMo = tipos.includes("mao_de_obra");
        const hasQtd = hasArea || tipos.includes("unidade");
        const uniforme = tipos.every(t => t === tipos[0]) ? tipos[0] : null;
        const m = (hasQtd ? 1 : 0) + (hasArea ? 3 : 0) + (hasMo ? 3 : 0);

        const porTipo = new Map<Tipo, number>();
        linhas.forEach(l => {
          const t = tipoDe(l);
          porTipo.set(t, (porTipo.get(t) || 0) + calcLinha(t, l));
        });
        const linhasTotal: [Tipo, number][] = porTipo.size ? Array.from(porTipo) : [[tipoGrupo, 0]];

        return (
          <div key={gi} className="border rounded-md overflow-x-auto">
            <div className="bg-muted px-3 py-2 text-xs font-semibold">
              {g.item ? `${g.item} - ` : ""}{g.titulo || "SEM TÍTULO"}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ITEM</TableHead>
                  <TableHead className="text-xs">CÓDIGO</TableHead>
                  <TableHead className="text-xs">DESCRIÇÃO</TableHead>
                  <TableHead className="text-xs">TIPO</TableHead>
                  <TableHead className="text-xs">SETOR</TableHead>
                  {hasMo && (
                    <>
                      <TableHead className="text-xs">FUNCIONÁRIO</TableHead>
                      <TableHead className="text-xs text-right">HR/DIA</TableHead>
                      <TableHead className="text-xs text-right">DIAS</TableHead>
                    </>
                  )}
                  {hasQtd && <TableHead className="text-xs text-right">QUANT.</TableHead>}
                  {hasArea && (
                    <>
                      <TableHead className="text-xs text-right">COMP.</TableHead>
                      <TableHead className="text-xs text-right">LARG.</TableHead>
                      <TableHead className="text-xs text-right">ALT.</TableHead>
                    </>
                  )}
                  <TableHead className="text-xs text-right">{uniforme ? UNIDADE_LABEL[uniforme] : "TOTAL"}</TableHead>
                  <TableHead className="text-xs">UN.</TableHead>
                  <TableHead className="text-xs">IMAGENS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l: any, li: number) => {
                  const tipo = tipoDe(l);
                  const entradas = getEntradas(l);
                  const rows = entradas.map((e: any, ei: number) => (
                    <TableRow key={`${li}-${ei}`}>
                      {ei === 0 && (
                        <>
                          <TableCell rowSpan={entradas.length} className="text-xs align-top">{l.item || ""}</TableCell>
                          <TableCell rowSpan={entradas.length} className="text-xs font-mono align-top">{l.codigo || ""}</TableCell>
                          <TableCell rowSpan={entradas.length} className="text-xs align-top">{l.descricao || ""}</TableCell>
                          <TableCell rowSpan={entradas.length} className="text-xs align-top">{TIPO_LABEL[tipo]}</TableCell>
                        </>
                      )}
                      <TableCell className="text-xs">{e.setor || ""}</TableCell>
                      {hasMo && (
                        <>
                          <TableCell className="text-xs">{tipo === "mao_de_obra" ? (e.funcionario || "") : ""}</TableCell>
                          <TableCell className="text-xs text-right">{tipo === "mao_de_obra" ? nf(Number(e.hrDia) || 0) : ""}</TableCell>
                          <TableCell className="text-xs text-right">{tipo === "mao_de_obra" ? nf(Number(e.dias) || 0) : ""}</TableCell>
                        </>
                      )}
                      {hasQtd && (
                        <TableCell className="text-xs text-right">
                          {tipo === "mao_de_obra" ? "" : nf(Number(e.quantidade) || 0)}
                        </TableCell>
                      )}
                      {hasArea && (
                        <>
                          <TableCell className="text-xs text-right">{tipo === "area" ? nf(Number(e.comprimento) || 0) : ""}</TableCell>
                          <TableCell className="text-xs text-right">{tipo === "area" ? nf(Number(e.largura) || 0) : ""}</TableCell>
                          <TableCell className="text-xs text-right">{tipo === "area" ? nf(Number(e.altura) || 0) : ""}</TableCell>
                        </>
                      )}
                      <TableCell className="text-xs text-right font-medium">{nf(calcEntrada(tipo, e))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{unidadeLinha(l, tipo)}</TableCell>
                      {ei === 0 && (
                        <TableCell rowSpan={entradas.length} className="align-top">
                          <ImagensSubItem imagens={Array.isArray(l.imagens) ? l.imagens : []} readOnly onChange={() => {}}
                            titulo={`${l.item || ""} ${l.descricao || ""}`.trim()} />
                        </TableCell>
                      )}
                    </TableRow>
                  ));
                  return (
                    <Fragment key={li}>
                      {rows}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5 + m} className="text-xs text-right font-semibold">
                          SUBTOTAL{l.item ? ` ITEM ${l.item}` : " DO ITEM"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold">{nf(calcLinha(tipo, l))}</TableCell>
                        <TableCell className="text-xs font-semibold">{unidadeLinha(l, tipo)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </Fragment>
                  );
                })}
                {linhasTotal.map(([t, v], i) => (
                  <TableRow key={`total-${t}`} className="bg-muted/50">
                    <TableCell className="text-xs font-bold">{i === 0 ? "TOTAL" : ""}</TableCell>
                    <TableCell colSpan={4 + m} className="text-xs text-right font-semibold">
                      {linhasTotal.length > 1 ? UNIDADE_LABEL[t] : ""}
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{nf(v)}</TableCell>
                    <TableCell className="text-xs font-semibold">{UNIDADE_CURTA[t]}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
