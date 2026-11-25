import { describe, expect, it } from "vitest";
import { agruparPorCategoria, categoriaDeOS, SEM_CATEGORIA } from "./relatoriosOsAnalitico";
import type { OrdemServico } from "@/contexts/OrdensServicoContext";

type OSComTotal = OrdemServico & { _total: number };

const criarOS = (id: string, categoria: string, servico: string, total: number): OSComTotal =>
  ({ id, categoria, servico, _total: total }) as unknown as OSComTotal;

const totalDe = (o: OrdemServico) => (o as unknown as { _total: number })._total;

describe("agruparPorCategoria", () => {
  it("agrupa O.S. de serviços diferentes quando a categoria é a mesma", () => {
    const ordens = [
      criarOS("1", "Elétrica", "Trocar lâmpada", 100),
      criarOS("2", "Elétrica", "Revisar quadro", 250),
      criarOS("3", "Hidráulica", "Desentupir pia", 80),
    ];

    const resultado = agruparPorCategoria(ordens, totalDe);

    expect(resultado).toEqual([
      { nome: "Elétrica", qtd: 2, valor: 350 },
      { nome: "Hidráulica", qtd: 1, valor: 80 },
    ]);
  });

  it("usa SEM CATEGORIA quando a O.S. não tem categoria informada", () => {
    const ordens = [
      criarOS("1", "", "Serviço avulso", 50),
      criarOS("2", "   ", "Serviço avulso 2", 25),
    ];

    const resultado = agruparPorCategoria(ordens, totalDe);

    expect(resultado).toEqual([{ nome: SEM_CATEGORIA, qtd: 2, valor: 75 }]);
  });

  it("ordena por quantidade, depois por valor e por nome", () => {
    const ordens = [
      criarOS("1", "Pintura", "Pintar sala", 900),
      criarOS("2", "Alvenaria", "Levantar muro", 900),
      criarOS("3", "Elétrica", "Trocar tomada", 10),
      criarOS("4", "Elétrica", "Trocar disjuntor", 20),
      criarOS("5", "Hidráulica", "Trocar registro", 500),
    ];

    const resultado = agruparPorCategoria(ordens, totalDe);

    expect(resultado.map(r => r.nome)).toEqual(["Elétrica", "Alvenaria", "Pintura", "Hidráulica"]);
    expect(resultado[0]).toEqual({ nome: "Elétrica", qtd: 2, valor: 30 });
  });

  it("não cria agrupamento por serviço: uma categoria gera uma única linha", () => {
    const ordens = [
      criarOS("1", "Limpeza", "Vidros", 10),
      criarOS("2", "Limpeza", "Pisos", 20),
      criarOS("3", "Limpeza", "Forro", 30),
    ];

    const resultado = agruparPorCategoria(ordens, totalDe);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual({ nome: "Limpeza", qtd: 3, valor: 60 });
  });

  it("categoriaDeOS normaliza espaços e mantém o nome original", () => {
    expect(categoriaDeOS(criarOS("1", "  Ar-condicionado  ", "x", 1))).toBe("Ar-condicionado");
    expect(categoriaDeOS(criarOS("2", "", "x", 1))).toBe(SEM_CATEGORIA);
  });
});
