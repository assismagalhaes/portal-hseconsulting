import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type ResumoColeta = {
  status: string;
  prazo: string | null;
  coleta_expira_em: string | null;
  prazo_expirado: boolean;
  participantes_previstos: number | null;
  participantes_na_abertura: number | null;
  participantes_ativos_atuais: number;
  convites_ativos: number;
  convites_distribuidos: number;
  acessaram: number;
  respondidos: number;
  pendentes: number;
  respostas_anonimas: number;
  percentual_participacao: number;
  integridade_ok: boolean;
  quantidade_minima_global: number;
  amostra_suficiente_global: boolean;
  coleta_aberta_em: string | null;
  coleta_encerrada_em: string | null;
};

export async function getResumoColeta(avaliacaoId: string) {
  return sb.rpc("psico_resumo_coleta", { p_avaliacao_id: avaliacaoId });
}

export type ChecklistItem = { chave: string; label: string; ok: boolean; erro?: string };

export async function calcularChecklist(av: any): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = [];
  items.push({ chave: "quest", label: "Questionário vinculado", ok: !!av.questionario_versao_id });
  items.push({ chave: "metod", label: "Metodologia vinculada", ok: !!av.metodologia_versao_id });
  items.push({ chave: "data", label: "Data de encerramento definida (não no passado)",
    ok: !!av.data_fim_prevista && av.data_fim_prevista >= new Date().toISOString().slice(0, 10) });

  if (av.questionario_versao_id) {
    const [{ count: perg }, { data: quest }] = await Promise.all([
      sb.from("psico_perguntas").select("id", { count: "exact", head: true })
        .eq("questionario_versao_id", av.questionario_versao_id).eq("ativa", true),
      sb.from("psico_questionarios_versoes").select("status").eq("id", av.questionario_versao_id).maybeSingle(),
    ]);
    items.push({ chave: "35p", label: "35 perguntas ativas configuradas", ok: (perg ?? 0) === 35, erro: `atual: ${perg ?? 0}` });
    items.push({ chave: "qpub", label: "Questionário publicado", ok: quest?.data ? true : ["publicada", "arquivada"].includes(quest?.status) });
  }
  if (av.metodologia_versao_id) {
    const { count } = await sb.from("psico_opcoes_resposta").select("id", { count: "exact", head: true })
      .eq("metodologia_versao_id", av.metodologia_versao_id).eq("ativo", true);
    items.push({ chave: "5o", label: "5 opções de resposta ativas", ok: (count ?? 0) === 5, erro: `atual: ${count ?? 0}` });
  }

  const isPublico = av.modo_coleta === "publico_anonimo";
  if (isPublico) {
    items.push({ chave: "publico", label: "Coleta pública anônima (link único compartilhado)", ok: true });
  } else {
    const { count: partAtivos } = await sb.from("psico_participantes")
      .select("id", { count: "exact", head: true })
      .eq("avaliacao_id", av.id).eq("ativo", true);
    items.push({ chave: "part2", label: "Pelo menos 2 participantes ativos", ok: (partAtivos ?? 0) >= 2, erro: `atual: ${partAtivos ?? 0}` });

    const { data: parts } = await sb.from("psico_participantes")
      .select("id").eq("avaliacao_id", av.id).eq("ativo", true);
    const ids = (parts || []).map((p: any) => p.id);
    if (ids.length > 0) {
      const { data: conv } = await sb.from("psico_convites")
        .select("participante_id, status")
        .in("participante_id", ids);
      const prep = new Set((conv || []).filter((c: any) => c.status === "preparado").map((c: any) => c.participante_id));
      const semPrep = ids.filter((i: string) => !prep.has(i));
      items.push({ chave: "prep", label: "Todos os participantes ativos possuem link preparado",
        ok: semPrep.length === 0, erro: semPrep.length > 0 ? `${semPrep.length} sem link` : undefined });
      const resp = (conv || []).filter((c: any) => c.status === "respondido").length;
      items.push({ chave: "resp0", label: "Nenhum participante já respondeu", ok: resp === 0 });
    }
  }
  return items;
}

export async function abrirColeta(avaliacaoId: string, confirmacao: string) {
  return sb.rpc("psico_abrir_coleta", { p_avaliacao_id: avaliacaoId, p_confirmacao: confirmacao });
}
export async function prorrogarColeta(avaliacaoId: string, novaData: string, motivo: string) {
  return sb.rpc("psico_prorrogar_coleta", { p_avaliacao_id: avaliacaoId, p_nova_data_fim: novaData, p_motivo: motivo });
}
export async function encerrarColeta(avaliacaoId: string, confirmacao: string, motivo?: string) {
  return sb.rpc("psico_encerrar_coleta", { p_avaliacao_id: avaliacaoId, p_confirmacao: confirmacao, p_motivo: motivo ?? null });
}