import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEstoque } from "@/contexts/EstoqueContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { useToast } from "@/hooks/use-toast";
import type { RequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import type { CotacaoCompras } from "@/contexts/CotacaoComprasContext";
import { validarTransferencia, type ItemTransferencia } from "@/lib/transferenciaEstoque";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Transferencia {
  id: string; status: string; local_destino: string; itens: ItemTransferencia[];
  solicitante: string | null; aprovador: string | null; created_at: string; motivo_decisao: string | null;
}

const db = supabase as any;

export default function TransferenciaEstoqueDialog({ open, onOpenChange, cotacao, requisicao }: {
  open: boolean; onOpenChange: (v: boolean) => void; cotacao: CotacaoCompras | null; requisicao: RequisicaoCompras | null;
}) {
  const { getSaldos, getSaldoPorLocal, transferirEntreLocais } = useEstoque();
  const { usuarioLogado } = useAuth();
  const { tem } = usePermissao();
  const podeAprovar = tem("cotacoes.aprovar_transferencia");
  const { toast } = useToast();
  const qc = useQueryClient();
  const qk = ["estoque_transferencias", cotacao?.id];

  const { data: transferencias = [] } = useQuery({
    enabled: open && !!cotacao,
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await db.from("estoque_transferencias").select("*").eq("cotacao_id", cotacao!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transferencia[];
    },
  });

  const saldos = useMemo(() => getSaldos().filter(s => s.quantidade > 0), [getSaldos]);
  const locaisConhecidos = useMemo(() => Array.from(new Set(saldos.map(s => s.local).filter(Boolean))).sort(), [saldos]);
  const [destino, setDestino] = useState("");
  const [linhas, setLinhas] = useState<Record<string, { origem: string; qtd: string }>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) { setDestino(requisicao?.localEntrega ?? ""); setLinhas({}); } }, [open, requisicao]);

  const itensRc = (requisicao?.itens ?? []).filter(i => i.materialId);

  const solicitar = async () => {
    if (!cotacao || !requisicao) return;
    const itens: ItemTransferencia[] = itensRc.flatMap(i => {
      const l = linhas[i.id]; const q = Number(String(l?.qtd ?? "").replace(",", "."));
      if (!l || !q) return [];
      const s = saldos.find(x => x.materialId === i.materialId);
      return [{ materialId: i.materialId, materialCodigo: s?.materialCodigo ?? "", materialDescricao: i.descricao, unidadeMedida: i.unidadeMedida, localOrigem: l.origem, quantidade: q }];
    });
    const erros = validarTransferencia(itens, destino.trim(), getSaldoPorLocal);
    if (erros.length) { toast({ title: "Verifique a transferência", description: erros.join(" "), variant: "destructive" }); return; }
    setSalvando(true);
    const { error } = await db.from("estoque_transferencias").insert({
      cotacao_id: cotacao.id, cotacao_numero: cotacao.numero, requisicao_id: requisicao.id, requisicao_numero: requisicao.numero,
      local_destino: destino.trim(), itens, solicitante: usuarioLogado?.nome ?? "",
    });
    setSalvando(false);
    if (error) { toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Transferência enviada para aprovação" });
    setLinhas({});
    qc.invalidateQueries({ queryKey: qk });
  };

  const decidir = async (t: Transferencia, aprovar: boolean) => {
    if (!podeAprovar) return;
    let motivo: string | null = null;
    if (!aprovar) { motivo = window.prompt("Motivo da rejeição:") ?? null; if (motivo === null) return; }
    setSalvando(true);
    try {
      if (aprovar) {
        const erros = validarTransferencia(t.itens, t.local_destino, getSaldoPorLocal);
        if (erros.length) throw new Error(erros.join(" "));
        // Marca como aprovada antes de mover: o banco recusa se o usuário não tiver permissão.
        const { error } = await db.from("estoque_transferencias").update({ status: "Aprovada", aprovador: usuarioLogado?.nome ?? "" }).eq("id", t.id).eq("status", "Pendente");
        if (error) throw error;
        for (const i of t.itens) {
          await transferirEntreLocais({
            materialId: i.materialId, materialCodigo: i.materialCodigo, materialDescricao: i.materialDescricao, quantidade: i.quantidade,
            localOrigem: i.localOrigem, localDestino: t.local_destino, usuario: usuarioLogado?.nome ?? "",
            observacao: `Transferência aprovada — COT-${String(cotacao?.numero ?? "").padStart(4, "0")}`,
          });
        }
      } else {
        const { error } = await db.from("estoque_transferencias").update({ status: "Rejeitada", aprovador: usuarioLogado?.nome ?? "", motivo_decisao: motivo }).eq("id", t.id).eq("status", "Pendente");
        if (error) throw error;
      }
      toast({ title: aprovar ? "Transferência aprovada e estoque movimentado" : "Transferência rejeitada" });
    } catch (e: any) {
      toast({ title: "Não foi possível concluir", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSalvando(false);
      qc.invalidateQueries({ queryKey: qk });
    }
  };

  const corStatus = (s: string) => s === "Aprovada" ? "default" : s === "Rejeitada" ? "destructive" : "secondary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />Transferir do estoque</DialogTitle>
          <DialogDescription>Atenda itens da RC-{String(requisicao?.numero ?? "").padStart(4, "0")} com material já em estoque, sem comprar. A transferência só movimenta o estoque após aprovação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Local de destino</Label>
            <Input list="locais-estoque" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex.: Almoxarifado da obra" />
            <datalist id="locais-estoque">{locaisConhecidos.map(l => <option key={l} value={l} />)}</datalist>
          </div>
          <div className="rounded-md border divide-y">
            {itensRc.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum item desta requisição está ligado a um material cadastrado.</p>}
            {itensRc.map(i => {
              const locais = saldos.filter(s => s.materialId === i.materialId && s.local !== destino.trim());
              const l = linhas[i.id] ?? { origem: "", qtd: "" };
              const set = (p: Partial<typeof l>) => setLinhas(prev => ({ ...prev, [i.id]: { ...l, ...p } }));
              return (
                <div key={i.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_220px_110px] sm:items-end">
                  <div className="text-sm"><div className="font-medium">{i.descricao}</div><div className="text-xs text-muted-foreground">Pedido: {i.quantidade} {i.unidadeMedida}</div></div>
                  {locais.length ? (
                    <Select value={l.origem} onValueChange={v => set({ origem: v })}>
                      <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                      <SelectContent>{locais.map(s => <SelectItem key={s.local} value={s.local}>{s.local || "Sem local"} ({s.quantidade})</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-xs text-muted-foreground">Sem estoque em outro local</span>}
                  <Input inputMode="decimal" placeholder="Qtd." disabled={!locais.length} value={l.qtd} onChange={e => set({ qtd: e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={solicitar} disabled={salvando || !itensRc.length}>Enviar para aprovação</Button>
        </DialogFooter>

        <div className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-semibold">Transferências desta cotação</h4>
          {transferencias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma transferência solicitada.</p>}
          {transferencias.map(t => (
            <div key={t.id} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Para <b>{t.local_destino}</b> · por {t.solicitante || "-"} em {new Date(t.created_at).toLocaleString("pt-BR")}</span>
                <Badge variant={corStatus(t.status) as any}>{t.status}</Badge>
              </div>
              <ul className="text-xs text-muted-foreground">
                {t.itens.map((i, k) => <li key={k}>{i.materialDescricao}: {i.quantidade} {i.unidadeMedida} de {i.localOrigem}</li>)}
              </ul>
              {t.aprovador && <div className="text-xs">Decisão: {t.aprovador}{t.motivo_decisao ? ` — ${t.motivo_decisao}` : ""}</div>}
              {t.status === "Pendente" && podeAprovar && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={salvando} onClick={() => decidir(t, true)}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                  <Button size="sm" variant="outline" disabled={salvando} onClick={() => decidir(t, false)}><X className="mr-1 h-4 w-4" />Rejeitar</Button>
                </div>
              )}
              {t.status === "Pendente" && !podeAprovar && <div className="text-xs text-muted-foreground">Aguardando aprovação.</div>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
