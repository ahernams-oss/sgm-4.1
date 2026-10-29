import { describe, expect, it } from "vitest";
import { resumirI0 } from "./dashboardI0";

describe("dashboard I0", () => {
  it("conta 13.580 registros SCO em novembro de 2025 e 11.150 SINAPI em maio de 2024", () => {
    const items = [
      ...Array.from({ length: 13580 }, () => ({ codSco: "SCO001", mes: 11, ano: 2025 })),
      ...Array.from({ length: 11150 }, () => ({ codSco: "SIN001", mes: 5, ano: 2024 })),
    ];
    expect(resumirI0(items, [{ codSco: "SCO001", tipo: "SCO" }, { codSco: "SIN001", tipo: "SINAPI" }])).toEqual([
      { tabela: "SCO", mes: 11, ano: 2025, quantidade: 13580 },
      { tabela: "SINAPI", mes: 5, ano: 2024, quantidade: 11150 },
    ]);
  });

  it("separa meses e anos, incluindo registros com valor zero", () => {
    expect(resumirI0([
      { codSco: "A", mes: 11, ano: 2025 }, { codSco: "A", mes: 10, ano: 2025 },
      { codSco: "A", mes: 11, ano: 2024 },
    ], [{ codSco: "A", tipo: "EMOP" }])).toEqual([
      { tabela: "EMOP", mes: 11, ano: 2025, quantidade: 1 },
      { tabela: "EMOP", mes: 10, ano: 2025, quantidade: 1 },
      { tabela: "EMOP", mes: 11, ano: 2024, quantidade: 1 },
    ]);
  });

  it("mantém registros sem correspondência ou com tabelas ambíguas no total", () => {
    expect(resumirI0([{ codSco: "A", mes: 1, ano: 2025 }, { codSco: "B", mes: 1, ano: 2025 }], [
      { codSco: "A", tipo: "SCO" }, { codSco: "A", tipo: "SINAPI" },
    ])).toEqual([{ tabela: "Tabela não identificada", mes: 1, ano: 2025, quantidade: 2 }]);
  });

  it("normaliza códigos e não duplica contagem por repetições no catálogo", () => {
    expect(resumirI0([{ codSco: " a ", mes: 1, ano: 2025 }], [
      { codSco: "A", tipo: "SCO" }, { codSco: "A", tipo: "SCO" },
    ])).toEqual([{ tabela: "SCO", mes: 1, ano: 2025, quantidade: 1 }]);
    expect(resumirI0([], [])).toEqual([]);
  });
});