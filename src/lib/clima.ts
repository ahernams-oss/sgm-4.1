import { z } from "zod";

export const localClimaSchema = z.string().trim().min(2).max(120);
export const locaisClimaSchema = z.array(localClimaSchema).max(5);
export const consultaClimaSchema = z.object({ cidade: localClimaSchema, alertas: z.boolean().default(false) });
const alertaSchema = z.object({ headline: z.string().default(""), severity: z.string().default(""), event: z.string().default(""), areas: z.string().default(""), effective: z.string().default(""), expires: z.string().default(""), desc: z.string().default(""), instruction: z.string().default("") });
export function alertaSevero(severidade: string) {
  return ["severe", "extreme", "severo", "extremo"].includes(severidade.trim().toLowerCase());
}
const respostaClimaSchema = z.object({
  location: z.object({ name: z.string(), region: z.string(), country: z.string() }),
  current: z.object({ temp_c: z.number(), feelslike_c: z.number(), humidity: z.number(), wind_kph: z.number(), last_updated: z.string(), condition: z.object({ text: z.string() }) }),
  alerts: z.object({ alert: z.array(alertaSchema) }).optional(),
});

export function adaptarClima(resposta: unknown) {
  const { location, current, alerts } = respostaClimaSchema.parse(resposta);
  return { cidade: location.name, regiao: location.region, pais: location.country, temperatura: current.temp_c, sensacao: current.feelslike_c, umidade: current.humidity, vento: current.wind_kph, atualizado: current.last_updated, condicao: current.condition.text, alertas: alerts?.alert ?? [], alertasDisponiveis: Boolean(alerts) };
}