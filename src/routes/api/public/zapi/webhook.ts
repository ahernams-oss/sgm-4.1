import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/zapi/webhook')({
  server: {
    handlers: {
      GET: () => Response.json({ service: 'SGM Z-API webhook', method: 'POST' }, { headers: { 'Cache-Control': 'no-store' } }),
      POST: async ({ request }) => {
        const { receberWebhookZapi } = await import('@/lib/zapiWebhook.server');
        return receberWebhookZapi(request, process.env['ZAPI_WEBHOOK_SECRET'], evento => {
          console.info('[zapi:webhook]', JSON.stringify(evento));
        });
      },
    },
  },
});