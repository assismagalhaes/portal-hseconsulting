// Feature flag e tipos base da modalidade "Avaliação Assistida Individual — Microempresa".
// PR1: fundação (flag + tipos).
// PR2: seleção de modalidade, seed dos instrumentos AQI e criação de avaliação individual.
// Nenhuma UI é exposta enquanto a flag estiver desativada.

import { supabase } from "@/integrations/supabase/client";

export const PSICO_INDIVIDUAL_ENABLED: boolean =
  ((import.meta as any).env?.VITE_PSICO_INDIVIDUAL_ENABLED ?? "false")
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
  "Por envolver apenas 1 empregado e 1 empregador, o resultado é sempre nominal e não há tratamento estatístico ou anonimato. " +
  "Os achados são construídos por convergência entre as duas visões e complementados por revisão técnica.";

export const PSICO_INDIVIDUAL_AVISO_PRIVACIDADE =
  "Não haverá anonimato: o empregador saberá que a avaliação se refere ao empregado convidado e vice-versa. " +
  "As respostas ficam armazenadas com identificação e são acessadas apenas pela equipe técnica interna e pelas rotinas do sistema. " +
  "Campos livres podem conter conteúdo sensível — trate com o mesmo cuidado de uma entrevista clínica.";

// ---------- Instrumentos vigentes ----------

export type PsicoIndividualInstrumentoVigente = {
  id: string;
  codigo: string;
  versao: string;
  nome: string;
  papel: PsicoIndividualPapel;
};

/**
 * Retorna o par (empregado + empregador) de instrumentos vigentes da modalidade individual.
 * A associação de papel é feita pelo sufixo do código: `AQI-EMPREGADO*` → empregado.
 */
export async function listarInstrumentosVigentes(): Promise<{
  empregado: PsicoIndividualInstrumentoVigente | null;
  empregador: PsicoIndividualInstrumentoVigente | null;
  erro?: string;
}> {
  const { data, error } = await (supabase as any)
    .from("psico_individual_instrumentos_versoes")
    .select("id, codigo, versao, nome")
    .eq("vigente", true);
  if (error) return { empregado: null, empregador: null, erro: error.message };
  const map = (row: any, papel: PsicoIndividualPapel): PsicoIndividualInstrumentoVigente => ({
    id: row.id, codigo: row.codigo, versao: row.versao, nome: row.nome, papel,
  });
  const empregado = (data || []).find((r: any) => /EMPREGADO(?!R)/i.test(r.codigo));
  const empregador = (data || []).find((r: any) => /EMPREGADOR/i.test(r.codigo));
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
