import { describe, expect, it } from "vitest";
import { estaEmAppInstalada, estaEmAppInstaladaSinais } from "./app-instalada";

describe("app instalado (PWA)", () => {
  it("não considera instalado sem nenhum sinal", () => {
    expect(estaEmAppInstaladaSinais({})).toBe(false);
  });

  it("não considera instalado em aba comum de navegador", () => {
    expect(estaEmAppInstaladaSinais({ displayModeStandalone: false, iosStandalone: false })).toBe(
      false,
    );
  });

  it("considera instalado no Android/Chrome (display-mode standalone)", () => {
    expect(estaEmAppInstaladaSinais({ displayModeStandalone: true })).toBe(true);
  });

  it("considera instalado no iPhone (navigator.standalone)", () => {
    expect(estaEmAppInstaladaSinais({ iosStandalone: true })).toBe(true);
  });

  it("não considera instalado fora do navegador", () => {
    // Ambiente de teste sem janela: nunca pode liberar a digital.
    expect(estaEmAppInstalada()).toBe(false);
  });
});
