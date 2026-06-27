import { brl } from "./format";

export const FIN_STATUS_CONTRATO: Record<string, string> = {
  aguardando_faturamento: "Aguardando faturamento",
  parcialmente_faturado: "Parcialmente faturado",
  faturado: "Faturado",
  parcialmente_recebido: "Parcialmente recebido",
  recebido: "Recebido",
  em_atraso: "Em atraso",
  cancelado: "Cancelado",
};

export const FIN_STATUS_CONTRATO_COR: Record<string, string> = {
  aguardando_faturamento: "bg-slate-200 text-slate-800",
  parcialmente_faturado: "bg-blue-100 text-blue-800",
  faturado: "bg-indigo-100 text-indigo-800",
  parcialmente_recebido: "bg-amber-100 text-amber-900",
  recebido: "bg-emerald-100 text-emerald-900",
  em_atraso: "bg-rose-100 text-rose-900",
  cancelado: "bg-zinc-200 text-zinc-700",
};

export const FIN_STATUS_PARCELA: Record<string, string> = {
  a_vencer: "A vencer",
  vencida: "Vencida",
  recebida: "Recebida",
  recebida_parcial: "Recebida parcialmente",
  cancelada: "Cancelada",
};

export const FIN_STATUS_PARCELA_COR: Record<string, string> = {
  a_vencer: "bg-blue-100 text-blue-800",
  vencida: "bg-rose-100 text-rose-900",
  recebida: "bg-emerald-100 text-emerald-900",
  recebida_parcial: "bg-amber-100 text-amber-900",
  cancelada: "bg-zinc-200 text-zinc-700",
};

export const FIN_FORMA_PAGAMENTO: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export const FIN_TIPO_CUSTO: Record<string, string> = {
  deslocamento: "Deslocamento",
  combustivel: "Combustível",
  pedagio: "Pedágio",
  alimentacao: "Alimentação",
  hospedagem: "Hospedagem",
  terceiros: "Terceiros",
  laboratorio: "Laboratório",
  equipamentos: "Equipamentos",
  materiais: "Materiais",
  impressoes: "Impressões",
  art: "ART",
  taxas: "Taxas",
  mao_de_obra: "Mão de obra",
  outros: "Outros",
};

export const FIN_ALERTA_TIPO: Record<string, string> = {
  parcela_vencendo: "Parcela vencendo",
  parcela_vencida: "Parcela vencida",
  pagamento_parcial: "Pagamento parcial",
  sem_parcelas: "Proposta aprovada sem parcelas",
  custo_acima_previsto: "Custo acima do previsto",
  margem_baixa: "Margem abaixo do mínimo",
  servico_sem_recebimento: "Serviço concluído sem recebimento",
};

export function margemIndicador(margem: number, minima = 15) {
  if (margem < 0) return { cor: "text-rose-600", emoji: "🔴", label: "Prejuízo" };
  if (margem < minima) return { cor: "text-amber-600", emoji: "🟡", label: "Abaixo do mínimo" };
  return { cor: "text-emerald-600", emoji: "🟢", label: "Saudável" };
}

export function calcMargem(receita: number, custo: number) {
  if (!receita) return 0;
  return ((receita - custo) / receita) * 100;
}

export function fmtMoeda(n: number | null | undefined) { return brl(Number(n ?? 0)); }

export function diasParaVencer(data: string | null | undefined) {
  if (!data) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}