import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OsAssinaturasProvider, useOsAssinaturas } from "./OsAssinaturasContext";

// Mock supabase helpers so the provider's useQuery never hits the network.
vi.mock("@/lib/supabaseHelper", () => ({
  fetchAll: vi.fn(async () => []),
  insertRow: vi.fn(async () => null),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) },
}));

describe("useOsAssinaturas", () => {
  it("returns safe defaults (arrays / no-op fns) when used OUTSIDE the provider", () => {
    const { result } = renderHook(() => useOsAssinaturas());

    expect(Array.isArray(result.current.assinaturas)).toBe(true);
    expect(result.current.assinaturas).toEqual([]);
    expect(Array.isArray(result.current.porOs("qualquer-id"))).toBe(true);
    expect(result.current.porOs("qualquer-id")).toEqual([]);
    expect(typeof result.current.registrar).toBe("function");
    expect(typeof result.current.buscarPorCodigo).toBe("function");
    expect(typeof result.current.refresh).toBe("function");
  });

  it("does not crash calling async defaults outside provider", async () => {
    const { result } = renderHook(() => useOsAssinaturas());
    await expect(result.current.registrar({})).resolves.toBeNull();
    await expect(result.current.buscarPorCodigo("x")).resolves.toBeNull();
    await expect(result.current.refresh()).resolves.toBeUndefined();
  });

  it("returns arrays initially INSIDE the provider (before data loads)", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <OsAssinaturasProvider>{children}</OsAssinaturasProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useOsAssinaturas(), { wrapper });

    expect(Array.isArray(result.current.assinaturas)).toBe(true);
    expect(Array.isArray(result.current.porOs("os-1"))).toBe(true);
  });
});
