// Cálculo de precificação interna por item da proposta.

/* ============ Estrutura nova (detalhada) ============ */
export type CustoDiretoRow = {
  id?: string;
  categoria: string;     // chave de CUSTO_CATEGORIAS
  descricao: string;
  valor: number;
};

export type HoraTecnicaRow = {
  id?: string;
  atividade: string;      // chave de ATIVIDADE_CATEGORIAS ou texto livre
  descricao?: string;
  horas: number;
  valor_hora: number;
};

/* ============ Estrutura legada (campos fixos) ============ */
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
  custos: CustosDiretos | CustoDiretoRow[];
  horas: Horas | HoraTecnicaRow[];
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

const sumObj = (o: Record<string, number | undefined>) =>
  Object.values(o || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);

export function sumCustos(c: CustosDiretos | CustoDiretoRow[] | undefined | null): number {
  if (!c) return 0;
  if (Array.isArray(c)) return c.reduce((a, r) => a + (Number(r?.valor) || 0), 0);
  return sumObj(c as Record<string, number | undefined>);
}

export function computeHoras(
  h: Horas | HoraTecnicaRow[] | undefined | null,
  valorHoraPadrao: number
): { horas_total: number; custo_horas: number } {
  if (!h) return { horas_total: 0, custo_horas: 0 };
  if (Array.isArray(h)) {
    let horas_total = 0;
    let custo_horas = 0;
    for (const r of h) {
      const hh = Number(r?.horas) || 0;
      const vh = Number(r?.valor_hora ?? valorHoraPadrao) || 0;
      horas_total += hh;
      custo_horas += hh * vh;
    }
    return { horas_total, custo_horas };
  }
  const horas_total = sumObj(h as Record<string, number | undefined>);
  return { horas_total, custo_horas: horas_total * valorHoraPadrao };
}

export function computePricing(i: PricingInput): PricingResult {
  const custo_direto_total = sumCustos(i.custos);
  const valorHora = Number(i.valor_hora_tecnica ?? 0) > 0
    ? Number(i.valor_hora_tecnica)
    : Number(i.custo_hora_interno || 0);
  const { horas_total, custo_horas } = computeHoras(i.horas, valorHora);
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

/* ============ Catálogos para a UI individual ============ */
export const CUSTO_CATEGORIAS = [
  { value: "deslocamento", label: "Deslocamento" },
  { value: "alimentacao_hospedagem", label: "Alimentação / Hospedagem" },
  { value: "terceiros", label: "Terceiros / Profissional externo" },
  { value: "exames_laboratorio", label: "Exames / Laboratório" },
  { value: "taxas_art", label: "Taxas / ART" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "materiais_epi", label: "Materiais / EPI" },
  { value: "taxa_por_funcionario", label: "Taxa por funcionário" },
  { value: "outros", label: "Outros custos" },
] as const;

export const ATIVIDADE_CATEGORIAS = [
  { value: "atendimento", label: "Atendimento / alinhamento" },
  { value: "analise_documental", label: "Análise documental" },
  { value: "deslocamento", label: "Deslocamento vinculado" },
  { value: "visita_tecnica", label: "Visita técnica / levantamento" },
  { value: "elaboracao", label: "Elaboração técnica" },
  { value: "revisao", label: "Revisão / ajustes" },
  { value: "pos_entrega", label: "Envio / suporte pós-entrega" },
  { value: "outras", label: "Outras horas" },
] as const;

export const custoCategoriaLabel = (k: string) =>
  CUSTO_CATEGORIAS.find((c) => c.value === k)?.label || k;
export const atividadeLabel = (k: string) =>
  ATIVIDADE_CATEGORIAS.find((a) => a.value === k)?.label || k;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Converte custos (legado ou novo) em array detalhado.
 *  Linhas com valor 0 são descartadas (não cria linhas zeradas). */
export function normalizarCustosDiretos(
  c: CustosDiretos | CustoDiretoRow[] | undefined | null
): CustoDiretoRow[] {
  if (!c) return [];
  if (Array.isArray(c)) {
    return c
      .filter((r) => r && (Number(r.valor) || 0) !== 0 || (r?.categoria && r?.descricao))
      .map((r) => ({
        id: r.id || uid(),
        categoria: r.categoria || "outros",
        descricao: r.descricao || "",
        valor: Number(r.valor) || 0,
      }));
  }
  const out: CustoDiretoRow[] = [];
  for (const [k, v] of Object.entries(c as Record<string, any>)) {
    const valor = Number(v) || 0;
    if (!valor) continue;
    // mapeia legado -> nova categoria
    const mapa: Record<string, string> = {
      deslocamento: "deslocamento",
      alimentacao_hospedagem: "alimentacao_hospedagem",
      terceiros: "terceiros",
      exames_laboratorio: "exames_laboratorio",
      taxas_art: "taxas_art",
      equipamentos: "equipamentos",
      materiais_epi: "materiais_epi",
      taxa_por_funcionario: "taxa_por_funcionario",
      outros: "outros",
    };
    const cat = mapa[k] || "outros";
    out.push({ id: uid(), categoria: cat, descricao: custoCategoriaLabel(cat), valor });
  }
  return out;
}

/** Converte horas (legado ou novo) em array detalhado. */
export function normalizarHorasTecnicas(
  h: Horas | HoraTecnicaRow[] | undefined | null,
  valorHoraPadrao: number
): HoraTecnicaRow[] {
  if (!h) return [];
  if (Array.isArray(h)) {
    return h
      .filter((r) => r && ((Number(r.horas) || 0) !== 0 || r?.atividade))
      .map((r) => ({
        id: r.id || uid(),
        atividade: r.atividade || "outras",
        descricao: r.descricao || "",
        horas: Number(r.horas) || 0,
        valor_hora: Number(r.valor_hora ?? valorHoraPadrao) || 0,
      }));
  }
  const out: HoraTecnicaRow[] = [];
  for (const [k, v] of Object.entries(h as Record<string, any>)) {
    const horas = Number(v) || 0;
    if (!horas) continue;
    out.push({ id: uid(), atividade: k, horas, valor_hora: valorHoraPadrao });
  }
  return out;
}