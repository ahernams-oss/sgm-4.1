import { useState } from "react";
import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileSignature, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import { useLaudosAssinaturas, type LaudoAssinatura } from "@/contexts/LaudosAssinaturasContext";
import { gerarHashLaudo, obterIpOrigem } from "@/lib/assinaturaHashLaudo";
import type { LaudoCondenacao } from "@/contexts/LaudosCondenacaoContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";

interface Props {
  laudo: Partial<LaudoCondenacao> & { id?: string; numero?: number };
  assinaturaExistente?: LaudoAssinatura;
  onAssinado?: () => void;
}

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export function AssinaturaEletronicaLaudo({ laudo, assinaturaExistente, onAssinado }: Props) {
  const { usuarioLogado } = useAuth();
  const { cargos } = useCargos();
  const { registrar, remover } = useLaudosAssinaturas();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  // ========== JÁ ASSINADO ==========
  if (assinaturaExistente) {
    const verifyUrl = `${window.location.origin}/verificar-assinatura/${assinaturaExistente.codigo_verificador}`;
    return (
      <>
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Responsável Técnico — Assinado Eletronicamente</CardTitle>
            <Badge variant="outline" className="ml-auto bg-green-100 text-green-800 border-green-300">Válido</Badge>
            <Button size="icon" variant="ghost" onClick={() => requestDelete(assinaturaExistente.id)} title="Remover assinatura">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="font-semibold">Signatário:</span> {assinaturaExistente.signatario_nome}</p>
            {assinaturaExistente.signatario_cargo && (
              <p><span className="font-semibold">Cargo:</span> {assinaturaExistente.signatario_cargo}</p>
            )}
            {assinaturaExistente.responsavel_tecnico_nome && (
              <p><span className="font-semibold">Responsável Técnico:</span> {assinaturaExistente.responsavel_tecnico_nome}
                {assinaturaExistente.responsavel_tecnico_registro ? ` (${assinaturaExistente.responsavel_tecnico_registro})` : ""}
              </p>
            )}
            <p><span className="font-semibold">Data/Hora:</span> {fmtDateTime(assinaturaExistente.signed_at)}</p>
            <p className="text-xs text-muted-foreground mt-2 italic">{assinaturaExistente.base_legal}</p>
            <div className="border-t pt-2 mt-2">
              <p className="text-xs">
                <span className="font-semibold">Código verificador:</span>{" "}
                <code className="bg-muted px-1 rounded">{assinaturaExistente.codigo_verificador}</code>
              </p>
              <p className="text-xs break-all">
                <span className="font-semibold">Verifique em:</span>{" "}
                <a href={verifyUrl} target="_blank" rel="noreferrer" className="text-primary underline">{verifyUrl}</a>
              </p>
            </div>
          </CardContent>
        </Card>
        <DoubleConfirmDelete
          open={!!deleteId}
          onOpenChange={(o) => { if (!o) cancelDelete(); }}
          onConfirm={async () => {
            if (deleteId) {
              const ok = await remover(deleteId);
              if (ok) { toast.success("Assinatura removida."); onAssinado?.(); }
            }
          }}
        />
      </>
    );
  }

  // ========== NÃO ASSINADO ==========
  const handleAssinar = async () => {
    if (!usuarioLogado) { toast.error("Usuário não autenticado."); return; }
    if (!laudo.id) { toast.error("Salve o laudo antes de assiná-lo."); return; }
    if (laudo.parecer !== "APROVADO PARA CONDENAÇÃO" && laudo.parecer !== "REPROVADO") {
      toast.error("Informe o parecer técnico antes de assinar."); return;
    }
    const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
    if (!senhaOk) { toast.error("Senha incorreta. A autenticação falhou."); return; }

    setLoading(true);
    try {
      const hash = await gerarHashLaudo(laudo as LaudoCondenacao);
      const ip = await obterIpOrigem();
      const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);

      const result = await registrar({
        laudo_id: laudo.id,
        laudo_numero: laudo.numero || 0,
        papel: "responsavel_tecnico",
        signatario_user_id: usuarioLogado.id,
        signatario_nome: usuarioLogado.nome,
        signatario_email: usuarioLogado.email,
        signatario_cargo: cargo?.nome || "",
        signatario_matricula: usuarioLogado.matricula || "",
        responsavel_tecnico_nome: laudo.responsavel_tecnico || "",
        responsavel_tecnico_registro: laudo.registro_profissional || "",
        hash_documento: hash,
        ip_origem: ip,
        user_agent: navigator.userAgent,
      });

      if (result) {
        toast.success("Laudo assinado eletronicamente.");
        setOpen(false);
        setSenha("");
        onAssinado?.();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      toast.error("Erro ao assinar: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const desabilitado = !laudo.id || !laudo.parecer;

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assinatura Eletrônica do Responsável Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)} disabled={desabilitado} variant="default">
            <FileSignature className="h-4 w-4 mr-2" />Assinar Eletronicamente
          </Button>
          {desabilitado && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Salve o laudo e informe o parecer técnico antes de assiná-lo.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação de Assinatura Eletrônica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você está prestes a assinar eletronicamente o{" "}
              <strong>Laudo de Condenação Nº {laudo.numero}</strong> como <strong>Responsável Técnico</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p><strong>Signatário:</strong> {usuarioLogado?.nome}</p>
              <p><strong>E-mail:</strong> {usuarioLogado?.email}</p>
              {laudo.responsavel_tecnico && (
                <p><strong>Responsável Técnico do laudo:</strong> {laudo.responsavel_tecnico}
                  {laudo.registro_profissional ? ` — ${laudo.registro_profissional}` : ""}
                </p>
              )}
              <p className="italic text-muted-foreground mt-2">
                Esta assinatura tem valor jurídico conforme Lei nº 14.063/2020. A operação será
                registrada com data, hora, IP e código verificador único, protegida por hash SHA-256.
              </p>
            </div>
            <div>
              <Label>Confirme sua senha para prosseguir</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                onKeyDown={(e) => e.key === "Enter" && handleAssinar()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setSenha(""); }}>Cancelar</Button>
            <Button onClick={handleAssinar} disabled={loading || !senha}>
              {loading ? "Assinando..." : "Confirmar e Assinar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
