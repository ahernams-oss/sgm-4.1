export interface TomadorBusca {
  id: string;
  nome?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  cpf?: string;
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function correspondeTomador(tomador: TomadorBusca, busca: string): boolean {
  const texto = normalizar(`${tomador.nome || ""} ${tomador.nomeFantasia || ""} ${tomador.razaoSocial || ""}`);
  const documentos = [tomador.cnpj, tomador.cpf].map(doc => (doc || "").replace(/\D/g, ""));
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (/^[\d\s./-]+$/.test(busca.trim())) {
    const numero = busca.replace(/\D/g, "");
    return !numero || documentos.some(doc => doc.includes(numero));
  }
  return termos.every(termo => texto.includes(termo) || (/^\d+$/.test(termo) && documentos.some(doc => doc.includes(termo))));
}