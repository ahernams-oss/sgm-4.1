import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const eventoSchema = z.object({
  type: z.enum(['ReceivedCallback', 'DeliveryCallback', 'MessageStatusCallback', 'ConnectedCallback', 'DisconnectedCallback']),
  instanceId: z.string().min(1).max(200),
  status: z.enum(['SENT', 'RECEIVED', 'READ', 'READ_BY_ME', 'PLAYED']).optional(),
  connected: z.boolean().optional(),
  disconnected: z.boolean().optional(),
  ids: z.array(z.string().min(1).max(200)).max(1000).optional(),
}).strip();

const LIMITE_BYTES = 256 * 1024;

export async function receberWebhookZapi(request: Request, secret: string | undefined, registrar: (evento: { tipo: string; status?: string }) => void): Promise<Response> {
  const resposta = (status: number, body: object) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!secret) return resposta(503, { error: 'Webhook Z-API ainda não configurado.' });
  const fornecido = new URL(request.url).searchParams.get('token') || '';
  const esperadoBytes = new TextEncoder().encode(secret);
  const fornecidoBytes = new TextEncoder().encode(fornecido);
  if (!fornecido || fornecidoBytes.length !== esperadoBytes.length || !timingSafeEqual(fornecidoBytes, esperadoBytes)) {
    return resposta(401, { error: 'Webhook não autorizado.' });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return resposta(415, { error: 'Envie JSON.' });
  }
  const reader = request.body?.getReader();
  if (!reader) return resposta(400, { error: 'Evento inválido.' });
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_BYTES) {
        await reader.cancel();
        return resposta(413, { error: 'Evento excede o tamanho permitido.' });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
    const evento = eventoSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!evento.success) return resposta(400, { error: 'Evento Z-API inválido ou não suportado.' });
    // Test-only receipt: never store message bodies, phones, media URLs or credentials.
    registrar({ tipo: evento.data.type, ...(evento.data.status ? { status: evento.data.status } : {}) });
    return resposta(200, { received: true });
  } catch {
    return resposta(400, { error: 'Não foi possível ler o evento.' });
  } finally {
    reader.releaseLock();
  }
}