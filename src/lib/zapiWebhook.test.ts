import { describe, expect, it, vi } from 'vitest';
import { receberWebhookZapi } from './zapiWebhook.server';

const fixtureSecret = 'test-fixture-only';
const request = (body: unknown, token = fixtureSecret) => new Request(`https://example.test/api/public/zapi/webhook?token=${token}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('webhook de teste Z-API', () => {
  it('aceita proteção Bearer do Omni sem token na URL', async () => {
    const registrar = vi.fn();
    const req = new Request('https://example.test/api/public/zapi/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixtureSecret}` },
      body: JSON.stringify({ type: 'ConnectedCallback', instanceId: 'fixture' }),
    });
    expect((await receberWebhookZapi(req, fixtureSecret, registrar)).status).toBe(200);
    expect(registrar).toHaveBeenCalledWith({ tipo: 'ConnectedCallback' });
  });
  it('recusa Bearer incorreto mesmo com token correto na URL', async () => {
    const registrar = vi.fn();
    const req = request({ type: 'ConnectedCallback', instanceId: 'fixture' });
    req.headers.set('Authorization', 'Bearer invalid');
    expect((await receberWebhookZapi(req, fixtureSecret, registrar)).status).toBe(401);
    expect(registrar).not.toHaveBeenCalled();
  });
  it('recusa ausência de configuração sem registrar evento', async () => {
    const registrar = vi.fn();
    expect((await receberWebhookZapi(request({}), undefined, registrar)).status).toBe(503);
    expect(registrar).not.toHaveBeenCalled();
  });
  it.each(['', 'wrong-token', 'test-fixture-onlz'])('recusa token inválido antes de registrar', async token => {
    const registrar = vi.fn();
    expect((await receberWebhookZapi(request({ type: 'ConnectedCallback', instanceId: 'fixture' }, token), fixtureSecret, registrar)).status).toBe(401);
    expect(registrar).not.toHaveBeenCalled();
  });
  it.each(['ReceivedCallback', 'DeliveryCallback', 'MessageStatusCallback', 'ConnectedCallback', 'DisconnectedCallback'])('recebe %s sem registrar dados pessoais', async type => {
    const registrar = vi.fn();
    const result = await receberWebhookZapi(request({ type, instanceId: 'fixture', status: 'READ', phone: 'private-fixture', text: { message: 'private message' } }), fixtureSecret, registrar);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ received: true });
    expect(registrar).toHaveBeenCalledWith({ tipo: type, status: 'READ' });
  });
  it.each(['SENT', 'RECEIVED', 'READ', 'READ_BY_ME', 'PLAYED'])('aceita status documentado %s', async status => {
    const registrar = vi.fn();
    expect((await receberWebhookZapi(request({ type: 'MessageStatusCallback', instanceId: 'fixture', status, ids: ['fixture-message'] }), fixtureSecret, registrar)).status).toBe(200);
    expect(registrar).toHaveBeenCalledWith({ tipo: 'MessageStatusCallback', status });
  });
  it('recusa eventos inválidos', async () => {
    const registrar = vi.fn();
    expect((await receberWebhookZapi(request({ type: 'UnknownCallback' }), fixtureSecret, registrar)).status).toBe(400);
    expect(registrar).not.toHaveBeenCalled();
  });
  it('limita o corpo sem registrar mensagens', async () => {
    const registrar = vi.fn();
    expect((await receberWebhookZapi(request({ type: 'ReceivedCallback', instanceId: 'fixture', text: 'x'.repeat(256 * 1024) }), fixtureSecret, registrar)).status).toBe(413);
    expect(registrar).not.toHaveBeenCalled();
  });
});