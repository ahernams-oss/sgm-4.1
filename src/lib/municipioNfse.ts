export function codigoMunicipioNfse(value: unknown): string | null {
  const codigo = String(value ?? "").trim();
  return /^[1-5]\d{6}$/.test(codigo) ? codigo : null;
}

const normalizar = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

// Resolve only exact city/UF matches; never substitute the service/provider municipality.
export async function resolverEnderecoMunicipioNfse(endereco: any, rotulo: string, consultar: typeof fetch = fetch) {
  if (!endereco) throw new Error(`Informe o endereço do ${rotulo}, incluindo cidade e UF.`);
  const existente = codigoMunicipioNfse(endereco.codigoMunicipio);
  if (existente) return { ...endereco, codigoMunicipio: existente };
  const uf = String(endereco.uf ?? "").trim().toUpperCase();
  const cidade = String(endereco.municipio ?? "").trim();
  if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf) || !cidade) {
    throw new Error(`Informe cidade e UF no endereço do ${rotulo} para identificar o município IBGE.`);
  }
  let municipios: unknown;
  try {
    const resposta = await consultar(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, { signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error("Consulta indisponível");
    municipios = await resposta.json();
  } catch {
    throw new Error(`Não foi possível consultar o município do ${rotulo} no IBGE. Tente novamente mais tarde.`);
  }
  const encontrados = Array.isArray(municipios) ? municipios.filter(m => typeof m?.nome === "string" && normalizar(m.nome) === normalizar(cidade) && codigoMunicipioNfse(m.id)) : [];
  if (encontrados.length !== 1) throw new Error(`Município do ${rotulo} não encontrado no IBGE. Confira cidade e UF do endereço.`);
  return { ...endereco, uf, municipio: encontrados[0].nome, codigoMunicipio: String(encontrados[0].id) };
}