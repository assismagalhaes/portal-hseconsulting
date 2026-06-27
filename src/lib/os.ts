export const osStatusLabel: Record<string, string> = {
  aberta: "Aberta",
  planejamento: "Planejamento",
  agendada: "Agendada",
  em_campo: "Em campo",
  em_elaboracao: "Em elaboração",
  em_revisao: "Em revisão",
  aguardando_cliente: "Aguardando cliente",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const osStatusColor: Record<string, string> = {
  aberta: "bg-slate-200 text-slate-800",
  planejamento: "bg-blue-100 text-blue-800",
  agendada: "bg-indigo-100 text-indigo-800",
  em_campo: "bg-emerald-100 text-emerald-900",
  em_elaboracao: "bg-violet-100 text-violet-800",
  em_revisao: "bg-amber-100 text-amber-900",
  aguardando_cliente: "bg-cyan-100 text-cyan-900",
  finalizada: "bg-green-200 text-green-900",
  cancelada: "bg-rose-100 text-rose-900",
};

export const osPrioridadeLabel: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

export const osPrioridadeColor: Record<string, string> = {
  baixa: "bg-slate-200 text-slate-700",
  media: "bg-blue-100 text-blue-800",
  alta: "bg-amber-200 text-amber-900",
  urgente: "bg-rose-200 text-rose-900",
};

export const osRecursoTipoLabel: Record<string, string> = {
  equipamento: "Equipamento",
  veiculo: "Veículo",
  documento: "Documento",
  epi: "EPI",
  outro: "Outro",
};

export const osVisitaSituacaoLabel: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  realizada: "Realizada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
};

export const osDocCategoriaLabel: Record<string, string> = {
  recebido: "Recebido", gerado: "Gerado", pendente: "Pendente",
};

export const osEvidenciaTipoLabel: Record<string, string> = {
  foto: "Foto", video: "Vídeo", pdf: "PDF", audio: "Áudio", documento: "Documento", outro: "Outro",
};

/** Detecta conflito de horários entre eventos de um mesmo profissional. */
export function detectarConflitos<T extends { start_at: string; end_at: string; profissional_id: string | null; id: string }>(eventos: T[]) {
  const conflitos = new Set<string>();
  const byProf: Record<string, T[]> = {};
  for (const e of eventos) {
    if (!e.profissional_id) continue;
    (byProf[e.profissional_id] ||= []).push(e);
  }
  for (const arr of Object.values(byProf)) {
    arr.sort((a, b) => a.start_at.localeCompare(b.start_at));
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j].start_at >= arr[i].end_at) break;
        conflitos.add(arr[i].id); conflitos.add(arr[j].id);
      }
    }
  }
  return conflitos;
}