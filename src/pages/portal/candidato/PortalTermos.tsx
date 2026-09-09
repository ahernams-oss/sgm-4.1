import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

const CONSENTIMENTOS = [
  { key: "termos_uso", label: "Li e aceito os [Termos de Uso]." },
  { key: "aviso_privacidade", label: "Declaro que li e estou ciente do [Aviso de Privacidade]." },
  { key: "comunicacoes", label: "Autorizo o recebimento de comunicações, campanhas, pesquisas e novidades por e-mail, SMS, WhatsApp ou notificações do aplicativo." },
  { key: "biometria", label: "Autorizo o tratamento dos meus dados biométricos exclusivamente para registro da empresa." },
];

const TERMOS = [
  {
    tipo: "lgpd", titulo: "Termo LGPD - Consentimento",
    texto: `PRIVACIDADE E CONDIÇÕES DE USO

O SGM LASANT utiliza dados pessoais para:

* identificar e autenticar o usuário;

* administrar o acesso e as permissões;

* registrar solicitações, alterações, aprovações e demais atividades;

* prestar suporte técnico;

* prevenir fraudes e acessos não autorizados;

* cumprir obrigações legais, regulatórias e contratuais.

Poderão ser tratados dados de identificação, contato, vínculo profissional, registros de acesso, endereço IP, informações do dispositivo e dados inseridos pelo próprio usuário nas funcionalidades do sistema.

As informações completas sobre finalidades, bases legais, compartilhamentos, armazenamento, segurança e direitos dos titulares estão disponíveis no [Aviso de Privacidade].

Ao prosseguir, o sistema registrará a data, o horário, a identificação do usuário e a versão dos documentos apresentados.

Você poderá alterar estas preferências posteriormente nas configurações do aplicativo.`,
    consents: CONSENTIMENTOS,
  },
];

export default function PortalTermos() {
  const { logout } = usePortalAuth();
  const [assinados, setAssinados] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const load = () => portalCall<{ termos: any[] }>("termos-list").then((r) => setAssinados(r.termos));
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const jaAssinou = (tipo: string) => assinados.some((t) => t.tipo_termo === tipo);

  const allConsents = (t: typeof TERMOS[number]) => t.consents.every((c) => ativos[c.key]);

  const assinar = async (t: typeof TERMOS[number]) => {
    if (!allConsents(t)) return toast.error("Aceite todos os itens para prosseguir.");
    setLoading(true);
    try {
      const acceptedText = `${t.texto}\n\nAceites informados:\n${t.consents.map((c) => `☑ ${c.label}`).join("\n")}`;
      await portalCall("termo-assinar", { tipo_termo: t.tipo, versao_termo: "1.0", texto_aceite: acceptedText });
      toast.success("Termo assinado.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const handleSair = () => {
    logout();
    window.location.href = "/portal";
  };

  return (
    <PortalLayout requireTipo="candidato">
      <h1 className="text-2xl font-semibold mb-4">Termos e Documentos</h1>
      <div className="space-y-4">
        {TERMOS.map((t) => {
          const done = jaAssinou(t.tipo);
          return (
            <Card key={t.tipo}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t.titulo}</CardTitle>
                {done && <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Assinado</span>}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm bg-muted/50 p-3 rounded whitespace-pre-line">{t.texto}</p>

                {!done && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Para prosseguir, aceite os itens abaixo:</p>
                    <div className="space-y-2">
                      {t.consents.map((c) => (
                        <label key={c.key} className="flex items-start gap-3 text-sm cursor-pointer">
                          <Checkbox
                            checked={!!ativos[c.key]}
                            onCheckedChange={(v) => setAtivos({ ...ativos, [c.key]: !!v })}
                            className="mt-0.5"
                          />
                          <span className="leading-relaxed">{c.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={handleSair}>Sair</Button>
                      <Button className="w-full sm:w-auto" onClick={() => assinar(t)} disabled={loading || !allConsents(t)}>Aceitar e Prosseguir</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {assinados.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Comprovantes de Assinatura</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs font-mono">
            {assinados.map((a) => (
              <div key={a.id}>
                {a.tipo_termo} v{a.versao_termo} • {new Date(a.assinado_em).toLocaleString("pt-BR")} • HASH: {a.hash_sha256.slice(0, 16)}...
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
}
