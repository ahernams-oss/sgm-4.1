/**
 * Tabela de feriados: Federais (fixos e móveis), Estaduais (RJ)
 * e Municipais dos principais municípios do Estado do Rio de Janeiro.
 *
 * Uso principal: definir automaticamente o percentual de hora extra
 * (50% de segunda a sábado, 100% aos domingos e feriados).
 */

export interface FeriadoInfo {
  nome: string;
  ambito: "Federal" | "Estadual" | "Municipal";
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher) */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const md = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

const addDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Feriados federais fixos (MM-DD) */
const FEDERAIS_FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal",
};

/** Feriados estaduais do Rio de Janeiro (MM-DD) */
const ESTADUAIS_RJ: Record<string, string> = {
  "04-23": "São Jorge (Estadual/RJ)",
  "11-20": "Consciência Negra (Estadual/RJ)",
};

/**
 * Feriados municipais (MM-DD) por município do Estado do RJ.
 * Inclui aniversário da cidade e padroeiro(a), quando feriado municipal.
 */
export const FERIADOS_MUNICIPAIS_RJ: Record<string, Record<string, string>> = {
  "Rio de Janeiro": {
    "01-20": "São Sebastião — Padroeiro da Cidade",
    "03-01": "Aniversário da Cidade do Rio de Janeiro",
  },
  "Niterói": {
    "11-22": "Aniversário de Niterói",
    "06-13": "Santo Antônio — Padroeiro",
  },
  "São Gonçalo": { "09-22": "Aniversário de São Gonçalo" },
  "Duque de Caxias": {
    "08-25": "Aniversário de Duque de Caxias",
    "12-08": "Nossa Senhora da Conceição — Padroeira",
  },
  "Nova Iguaçu": { "01-15": "Aniversário de Nova Iguaçu" },
  "Belford Roxo": { "12-03": "Aniversário de Belford Roxo" },
  "São João de Meriti": { "12-23": "Aniversário de São João de Meriti" },
  "Mesquita": { "09-25": "Aniversário de Mesquita" },
  "Nilópolis": { "01-10": "Aniversário de Nilópolis" },
  "Queimados": { "05-18": "Aniversário de Queimados" },
  "Magé": { "06-09": "Aniversário de Magé" },
  "Itaboraí": { "05-15": "Aniversário de Itaboraí" },
  "Maricá": { "05-26": "Aniversário de Maricá" },
  "Rio das Ostras": { "04-10": "Aniversário de Rio das Ostras" },
  "Macaé": { "07-29": "Aniversário de Macaé" },
  "Campos dos Goytacazes": {
    "05-28": "Aniversário de Campos dos Goytacazes",
    "03-19": "São José — Padroeiro",
  },
  "Cabo Frio": { "11-13": "Aniversário de Cabo Frio" },
  "Búzios": { "11-16": "Aniversário de Armação dos Búzios" },
  "Araruama": { "05-20": "Aniversário de Araruama" },
  "Saquarema": { "05-15": "Aniversário de Saquarema" },
  "Petrópolis": { "03-16": "Aniversário de Petrópolis" },
  "Teresópolis": { "07-06": "Aniversário de Teresópolis" },
  "Nova Friburgo": { "05-16": "Aniversário de Nova Friburgo" },
  "Volta Redonda": { "07-17": "Aniversário de Volta Redonda" },
  "Barra Mansa": { "09-03": "Aniversário de Barra Mansa" },
  "Resende": { "09-29": "Aniversário de Resende" },
  "Angra dos Reis": { "01-06": "Aniversário de Angra dos Reis" },
  "Paraty": { "08-28": "Aniversário de Paraty" },
  "Itaguaí": { "06-12": "Aniversário de Itaguaí" },
  "Seropédica": { "10-12": "Aniversário de Seropédica" },
  "Japeri": { "05-01": "Aniversário de Japeri" },
  "Barra do Piraí": { "03-25": "Aniversário de Barra do Piraí" },
  "Vassouras": { "02-15": "Aniversário de Vassouras" },
  "Valença": { "09-29": "Aniversário de Valença" },
  "Três Rios": { "12-14": "Aniversário de Três Rios" },
  "Cachoeiras de Macacu": { "06-16": "Aniversário de Cachoeiras de Macacu" },
  "Rio Bonito": { "05-27": "Aniversário de Rio Bonito" },
  "Casimiro de Abreu": { "12-15": "Aniversário de Casimiro de Abreu" },
  "São Pedro da Aldeia": { "05-16": "Aniversário de São Pedro da Aldeia" },
  "Arraial do Cabo": { "05-13": "Aniversário de Arraial do Cabo" },
  "Itaperuna": { "12-10": "Aniversário de Itaperuna" },
  "São Fidélis": { "05-15": "Aniversário de São Fidélis" },
  "Bom Jesus do Itabapoana": { "12-06": "Aniversário de Bom Jesus do Itabapoana" },
  "Miracema": { "12-30": "Aniversário de Miracema" },
  "Santo Antônio de Pádua": { "06-13": "Aniversário de Santo Antônio de Pádua" },
  "Paracambi": { "12-10": "Aniversário de Paracambi" },
  "Mangaratiba": { "08-23": "Aniversário de Mangaratiba" },
  "Guapimirim": { "12-14": "Aniversário de Guapimirim" },
  "Tanguá": { "12-24": "Aniversário de Tanguá" },
  "Silva Jardim": { "10-05": "Aniversário de Silva Jardim" },
  "Quissamã": { "12-16": "Aniversário de Quissamã" },
  "Piraí": { "12-11": "Aniversário de Piraí" },
  "Pinheiral": { "11-15": "Aniversário de Pinheiral" },
  "Porto Real": { "11-13": "Aniversário de Porto Real" },
  "Itatiaia": { "11-14": "Aniversário de Itatiaia" },
  "Rio Claro": { "06-13": "Aniversário de Rio Claro" },
  "Engenheiro Paulo de Frontin": { "12-31": "Aniversário de Eng. Paulo de Frontin" },
  "Mendes": { "12-31": "Aniversário de Mendes" },
  "Miguel Pereira": { "12-08": "Aniversário de Miguel Pereira" },
  "Paty do Alferes": { "12-27": "Aniversário de Paty do Alferes" },
  "Sapucaia": { "10-28": "Aniversário de Sapucaia" },
  "Areal": { "12-13": "Aniversário de Areal" },
  "Comendador Levy Gasparian": { "12-11": "Aniversário de Com. Levy Gasparian" },
  "Carmo": { "09-08": "Aniversário de Carmo" },
  "Cantagalo": { "05-13": "Aniversário de Cantagalo" },
  "Cordeiro": { "12-14": "Aniversário de Cordeiro" },
  "Bom Jardim": { "12-15": "Aniversário de Bom Jardim" },
  "Duas Barras": { "06-24": "Aniversário de Duas Barras" },
  "Sumidouro": { "12-15": "Aniversário de Sumidouro" },
  "Trajano de Moraes": { "12-06": "Aniversário de Trajano de Moraes" },
  "Santa Maria Madalena": { "07-22": "Aniversário de Santa Maria Madalena" },
  "São Sebastião do Alto": { "01-20": "Aniversário de São Sebastião do Alto" },
  "Conceição de Macabu": { "12-08": "Aniversário de Conceição de Macabu" },
  "Carapebus": { "12-20": "Aniversário de Carapebus" },
  "São Francisco de Itabapoana": { "11-19": "Aniversário de S. Francisco de Itabapoana" },
  "São João da Barra": { "05-28": "Aniversário de São João da Barra" },
  "Cardoso Moreira": { "12-14": "Aniversário de Cardoso Moreira" },
  "Italva": { "12-15": "Aniversário de Italva" },
  "Cambuci": { "12-10": "Aniversário de Cambuci" },
  "Aperibé": { "12-28": "Aniversário de Aperibé" },
  "Itaocara": { "05-11": "Aniversário de Itaocara" },
  "Laje do Muriaé": { "12-31": "Aniversário de Laje do Muriaé" },
  "Natividade": { "12-14": "Aniversário de Natividade" },
  "Porciúncula": { "12-31": "Aniversário de Porciúncula" },
  "Varre-Sai": { "12-01": "Aniversário de Varre-Sai" },
  "Bom Jesus": { "12-06": "Aniversário de Bom Jesus" },
  "Barra Mansa (Distrito)": { "09-03": "Aniversário do Distrito" },
  "Nossa Senhora do Amparo": { "11-08": "Padroeira" },
  "Iguaba Grande": { "12-13": "Aniversário de Iguaba Grande" },
  "Armação dos Búzios": { "11-16": "Aniversário de Armação dos Búzios" },
  "São José do Vale do Rio Preto": { "12-31": "Aniversário do município" },
  "Japuíba": { "06-13": "Padroeiro" },
};

export const MUNICIPIOS_RJ = Object.keys(FERIADOS_MUNICIPAIS_RJ).sort((a, b) =>
  a.localeCompare(b, "pt-BR")
);

/** Feriados móveis nacionais para um ano */
function moveisFederais(ano: number): Record<string, string> {
  const p = pascoa(ano);
  return {
    [md(addDias(p, -48))]: "Carnaval",
    [md(addDias(p, -47))]: "Carnaval",
    [md(addDias(p, -2))]: "Sexta-feira Santa",
    [md(addDias(p, 60))]: "Corpus Christi",
  };
}

/** Converte "YYYY-MM-DD" em Date local seguro */
function parseISO(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/** Retorna o feriado da data, considerando município do RJ (opcional) */
export function getFeriado(dateStr: string, municipio?: string): FeriadoInfo | null {
  const d = parseISO(dateStr);
  if (!d) return null;
  const ano = d.getFullYear();
  const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const movel = moveisFederais(ano)[key];
  if (movel) return { nome: movel, ambito: "Federal" };
  if (FEDERAIS_FIXOS[key]) return { nome: FEDERAIS_FIXOS[key], ambito: "Federal" };
  if (ESTADUAIS_RJ[key]) return { nome: ESTADUAIS_RJ[key], ambito: "Estadual" };
  if (municipio && FERIADOS_MUNICIPAIS_RJ[municipio]?.[key]) {
    return { nome: FERIADOS_MUNICIPAIS_RJ[municipio][key], ambito: "Municipal" };
  }
  return null;
}

export function isDomingo(dateStr: string): boolean {
  const d = parseISO(dateStr);
  return !!d && d.getDay() === 0;
}

/** 100% em domingos e feriados; 50% de segunda a sábado */
export function percentualHoraExtra(dateStr: string, municipio?: string): 50 | 100 {
  if (!dateStr) return 50;
  if (isDomingo(dateStr)) return 100;
  return getFeriado(dateStr, municipio) ? 100 : 50;
}

/** Motivo legível do percentual aplicado */
export function motivoPercentual(dateStr: string, municipio?: string): string {
  if (!dateStr) return "";
  if (isDomingo(dateStr)) return "Domingo — 100%";
  const f = getFeriado(dateStr, municipio);
  if (f) return `Feriado ${f.ambito}: ${f.nome} — 100%`;
  return "Dia útil (segunda a sábado) — 50%";
}
