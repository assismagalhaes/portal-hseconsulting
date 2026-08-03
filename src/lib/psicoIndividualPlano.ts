import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type IndPlanoItem = {
  id: string;
  avaliacao_id: string;
  achado_id: string;
  perigo_codigo: string | null;
  fator_codigo: string;
  origem: "manual" | "catalogo" | "ia";
  medida_modelo_id: string | null;
  titulo: string;
  objetivo: string;
  acao_recomendada: string;
  responsavel_sugerido: string | null;
  responsavel_definido: string | null;
  prazo_sugerido_dias: number | null;
  prazo_definido: string | null;
  evidencia_recomendada: string | null;
  evidencia_definida: string | null;
  indicador_eficacia: string | null;
  justificativa: string | null;
  nivel_recomendacao: string | null;
  ordem: number;
  aprovado: boolean;
  aprovado_em: string | null;
  aprovado_por: string | null;
  imutavel: boolean;
  created_at: string;
  updated_at: string;
  achado_estado: string;
  achado_necessita_acao: boolean;
};

export type SugestaoIA = {
  achado_id: string;
  titulo: string;
  objetivo: string;
  acao: string;
  responsavel_sugerido: string;
  prazo_dias: number;
  evidencia: string;
  indicador_eficacia: string;
  justificativa: string;
  medida_catalogo_id?: string | null;
  medida_catalogo_codigo?: string | null;
};

export async function listarPlanoIndividual(avaliacaoId: string): Promise<IndPlanoItem[]> {
  const { data, error } = await sb.rpc("psico_ind_plano_listar", { p_avaliacao: avaliacaoId });
  if (error) throw error;
  return (data as IndPlanoItem[]) ?? [];
}

export async function criarItemPlanoIndividual(patch: Partial<IndPlanoItem> & {
  avaliacao_id: string; achado_id: string; fator_codigo: string;
  titulo: string; objetivo: string; acao_recomendada: string;
}) {
  const { data, error } = await sb
    .from("psico_ind_plano_itens")
    .insert({ origem: "manual", ordem: 100, ...patch })
    .select("id")
    .single();
  return { data, error };
}

export async function atualizarItemPlanoIndividual(id: string, patch: Partial<IndPlanoItem>) {
  return sb.from("psico_ind_plano_itens").update(patch).eq("id", id);
}

export async function excluirItemPlanoIndividual(id: string) {
  return sb.from("psico_ind_plano_itens").delete().eq("id", id);
}

export async function aprovarPlanoIndividual(avaliacaoId: string) {
  return sb.rpc("psico_ind_plano_aprovar", { p_avaliacao: avaliacaoId });
}

export async function gatesPlanoIndividual(avaliacaoId: string) {
  const { data, error } = await sb.rpc("psico_ind_plano_gates", { p_avaliacao: avaliacaoId });
  if (error) throw error;
  return data as {
    achados_sem_acao: { achado_id: string; fator_codigo: string; estado_final: string }[];
    prioritarios_sem_acao: { achado_id: string; fator_codigo: string }[];
    itens_incompletos: { item_id: string; titulo: string; faltando: string[] }[];
    pronto_para_aprovacao: boolean;
  };
}

export async function sugerirPlanoIA(avaliacaoId: string) {
  const { data, error } = await sb.functions.invoke("psico-individual-sugerir-plano", {
    body: { avaliacao_id: avaliacaoId },
  });
  return { data, error };
}

export async function listarAchadosDaAvaliacao(avaliacaoId: string) {
  const { data, error } = await sb.rpc("psico_ind_listar_achados", { p_avaliacao: avaliacaoId });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export function sugestaoToPatch(s: SugestaoIA, avaliacaoId: string, fatorCodigo: string, perigoCodigo?: string | null): Parameters<typeof criarItemPlanoIndividual>[0] {
  return {
    avaliacao_id: avaliacaoId,
    achado_id: s.achado_id,
    fator_codigo: fatorCodigo,
    perigo_codigo: perigoCodigo ?? null,
    origem: "ia",
    titulo: s.titulo,
    objetivo: s.objetivo,
    acao_recomendada: s.acao,
    responsavel_sugerido: s.responsavel_sugerido,
    prazo_sugerido_dias: s.prazo_dias,
    evidencia_recomendada: s.evidencia,
    indicador_eficacia: s.indicador_eficacia,
    justificativa: s.justificativa,
    medida_modelo_id: s.medida_catalogo_id ?? null,
  } as any;
}