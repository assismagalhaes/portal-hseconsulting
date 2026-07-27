import { describe, expect, it } from "vitest";
import { normalizarSelecoesPlanoIA } from "../../supabase/functions/_shared/psico-plano-ia-policy";
import fs from "node:fs";
import path from "node:path";

const fatores = [
  { codigo: "demandas", tratamento: "monitoramento_preventivo" as const },
  { codigo: "controle", tratamento: "sem_acao_especifica" as const },
  { codigo: "papel", tratamento: "acao_recomendada" as const },
];

const catalogo = [
  { id: "m-demandas-essencial", fator_codigo: "demandas", nivel: "essencial" },
  { id: "m-demandas-estruturante", fator_codigo: "demandas", nivel: "estruturante" },
  { id: "m-controle", fator_codigo: "controle", nivel: "essencial" },
  { id: "m-papel-1", fator_codigo: "papel", nivel: "essencial" },
  { id: "m-papel-2", fator_codigo: "papel", nivel: "estruturante" },
];

describe("política das sugestões de plano por IA", () => {
  it("aceita no máximo uma medida essencial por fator em monitoramento", () => {
    const resultado = normalizarSelecoesPlanoIA([
      { medida_modelo_id: "m-demandas-essencial", fatores_codes: ["demandas"] },
      { medida_modelo_id: "m-demandas-estruturante", fatores_codes: ["demandas"] },
    ], fatores, catalogo);

    expect(resultado.selecoes).toHaveLength(1);
    expect(resultado.selecoes[0].medida_modelo_id).toBe("m-demandas-essencial");
    expect(resultado.selecoes[0].prioridade).toBe("monitoramento");
    expect(resultado.descartadas).toBe(1);
  });

  it("descarta medidas para fator sem ação específica", () => {
    const resultado = normalizarSelecoesPlanoIA([
      { medida_modelo_id: "m-controle", fatores_codes: ["controle"] },
    ], fatores, catalogo);

    expect(resultado.selecoes).toEqual([]);
    expect(resultado.descartadas).toBe(1);
  });

  it("mantém múltiplas medidas válidas para fator com ação recomendada", () => {
    const resultado = normalizarSelecoesPlanoIA([
      { medida_modelo_id: "m-papel-1", fatores_codes: ["papel"] },
      { medida_modelo_id: "m-papel-2", fatores_codes: ["papel"] },
    ], fatores, catalogo);

    expect(resultado.selecoes).toHaveLength(2);
    expect(resultado.descartadas).toBe(0);
  });

  it("aceita resposta vazia como plano sem ações", () => {
    expect(normalizarSelecoesPlanoIA([], fatores, catalogo)).toEqual({
      selecoes: [],
      descartadas: 0,
    });
  });

  it("mantém a política também na RPC do banco", () => {
    const sql = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20260727141247_harden_collective_ai_monitoring_actions.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("MONITORAMENTO_IA_EXCEDE_LIMITE");
    expect(sql).toContain("MONITORAMENTO_IA_NAO_ESSENCIAL");
    expect(sql).toContain("FATOR_IA_SEM_ACAO");
    expect(sql).toContain("true, _selecionado, false, _ordem");
    expect(sql).toContain("'itens_selecionados', _itens_selecionados");
  });

  it("evita gravar novamente quando o plano vazio já é o estado desejado", () => {
    const edgeFunction = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/psico-gerar-plano-ia/index.ts",
      ),
      "utf8",
    );

    expect(edgeFunction).toContain("planoSemSugestoesAutomaticas");
    expect(edgeFunction).toContain("normalizadas.selecoes.length === 0");
    expect(edgeFunction).toContain("alteracao_banco: false");
  });
});
