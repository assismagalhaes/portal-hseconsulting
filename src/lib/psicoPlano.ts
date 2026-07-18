import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type PlanoStatus = "rascunho" | "revisado" | "aprovado";
export type AbrangenciaTipo = "global" | "funcao" | "setor" | "unidade";

export const PLANO_STATUS_LABEL: Record<PlanoStatus, string> = {
  rascunho: "Rascunho",
  revisado: "Revisado",
  aprovado: "Aprovado",
};
export const PLANO_STATUS_COLOR: Record<PlanoStatus, string> = {
  rascunho: "bg-muted text-foreground",
  revisado: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  aprovado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const NIVEL_COLOR: Record<string, string> = {
  basica: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  intermediaria: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  avancada: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  transversal: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
};

export async function getPlanoPorRevisao(revisaoId: string) {
  const { data } = await sb.from("psico_planos_acao").select("*").eq("revisao_id", revisaoId).maybeSingle();
  return data;
}

export async function listItens(planoId: string) {
  const { data } = await sb.from("psico_plano_acao_itens").select("*").eq("plano_id", planoId).order("ordem");
  return data || [];
}

export async function listItemFatores(planoId: string) {
  const { data } = await sb
    .from("psico_plano_item_fatores")
    .select("id, plano_item_id, fator_codigo, resultado_fator_id, psico_plano_acao_itens!inner(plano_id)")
    .eq("psico_plano_acao_itens.plano_id", planoId);
  return data || [];
}

export async function atualizarItem(id: string, patch: Record<string, any>) {
  return sb.from("psico_plano_acao_itens").update(patch).eq("id", id);
}

export async function atualizarPlano(id: string, patch: Record<string, any>) {
  return sb.from("psico_planos_acao").update(patch).eq("id", id);
}

export async function marcarPlanoRevisado(id: string) {
  return sb.rpc("psico_marcar_plano_revisado", { p_plano_id: id });
}

export async function excluirItem(id: string) {
  return sb.from("psico_plano_acao_itens").delete().eq("id", id);
}

export async function criarItemPersonalizado(planoId: string, patch: Record<string, any>, fatoresCodes: string[], resultadoFatorPorCodigo: Record<string, string>) {
  const { data, error } = await sb.from("psico_plano_acao_itens").insert({
    plano_id: planoId,
    personalizado: true,
    gerado_automaticamente: false,
    selecionado: true,
    ordem: 9999,
    ...patch,
  }).select("id").single();
  if (error || !data) return { error };
  const links = fatoresCodes.map((c) => ({
    plano_item_id: data.id,
    fator_codigo: c,
    resultado_fator_id: resultadoFatorPorCodigo[c] || null,
  }));
  if (links.length) {
    const { error: e2 } = await sb.from("psico_plano_item_fatores").insert(links);
    if (e2) return { error: e2 };
  }
  return { data };
}

export async function regenerarRecomendacoes(revisaoId: string, confirmacao: string) {
  return sb.rpc("psico_regenerar_recomendacoes", { p_revisao_id: revisaoId, p_confirmacao: confirmacao });
}

export async function getMedidasCatalogo(bibliotecaVersaoId: string) {
  const { data } = await sb
    .from("psico_medidas_modelos")
    .select("id, fator_codigo, codigo, titulo, nivel_recomendacao, grupo_transversal, o_que_significa, orientacoes_praticas, exemplos_aplicacao, responsaveis_sugeridos, evidencias_recomendadas, indicadores_sugeridos, prazo_sugerido_dias")
    .eq("biblioteca_versao_id", bibliotecaVersaoId)
    .eq("ativo", true)
    .order("fator_codigo").order("ordem");
  return data || [];
}

export async function getResultadoFatoresPorRevisao(revisaoId: string) {
  const { data } = await sb
    .from("psico_revisoes_fatores")
    .select("fator_codigo, resultado_fator_id")
    .eq("revisao_id", revisaoId);
  const map: Record<string, string> = {};
  (data || []).forEach((x: any) => { if (x.resultado_fator_id) map[x.fator_codigo] = x.resultado_fator_id; });
  return map;
}

export async function adicionarMedidaDoModelo(planoId: string, medidaId: string, fatoresCodes: string[], resultadoFatorPorCodigo: Record<string, string>) {
  const { data: med } = await sb.from("psico_medidas_modelos").select("*").eq("id", medidaId).maybeSingle();
  if (!med) return { error: { message: "Medida não localizada" } };
  return criarItemPersonalizado(planoId, {
    medida_modelo_id: med.id,
    codigo_origem: med.codigo,
    titulo: med.titulo,
    acao_recomendada: med.titulo,
    objetivo: med.o_que_significa,
    orientacoes_praticas: med.orientacoes_praticas,
    exemplos_aplicacao: med.exemplos_aplicacao,
    nivel_recomendacao: med.nivel_recomendacao,
    grupo_transversal: med.grupo_transversal,
    responsaveis_sugeridos: med.responsaveis_sugeridos,
    prazo_sugerido_dias: med.prazo_sugerido_dias,
    evidencias_recomendadas: med.evidencias_recomendadas,
    indicador_sugerido: (med.indicadores_sugeridos || [])[0] || null,
    personalizado: false,
  }, fatoresCodes, resultadoFatorPorCodigo);
}
