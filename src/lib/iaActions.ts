import { supabase } from "@/integrations/supabase/client";

export type EntidadeTipo = "proposta" | "os" | "documento" | "cliente" | "oportunidade" | "contrato" | "execucao";
export type ModuloIa = "geral" | "proposta" | "precificacao" | "documento" | "os" | "execucao" | "crm" | "financeiro" | "alertas";

export interface ModuloContext {
  modulo: ModuloIa;
  entidade_tipo?: EntidadeTipo;
  entidade_id?: string;
  client_id?: string | null;
  label: string;
}

export const SUGESTOES_POR_MODULO: Record<ModuloIa, string[]> = {
  geral: [
    "Resumir o que está acontecendo hoje",
    "Quais clientes precisam de atenção?",
    "Quais ações são prioridade nesta semana?",
  ],
  proposta: [
    "Melhorar escopo comercial",
    "Revisar clareza da proposta",
    "Gerar resumo executivo",
    "Sugerir itens não inclusos",
    "Sugerir responsabilidades do cliente",
    "Analisar margem e risco",
    "Sugerir mensagem de envio",
  ],
  precificacao: [
    "Analisar margem real x esperada",
    "Apontar itens com margem baixa",
    "Sugerir ajuste de preço",
  ],
  os: [
    "Resumir esta OS",
    "Listar pendências",
    "Sugerir próximos passos",
    "Gerar resumo da visita",
    "Verificar checklist incompleto",
    "Sugerir relatório de visita",
  ],
  execucao: [
    "Resumir execução do serviço",
    "Quais pendências bloqueiam o avanço?",
    "Sugerir próximas ações operacionais",
  ],
  documento: [
    "Revisar redação técnica",
    "Sugerir conclusão",
    "Apontar campos ausentes",
    "Melhorar formalidade",
    "Comparar revisões",
    "Gerar resumo técnico",
  ],
  crm: [
    "Sugerir próximo follow-up",
    "Gerar mensagem WhatsApp",
    "Gerar e-mail comercial",
    "Resumir histórico do cliente",
    "Avaliar chance de fechamento",
    "Sugerir argumento de negociação",
  ],
  financeiro: [
    "Explicar margem real",
    "Identificar custos acima do previsto",
    "Gerar cobrança amigável",
    "Resumir situação financeira",
    "Apontar inadimplência",
    "Comparar previsto x realizado",
  ],
  alertas: [
    "Quais alertas devo tratar primeiro?",
    "Resumir alertas por gravidade",
  ],
};

export const SUGESTOES_CLIENTE = [
  "Gerar resumo geral do cliente",
  "Listar pendências do cliente",
  "Listar documentos vencendo",
  "Resumir relacionamento comercial",
  "Resumir serviços em execução",
  "Apontar oportunidades de renovação",
];

// ---------- Aplicação de ações de baixo risco ----------

export interface AcaoSugerida {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  payload?: Record<string, unknown> | null;
  status: string;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  modulo: string;
  created_at: string;
}

function pick<T = unknown>(obj: Record<string, unknown> | null | undefined, k: string): T | undefined {
  if (!obj) return undefined;
  return obj[k] as T | undefined;
}

export async function aplicarAcao(acao: AcaoSugerida, payloadOverride?: Record<string, unknown>) {
  const payload = { ...(acao.payload ?? {}), ...(payloadOverride ?? {}) };
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? null;

  switch (acao.tipo) {
    case "criar_followup": {
      const tipoIn = (pick<string>(payload, "tipo") ?? "ligacao").toLowerCase();
      const tipoMap: Record<string, "ligacao" | "email" | "whatsapp" | "reuniao_online" | "reuniao_presencial" | "visita_comercial" | "outro"> = {
        ligacao: "ligacao", email: "email", whatsapp: "whatsapp",
        reuniao: "reuniao_online", reuniao_online: "reuniao_online", reuniao_presencial: "reuniao_presencial",
        visita: "visita_comercial", visita_comercial: "visita_comercial", outro: "outro",
      };
      const { error } = await supabase.from("crm_followups").insert({
        tipo: tipoMap[tipoIn] ?? "ligacao",
        data: (pick<string>(payload, "data") as string) ?? new Date().toISOString().slice(0, 10),
        resumo: (pick<string>(payload, "resumo") as string) ?? acao.titulo,
        proxima_acao: pick<string>(payload, "proxima_acao") ?? null,
        client_id: (pick<string>(payload, "client_id") as string) ?? null,
        oportunidade_id: (pick<string>(payload, "oportunidade_id") as string) ?? null,
        proposal_id: (pick<string>(payload, "proposal_id") as string) ?? null,
        responsavel_id: uid,
        created_by: uid,
      });
      if (error) throw error;
      break;
    }
    case "criar_observacao_execucao": {
      const execId = (pick<string>(payload, "execucao_id") as string) ?? acao.entidade_id;
      if (!execId) throw new Error("execucao_id ausente");
      const { error } = await supabase.from("execucao_observacoes").insert({
        execucao_id: execId,
        texto: (pick<string>(payload, "texto") as string) ?? acao.descricao ?? acao.titulo,
        user_id: uid,
      });
      if (error) throw error;
      break;
    }
    case "criar_pendencia_documental": {
      const { error } = await supabase.from("documentos_pendentes").insert({
        documento_solicitado: (pick<string>(payload, "documento_solicitado") as string) ?? acao.titulo,
        responsavel_envio: pick<string>(payload, "responsavel_envio") ?? null,
        prazo: pick<string>(payload, "prazo") ?? null,
        observacao: pick<string>(payload, "observacao") ?? acao.descricao ?? null,
        client_id: (pick<string>(payload, "client_id") as string) ?? null,
        execucao_id: (pick<string>(payload, "execucao_id") as string) ?? null,
        created_by: uid,
      });
      if (error) throw error;
      break;
    }
    case "criar_item_checklist": {
      const osId = (pick<string>(payload, "os_id") as string) ?? acao.entidade_id;
      if (!osId) throw new Error("os_id ausente");
      const { data: maxRow } = await supabase
        .from("os_checklist").select("ordem").eq("os_id", osId).order("ordem", { ascending: false }).limit(1).maybeSingle();
      const ordem = ((maxRow?.ordem as number | undefined) ?? 0) + 1;
      const { error } = await supabase.from("os_checklist").insert({
        os_id: osId,
        descricao: (pick<string>(payload, "descricao") as string) ?? acao.titulo,
        ordem,
        obrigatorio: (pick<boolean>(payload, "obrigatorio") as boolean) ?? false,
      });
      if (error) throw error;
      break;
    }
    case "criar_alerta": {
      const { error } = await supabase.from("ia_alertas").insert({
        tipo: (pick<string>(payload, "tipo_alerta") as string) ?? "sugestao_ia",
        gravidade: (pick<string>(payload, "gravidade") as "baixa" | "media" | "alta" | "critica") ?? "media",
        modulo: (acao.modulo as "geral" | "proposta" | "precificacao" | "documento" | "os" | "execucao" | "crm" | "financeiro" | "alertas") ?? "geral",
        titulo: (pick<string>(payload, "titulo") as string) ?? acao.titulo,
        descricao: pick<string>(payload, "descricao") ?? acao.descricao ?? null,
        acao_sugerida: pick<string>(payload, "acao_sugerida") ?? null,
        client_id: (pick<string>(payload, "client_id") as string) ?? null,
        entidade_tipo: acao.entidade_tipo ?? null,
        entidade_id: acao.entidade_id ?? null,
      });
      if (error) throw error;
      break;
    }
    case "salvar_resumo": {
      const { error } = await supabase.from("ia_resumos").insert({
        entidade_tipo: acao.entidade_tipo ?? "geral",
        entidade_id: acao.entidade_id ?? null,
        titulo: (pick<string>(payload, "titulo") as string) ?? acao.titulo,
        resumo: (pick<string>(payload, "resumo") as string) ?? acao.descricao ?? "",
        modulo: (acao.modulo as "geral" | "proposta" | "precificacao" | "documento" | "os" | "execucao" | "crm" | "financeiro" | "alertas") ?? "geral",
        created_by: uid,
      });
      if (error) throw error;
      break;
    }
    default:
      throw new Error(`Tipo de ação não suportado: ${acao.tipo}`);
  }

  await supabase.from("ia_acoes_sugeridas").update({
    status: payloadOverride ? "editada_aplicada" : "aplicada",
    applied_by: uid,
    applied_at: new Date().toISOString(),
  }).eq("id", acao.id);
}

export async function ignorarAcao(acaoId: string) {
  await supabase.from("ia_acoes_sugeridas").update({ status: "ignorada" }).eq("id", acaoId);
}

export async function salvarResumoEntidade(params: {
  entidade_tipo: EntidadeTipo | "geral";
  entidade_id?: string;
  modulo: ModuloIa;
  titulo?: string;
  resumo: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("ia_resumos").insert({
    entidade_tipo: params.entidade_tipo,
    entidade_id: params.entidade_id ?? null,
    titulo: params.titulo ?? "Resumo IA",
    resumo: params.resumo,
    modulo: params.modulo,
    created_by: user?.id ?? null,
  });
  if (error) throw error;
}

export async function enviarFeedback(interacaoId: string, util: boolean | null, comentario?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("ia_feedbacks").insert({
    interacao_id: interacaoId,
    user_id: user?.id ?? null,
    util,
    comentario: comentario ?? null,
  });
}