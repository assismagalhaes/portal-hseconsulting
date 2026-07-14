import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type PsicoAvaliacaoStatus =
  | "rascunho"
  | "coleta_em_andamento"
  | "coleta_encerrada"
  | "resultado_pronto"
  | "relatorio_emitido"
  | "cancelada";

export const PSICO_STATUS_LABEL: Record<PsicoAvaliacaoStatus, string> = {
  rascunho: "Rascunho",
  coleta_em_andamento: "Coleta em andamento",
  coleta_encerrada: "Coleta encerrada",
  resultado_pronto: "Resultado pronto",
  relatorio_emitido: "Relatório emitido",
  cancelada: "Cancelada",
};

export const PSICO_STATUS_COLOR: Record<PsicoAvaliacaoStatus, string> = {
  rascunho: "bg-muted text-foreground",
  coleta_em_andamento: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  coleta_encerrada: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  resultado_pronto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  relatorio_emitido: "bg-primary/15 text-primary",
  cancelada: "bg-destructive/15 text-destructive",
};

export const PSICO_STATUS_ORDER: PsicoAvaliacaoStatus[] = [
  "rascunho",
  "coleta_em_andamento",
  "coleta_encerrada",
  "resultado_pronto",
  "relatorio_emitido",
  "cancelada",
];

export interface PsicoAvaliacaoInput {
  cliente_id: string;
  titulo: string;
  unidade?: string;
  data_inicio_prevista?: string | null;
  data_fim_prevista?: string | null;
  quantidade_participantes_prevista: number;
  responsavel_hse_id: string;
  servico_execucao_id?: string | null;
  observacoes_internas?: string | null;
}

export async function listAvaliacoes() {
  return supabase
    .from("psico_avaliacoes")
    .select("id, codigo, titulo, status, unidade, data_inicio_prevista, data_fim_prevista, quantidade_participantes_prevista, responsavel_hse_id, updated_at, created_at, cliente_id, clients(id, razao_social, nome_fantasia)")
    .order("created_at", { ascending: false });
}

export async function contarPorStatus(): Promise<Record<PsicoAvaliacaoStatus, number>> {
  const { data } = await supabase.from("psico_avaliacoes").select("status");
  const acc = Object.fromEntries(PSICO_STATUS_ORDER.map((s) => [s, 0])) as Record<PsicoAvaliacaoStatus, number>;
  (data || []).forEach((r: any) => { acc[r.status as PsicoAvaliacaoStatus] = (acc[r.status as PsicoAvaliacaoStatus] || 0) + 1; });
  return acc;
}

export function statusLabel(s: string) { return PSICO_STATUS_LABEL[s as PsicoAvaliacaoStatus] || s; }
export function statusColor(s: string) { return PSICO_STATUS_COLOR[s as PsicoAvaliacaoStatus] || "bg-muted"; }

// ============ Fase 2: configuração ============

export async function getVersaoVigente() {
  return sb.from("psico_questionarios_versoes").select("*").eq("vigente", true).maybeSingle();
}

export async function getQuestionarioConfig(codigo = "QPPOT-2.0") {
  const { data: quest } = await sb.from("psico_questionarios_versoes").select("*").eq("codigo", codigo).maybeSingle();
  if (!quest) return { quest: null, metod: null, fatores: [], perguntas: [], opcoes: [] };
  const { data: metod } = await sb.from("psico_metodologias_versoes").select("*").eq("id", quest.metodologia_versao_id).maybeSingle();
  const [{ data: fatores }, { data: perguntas }, { data: opcoes }] = await Promise.all([
    sb.from("psico_fatores").select("*").eq("questionario_versao_id", quest.id).order("ordem"),
    sb.from("psico_perguntas").select("*").eq("questionario_versao_id", quest.id).order("numero"),
    sb.from("psico_opcoes_resposta").select("*").eq("metodologia_versao_id", quest.metodologia_versao_id).order("ordem"),
  ]);
  return { quest, metod, fatores: fatores || [], perguntas: perguntas || [], opcoes: opcoes || [] };
}

export async function validarQuestionario(id: string) {
  return sb.rpc("psico_validar_questionario", { _questionario_id: id });
}

export async function publicarQuestionario(id: string, confirmacao: string) {
  return sb.rpc("psico_publicar_questionario", { _questionario_id: id, _confirmacao: confirmacao });
}

export async function duplicarQuestionario(id: string, novoCodigo: string, novaVersao: string, novoNome?: string) {
  return sb.rpc("psico_duplicar_questionario", { _questionario_id: id, _novo_codigo: novoCodigo, _nova_versao: novaVersao, _novo_nome: novoNome ?? null });
}

export async function vincularVersaoVigente(avaliacaoId: string) {
  return sb.rpc("psico_vincular_versao_vigente", { _avaliacao_id: avaliacaoId });
}

export async function atualizarFator(id: string, patch: Record<string, any>) {
  return sb.from("psico_fatores").update(patch).eq("id", id);
}

export async function atualizarPergunta(id: string, patch: Record<string, any>) {
  return sb.from("psico_perguntas").update(patch).eq("id", id);
}
