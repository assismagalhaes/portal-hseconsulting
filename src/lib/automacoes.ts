import { supabase } from "@/integrations/supabase/client";

export const AUTOMACAO_TIPO_LABEL: Record<string, string> = {
  comercial: "Comercial",
  operacional: "Operacional",
  documental: "Documental",
  financeira: "Financeira",
  portal_cliente: "Portal do Cliente",
  ia_gestao: "IA / Gestão",
  sistema: "Sistema",
};

export const AUTOMACAO_GATILHO_LABEL: Record<string, string> = {
  por_data: "Por data",
  por_vencimento: "Por vencimento",
  mudanca_status: "Mudança de status",
  criacao_registro: "Criação de registro",
  inatividade: "Inatividade",
  atraso: "Atraso",
  evento_sistema: "Evento do sistema",
  manual: "Execução manual",
};

export const AUTOMACAO_ACAO_LABEL: Record<string, string> = {
  criar_notificacao: "Criar notificação",
  criar_alerta: "Criar alerta inteligente",
  criar_tarefa: "Criar tarefa",
  criar_followup: "Criar follow-up",
  criar_pendencia_documental: "Criar pendência documental",
  gerar_resumo_ia: "Gerar resumo IA",
  atualizar_status_alerta: "Atualizar status de alerta",
  registrar_timeline: "Registrar timeline",
  registrar_log: "Registrar log",
  sugerir_mensagem: "Sugerir mensagem",
  sugerir_email: "Sugerir e-mail",
  sugerir_cobranca: "Sugerir cobrança",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORIDADE_COLOR: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  alta: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  critica: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export async function executarAutomacaoManual(automacaoId: string) {
  const { data, error } = await supabase.functions.invoke("automacoes-runner", {
    body: { automacao_id: automacaoId, manual: true },
  });
  if (error) throw error;
  return data as { ok: boolean; execucao_id?: string; afetados?: number };
}

export async function executarTodasAutomacoes() {
  const { data, error } = await supabase.functions.invoke("automacoes-runner", {
    body: { manual: true },
  });
  if (error) throw error;
  return data;
}

export async function criarNotificacao(params: {
  user_id: string;
  titulo: string;
  mensagem?: string;
  modulo?: string;
  prioridade?: "baixa" | "normal" | "alta" | "critica";
  link?: string;
  entidade_tipo?: string;
  entidade_id?: string;
  client_id?: string;
}) {
  const { error } = await supabase.from("notificacoes").insert({
    user_id: params.user_id,
    titulo: params.titulo,
    mensagem: params.mensagem ?? null,
    modulo: params.modulo ?? "geral",
    prioridade: params.prioridade ?? "normal",
    link: params.link ?? null,
    entidade_tipo: params.entidade_tipo ?? null,
    entidade_id: params.entidade_id ?? null,
    client_id: params.client_id ?? null,
  });
  if (error) throw error;
}