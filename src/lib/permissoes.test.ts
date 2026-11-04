import { describe, expect, it } from "vitest";
import { cargoTemAcessoTotal, temPermissao, temPermissaoNoModulo } from "./permissoes";

describe("restrições administrativas por cargo", () => {
  for (const cargo of ["Coordenador Tecnico Lasant", "Coordenador Técnico Lasant", "Coordenador Administrativo Lasant", "Gerente Executivo", "Gerente Executivo Lasant"]) {
    it(`${cargo} não acessa Usuários nem Perfis, mesmo com autorização`, () => {
      const permissoes = { "usuarios.editar": true, "perfis_acesso.editar": true };
      const total = cargoTemAcessoTotal(cargo);
      expect(temPermissao(total, permissoes, "usuarios.editar", cargo)).toBe(false);
      expect(temPermissao(total, permissoes, "perfis_acesso.editar", cargo)).toBe(false);
      expect(temPermissaoNoModulo(total, permissoes, "usuarios", cargo)).toBe(false);
      expect(temPermissaoNoModulo(total, permissoes, "perfis_acesso", cargo)).toBe(false);
    });
  }
});

describe("Gerencial exige perfil", () => {
  for (const modulo of ["monitor_tv", "gerencial_dashboard", "gerencial_relatorios", "gerencial_multidim", "gerencial_mapa_clientes"]) {
    it(`${modulo} não é liberado automaticamente pelo cargo`, () => {
      expect(temPermissaoNoModulo(true, {}, modulo, "Diretor Geral Lasant")).toBe(false);
      expect(temPermissao(true, {}, `${modulo}.visualizar`, "Diretor Geral Lasant")).toBe(false);
      expect(temPermissaoNoModulo(true, { [`${modulo}.visualizar`]: true }, modulo)).toBe(true);
      expect(temPermissao(true, { [`${modulo}.visualizar`]: true }, `${modulo}.exportar_pdf`)).toBe(false);
    });
  }
  it("preserva acesso do Diretor à administração e dos coordenadores aos demais módulos", () => {
    expect(temPermissaoNoModulo(true, {}, "usuarios", "Diretor Geral Lasant")).toBe(true);
    expect(temPermissaoNoModulo(true, {}, "perfis_acesso", "Diretor Geral Lasant")).toBe(true);
    expect(temPermissao(true, {}, "cargos.editar", "Coordenador Tecnico Lasant")).toBe(true);
  });
});