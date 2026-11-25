import { z } from "zod";

export const consultaClimaSchema = z.object({ cidade: z.string().trim().min(2).max(120) });
const respostaClimaSchema = z.object({
  location: z.object({ name: z.string(), region: z.string(), country: z.string() }),
  current: z.object({ temp_c: z.number(), feelslike_c: z.number(), humidity: z.number(), wind_kph: z.number(), last_updated: z.string(), condition: z.object({ text: z.string() }) }),
});

export function adaptarClima(resposta: unknown) {
  const { location, current } = respostaClimaSchema.parse(resposta);
  return { cidade: location.name, regiao: location.region, pais: location.country, temperatura: current.temp_c, sensacao: current.feelslike_c, umidade: current.humidity, vento: current.wind_kph, atualizado: current.last_updated, condicao: current.condition.text };
}