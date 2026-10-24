import municipios from "./data/municipios-ibge.json";

export class ErroMunicipioNfse extends Error {}

export function codigoMunicipioNfse(value: unknown): string | null {
  const codigo = String(value ?? "").trim();
  return /^[1-5]\d{6}$/.test(codigo) ? codigo : null;
}

const normalizar = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

// Resolve only exact city/UF matches; never substitute the service/provider municipality.
export async function resolverEnderecoMunicipioNfse(endereco: any, rotulo: string) {
  if (!endereco) throw new ErroMunicipioNfse(`Informe o endereço do ${rotulo}, incluindo cidade e UF.`);
  const existente = codigoMunicipioNfse(endereco.codigoMunicipio);
  if (existente) return { ...endereco, codigoMunicipio: existente };
  const uf = String(endereco.uf ?? "").trim().toUpperCase();
  const cidade = String(endereco.municipio ?? "").trim();
  if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf) || !cidade) {
    throw new ErroMunicipioNfse(`Informe cidade e UF no endereço do ${rotulo} para identificar o município IBGE.`);
  }
  const encontrados = municipios.filter(m => m[2] === uf && typeof m[1] === "string" && normalizar(m[1]) === normalizar(cidade) && codigoMunicipioNfse(m[0]));
  const encontrado = encontrados[0];
  if (encontrados.length !== 1 || !encontrado) throw new ErroMunicipioNfse(`Município do ${rotulo} não encontrado na tabela IBGE. Confira cidade e UF do endereço.`);
  return { ...endereco, uf, municipio: encontrado[1], codigoMunicipio: encontrado[0] };
}