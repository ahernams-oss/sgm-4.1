// Camada de compatibilidade para o código originalmente escrito para o
// runtime Deno das Supabase Edge Functions. Cada função portada recebe um
// "slot" próprio onde registra seu handler.

export type EdgeHandler = (req: Request) => Response | Promise<Response>;

export const denoEnv = {
  get(key: string): string | undefined {
    return process.env[key];
  },
  toObject(): Record<string, string> {
    return { ...process.env } as Record<string, string>;
  },
};

export function createDenoSlot() {
  let handler: EdgeHandler | undefined;

  const serve = (h: EdgeHandler) => {
    handler = h;
  };

  const Deno = {
    env: denoEnv,
    serve,
    createHttpClient(_opts: unknown): never {
      throw new Error('Deno.createHttpClient não é suportado neste runtime');
    },
  } as any;

  const dispatch: EdgeHandler = (req) => {
    if (!handler) throw new Error('Handler não registrado');
    return handler(req);
  };

  return { serve, Deno, dispatch };
}
