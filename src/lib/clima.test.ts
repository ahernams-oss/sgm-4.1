import { describe, expect, it } from "vitest";
import { adaptarClima, consultaClimaSchema } from "./clima";

describe("consulta do clima", () => {
  it("preserva medidas em Celsius e km/h e condição em português", () => {
    const clima = adaptarClima({ location: { name: "Rio de Janeiro", region: "RJ", country: "Brazil" }, current: { temp_c: 28.9, feelslike_c: 33.9, humidity: 77, wind_kph: 6.5, last_updated: "2026-11-25 16:30", condition: { text: "Chuva fraca" } } });
    expect(clima).toMatchObject({ temperatura: 28.9, sensacao: 33.9, umidade: 77, vento: 6.5, condicao: "Chuva fraca" });
  });
  it("rejeita resposta sem medidas em vez de inventar valores", () => {
    expect(() => adaptarClima({ location: { name: "Rio de Janeiro" }, current: {} })).toThrow();
  });
  it("valida a cidade e remove espaços", () => {
    expect(consultaClimaSchema.parse({ cidade: " Rio de Janeiro " }).cidade).toBe("Rio de Janeiro");
    expect(consultaClimaSchema.safeParse({ cidade: " " }).success).toBe(false);
  });
});