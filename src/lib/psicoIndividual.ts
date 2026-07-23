// Feature flag e tipos base da modalidade "Avaliação Assistida Individual — Microempresa".
// PR1: fundação (flag + tipos).
// PR2: seleção de modalidade, seed dos instrumentos AQI e criação de avaliação individual.
// Nenhuma UI é exposta enquanto a flag estiver desativada.

import { supabase } from "@/integrations/supabase/client";

export const PSICO_INDIVIDUAL_ENABLED: boolean =
  (import.meta.env.VITE_PSICO_INDIVIDUAL_ENABLED ?? "true")
    .toString()
    .toLowerCase() === "true";

// Sub-flag: libera a geração de plano de ação por IA para a modalidade individual.
// Coleta/processamento/parecer continuam funcionando com a modalidade habilitada;
// apenas o botão "Sugerir com IA" no plano é gated por esta flag.
// Default: false (ordem de liberação do PR7 — coleta → plano manual → IA de plano → parecer).
export const PSICO_INDIVIDUAL_AI_PLAN_ENABLED: boolean =
  (import.meta.env.VITE_PSICO_INDIVIDUAL_AI_PLAN_ENABLED ?? "false")
    .toString()
    .toLowerCase() === "true";

export type PsicoModalidade = "coletiva_hse" | "individual_microempresa";

export const PSICO_MODALIDADE_LABEL: Record<PsicoModalidade, string> = {
  coletiva_hse: "Coletiva (metodologia HSE)",
  individual_microempresa: "Assistida individual — Microempresa",
};

export type PsicoIndividualPapel = "empregador" | "empregado";

export type PsicoIndividualEstadoConvergencia =
  | "convergente"
  | "divergente"
  | "apenas_empregador"
  | "apenas_empregado"
  | "indeterminado";

// Textos oficiais de aviso — mostrados antes da confirmação de criação.
export const PSICO_INDIVIDUAL_AVISO_METODOLOGICO =
  "A modalidade Assistida Individual — Microempresa não usa a metodologia coletiva HSE. " +
  "Por envolver apenas 1 empregado e 1 empregador, não há tratamento estatístico nem garantia de anonimato por grupo. " +
  "Os achados são construídos por convergência entre as duas visões e complementados por revisão técnica.";

export const PSICO_INDIVIDUAL_AVISO_PRIVACIDADE =
  "As respostas são confidenciais, mas não podem ser consideradas anônimas em uma empresa com apenas um empregado. " +
  "O relatório deve apresentar condições organizacionais e medidas de prevenção, sem reproduzir respostas livres nem atribuir frases a uma pessoa. " +
  "Campos livres podem conter conteúdo sensível e são restritos à equipe técnica autorizada.";

// ---------- Instrumentos vigentes ----------

export type PsicoIndividualInstrumentoVigente = {
  id: string;
  codigo: string;
  versao: string;
  nome: string;
  papel: PsicoIndividualPapel;
};

type InstrumentoRow = Pick<PsicoIndividualInstrumentoVigente, "id" | "codigo" | "versao" | "nome">;

/**
 * Retorna o par (empregado + empregador) de instrumentos vigentes da modalidade individual.
 * A associação de papel é feita pelo sufixo do código: `AQI-EMPREGADO*` → empregado.
 */
export async function listarInstrumentosVigentes(): Promise<{
  empregado: PsicoIndividualInstrumentoVigente | null;
  empregador: PsicoIndividualInstrumentoVigente | null;
  erro?: string;
}> {
  // A tabela será incorporada aos tipos gerados após a migração no projeto alvo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("psico_individual_instrumentos_versoes")
    .select("id, codigo, versao, nome")
    .eq("vigente", true)
    .not("publicado_em", "is", null)
    .order("publicado_em", { ascending: false });
  if (error) return { empregado: null, empregador: null, erro: error.message };
  const rows = (data || []) as InstrumentoRow[];
  const map = (row: InstrumentoRow, papel: PsicoIndividualPapel): PsicoIndividualInstrumentoVigente => ({
    id: row.id, codigo: row.codigo, versao: row.versao, nome: row.nome, papel,
  });
  const empregado = rows.find((r) => /EMPREGADO(?!R)/i.test(r.codigo));
  const empregador = rows.find((r) => /EMPREGADOR/i.test(r.codigo));
  return {
    empregado: empregado ? map(empregado, "empregado") : null,
    empregador: empregador ? map(empregador, "empregador") : null,
  };
}

// ---------- Criação de avaliação individual ----------

export type CriarAvaliacaoIndividualInput = {
  cliente_id: string;
  titulo: string;
  unidade?: string | null;
  data_inicio_prevista?: string | null;
  data_fim_prevista?: string | null;
  responsavel_hse_id?: string | null;
  responsavel_profissional_id?: string | null;
  observacoes_internas?: string | null;
  instrumento_empregado_versao_id: string;
  instrumento_empregador_versao_id: string;
};

export async function criarAvaliacaoIndividual(
  input: CriarAvaliacaoIndividualInput,
): Promise<{ id: string | null; erro?: string }> {
  if (!input.cliente_id) return { id: null, erro: "Cliente é obrigatório" };
  if (!input.titulo?.trim()) return { id: null, erro: "Título é obrigatório" };
  if (!input.instrumento_empregado_versao_id || !input.instrumento_empregador_versao_id) {
    return { id: null, erro: "Instrumentos AQI vigentes não encontrados. Verifique com a equipe técnica." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("psico_avaliacoes")
    .insert({
      cliente_id: input.cliente_id,
      titulo: input.titulo.trim(),
      unidade: input.unidade || "Matriz",
      data_inicio_prevista: input.data_inicio_prevista || null,
      data_fim_prevista: input.data_fim_prevista || null,
      quantidade_participantes_prevista: 1,
      responsavel_hse_id: input.responsavel_hse_id || null,
      responsavel_profissional_id: input.responsavel_profissional_id || null,
      observacoes_internas: input.observacoes_internas || null,
      modalidade: "individual_microempresa",
      instrumento_empregado_versao_id: input.instrumento_empregado_versao_id,
      instrumento_empregador_versao_id: input.instrumento_empregador_versao_id,
      metodologia_versao_id: null,
      questionario_versao_id: null,
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) return { id: null, erro: error.message };
  return { id: data!.id };
}

// ---------- Utilidades ----------

export function descreverInstrumento(inst: PsicoIndividualInstrumentoVigente | null): string {
  if (!inst) return "—";
  return `${inst.codigo} v${inst.versao} — ${inst.nome}`;
}

export function isModalidadeIndividual(m: string | null | undefined): boolean {
  return m === "individual_microempresa";
}
