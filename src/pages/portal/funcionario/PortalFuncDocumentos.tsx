import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function PortalFuncDocumentos() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    portalCall("func-documentos").then(setData).catch((e) => toast.error(e.message));
  }, []);

  if (!data) return <PortalLayout requireTipo="funcionario"><p className="text-sm text-muted-foreground">Carregando...</p></PortalLayout>;
  const f = data.funcionario || {};
  const exames = data.exames || [];

  const Field = ({ l, v }: { l: string; v: any }) => (
    <div><div className="text-xs text-muted-foreground">{l}</div><div className="text-sm">{v ?? "—"}</div></div>
  );

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-2xl font-semibold mb-4">Meus Documentos</h1>
      <Card className="mb-4">
        <CardHeader><CardTitle>Dados Cadastrais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field l="Nome" v={f.nome} /><Field l="CPF" v={f.cpf} /><Field l="RG" v={f.rg} />
          <Field l="Data Nasc." v={f.data_nascimento} /><Field l="Admissão" v={f.data_admissao} />
          <Field l="Cargo" v={f.cargo_id} /><Field l="E-mail" v={f.email} /><Field l="Telefone" v={f.telefone} />
          <Field l="Endereço" v={`${f.logradouro || ""}, ${f.numero || ""} - ${f.bairro || ""} - ${f.cidade || ""}/${f.uf || ""}`} />
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader><CardTitle>Conselho de Classe</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field l="Conselho" v={f.conselho_classe} />
          <Field l="Nº de Registro" v={f.conselho_numero} />
          <Field l="Data de Expedição" v={f.conselho_data_expedicao} />
          <Field l="UF de Expedição" v={f.conselho_uf} />
          <div className="col-span-2 md:col-span-4">
            <div className="text-xs text-muted-foreground mb-1">Documentos anexados</div>
            {(f.conselho_anexos || []).length === 0
              ? <div className="text-sm">—</div>
              : <ul className="text-sm list-disc pl-5">{(f.conselho_anexos || []).map((a: any) => <li key={a.id}>{a.nome}</li>)}</ul>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Exames ASO</CardTitle></CardHeader>
        <CardContent>
          {exames.length === 0 && <p className="text-sm text-muted-foreground">Nenhum exame registrado.</p>}
          <div className="space-y-2">
            {exames.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="text-sm font-medium">{e.tipo_exame ?? e.tipo}</div>
                  <div className="text-xs text-muted-foreground">Data: {e.data_exame} • Validade: {e.validade}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-muted">{e.resultado ?? e.status ?? "—"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
