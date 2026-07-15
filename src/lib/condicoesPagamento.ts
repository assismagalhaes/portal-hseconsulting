import type { Database } from "@/integrations/supabase/types";

export type CondPagMarco = Database["public"]["Enums"]["cond_pag_marco"];

export const MARCO_LABEL: Record<CondPagMarco, string> = {
  aceite_proposta: "Aceite da proposta",
  emissao_nf: "Emissão da NF",
  inicio_servico: "Início do serviço",
  conclusao_servico: "Conclusão do serviço",
  entrega_documento: "Entrega de documento",
  data_fixa: "Data fixa",
  mensal_recorrente: "Mensal recorrente",
  definido_posteriormente: "Definido posteriormente",
};

export const MARCOS: CondPagMarco[] = [
  "aceite_proposta",
  "emissao_nf",
  "inicio_servico",
  "conclusao_servico",
  "entrega_documento",
  "data_fixa",
  "mensal_recorrente",
  "definido_posteriormente",
];

export type ParcelaForm = {
  id?: string;
  numero: number;
  percentual: number;
  marco: CondPagMarco;
  dias_apos_marco: number;
  dia_mes: number | null;
  descricao: string | null;
};

export function somaPercentuais(parcelas: ParcelaForm[]) {
  return parcelas.reduce((s, p) => s + (Number(p.percentual) || 0), 0);
}

export function validarParcelas(parcelas: ParcelaForm[]): string | null {
  if (!parcelas.length) return "Adicione ao menos uma parcela";
  const soma = somaPercentuais(parcelas);
  if (Math.abs(soma - 100) > 0.01) return `A soma dos percentuais deve ser 100% (atual: ${soma.toFixed(2)}%)`;
  for (const p of parcelas) {
    if (p.percentual <= 0) return `Parcela ${p.numero}: percentual deve ser maior que zero`;
    if (p.marco === "mensal_recorrente" && (p.dia_mes == null || p.dia_mes < 1 || p.dia_mes > 31))
      return `Parcela ${p.numero}: informe um dia do mês entre 1 e 31`;
  }
  return null;
}