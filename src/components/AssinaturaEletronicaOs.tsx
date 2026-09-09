import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileSignature, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import {
  useOsAssinaturas,
  OsAssinatura,
  PapelOsAssinatura,
} from "@/contexts/OsAssinaturasContext";
import { usePermissao } from "@/hooks/usePermissao";
import { gerarHashOs, obterIpOrigem } from "@/lib/assinaturaHashOs";
import { purposeAssinatura, verificarTokenAssinatura } from "@/lib/otpAssinatura";
import { TokenAssinaturaEmail } from "@/components/TokenAssinaturaEmail";
import type { OrdemServico } from "@/contexts/OrdensServicoContext";

interface Props {
  os: Partial<OrdemServico> & { id?: string; numero?: number; clienteId?: string };
  papel: PapelOsAssinatura;
  assinaturaExistente?: OsAssinatura;
  onAssinado?: () => void;
}

const labelPapel = (p: PapelOsAssinatura) =>
  p === "solicitante"
    ? "Solicitante"
    : p === "fiscal"
    ? "Fiscal do Contrato 1"
    : p === "fiscal_2"
    ? "Fiscal do Contrato 2"
    : "Fiscal do Contrato 3";


const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AssinaturaEletronicaOs({
  os,
  papel,
  assinaturaExistente,
  onAssinado,
}: Props) {
  const { usuarioLogado, clientesPermitidosIds, temAcessoTotal } = useAuth();
  const { cargos } = useCargos();
  const { tem } = usePermissao();
  const { registrar } = useOsAssinaturas();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  // Regras de autorização para assinar
  // - Fiscal: requer permissão dedicada "os.assinar_fiscal"
  // - Solicitante: requer permissão "os.assinar_solicitante" + acesso ao cliente da OS
  const temAcessoAoCliente =
    temAcessoTotal ||
    !os.clienteId ||
    clientesPermitidosIds.includes(os.clienteId);

  const podeAssinar =
    papel === "solicitante"
      ? tem("os.assinar_solicitante") && temAcessoAoCliente
      : tem("os.assinar_fiscal");

  // ========== JÁ ASSINADO ==========
  if (assinaturaExistente) {
    const verifyUrl = `${window.location.origin}/verificar-assinatura/${assinaturaExistente.codigo_verificador}`;
    return (
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2 flex flex-row items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            {labelPapel(papel)} — Assinado Eletronicamente
          </CardTitle>
          <Badge
            variant="outline"
            className="ml-auto bg-green-100 text-green-800 border-green-300"
          >
            Válido
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Signatário:</span>{" "}
            {assinaturaExistente.signatario_nome}
          </p>
          {assinaturaExistente.signatario_cargo && (
            <p>
              <span className="font-semibold">Cargo:</span>{" "}
              {assinaturaExistente.signatario_cargo}
            </p>
          )}
          {assinaturaExistente.signatario_matricula && (
            <p>
              <span className="font-semibold">Matrícula:</span>{" "}
              {assinaturaExistente.signatario_matricula}
            </p>
          )}
          <p>
            <span className="font-semibold">Data/Hora:</span>{" "}
            {fmtDateTime(assinaturaExistente.signed_at)}
          </p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            {assinaturaExistente.base_legal}
          </p>
          <div className="border-t pt-2 mt-2">
            <p className="text-xs">
              <span className="font-semibold">Código verificador:</span>{" "}
              <code className="bg-muted px-1 rounded">
                {assinaturaExistente.codigo_verificador}
              </code>
            </p>
            <p className="text-xs break-all">
              <span className="font-semibold">Verifique em:</span>{" "}
              <a
                href={verifyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {verifyUrl}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ========== NÃO ASSINADO ==========
  const handleAssinar = async () => {
    if (!usuarioLogado) {
      toast.error("Usuário não autenticado.");
      return;
    }
    if (!os.id) {
      toast.error("Salve a OS antes de assiná-la.");
      return;
    }
    if (os.situacao !== "Validada") {
      toast.error("A OS precisa estar Validada para ser assinada.");
      return;
    }
    if (token.length !== 6) {
      toast.error("Informe o token de 6 dígitos enviado por e-mail.");
      return;
    }

    setLoading(true);
    try {
      const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
      if (!senhaOk) {
        toast.error("Senha incorreta. A autenticação falhou.");
        return;
      }

      const otp = await verificarTokenAssinatura({
        usuarioId: usuarioLogado.id,
        purpose: purposeAssinatura("os", os.id, papel),
        code: token,
      });
      if (!otp.success) {
        toast.error(otp.error || "Token inválido.");
        return;
      }

      const hash = await gerarHashOs(os);
      const ip = await obterIpOrigem();
      const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);

      const result = await registrar({
        os_id: os.id,
        os_numero: os.numero || 0,
        papel,
        signatario_user_id: usuarioLogado.id,
        signatario_nome: usuarioLogado.nome,
        signatario_email: usuarioLogado.email,
        signatario_cargo: cargo?.nome || "",
        signatario_matricula: usuarioLogado.matricula || "",
        hash_documento: hash,
        ip_origem: ip,
        user_agent: navigator.userAgent,
        metodo_autenticacao: "senha+otp_email",
        nivel_assinatura: "avancada",
      });

      if (result) {
        toast.success(
          `Documento assinado eletronicamente como ${labelPapel(papel)}.`
        );
        setOpen(false);
        setSenha("");
        setToken("");
        onAssinado?.();
      }

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "verifique se já existe assinatura deste papel.";
      toast.error(
        "Erro ao assinar: " + message
      );
    } finally {
      setLoading(false);
    }
  };

  const desabilitado = !os.id || os.situacao !== "Validada";

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{labelPapel(papel)}</CardTitle>
        </CardHeader>
        <CardContent>
          {!podeAssinar ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              {papel === "solicitante"
                ? "Você não possui acesso a este cliente para assinar como Solicitante."
                : "Você não possui permissão para assinar como Fiscal do Contrato."}
            </div>
          ) : (
            <Button
              onClick={() => setOpen(true)}
              disabled={desabilitado}
              variant="default"
            >
              <FileSignature className="h-4 w-4 mr-2" />
              Assinar Eletronicamente
            </Button>
          )}
          {desabilitado && podeAssinar && (
            <p className="text-xs text-muted-foreground mt-2">
              Salve a OS antes de assiná-la.
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
              Você está prestes a assinar eletronicamente a{" "}
              <strong>OS Nº {os.numero}</strong> como{" "}
              <strong>{labelPapel(papel)}</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p><strong>Signatário:</strong> {usuarioLogado?.nome}</p>
              <p><strong>E-mail:</strong> {usuarioLogado?.email}</p>
              <p className="italic text-muted-foreground mt-2">
                Assinatura eletrônica avançada (senha + token enviado por e-mail), nos termos do
                Art. 4º, II da Lei nº 14.063/2020. A operação será registrada com data, hora, IP,
                hash do documento e código verificador único.
              </p>
            </div>
            <div>
              <Label>Confirme sua senha para prosseguir</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>
            {usuarioLogado && os.id && (
              <TokenAssinaturaEmail
                usuarioId={usuarioLogado.id}
                purpose={purposeAssinatura("os", os.id, papel)}
                documento={`Ordem de Serviço nº ${os.numero || ""}`}
                papel={labelPapel(papel)}
                token={token}
                onTokenChange={setToken}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setSenha("");
                setToken("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleAssinar} disabled={loading || !senha || token.length !== 6}>
              {loading ? "Assinando..." : "Confirmar e Assinar"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
