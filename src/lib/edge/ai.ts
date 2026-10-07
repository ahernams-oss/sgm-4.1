// Cliente de IA das funções de servidor do SGM: Google Gemini direto, com a chave
// GEMINI_API_KEY (Google AI Studio). Substitui o gateway de IA da Lovable, que só
// funcionava dentro da hospedagem da Lovable.
//
// - Chat com ferramentas e streaming (Duda): endpoint do Gemini compatível com OpenAI,
//   então o formato das mensagens, das ferramentas e do SSE lido pela tela continua igual.
// - Leitura de PDFs e imagens: API nativa generateContent. O endpoint compatível com
//   OpenAI só documenta imagens; a API nativa aceita PDF de até 50 MB por arquivo.
// - Embeddings da Base de Conhecimento: embedContent com 768 dimensões, o tamanho da
//   coluna vector(768) de kb_artigos/kb_faq. Mesmo modelo que a Lovable usava
//   (gemini-embedding-2), então os vetores já gravados continuam comparáveis.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Modelos configuráveis no .env do servidor. Os padrões são os indicados pelo Google
// para projetos novos: chaves novas não têm acesso à família 2.5 que o código usava.
export const modeloRapido = () => process.env['GEMINI_MODEL_RAPIDO'] || 'gemini-3.5-flash-lite';
export const modeloAvancado = () => process.env['GEMINI_MODEL_AVANCADO'] || 'gemini-3.8-flash';

const MODELO_EMBEDDING = 'gemini-embedding-2';
export const DIMENSOES_EMBEDDING = 768;

export class ErroIA extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function mensagemErro(status: number, detalhe: string): string {
  if (status === 429) return 'Limite de requisições de IA atingido. Aguarde alguns instantes e tente novamente.';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(detalhe)) {
    return 'Chave da IA (GEMINI_API_KEY) inválida ou sem permissão.';
  }
  return `Serviço de IA retornou ${status}`;
}

function chave(): string {
  const k = process.env['GEMINI_API_KEY'];
  if (!k) throw new ErroIA(500, 'GEMINI_API_KEY não configurada');
  return k;
}

async function falha(resp: Response, contexto: string): Promise<never> {
  const detalhe = await resp.text().catch(() => '');
  console.error(`[ia] ${contexto}:`, resp.status, detalhe.slice(0, 2000));
  throw new ErroIA(resp.status, mensagemErro(resp.status, detalhe));
}

/** Resposta JSON de erro padronizada para as funções que usam IA. */
export function respostaErroIA(e: unknown, headers: Record<string, string>): Response {
  const status = e instanceof ErroIA ? e.status : 500;
  const error = e instanceof Error ? e.message : 'Erro desconhecido';
  return new Response(JSON.stringify({ error }), {
    status: status === 429 ? 429 : 500,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * Chat no formato OpenAI (messages, tools, tool_choice, stream). Devolve a Response
 * crua do Gemini para quem chama tratar status e repassar o stream.
 */
export function chatCompletions(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE_URL}/openai/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface ArquivoIA {
  mimeType: string;
  /** Conteúdo em base64, sem o prefixo "data:...;base64,". */
  base64: string;
}

/** Converte o conteúdo de um arquivo enviado para base64, em blocos (PDFs grandes). */
export async function paraBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Gera texto a partir de um prompt e de arquivos (PDF/imagem) com a API nativa. */
export async function gerarTexto(opts: {
  texto: string;
  arquivos?: ArquivoIA[];
  sistema?: string;
  modelo?: string;
  temperatura?: number;
}): Promise<string> {
  const modelo = opts.modelo ?? modeloRapido();
  const parts: unknown[] = [{ text: opts.texto }];
  for (const a of opts.arquivos ?? []) {
    parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
  }

  const resp = await fetch(`${BASE_URL}/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': chave(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(opts.sistema ? { systemInstruction: { parts: [{ text: opts.sistema }] } } : {}),
      contents: [{ role: 'user', parts }],
      ...(opts.temperatura !== undefined
        ? { generationConfig: { temperature: opts.temperatura } }
        : {}),
    }),
  });
  if (!resp.ok) await falha(resp, `generateContent ${modelo}`);

  const data = await resp.json();
  const candidato = data?.candidates?.[0];
  const texto = (candidato?.content?.parts ?? [])
    .filter((p: any) => typeof p?.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  if (!texto) {
    console.warn('[ia] resposta sem texto:', candidato?.finishReason ?? data?.promptFeedback?.blockReason);
  }
  return texto;
}

/** Embedding de 768 dimensões para a Base de Conhecimento. */
export async function gerarEmbedding(texto: string): Promise<number[]> {
  const resp = await fetch(`${BASE_URL}/models/${MODELO_EMBEDDING}:embedContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': chave(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: texto }] },
      outputDimensionality: DIMENSOES_EMBEDDING,
    }),
  });
  if (!resp.ok) await falha(resp, 'embedContent');

  const data = await resp.json();
  const valores = data?.embedding?.values;
  if (!Array.isArray(valores) || valores.length !== DIMENSOES_EMBEDDING) {
    throw new ErroIA(502, 'Resposta de embedding inválida');
  }
  return valores;
}
