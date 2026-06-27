import { brl } from "./format";

export const ETAPAS = [
  { value: "novo_lead", label: "Novo lead", color: "bg-slate-200 text-slate-800" },
  { value: "qualificacao", label: "Qualificação", color: "bg-blue-100 text-blue-800" },
  { value: "diagnostico", label: "Diagnóstico", color: "bg-indigo-100 text-indigo-800" },
  { value: "proposta_elaborar", label: "Proposta a elaborar", color: "bg-violet-100 text-violet-800" },
  { value: "proposta_enviada", label: "Proposta enviada", color: "bg-cyan-100 text-cyan-900" },
  { value: "followup", label: "Follow-up", color: "bg-amber-100 text-amber-900" },
  { value: "negociacao", label: "Negociação", color: "bg-orange-100 text-orange-900" },
  { value: "fechamento_provavel", label: "Fechamento provável", color: "bg-lime-200 text-lime-900" },
  { value: "ganho", label: "Ganho", color: "bg-emerald-200 text-emerald-900" },
  { value: "perdido", label: "Perdido", color: "bg-rose-200 text-rose-900" },
] as const;

export const etapaLabel = Object.fromEntries(ETAPAS.map(e => [e.value, e.label])) as Record<string, string>;
export const etapaColor = Object.fromEntries(ETAPAS.map(e => [e.value, e.color])) as Record<string, string>;

export const LEAD_STATUS = [
  { value: "novo", label: "Novo" },
  { value: "em_qualificacao", label: "Em qualificação" },
  { value: "qualificado", label: "Qualificado" },
  { value: "nao_qualificado", label: "Não qualificado" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
] as const;

export const ORIGENS = [
  { value: "indicacao", label: "Indicação" },
  { value: "cliente_antigo", label: "Cliente antigo" },
  { value: "google", label: "Google" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao_ativa", label: "Ligação ativa" },
  { value: "email", label: "E-mail" },
  { value: "evento", label: "Evento" },
  { value: "parceiro", label: "Parceiro" },
  { value: "site", label: "Site" },
  { value: "outro", label: "Outro" },
] as const;

export const TEMPERATURAS = [
  { value: "frio", label: "Frio", color: "bg-sky-100 text-sky-800" },
  { value: "morno", label: "Morno", color: "bg-amber-100 text-amber-900" },
  { value: "quente", label: "Quente", color: "bg-rose-200 text-rose-900" },
] as const;

export const FUP_TIPOS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "reuniao_presencial", label: "Reunião presencial" },
  { value: "reuniao_online", label: "Reunião online" },
  { value: "visita_comercial", label: "Visita comercial" },
  { value: "outro", label: "Outro" },
] as const;

export const FUP_STATUS = [
  { value: "pendente", label: "Pendente", color: "bg-amber-100 text-amber-900" },
  { value: "realizado", label: "Realizado", color: "bg-emerald-100 text-emerald-900" },
  { value: "reagendado", label: "Reagendado", color: "bg-blue-100 text-blue-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-slate-200 text-slate-700" },
  { value: "sem_resposta", label: "Sem resposta", color: "bg-rose-100 text-rose-800" },
] as const;

export const SCORES = [
  { value: "baixo", label: "Baixo potencial", color: "bg-slate-200 text-slate-700" },
  { value: "medio", label: "Médio potencial", color: "bg-amber-100 text-amber-900" },
  { value: "alto", label: "Alto potencial", color: "bg-emerald-200 text-emerald-900" },
] as const;

export const fmt = brl;

/** Score automático básico baseado em qualificação BANT */
export function calcularScore(l: any): "baixo" | "medio" | "alto" {
  let p = 0;
  if (l.necessidade) p++;
  if (l.urgencia) p++;
  if (l.orcamento_disponivel) p++;
  if (l.autoridade_decisao) p++;
  if (l.prazo_contratacao) p++;
  if (l.servicos_interesse && l.servicos_interesse.length > 0) p++;
  if (p >= 5) return "alto";
  if (p >= 3) return "medio";
  return "baixo";
}
