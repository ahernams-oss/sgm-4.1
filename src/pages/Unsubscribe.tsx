import { useEffect, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MailX, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!res.ok) { setStatus("invalid"); return; }
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch { setStatus("invalid"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) { setStatus("error"); return; }
      if (data?.success) { setStatus("success"); }
      else if (data?.reason === "already_unsubscribed") { setStatus("already"); }
      else { setStatus("error"); }
    } catch { setStatus("error"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Verificando...</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold text-foreground">Cancelar inscrição</h2>
              <p className="text-muted-foreground text-sm">
                Deseja deixar de receber e-mails transacionais? Esta ação pode ser permanente.
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <h2 className="text-xl font-semibold text-foreground">Inscrição cancelada</h2>
              <p className="text-muted-foreground text-sm">
                Você não receberá mais e-mails deste tipo.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Já cancelado</h2>
              <p className="text-muted-foreground text-sm">
                Sua inscrição já foi cancelada anteriormente.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold text-foreground">Link inválido</h2>
              <p className="text-muted-foreground text-sm">
                Este link de cancelamento é inválido ou expirou.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold text-foreground">Erro</h2>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
