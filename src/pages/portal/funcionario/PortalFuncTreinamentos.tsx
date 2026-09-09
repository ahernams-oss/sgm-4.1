import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GraduationCap, CheckCircle2, Clock, ShieldCheck, FileDown } from "lucide-react";
import ValidacaoCertificadoDialog from "@/components/portal/ValidacaoCertificadoDialog";
import { baixarCertificadoTreinamento } from "@/lib/gerarPdfCertificadoTreinamento";

interface T {
  id: string;
  tipo: string;
  titulo: string;
  status: string;
  concluido_em: string | null;
  nota: number | null;
  created_at: string;
  assinado_em?: string | null;
  assinatura_hash?: string | null;
  assinatura_ip?: string | null;
  resp_assinado_em?: string | null;
  resp_assinante_nome?: string | null;
  resp_assinante_cargo?: string | null;
  resp_assinatura_hash?: string | null;
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function PortalFuncTreinamentos() {
  const { user } = usePortalAuth();
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [validarId, setValidarId] = useState<string | null>(null);

  useEffect(() => {
    portalCall<{ treinamentos: T[] }>("treinamentos-list")
      .then((r) => setList(r.treinamentos))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const baixar = async (t: T) => {
    try {
      await baixarCertificadoTreinamento({
        funcionario: user?.nome ?? "",
        cpf: user?.cpf ?? "",
        titulo: t.titulo,
        tipo: t.tipo,
        nota: t.nota != null ? String(t.nota) : null,
        concluidoEm: t.concluido_em,
        codigo: t.id.slice(0, 8).toUpperCase(),
        assinadoEm: t.assinado_em ?? null,
        assinaturaHash: t.assinatura_hash ?? null,
        assinaturaIp: t.assinatura_ip ?? null,
        respAssinadoEm: t.resp_assinado_em ?? null,
        respAssinanteNome: t.resp_assinante_nome ?? null,
        respAssinanteCargo: t.resp_assinante_cargo ?? null,
        respAssinaturaHash: t.resp_assinatura_hash ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar certificado.");
    }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <GraduationCap className="w-6 h-6" /> Treinamentos
      </h1>
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && list.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum treinamento registrado.</CardContent></Card>
      )}
      <div className="space-y-2">
        {list.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{t.titulo}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {t.tipo}
                  {t.concluido_em && <> · Concluído em {fmt(t.concluido_em)}</>}
                  {t.nota != null && <> · Nota {t.nota}</>}
                </div>
                {t.assinado_em && t.assinatura_hash && (
                  <div className="text-xs text-muted-foreground mt-1 break-all">
                    Validado eletronicamente em {fmt(t.assinado_em)} · SHA-256 {t.assinatura_hash.slice(0, 16)}...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {t.status === "concluido" ? (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Concluído
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pendente
                  </span>
                )}
                {t.status === "concluido" && !t.assinado_em && (
                  <Button size="sm" onClick={() => setValidarId(t.id)}>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Validar certificado
                  </Button>
                )}
                {t.status === "concluido" && t.assinado_em && (
                  <Button size="sm" variant="outline" onClick={() => baixar(t)}>
                    <FileDown className="w-4 h-4 mr-1" /> Baixar certificado
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ValidacaoCertificadoDialog
        open={!!validarId}
        onOpenChange={(v) => !v && setValidarId(null)}
        treinamentoId={validarId}
        titulo={list.find((t) => t.id === validarId)?.titulo}
        onValidado={(id, assinadoEm, hash) =>
          setList((prev) => prev.map((t) => (t.id === id ? { ...t, assinado_em: assinadoEm, assinatura_hash: hash } : t)))
        }
      />
    </PortalLayout>
  );
}
