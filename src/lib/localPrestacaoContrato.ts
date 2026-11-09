import municipios from "./data/municipios-ibge.json";

export interface LocalPrestacaoContrato {
  ufPrestacao: string;
  codigoMunicipioPrestacao: string;
  municipioPrestacao: string;
  codigoTributacaoNacional: string;
  codigoTributacaoMunicipal: string;
}

export function municipiosPrestacaoContrato(uf: string) {
  return municipios.filter(m => m[2] === uf).map(m => ({ codigo: m[0] ?? "", nome: m[1] ?? "" }));
}

export function trocarUfPrestacaoContrato(uf: string) {
  return { ufPrestacao: uf, codigoMunicipioPrestacao: "", municipioPrestacao: "" };
}