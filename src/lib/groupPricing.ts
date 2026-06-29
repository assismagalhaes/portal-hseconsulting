// Cálculo de precificação agrupada com custos compartilhados rateados.
import { computePricing, type PricingInput, type PricingResult } from "./pricing";

export type RateioRegra =
  | "igual"
  | "proporcional_venda"
  | "proporcional_custo"
  | "proporcional_horas"
  | "proporcional_quantidade"
  | "manual";

export const rateioRegraLabel: Record<RateioRegra, string> = {
  igual: "Igual entre os serviços",
  proporcional_venda: "Proporcional ao valor de venda",
  proporcional_custo: "Proporcional ao custo direto",
  proporcional_horas: "Proporcional às horas previstas",
  proporcional_quantidade: "Proporcional à quantidade",
  manual: "Manual (% por serviço)",
};

export const custosCompartilhadosCategorias = [
  "deslocamento",
  "hospedagem",
  "alimentacao",
  "combustivel",
  "pedagio",
  "locacao_equipamento",
  "profissional_terceirizado",
  "taxa_art",
  "custos_administrativos",
  "outros",
] as const;

export const custoCompartilhadoLabel: Record<string, string> = {
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  combustivel: "Combustível",
  pedagio: "Pedágio",
  locacao_equipamento: "Locação de equipamento",
  profissional_terceirizado: "Profissional terceirizado",
  taxa_art: "Taxa / ART",
  custos_administrativos: "Custos administrativos",
  outros: "Outros custos compartilhados",
};

export type GroupItemInput = {
  proposal_item_id: string;
  nome: string;
  quantidade: number;
  valor_venda_atual: number;        // preço já na proposta (referência)
  custos_individuais: Record<string, number>;
  horas: Record<string, number>;
  qtd_funcionarios: number;
  margem_desejada: number;
  aliquota_imposto: number;
  lucro_desejado: number;
  desconto_comercial: number;
  peso_manual: number;              // 0..100 (%) — usado só no rateio manual
};

export type GroupComputeContext = {
  regra: RateioRegra;
  custos_compartilhados_total: number;
  custo_hora_interno: number;
  custo_por_vida: number;
  arredondamento: number;
  markup_minimo: number;
  margem_minima: number;
};

export type GroupItemResult = {
  proposal_item_id: string;
  custo_individual: number;
  custo_compartilhado_rateado: number;
  custo_total: number;
  preco_sugerido: number;
  preco_final: number;
  lucro_estimado: number;
  margem_liquida: number;
  markup: number;
  status_margem: PricingResult["status_margem"];
  pricing: PricingResult;
};

export type GroupTotals = {
  custo_individual_total: number;
  custo_compartilhado_total: number;
  custo_geral: number;
  receita_total: number;
  imposto_estimado: number;
  lucro_total: number;
  margem_liquida: number;
  markup_medio: number;
  status_margem: PricingResult["status_margem"];
};

const sum = (o: Record<string, number | undefined>) =>
  Object.values(o).reduce<number>((a, b) => a + (Number(b) || 0), 0);

function baseRateio(items: GroupItemInput[], ctx: GroupComputeContext, custoIndividuais: number[]): number[] {
  const n = items.length;
  if (n === 0) return [];
  switch (ctx.regra) {
    case "igual":
      return items.map(() => 1 / n);
    case "proporcional_venda": {
      const tot = items.reduce((a, i) => a + (Number(i.valor_venda_atual) || 0), 0);
      return tot > 0 ? items.map((i) => (Number(i.valor_venda_atual) || 0) / tot) : items.map(() => 1 / n);
    }
    case "proporcional_custo": {
      const tot = custoIndividuais.reduce((a, b) => a + b, 0);
      return tot > 0 ? custoIndividuais.map((c) => c / tot) : items.map(() => 1 / n);
    }
    case "proporcional_horas": {
      const horas = items.map((i) => sum(i.horas));
      const tot = horas.reduce((a, b) => a + b, 0);
      return tot > 0 ? horas.map((h) => h / tot) : items.map(() => 1 / n);
    }
    case "proporcional_quantidade": {
      const q = items.map((i) => Number(i.quantidade) || 0);
      const tot = q.reduce((a, b) => a + b, 0);
      return tot > 0 ? q.map((v) => v / tot) : items.map(() => 1 / n);
    }
    case "manual": {
      const pesos = items.map((i) => Math.max(0, Number(i.peso_manual) || 0));
      const tot = pesos.reduce((a, b) => a + b, 0);
      return tot > 0 ? pesos.map((p) => p / tot) : items.map(() => 1 / n);
    }
  }
}

export function computeGroup(items: GroupItemInput[], ctx: GroupComputeContext): {
  perItem: GroupItemResult[];
  totals: GroupTotals;
  pesos: number[];
} {
  // Calcula custo individual (direto + horas + vidas) de cada item para usar como base de rateio
  const custoIndividuais = items.map((i) => {
    const direto = sum(i.custos_individuais);
    const horas = sum(i.horas) * (ctx.custo_hora_interno || 0);
    const vidas = (Number(i.qtd_funcionarios) || 0) * (ctx.custo_por_vida || 0);
    return direto + horas + vidas;
  });

  const pesos = baseRateio(items, ctx, custoIndividuais);
  const totalCompart = Number(ctx.custos_compartilhados_total) || 0;

  const perItem: GroupItemResult[] = items.map((it, idx) => {
    const rateado = totalCompart * (pesos[idx] || 0);
    // injeta o rateio como linha extra de custo no input pricing
    const custosAjust = { ...it.custos_individuais, _rateio_grupo: rateado };
    const input: PricingInput = {
      custos: custosAjust as any,
      horas: it.horas as any,
      qtd_funcionarios: it.qtd_funcionarios,
      custo_hora_interno: ctx.custo_hora_interno,
      custo_por_vida: ctx.custo_por_vida,
      aliquota_imposto: it.aliquota_imposto,
      margem_desejada: it.margem_desejada,
      lucro_desejado: it.lucro_desejado,
      desconto_comercial: it.desconto_comercial,
      arredondamento: ctx.arredondamento,
      markup_minimo: ctx.markup_minimo,
      margem_minima: ctx.margem_minima,
    };
    const p = computePricing(input);
    return {
      proposal_item_id: it.proposal_item_id,
      custo_individual: custoIndividuais[idx],
      custo_compartilhado_rateado: rateado,
      custo_total: p.custo_total,
      preco_sugerido: p.preco_sugerido,
      preco_final: p.preco_arredondado,
      lucro_estimado: p.lucro_estimado,
      margem_liquida: p.margem_liquida,
      markup: p.markup,
      status_margem: p.status_margem,
      pricing: p,
    };
  });

  const custo_individual_total = custoIndividuais.reduce((a, b) => a + b, 0);
  const receita_total = perItem.reduce((a, b) => a + b.preco_final, 0);
  const imposto_estimado = perItem.reduce((a, b) => a + b.pricing.imposto_estimado, 0);
  const custo_geral = custo_individual_total + totalCompart;
  const lucro_total = receita_total - imposto_estimado - custo_geral;
  const margem_liquida = receita_total > 0 ? lucro_total / receita_total : 0;
  const markup_medio = custo_geral > 0 ? receita_total / custo_geral : 0;

  let status_margem: PricingResult["status_margem"] = "ok";
  if (lucro_total < 0) status_margem = "prejuizo";
  else if (markup_medio < ctx.markup_minimo) status_margem = "atencao";
  else if (margem_liquida < ctx.margem_minima) status_margem = "baixa";

  return {
    perItem,
    pesos,
    totals: {
      custo_individual_total,
      custo_compartilhado_total: totalCompart,
      custo_geral,
      receita_total,
      imposto_estimado,
      lucro_total,
      margem_liquida,
      markup_medio,
      status_margem,
    },
  };
}