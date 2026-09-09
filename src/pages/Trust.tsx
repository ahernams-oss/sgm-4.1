import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Database, Mail, FileCheck, AlertCircle } from "lucide-react";

export default function Trust() {
  useEffect(() => {
    document.title = "Central de Confiança - Lasant";
    const desc = "Práticas de segurança, privacidade e proteção de dados aplicadas pela Lasant no sistema corporativo.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + "/trust";
  }, []);

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-serif font-semibold">Central de Confiança</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Esta página é mantida pela Lasant para explicar como o sistema corporativo trata segurança,
            privacidade e dados. O conteúdo é editorial — não constitui certificação independente.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Acesso e Autenticação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>O acesso ao sistema requer credenciais individuais por usuário, com senhas armazenadas usando hash bcrypt.</p>
            <p>Perfis de acesso granulares controlam permissões por módulo. Tentativas de login são auditadas.</p>
            <p>Recuperação de senha via e-mail corporativo com token de uso único.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Plataforma e Hospedagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>O sistema é hospedado em infraestrutura gerenciada na nuvem com tráfego HTTPS/TLS criptografado em trânsito.</p>
            <p>Os dados são armazenados em banco PostgreSQL com criptografia em repouso fornecida pela plataforma.</p>
            <p>Backups automáticos são mantidos pela plataforma de hospedagem. Esta página descreve recursos habilitados — não certifica conformidade independente.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" /> Coleta e Uso de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>O sistema coleta apenas dados necessários à operação interna da Lasant (funcionários, clientes, fornecedores, obras, processos administrativos).</p>
            <p>Dados pessoais são utilizados exclusivamente para finalidades operacionais legítimas relacionadas ao vínculo com a empresa.</p>
            <p>Não há comercialização de dados a terceiros.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Subprocessadores e Integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>O sistema integra-se com serviços para envio de e-mails transacionais, mensagens WhatsApp (ChatPro) e emissão de notas fiscais eletrônicas.</p>
            <p>Cada integração processa apenas os dados estritamente necessários à finalidade do serviço.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" /> Retenção, Exclusão e Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Dados são retidos enquanto forem necessários para a operação da empresa ou exigidos por obrigação legal/fiscal.</p>
            <p>Solicitações relativas a dados pessoais (LGPD) podem ser direcionadas ao contato abaixo.</p>
            <p>Há mecanismo de opt-out para comunicações via e-mail.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Contato de Segurança e Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Para reportar vulnerabilidades, incidentes ou solicitações relativas a dados pessoais, entre em contato com a equipe responsável da Lasant pelos canais corporativos oficiais.</p>
            <p className="text-xs italic pt-2">Esta página descreve práticas e recursos habilitados atualmente. Não constitui declaração de conformidade auditada nem garantia absoluta de ausência de incidentes.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
