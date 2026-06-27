export const brl = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (n: number | null | undefined, digits = 1) =>
  `${(Number(n ?? 0) * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined, digits = 2) =>
  Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatCnpjCpf = (v: string) => {
  const d = (v || "").replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join(".") + (e ? "-" + e : ""));
  }
  return d.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, d2, e) =>
    `${a}${b ? "." + b : ""}${c ? "." + c : ""}${d2 ? "/" + d2 : ""}${e ? "-" + e : ""}`);
};

export const proposalStatusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  negociacao: "Em negociação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export const execStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const execucaoStatusLabel: Record<string, string> = {
  aguardando_inicio: "Aguardando início",
  planejamento: "Planejamento",
  aguardando_documentacao: "Aguardando documentação",
  agendado: "Agendado",
  em_execucao: "Em execução",
  em_revisao_tecnica: "Em revisão técnica",
  aguardando_aprovacao_cliente: "Aguardando aprovação do cliente",
  concluido: "Concluído",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

export const execucaoStatusColor: Record<string, string> = {
  aguardando_inicio: "bg-slate-200 text-slate-800",
  planejamento: "bg-blue-100 text-blue-800",
  aguardando_documentacao: "bg-amber-100 text-amber-900",
  agendado: "bg-indigo-100 text-indigo-800",
  em_execucao: "bg-emerald-100 text-emerald-900",
  em_revisao_tecnica: "bg-violet-100 text-violet-800",
  aguardando_aprovacao_cliente: "bg-cyan-100 text-cyan-900",
  concluido: "bg-green-200 text-green-900",
  suspenso: "bg-orange-100 text-orange-900",
  cancelado: "bg-rose-100 text-rose-900",
};

export const prioridadeLabel: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const prioridadeColor: Record<string, string> = {
  baixa: "bg-slate-200 text-slate-700",
  normal: "bg-blue-100 text-blue-800",
  alta: "bg-amber-200 text-amber-900",
  urgente: "bg-rose-200 text-rose-900",
};

export const checklistSituacaoLabel: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const profissionalSituacaoLabel: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  ferias: "Férias",
  afastado: "Afastado",
};

export const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d.length <= 10 ? d + "T00:00:00" : d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
};

export const formatDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/** Retorna {dias, status} relativo à data prevista de conclusão */
export function prazoStatus(prevista: string | null | undefined, statusServico?: string) {
  if (!prevista || statusServico === "concluido" || statusServico === "cancelado") {
    return { dias: null as number | null, cor: "text-muted-foreground", emoji: "—", label: "—" };
  }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(prevista + "T00:00:00");
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { dias: diff, cor: "text-rose-600", emoji: "🔴", label: `${Math.abs(diff)}d em atraso` };
  if (diff <= 5) return { dias: diff, cor: "text-amber-600", emoji: "🟡", label: `${diff}d restantes` };
  return { dias: diff, cor: "text-emerald-600", emoji: "🟢", label: `${diff}d restantes` };
}