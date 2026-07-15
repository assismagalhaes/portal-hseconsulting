import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type RevisaoStatus = "rascunho" | "pronta_para_aprovacao" | "aprovada" | "reaberta" | "substituida";
export type RevisaoModo = "rapida" | "detalhada";
export type TratamentoTecnico = "acao_recomendada" | "monitoramento_preventivo" | "sem_acao_especifica";

export const STATUS_REVISAO_LABEL: Record<RevisaoStatus, string> = {
  rascunho: "Rascunho",
  pronta_para_aprovacao: "Pronta para aprovação",
  aprovada: "Aprovada",
  reaberta: "Reaberta",
  substituida: "Substituída",
};

export const STATUS_REVISAO_COLOR: Record<RevisaoStatus, string> = {
  rascunho: "bg-muted text-foreground",
  pronta_para_aprovacao: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  aprovada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  reaberta: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  substituida: "bg-muted text-muted-foreground",
};

export const TRATAMENTO_LABEL: Record<TratamentoTecnico, string> = {
  acao_recomendada: "Ação recomendada",
  monitoramento_preventivo: "Monitoramento preventivo",
  sem_acao_especifica: "Sem ação específica",
};

export const PRIORIDADE_COLOR: Record<string, string> = {
  critica: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  alta: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  baixa: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export async function getRevisaoAtiva(avaliacaoId: string) {
  const { data } = await sb
    .from("psico_revisoes_tecnicas")
    .select("*")
    .eq("avaliacao_id", avaliacaoId)
    .eq("ativa", true)
    .maybeSingle();
  return data;
}

export async function getRevisaoFatores(revisaoId: string) {
  const { data } = await sb
    .from("psico_revisoes_fatores")
    .select("*")
    .eq("revisao_id", revisaoId)
    .order("ordem_relatorio");
  return data || [];
}

export async function criarRevisao(avaliacaoId: string, modo: RevisaoModo = "rapida") {
  return sb.rpc("psico_criar_revisao_tecnica", { p_avaliacao_id: avaliacaoId, p_modo: modo });
}

export async function validarRevisao(revisaoId: string) {
  return sb.rpc("psico_validar_revisao_tecnica", { p_revisao_id: revisaoId });
}

export async function aprovarRevisao(revisaoId: string, confirmacao: string) {
  return sb.rpc("psico_aprovar_revisao_tecnica", { p_revisao_id: revisaoId, p_confirmacao: confirmacao });
}

export async function reabrirRevisao(revisaoId: string, motivo: string) {
  return sb.rpc("psico_reabrir_revisao_tecnica", { p_revisao_id: revisaoId, p_motivo: motivo });
}

export async function atualizarRevisao(revisaoId: string, patch: Record<string, any>) {
  return sb.from("psico_revisoes_tecnicas").update(patch).eq("id", revisaoId);
}

export async function atualizarRevisaoFator(id: string, patch: Record<string, any>) {
  return sb.from("psico_revisoes_fatores").update(patch).eq("id", id);
}

export const ERRO_LABEL: Record<string, string> = {
  RESPONSAVEL_TECNICO_AUSENTE: "Responsável técnico não definido",
  CONCLUSAO_INCOMPLETA: "Conclusão técnica insuficiente (mín. 50 caracteres)",
  LIMITACOES_INCOMPLETAS: "Limitações não descritas (mín. 10 caracteres)",
  FATOR_SIGNIFICATIVO_SEM_ACAO: "Fator significativo sem ação selecionada no plano",
};

export function traduzirErro(cod: string) {
  if (ERRO_LABEL[cod]) return ERRO_LABEL[cod];
  if (cod.startsWith("ITENS_SEM_RESPONSAVEL:")) return `${cod.split(":")[1]} item(ns) do plano sem responsável`;
  if (cod.startsWith("ITENS_SEM_PRAZO:")) return `${cod.split(":")[1]} item(ns) do plano sem prazo`;
  if (cod.startsWith("ITENS_SEM_EVIDENCIA:")) return `${cod.split(":")[1]} item(ns) do plano sem evidência recomendada`;
  return cod;
}