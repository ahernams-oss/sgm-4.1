// Contract: https://brasilnfe.com.br/api/nfs-e
export const BRASILNFE_FISCAL_URL = "https://api.brasilnfe.com.br/services/fiscal";
const digits = (value: string = "") => value.replace(/\D/g, "");

export function montarPayloadBrasilNfe(numero: number, modelo: any, referencia: string, ambiente: number) {
  const s = modelo.servico;
  const t = modelo.tributos;
  const federal = t.federal || {};
  const endereco = (e: any) => e ? {
    Cep: digits(e.cep), Logradouro: e.logradouro, Numero: e.numero,
    Complemento: e.complemento, Bairro: e.bairro,
    CodMunicipio: e.codigoMunicipio, Municipio: e.municipio, Uf: e.uf,
    Pais: e.pais || "Brasil",
  } : undefined;
  const obra = s.informacoesObra;
  if (obra?.tipo === "endEX" && obra.enderecoExterior?.endereco) {
    throw new Error("A emissão Brasil NFe com endereço de obra no exterior exige confirmação do layout pelo provedor.");
  }
  return {
    TipoAmbiente: ambiente,
    Lote: numero,
    nFSInfo: [{
      SerieRps: modelo.serie || "00001", NumeroRps: numero,
      IdentificadorInterno: referencia, EnviarEmail: false,
      DataCompetencia: modelo.dataCompetencia || new Date().toISOString().slice(0, 10),
      DataEmissao: new Date().toISOString(),
      Tomador: {
        CpfCnpj: digits(modelo.tomador.documento), NmTomador: modelo.tomador.razaoSocial,
        Im: modelo.tomador.inscricaoMunicipal,
        Endereco: endereco(modelo.tomador.endereco), Contato: { Email: modelo.tomador.email },
      },
      ConstrucaoCivil: obra ? {
        CodObra: obra.codigoObra || s.codigoObra, Cib: obra.cib,
        InscricaoImobiliaria: obra.inscricaoMobiliariaFiscal,
        EnderecoObra: endereco(obra.enderecoBrasil),
      } : undefined,
      Servico: {
        Descricao: s.descricao,
        ItemListaServico: digits(s.codigoTributacaoNacional || s.codigoTributacaoMunicipio),
        CodTributacaoMunicipio: s.codigoTributacaoMunicipio,
        CodNBS: s.codigoNbs, CodigoCnae: s.cnae,
        NaturezaOperacao: 1, IssRetido: t.issRetido, ExigibilidadeISS: 1,
        CodMunicipioIncidencia: modelo.prestador.codigoMunicipio,
        CodMunicipioPrestacao: modelo.prestador.codigoMunicipio,
        Valores: {
          ValorServico: Number(s.valorServico), Aliquota: Number(t.aliquotaIss),
          ValorDeducoes: Number(s.deducoes || 0),
          DescontoCondicionado: Number(s.descontoCondicionado || 0),
          DescontoIncondicionado: Number(s.descontoIncondicionado || 0),
          ValorInss: Number(t.inss ?? federal.contribPrevidRetida ?? 0),
        },
      },
    }],
  };
}

export function interpretarRetornoBrasilNfe(body: any, referencia: string) {
  const notas: any[] = Array.isArray(body?.Notas) ? body.Notas : [];
  const nota = notas.find(n => n.IdentificadorInterno === referencia) || (notas.length === 1 ? notas[0] : undefined);
  const erro = body?.Error || nota?.Erro;
  const statusLote = Number(body?.StatusLote);
  const emitida = !erro && statusLote === 1 && Number(nota?.Status) === 1 && !!nota?.NumeroNFSe;
  const status = nota?.Cancelada ? "cancelada" : erro || statusLote === 3 || statusLote === 4
    ? "rejeitada" : emitida ? "emitida" : "processando";
  return {
    status, mensagem: erro || (emitida ? "NFS-e autorizada pela Brasil NFe" : status === "cancelada" ? "NFS-e cancelada" : "NFS-e em processamento na Brasil NFe"),
    chave: nota?.Chave || nota?.CodVerificacao || null,
    protocolo: body?.Protocolo || body?.CodLote || null,
    dataEmissao: emitida ? nota?.DtEmissao || null : null,
    xmlBase64: emitida ? nota?.Base64Xml || null : null,
    valorIss: nota?.Valores?.ValorISS, valorLiquido: nota?.Valores?.ValorLiquido,
  };
}