import { useEffect, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

// A tipagem beta de `supabase.auth.oauth` ainda não é exposta pelo SDK.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const carregarDetalhes = async () => {
    const { data, error: err } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (err) {
      setError(err.message);
      return;
    }
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) {
      window.location.href = imediato;
      return;
    }
    setDetails(data);
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        setCarregando(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!ativo) return;
      if (!sess.session) {
        setCarregando(false);
        return;
      }
      setSessionEmail(sess.session.user.email ?? null);
      await carregarDetalhes();
      if (ativo) setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationId]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Usa o mesmo login do SGM (edge function auth-login), que valida a senha
    // na tabela de usuários e emite um token de sessão do provedor de autenticação.
    const { data: loginData, error: loginErr } = await supabase.functions.invoke("auth-login", {
      body: { email: email.trim().toLowerCase(), senha },
    });
    if (loginErr || !loginData?.tokenHash) {
      setError("E-mail ou senha inválidos.");
      setBusy(false);
      return;
    }
    const { data, error: err } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: loginData.tokenHash,
    });
    if (err || !data.session) {
      setError(err?.message ?? "Não foi possível entrar.");
      setBusy(false);
      return;
    }
    setSessionEmail(data.session.user.email ?? loginData.email ?? null);
    await carregarDetalhes();
    setBusy(false);
  };

  const decidir = async (aprovar: boolean) => {
    setBusy(true);
    setError(null);
    const { data, error: err } = aprovar
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setError("O servidor de autorização não retornou um redirecionamento.");
      setBusy(false);
      return;
    }
    window.location.href = destino;
  };

  const nomeCliente = details?.client?.name ?? "o aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">Autorização de acesso</span>
          </div>
          <CardTitle className="text-xl">
            {details ? `Conectar ${nomeCliente} ao Lasant SGM 4.0` : "Lasant SGM 4.0"}
          </CardTitle>
          <CardDescription>
            {details
              ? `Isso permite que ${nomeCliente} use as ferramentas deste app em seu nome.`
              : "Entre com sua conta para continuar a autorização."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {carregando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}

          {!carregando && !sessionEmail && authorizationId && (
            <form onSubmit={entrar} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="oauth-email">E-mail</Label>
                <Input
                  id="oauth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oauth-senha">Senha</Label>
                <Input
                  id="oauth-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar e continuar
              </Button>
            </form>
          )}

          {!carregando && sessionEmail && details && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Conta: </span>
                  <span className="font-medium">{sessionEmail}</span>
                </p>
                {details?.client?.redirect_uri && (
                  <p className="break-all">
                    <span className="text-muted-foreground">Redirecionamento: </span>
                    {details.client.redirect_uri}
                  </p>
                )}
                {details?.scope && (
                  <p>
                    <span className="text-muted-foreground">Escopos: </span>
                    {String(details.scope)}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Isso não ignora as permissões nem as políticas de segurança do SGM.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => decidir(true)}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aprovar
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decidir(false)}>
                  Cancelar conexão
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
