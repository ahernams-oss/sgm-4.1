import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { DuplicateMatch, GroupedDuplicatePair } from "@/lib/duplicateDetection";

interface WarningProps<T> {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matches: DuplicateMatch<T>[];
  onConfirm: () => void;
  getCodigo?: (item: T) => string;
  getNome: (item: T) => string;
  entidade?: string;
}

/**
 * Dialog padrão para avisar sobre duplicidade "similar" e permitir
 * ao usuário confirmar o cadastro mesmo assim.
 */
export function DuplicateWarningDialog<T>({
  open,
  onOpenChange,
  matches,
  onConfirm,
  getCodigo,
  getNome,
  entidade = "registro",
}: WarningProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" /> Possível cadastro duplicado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Encontramos {matches.length} {entidade}(s) parecido(s) com o que você está cadastrando.
            Confira se não é a mesma coisa antes de confirmar.
          </p>
          <div className="border rounded-md divide-y max-h-64 overflow-auto">
            {matches.map((m, i) => {
              const cod = getCodigo?.(m.item);
              return (
                <div key={i} className="p-2 flex items-center justify-between text-sm">
                  <div>
                    {cod ? <Badge variant="outline" className="font-mono mr-2">{cod}</Badge> : null}
                    <span className="font-medium">{getNome(m.item)}</span>
                  </div>
                  <Badge variant={m.kind === "exato" ? "destructive" : "secondary"}>
                    {m.kind === "exato" ? "Idêntico" : `${Math.round(m.score * 100)}% similar`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onOpenChange(false); onConfirm(); }}>
            Cadastrar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AnalysisProps<T> {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  pairs: GroupedDuplicatePair<T>[];
  showContext?: boolean;
  getCodigo?: (item: T) => string;
  getNome: (item: T) => string;
}

/**
 * Dialog padrão para exibir análise completa de duplicidades
 * (pares detectados por scanDuplicatesGrouped).
 */
export function DuplicateAnalysisDialog<T>({
  open,
  onOpenChange,
  title,
  pairs,
  showContext = false,
  getCodigo,
  getNome,
}: AnalysisProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>
        {pairs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma duplicidade detectada. ✅</p>
        ) : (
          <div className="border rounded-md max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {showContext && <TableHead>Contexto</TableHead>}
                  <TableHead>Registro A</TableHead>
                  <TableHead>Registro B</TableHead>
                  <TableHead className="w-32 text-center">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.map((p, i) => {
                  const codA = getCodigo?.(p.a);
                  const codB = getCodigo?.(p.b);
                  return (
                    <TableRow key={i}>
                      {showContext && (
                        <TableCell className="text-xs text-muted-foreground">{p.contexto}</TableCell>
                      )}
                      <TableCell>
                        {codA ? <Badge variant="outline" className="font-mono mr-1">{codA}</Badge> : null}
                        {getNome(p.a)}
                      </TableCell>
                      <TableCell>
                        {codB ? <Badge variant="outline" className="font-mono mr-1">{codB}</Badge> : null}
                        {getNome(p.b)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.kind === "exato" ? "destructive" : "secondary"}>
                          {p.kind === "exato" ? `Idêntico (${p.campo})` : `${Math.round(p.score * 100)}%`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
