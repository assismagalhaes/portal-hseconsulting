// Cálculo de precificação interna por item da proposta.

export type CustosDiretos = {
  deslocamento?: number;
  alimentacao_hospedagem?: number;
  terceiros?: number;
  exames_laboratorio?: number;
  taxas_art?: number;
  equipamentos?: number;
  materiais_epi?: number;
  taxa_por_funcionario?: number;
  outros?: number;
};

export type Horas = {
  atendimento?: number;
  analise_documental?: number;
  deslocamento?: number;
  visita_tecnica?: number;
  elaboracao?: number;
  revisao?: number;
  pos_entrega?: number;
  outras?: number;
};

export type PricingInput = {
  custos: CustosDiretos;
  horas: Horas;
  qtd_funcionarios?: number;
  custo_hora_interno: number;       // legado (fallback)
  valor_hora_tecnica?: number;      // novo: valor/hora HSE configurável (preferencial)
  custo_por_vida: number;
  aliquota_imposto: number;         // 0..1
  margem_desejada: number;          // 0..1
  lucro_desejado: number;           // R$
  desconto_comercial: number;       // R$
  arredondamento: number;           // múltiplo
  markup_minimo: number;            // ex 1.5
  margem_minima: number;            // 0..1
};

export type PricingResult = {
  custo_direto_total: number;
  horas_total: number;
  custo_horas: number;
  custo_vidas: number;
  custo_total: number;
  preco_sugerido: number;
  preco_arredondado: number;
  imposto_estimado: number;
  receita_liquida: number;
  lucro_estimado: number;
  margem_liquida: number;
  markup: number;
  preco_minimo: number;
  diferenca_preco_minimo: number;
  status_margem: "ok" | "baixa" | "atencao" | "prejuizo";
};

const sum = (o: Record<string, number | undefined>) =>
  Object.values(o).reduce<number>((a, b) => a + (Number(b) || 0), 0);

export function computePricing(i: PricingInput): PricingResult {
  const custo_direto_total = sum(i.custos);
  const horas_total = sum(i.horas);
  const valorHora = Number(i.valor_hora_tecnica ?? 0) > 0
    ? Number(i.valor_hora_tecnica)
    : Number(i.custo_hora_interno || 0);
  const custo_horas = horas_total * valorHora;
  const custo_vidas = (i.qtd_funcionarios || 0) * (i.custo_por_vida || 0);
  const custo_total = custo_direto_total + custo_horas + custo_vidas;

  // preço sugerido: custo / (1 - margem - imposto) + lucro_desejado - desconto
  const denom = Math.max(0.01, 1 - (i.margem_desejada || 0) - (i.aliquota_imposto || 0));
  const preco_base = custo_total / denom + (i.lucro_desejado || 0) - (i.desconto_comercial || 0);
  const preco_sugerido = Math.max(0, preco_base);

  const round = i.arredondamento && i.arredondamento > 0 ? i.arredondamento : 1;
  const preco_arredondado = Math.ceil(preco_sugerido / round) * round;

  const preco_final = preco_arredondado || preco_sugerido;
  const imposto_estimado = preco_final * (i.aliquota_imposto || 0);
  const receita_liquida = preco_final - imposto_estimado;
  const lucro_estimado = receita_liquida - custo_total;
  const margem_liquida = preco_final > 0 ? lucro_estimado / preco_final : 0;
  const markup = custo_total > 0 ? preco_final / custo_total : 0;
  const preco_minimo = custo_total / Math.max(0.01, 1 - (i.aliquota_imposto || 0));
  const diferenca_preco_minimo = preco_final - preco_minimo;

  let status_margem: PricingResult["status_margem"] = "ok";
  if (lucro_estimado < 0) status_margem = "prejuizo";
  else if (markup < (i.markup_minimo || 0)) status_margem = "atencao";
  else if (margem_liquida < (i.margem_minima || 0)) status_margem = "baixa";

  return {
    custo_direto_total, horas_total, custo_horas, custo_vidas, custo_total,
    preco_sugerido, preco_arredondado, imposto_estimado, receita_liquida,
    lucro_estimado, margem_liquida, markup, preco_minimo, diferenca_preco_minimo,
    status_margem,
  };
}

export const statusMargemMeta: Record<PricingResult["status_margem"], { label: string; color: string }> = {
  ok: { label: "Margem OK", color: "bg-success/15 text-success border-success/30" },
  baixa: { label: "Margem Baixa", color: "bg-warning/15 text-warning border-warning/30" },
  atencao: { label: "Atenção", color: "bg-warning/20 text-warning border-warning/40" },
  prejuizo: { label: "Prejuízo", color: "bg-danger/15 text-danger border-danger/30" },
};