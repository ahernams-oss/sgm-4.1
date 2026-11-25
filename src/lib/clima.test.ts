import { describe, expect, it } from "vitest";
import { adaptarClima, consultaClimaSchema, locaisClimaSchema, alertaSevero } from "./clima";

describe("consulta do clima", () => {
  it("permite cinco locais e impede um sexto", () => {
    const locais = ["Rio de Janeiro", "Niterói", "São Paulo", "Recife", "Salvador"];
    expect(locaisClimaSchema.safeParse(locais).success).toBe(true);
    expect(locaisClimaSchema.safeParse([...locais, "Brasília"]).success).toBe(false);
  });
  it("destaca eventos severos e extremos sem classificar alertas moderados como severos", () => {
    expect(alertaSevero("Severe")).toBe(true);
    expect(alertaSevero("Extreme")).toBe(true);
    expect(alertaSevero("Moderate")).toBe(false);
    expect(alertaSevero("")).toBe(false);
  });
  it("preserva alertas oficiais e distingue ausência de informação de lista vazia", () => {
    const resposta = { location: { name: "Rio", region: "RJ", country: "Brazil" }, current: { temp_c: 29, feelslike_c: 32, humidity: 77, wind_kph: 6, last_updated: "2026-11-25 16:30", condition: { text: "Chuva" } } };
    expect(adaptarClima(resposta).alertasDisponiveis).toBe(false);
    expect(adaptarClima({ ...resposta, alerts: { alert: [] } }).alertasDisponiveis).toBe(true);
    const clima = adaptarClima({ ...resposta, alerts: { alert: [{ headline: "Tempestade", severity: "Severe", instruction: "Procure abrigo" }] } });
    expect(clima.alertas[0]).toMatchObject({ headline: "Tempestade", severity: "Severe", instruction: "Procure abrigo" });
  });
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