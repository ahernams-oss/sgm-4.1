import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { enviarTokenAssinatura } from "@/lib/otpAssinatura";

interface Props {
  usuarioId: string;
  purpose: string;
  documento: string;
  papel: string;
  token: string;
  onTokenChange: (v: string) => void;
  onEnviar?: () => void;
  disabled?: boolean;
}

/**
 * Bloco reutilizável do 2º fator de autenticação (token por e-mail)
 * usado nas assinaturas eletrônicas avançadas.
 */
export function TokenAssinaturaEmail({
  usuarioId, purpose, documento, papel, token, onTokenChange, onEnviar, disabled,
}: Props) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [mascara, setMascara] = useState("");

  const enviar = async () => {
    setEnviando(true);
    const r = await enviarTokenAssinatura({ usuarioId, purpose, documento, papel });
    setEnviando(false);
    if (!r.success) {
      toast.error(r.error || "Não foi possível enviar o token por e-mail.");
      return;
    }
    setEnviado(true);
    setMascara(r.email_mascarado || "");
    toast.success(`Token enviado para ${r.email_mascarado || "seu e-mail"}.`);
    onEnviar?.();
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> Token de verificação por e-mail
        </Label>
        <Button type="button" size="sm" variant={enviado ? "outline" : "secondary"} onClick={enviar} disabled={enviando || disabled}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : enviado ? "Reenviar token" : "Enviar token"}
        </Button>
      </div>
      {enviado && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          Código de 6 dígitos enviado para {mascara}. Válido por 10 minutos.
        </p>
      )}
      <Input
        inputMode="numeric"
        maxLength={6}
        placeholder="Digite o código de 6 dígitos"
        value={token}
        onChange={(e) => onTokenChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="tracking-[0.4em] text-center font-mono"
      />
    </div>
  );
}
