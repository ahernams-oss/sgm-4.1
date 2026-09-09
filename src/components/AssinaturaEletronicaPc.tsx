import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import { usePcAssinaturas } from "@/contexts/PcAssinaturasContext";
import { gerarHashPc } from "@/lib/assinaturaHashPc";
import { obterIpOrigem } from "@/lib/assinaturaHashOs";
import type { PedidoCompra } from "@/contexts/PedidoCompraContext";

interface Props {
  pedido: PedidoCompra;
  onAssinado?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  fullLabel?: boolean;
}

export function AssinaturaEletronicaPc({ pedido, onAssinado, variant = "default", size = "sm", label = "Assinar", fullLabel = false }: Props) {
  const { usuarioLogado } = useAuth();
  const { cargos } = useCargos();
  const { registrar } = usePcAssinaturas();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssinar = async () => {
    if (!usuarioLogado) {
      toast.error("Usuário não autenticado.");
      return;
    }
    const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
    if (!senhaOk) {
      toast.error("Senha incorreta.");
      return;
    }
    setLoading(true);
    try {
      const hash = await gerarHashPc(pedido);
      const ip = await obterIpOrigem();
      const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);

      const result = await registrar({
        pedido_id: pedido.id,
        pedido_numero: pedido.numero,
        papel: "aprovador",
        signatario_user_id: usuarioLogado.id,
        signatario_nome: usuarioLogado.nome,
        signatario_email: usuarioLogado.email,
        signatario_cargo: cargo?.nome || "",
        signatario_matricula: usuarioLogado.matricula || "",
        hash_documento: hash,
        ip_origem: ip,
        user_agent: navigator.userAgent,
      });

      if (result) {
        toast.success("Ordem de Compra assinada eletronicamente.");
        setOpen(false);
        setSenha("");
        onAssinado?.();
      } else {
        toast.error("Já existe uma assinatura registrada para este pedido.");
      }
    } catch (e: unknown) {
      toast.error("Erro ao assinar: " + (e instanceof Error ? e.message : "tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant={variant} size={size}>
        <FileSignature className="h-4 w-4 mr-1" />
        {fullLabel ? "Assinar Eletronicamente" : label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura Eletrônica do Aprovador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você está prestes a assinar eletronicamente a{" "}
              <strong>Ordem de Compra OC-{String(pedido.numero).padStart(4, "0")}</strong> como{" "}
              <strong>Aprovador</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p><strong>Signatário:</strong> {usuarioLogado?.nome}</p>
              <p><strong>E-mail:</strong> {usuarioLogado?.email}</p>
              <p className="italic text-muted-foreground mt-2">
                Esta assinatura tem valor jurídico conforme LEI Nº 14.063, DE 23 DE
                SETEMBRO DE 2020. A operação será registrada com data, hora, IP e
                código verificador único.
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setSenha(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleAssinar} disabled={loading || !senha}>
              {loading ? "Assinando..." : "Confirmar e Assinar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
