import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// ============================================================
// FASE 6 · Contratos e fetchers dos resultados consolidados
// ============================================================
// Nenhuma função deste módulo lê respostas brutas.
// Nenhuma função aplica pesos ou recalcula significância.
// Todos os dados vêm das RPCs SECURITY DEFINER homologadas.
// ============================================================

export const RESULT_ERROR_CODES = [
  "PROCESSAMENTO_NAO_LOCALIZADO",
  "PROCESSAMENTO_INCOMPLETO",
  "ESCOPO_GLOBAL_NAO_LOCALIZADO",
  "FATORES_INCOMPLETOS",
  "PERGUNTAS_INCOMPLETAS",
  "CONTRATO_INVALIDO",
  "ACESSO_NEGADO",
  "ERRO_INTERNO_RESULTADO",
] as const;
export type ResultErrorCode = (typeof RESULT_ERROR_CODES)[number];

export const RESULT_ERROR_MESSAGE: Record<ResultErrorCode, string> = {
  PROCESSAMENTO_NAO_LOCALIZADO: "Esta avaliação ainda não possui um processamento consolidado disponível.",
  PROCESSAMENTO_INCOMPLETO: "O processamento desta avaliação está incompleto ou foi substituído.",
  ESCOPO_GLOBAL_NAO_LOCALIZADO: "Não foi possível carregar o resultado consolidado desta avaliação.",
  FATORES_INCOMPLETOS: "Os resultados dos fatores estão incompletos.",
  PERGUNTAS_INCOMPLETOS: "Os resultados das perguntas estão incompletos." as any, // typo-safe alias
  PERGUNTAS_INCOMPLETAS: "Os resultados das perguntas estão incompletos.",
  CONTRATO_INVALIDO: "Requisição inválida para os resultados.",
  ACESSO_NEGADO: "Acesso negado.",
  ERRO_INTERNO_RESULTADO: "Ocorreu um erro interno ao carregar os resultados.",
} as any;

// ---------- Enums ----------
export type ClassificacaoRisco = "irrelevante" | "baixo" | "medio" | "alto" | "critico";
export type PrioridadeFator = "monitoramento" | "media" | "alta" | "critica";
export type EscopoTipo = "global" | "funcao" | "setor" | "unidade";

// ---------- Schemas ----------
const classificacaoValores = ["irrelevante", "baixo", "medio", "alto", "critico"] as const;
const prioridadeValores = ["monitoramento", "media", "alta", "critica"] as const;

const classificacaoBanco: Record<string, (typeof classificacaoValores)[number]> = {
  "Risco Irrelevante": "irrelevante",
  "Risco Baixo": "baixo",
  "Risco Médio": "medio",
  "Risco Alto": "alto",
  "Risco Crítico": "critico",
};

const prioridadeBanco: Record<string, (typeof prioridadeValores)[number]> = {
  Monitoramento: "monitoramento",
  "Média": "media",
  Alta: "alta",
  "Crítica": "critica",
};

const classificacao = z.preprocess(
  (valor) => typeof valor === "string" ? classificacaoBanco[valor] ?? valor : valor,
  z.enum(classificacaoValores),
);
const prioridade = z.preprocess(
  (valor) => typeof valor === "string" ? prioridadeBanco[valor] ?? valor : valor,
  z.enum(prioridadeValores),
);

export function normalizarClassificacaoRisco(valor: unknown): ClassificacaoRisco {
  return classificacao.parse(valor);
}
const tipoEscopo    = z.enum(["global","funcao","setor","unidade"]);

const fatorSchema = z.object({
  id: z.string().uuid(),
  fator_id: z.string().uuid(),
  ordem: z.number().int(),
  fator_codigo: z.string(),
  fator_nome: z.string(),
  fator_descricao: z.string().nullable().optional(),
  quantidade_perguntas: z.number().int(),
  total_respostas_validas: z.number().int(),
  score_medio: z.coerce.number(),
  classificacao_media: classificacao,
  quantidade_irrelevante: z.number().int(),
  quantidade_baixo: z.number().int(),
  quantidade_medio: z.number().int(),
  quantidade_alto: z.number().int(),
  quantidade_critico: z.number().int(),
  percentual_irrelevante: z.coerce.number(),
  percentual_baixo: z.coerce.number(),
  percentual_medio: z.coerce.number(),
  percentual_alto: z.coerce.number(),
  percentual_critico: z.coerce.number(),
  percentual_medio_alto_critico: z.coerce.number(),
  percentual_alto_critico: z.coerce.number(),
  criterio_principal: z.boolean(),
  criterio_agravamento: z.boolean(),
  criterio_critico_automatico: z.boolean(),
  criterios_acionados: z.array(z.string()).nullable().optional(),
  significativo: z.boolean(),
  prioridade: prioridade,
});
export type FatorResultado = z.infer<typeof fatorSchema>;

const perguntaAtencaoSchema = z.object({
  pergunta_id: z.string().uuid(),
  numero: z.number().int(),
  fator_id: z.string().uuid(),
  fator_nome: z.string(),
  fator_codigo: z.string(),
  enunciado: z.string().nullable().optional(),
  inversa: z.boolean().nullable().optional(),
  score_medio: z.coerce.number(),
  classificacao_media: classificacao,
  percentual_desfavoravel: z.coerce.number(),
  percentual_alto_critico: z.coerce.number(),
  percentual_critico: z.coerce.number(),
});
export type PerguntaAtencao = z.infer<typeof perguntaAtencaoSchema>;

export const dashboardSchema = z.object({
  avaliacao: z.object({
    id: z.string().uuid(),
    codigo: z.string(),
    titulo: z.string(),
    cliente: z.string().nullable().optional(),
    unidade: z.string().nullable().optional(),
    status: z.string(),
    data_inicio_prevista: z.string().nullable().optional(),
    data_fim_prevista: z.string().nullable().optional(),
  }),
  processamento: z.object({
    id: z.string().uuid(),
    versao_motor: z.string(),
    hash_abreviado: z.string(),
    processado_em: z.string(),
    questionario: z.object({ codigo: z.string().nullable(), versao: z.string().nullable() }),
    metodologia:  z.object({ codigo: z.string().nullable(), versao: z.string().nullable() }),
    total_respondentes: z.number().int(),
    total_itens: z.number().int(),
    total_escopos: z.number().int(),
    escopos_funcao_elegiveis: z.number().int(),
    escopos_setor_elegiveis: z.number().int(),
    escopos_unidade_elegiveis: z.number().int(),
    escopos_suprimidos: z.number().int(),
  }),
  escopo: z.object({
    id: z.string().uuid(),
    tipo: tipoEscopo,
    rotulo: z.string().nullable(),
    respondentes: z.number().int(),
    minimo_aplicado: z.number().int(),
    amostra_reduzida: z.boolean(),
    total_itens: z.number().int(),
    fatores_significativos: z.number().int(),
    prioridade_maxima: prioridade,
    indice_geral_descritivo: z.coerce.number(),
    classificacao_indice_geral: classificacao,
  }),
  participacao: z.object({
    previstos: z.number().int().nullable(),
    ativos_abertura: z.number().int().nullable(),
    respondentes: z.number().int(),
    percentual: z.coerce.number().nullable(),
    coleta_aberta_em: z.string().nullable(),
    coleta_encerrada_em: z.string().nullable(),
  }),
  resumo: z.object({
    indice_geral_descritivo: z.coerce.number(),
    classificacao_indice_geral: classificacao,
    fatores_significativos: z.number().int(),
    prioridade_maxima: prioridade,
    total_respostas_validas: z.number().int(),
  }),
  fatores: z.array(fatorSchema),
  perguntas_atencao: z.array(perguntaAtencaoSchema),
  avisos: z.array(z.object({ codigo: z.string() })),
});
export type PsicoDashboard = z.infer<typeof dashboardSchema>;

export const interpretacaoSchema = z.object({
  gerado_em: z.string(),
  escopo_id: z.string().uuid(),
  resumo_geral: z.string(),
  situacao_amostra: z.string(),
  fatores_prioritarios: z.array(z.object({
    fator_id: z.string().uuid(),
    codigo: z.string(),
    nome: z.string(),
    ordem: z.number().int(),
    classificacao_media: classificacao,
    prioridade: prioridade,
    criterio_principal: z.boolean(),
    criterio_agravamento: z.boolean(),
    criterio_critico_automatico: z.boolean(),
    prioridade_ord: z.number().int(),
    texto: z.string(),
  })),
  fatores_monitoramento: z.array(z.object({
    fator_id: z.string().uuid(),
    codigo: z.string(),
    nome: z.string(),
    ordem: z.number().int(),
    classificacao_media: classificacao,
    texto: z.string(),
  })),
  perguntas_atencao: z.array(z.object({
    numero: z.number().int(),
    pergunta_id: z.string().uuid(),
    fator_id: z.string().uuid(),
    fator_nome: z.string(),
    percentual_desfavoravel: z.coerce.number(),
    percentual_alto_critico: z.coerce.number(),
    percentual_critico: z.coerce.number(),
  })),
  limitacoes: z.array(z.string()),
});
export type PsicoInterpretacao = z.infer<typeof interpretacaoSchema>;

export const comparacaoSchema = z.object({
  tipo: z.enum(["funcao","setor","unidade"]),
  segmentos: z.array(z.object({
    id: z.string().uuid(),
    rotulo: z.string(),
    respondentes: z.number().int(),
    minimo_aplicado: z.number().int(),
    fatores_significativos: z.number().int(),
    prioridade_maxima: prioridade,
    indice_geral_descritivo: z.coerce.number(),
    classificacao_indice_geral: classificacao,
    amostra_reduzida: z.boolean(),
  })),
  fatores: z.array(z.object({
    fator_id: z.string().uuid(),
    codigo: z.string(),
    nome: z.string(),
    ordem: z.number().int(),
  })),
  matriz: z.array(z.object({
    segmento_id: z.string().uuid(),
    fator_id: z.string().uuid(),
    score_medio: z.coerce.number(),
    classificacao_media: classificacao,
    significativo: z.boolean(),
    prioridade: prioridade,
    percentual_alto_critico: z.coerce.number(),
    percentual_critico: z.coerce.number(),
  })),
});
export type PsicoComparacao = z.infer<typeof comparacaoSchema>;

// ---------- Fetchers ----------
function extractError(data: any): ResultErrorCode | null {
  if (data && typeof data === "object" && typeof data.erro === "string") {
    const err = data.erro as ResultErrorCode;
    return (RESULT_ERROR_CODES as readonly string[]).includes(err) ? err : "ERRO_INTERNO_RESULTADO";
  }
  return null;
}

export async function getPsicoDashboardResults(
  avaliacaoId: string,
  escopoId: string | null = null,
): Promise<{ ok: true; data: PsicoDashboard } | { ok: false; code: ResultErrorCode; message: string }> {
  const { data, error } = await supabase.rpc("psico_obter_dashboard_resultados" as any, {
    p_avaliacao_id: avaliacaoId,
    p_escopo_id: escopoId,
  } as any);
  if (error) return { ok: false, code: "ERRO_INTERNO_RESULTADO", message: "Não foi possível carregar o resultado consolidado desta avaliação." };
  const err = extractError(data);
  if (err) return { ok: false, code: err, message: RESULT_ERROR_MESSAGE[err] };
  const parsed = dashboardSchema.safeParse(data);
  if (!parsed.success) return { ok: false, code: "CONTRATO_INVALIDO", message: RESULT_ERROR_MESSAGE.CONTRATO_INVALIDO };
  return { ok: true, data: parsed.data };
}

export async function getPsicoExecutiveInterpretation(
  avaliacaoId: string,
  escopoId: string | null = null,
): Promise<{ ok: true; data: PsicoInterpretacao } | { ok: false; code: ResultErrorCode; message: string }> {
  const { data, error } = await supabase.rpc("psico_obter_interpretacao_executiva" as any, {
    p_avaliacao_id: avaliacaoId,
    p_escopo_id: escopoId,
  } as any);
  if (error) return { ok: false, code: "ERRO_INTERNO_RESULTADO", message: "Não foi possível gerar a interpretação executiva." };
  const err = extractError(data);
  if (err) return { ok: false, code: err, message: RESULT_ERROR_MESSAGE[err] };
  const parsed = interpretacaoSchema.safeParse(data);
  if (!parsed.success) return { ok: false, code: "CONTRATO_INVALIDO", message: RESULT_ERROR_MESSAGE.CONTRATO_INVALIDO };
  return { ok: true, data: parsed.data };
}

export async function getPsicoSegmentComparison(
  avaliacaoId: string,
  tipo: "funcao" | "setor" | "unidade",
): Promise<{ ok: true; data: PsicoComparacao } | { ok: false; code: ResultErrorCode; message: string }> {
  const { data, error } = await supabase.rpc("psico_obter_comparacao_segmentacoes" as any, {
    p_avaliacao_id: avaliacaoId,
    p_tipo: tipo,
  } as any);
  if (error) return { ok: false, code: "ERRO_INTERNO_RESULTADO", message: "Não foi possível carregar a comparação de segmentos." };
  const err = extractError(data);
  if (err) return { ok: false, code: err, message: RESULT_ERROR_MESSAGE[err] };
  const parsed = comparacaoSchema.safeParse(data);
  if (!parsed.success) return { ok: false, code: "CONTRATO_INVALIDO", message: RESULT_ERROR_MESSAGE.CONTRATO_INVALIDO };
  return { ok: true, data: parsed.data };
}
