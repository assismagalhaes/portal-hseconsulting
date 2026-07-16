export const projetoStatusLabel: Record<string, string> = {
  planejamento: "Em planejamento",
  em_execucao: "Em execução",
  em_revisao: "Em revisão",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const projetoStatusColor: Record<string, string> = {
  planejamento: "bg-blue-100 text-blue-800",
  em_execucao: "bg-emerald-100 text-emerald-900",
  em_revisao: "bg-violet-100 text-violet-800",
  concluido: "bg-green-200 text-green-900",
  atrasado: "bg-rose-200 text-rose-900",
  cancelado: "bg-slate-200 text-slate-700",
};

export const projetoServicoStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const projetoServicoStatusColor: Record<string, string> = {
  pendente: "bg-slate-200 text-slate-700",
  em_andamento: "bg-emerald-100 text-emerald-900",
  concluido: "bg-green-200 text-green-900",
  cancelado: "bg-rose-100 text-rose-900",
};

export const projetoPrioridadeLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const projetoPrioridadeColor: Record<string, string> = {
  baixa: "bg-slate-200 text-slate-700",
  media: "bg-blue-100 text-blue-800",
  alta: "bg-amber-200 text-amber-900",
  urgente: "bg-rose-200 text-rose-900",
};