import { describe, expect, it } from "vitest";
import { dashboardSchema } from "@/lib/psicoResultados";

const dashboardBanco = {
  avaliacao: {
    id: "11111111-1111-4111-8111-111111111111",
    codigo: "AFP-2026-000002",
    titulo: "Avaliação",
    cliente: "Cliente",
    unidade: "Geral",
    status: "resultado_pronto",
    data_inicio_prevista: "2026-07-13",
    data_fim_prevista: "2026-07-16",
  },
  processamento: {
    id: "22222222-2222-4222-8222-222222222222",
    versao_motor: "1.0",
    hash_abreviado: "abcdef123456",
    processado_em: "2026-07-15T12:00:00Z",
    questionario: { codigo: "QPPOT-2.0", versao: "2.0" },
    metodologia: { codigo: "HSE-PSICO-2.0", versao: "2.0" },
    total_respondentes: 2,
    total_itens: 70,
    total_escopos: 1,
    escopos_funcao_elegiveis: 0,
    escopos_setor_elegiveis: 0,
    escopos_unidade_elegiveis: 0,
    escopos_suprimidos: 0,
  },
  escopo: {
    id: "33333333-3333-4333-8333-333333333333",
    tipo: "global",
    rotulo: "Global",
    respondentes: 2,
    minimo_aplicado: 2,
    amostra_reduzida: true,
    total_itens: 70,
    fatores_significativos: 0,
    prioridade_maxima: "Monitoramento",
    indice_geral_descritivo: 1.25,
    classificacao_indice_geral: "Risco Baixo",
  },
  participacao: {
    previstos: 9,
    ativos_abertura: 9,
    respondentes: 2,
    percentual: 22.22,
    coleta_aberta_em: "2026-07-14T12:00:00Z",
    coleta_encerrada_em: "2026-07-15T12:00:00Z",
  },
  resumo: {
    indice_geral_descritivo: 1.25,
    classificacao_indice_geral: "Risco Baixo",
    fatores_significativos: 0,
    prioridade_maxima: "Monitoramento",
    total_respostas_validas: 70,
  },
  fatores: [{
    id: "44444444-4444-4444-8444-444444444444",
    fator_id: "55555555-5555-4555-8555-555555555555",
    ordem: 1,
    fator_codigo: "carga_excessiva",
    fator_nome: "Carga Excessiva",
    quantidade_perguntas: 8,
    total_respostas_validas: 16,
    score_medio: 1.25,
    classificacao_media: "Risco Baixo",
    quantidade_irrelevante: 1,
    quantidade_baixo: 10,
    quantidade_medio: 5,
    quantidade_alto: 0,
    quantidade_critico: 0,
    percentual_irrelevante: 6.25,
    percentual_baixo: 62.5,
    percentual_medio: 31.25,
    percentual_alto: 0,
    percentual_critico: 0,
    percentual_medio_alto_critico: 31.25,
    percentual_alto_critico: 0,
    criterio_principal: false,
    criterio_agravamento: false,
    criterio_critico_automatico: false,
    criterios_acionados: [],
    significativo: false,
    prioridade: "Monitoramento",
  }],
  perguntas_atencao: [{
    pergunta_id: "66666666-6666-4666-8666-666666666666",
    numero: 1,
    fator_id: "55555555-5555-4555-8555-555555555555",
    fator_nome: "Carga Excessiva",
    fator_codigo: "carga_excessiva",
    enunciado: "Pergunta",
    inversa: false,
    score_medio: 2,
    classificacao_media: "Risco Médio",
    percentual_desfavoravel: 50,
    percentual_alto_critico: 0,
    percentual_critico: 0,
  }],
  avisos: [{ codigo: "AMOSTRA_REDUZIDA" }],
};

describe("dashboard psicossocial", () => {
  it("normaliza os enums canônicos retornados pelo banco", () => {
    const resultado = dashboardSchema.parse(dashboardBanco);

    expect(resultado.escopo.classificacao_indice_geral).toBe("baixo");
    expect(resultado.escopo.prioridade_maxima).toBe("monitoramento");
    expect(resultado.fatores[0].classificacao_media).toBe("baixo");
    expect(resultado.perguntas_atencao[0].classificacao_media).toBe("medio");
  });
});
