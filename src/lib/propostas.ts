import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de acesso a dados de propostas (Supabase).
 * Extraída de src/pages/ProposalEditor.tsx para isolar mutations e queries
 * do componente de UI. Mantém tipagem `any` intencionalmente para preservar
 * o comportamento atual do editor sem retipar campos do banco.
 */

export type ProposalBundle = {
  proposal: any;
  client: any;
  services: any[];
  params: any;
  items: any[];
  revisions: any[];
  pricings: Record<string, any>;
  proposalClients: any[];
};

const DEFAULT_PARAMS = {
  custo_fixo_mensal: 0,
  horas_produtivas_mes: 160,
  custo_por_vida: 0,
  aliquota_imposto: 0.10,
  margem_minima: 0.20,
  markup_minimo: 1.5,
  arredondamento: 1,
  valor_hora_tecnica: 35,
};

/** Carrega proposta + dados relacionados. Aplica pré-preenchimento de
 *  condições padrão na PRIMEIRA abertura (quando o campo é null — vazio "" é respeitado). */
export async function loadProposalBundle(id: string): Promise<ProposalBundle> {
  const [p, sv, pp] = await Promise.all([
    supabase.from("proposals").select("*, clients(*)").eq("id", id).single(),
    supabase.from("services").select("*").order("nome"),
    supabase.from("pricing_params").select("*").limit(1).maybeSingle(),
  ]);
  if (p.error) throw new Error(p.error.message);
  const proposalData: any = p.data;
  const patch: any = {};
  if (proposalData.condicoes_pagamento == null && pp.data?.condicoes_pagamento_default) patch.condicoes_pagamento = pp.data.condicoes_pagamento_default;
  if (proposalData.outras_condicoes == null && pp.data?.outras_condicoes_default) patch.outras_condicoes = pp.data.outras_condicoes_default;
  if (Object.keys(patch).length) {
    await supabase.from("proposals").update(patch).eq("id", proposalData.id);
    Object.assign(proposalData, patch);
  }
  const [it, rv] = await Promise.all([
    supabase.from("proposal_items").select("*").eq("proposal_id", id).order("numero_item"),
    supabase.from("proposal_revisions").select("*").eq("proposal_id", id).order("revisao", { ascending: false }),
  ]);
  const items = it.data || [];
  const pricings: Record<string, any> = {};
  if (items.length) {
    const pr = await supabase.from("proposal_item_pricing").select("*").in("proposal_item_id", items.map((x: any) => x.id));
    (pr.data || []).forEach((r: any) => { pricings[r.proposal_item_id] = r; });
  }
  const { data: pcs } = await supabase.from("proposal_clients")
    .select("*, clients(id,razao_social,nome_fantasia,cnpj_cpf,cidade,uf,endereco,solicitante,cargo,telefone,email)")
    .eq("proposal_id", id)
    .order("papel", { ascending: true })
    .order("ordem", { ascending: true });
  return {
    proposal: proposalData,
    client: proposalData.clients || null,
    services: sv.data || [],
    params: pp.data || DEFAULT_PARAMS,
    items,
    revisions: rv.data || [],
    pricings,
    proposalClients: pcs || [],
  };
}

export async function updateProposal(proposalId: string, patch: any): Promise<void> {
  const { error } = await supabase.from("proposals").update(patch).eq("id", proposalId);
  if (error) throw new Error(error.message);
}

export async function updateProposalTotal(proposalId: string, valorTotal: number): Promise<void> {
  await supabase.from("proposals").update({ valor_total: valorTotal }).eq("id", proposalId);
}

/* ---------------- Cliente ---------------- */

function clientPayload(c: any) {
  return {
    razao_social: c.razao_social, nome_fantasia: c.nome_fantasia, cnpj_cpf: c.cnpj_cpf,
    qtd_funcionarios: Number(c.qtd_funcionarios) || 0, endereco: c.endereco,
    bairro: c.bairro, cep: c.cep, cidade: c.cidade, uf: c.uf,
    solicitante: c.solicitante, cargo: c.cargo, telefone: c.telefone, whatsapp: c.whatsapp,
    email: c.email, observacoes: c.observacoes,
  };
}

/** Upsert do cliente vinculado à proposta. Retorna o cliente salvo.
 *  Se `c.id` está ausente, tenta localizar por CNPJ e apenas preenche campos vazios;
 *  do contrário insere um novo. Também atualiza `proposals.client_id`. */
export async function upsertProposalClient(proposalId: string, c: any): Promise<any> {
  if (c.id) {
    const { error } = await supabase.from("clients").update(clientPayload(c)).eq("id", c.id);
    if (error) throw new Error(error.message);
    return c;
  }
  let existing: any = null;
  if (c.cnpj_cpf) {
    const { data } = await supabase.from("clients").select("*").eq("cnpj_cpf", c.cnpj_cpf).maybeSingle();
    existing = data;
  }
  let saved: any;
  if (existing) {
    const merged: any = { ...existing };
    Object.entries(c).forEach(([k, v]) => { if (v && !merged[k]) merged[k] = v; });
    await supabase.from("clients").update(merged).eq("id", existing.id);
    saved = merged;
  } else {
    const { data, error } = await supabase.from("clients").insert({
      ...clientPayload(c),
      razao_social: c.razao_social || "Cliente sem nome",
    }).select("*").single();
    if (error) throw new Error(error.message);
    saved = data;
  }
  await supabase.from("proposals").update({ client_id: saved.id }).eq("id", proposalId);
  return saved;
}

/* ---------------- Itens ---------------- */

export async function insertProposalItem(payload: any): Promise<any> {
  const { data, error } = await supabase.from("proposal_items").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProposalItem(itemId: string, payload: any): Promise<void> {
  const { error } = await supabase.from("proposal_items").update(payload).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function deleteProposalItem(itemId: string): Promise<void> {
  await supabase.from("proposal_items").delete().eq("id", itemId);
}

/* ---------------- Serviços (catálogo) ---------------- */

export async function findServiceByName(nome: string): Promise<any | null> {
  const { data } = await supabase.from("services").select("id").eq("nome", nome).maybeSingle();
  return data;
}

export async function insertService(payload: any): Promise<any> {
  const { data, error } = await supabase.from("services").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

/* ---------------- Pricing ---------------- */

export async function insertItemPricing(payload: any): Promise<any> {
  const { data, error } = await supabase.from("proposal_item_pricing").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertItemPricing(existingId: string | undefined, payload: any): Promise<any> {
  if (existingId) {
    const { data, error } = await supabase.from("proposal_item_pricing").update(payload).eq("id", existingId).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  }
  return insertItemPricing(payload);
}

/** Registra a simulação individual + linha do histórico. Best-effort — erros
 *  são engolidos para não interromper o fluxo do usuário (comportamento original). */
export async function recordIndividualPricingHistory(args: {
  proposalId: string;
  item: any;
  draft: any;
  computed: any;
  valorAnterior: number;
}): Promise<void> {
  const { proposalId, item, draft, computed, valorAnterior } = args;
  try {
    const { data: sim } = await supabase.from("simulacoes_precificacao").insert({
      proposal_id: proposalId,
      tipo: "individual",
      regra_rateio: "igual",
      aplicada: true,
      aplicada_em: new Date().toISOString(),
      totais: computed as any,
    }).select("id").single();
    if (!sim) return;
    await supabase.from("simulacao_itens").insert({
      simulacao_id: sim.id,
      proposal_item_id: item.id,
      custos_individuais: draft.custos,
      horas: draft.horas,
      aliquota_imposto: draft.aliquota_imposto,
      margem_desejada: draft.margem_desejada,
      lucro_desejado: draft.lucro_desejado,
      desconto_comercial: draft.desconto_comercial,
      custo_individual: computed.custo_total,
      custo_total: computed.custo_total,
      preco_sugerido: computed.preco_sugerido,
      preco_final: computed.preco_arredondado,
      lucro_estimado: computed.lucro_estimado,
      margem_liquida: computed.margem_liquida,
      markup: computed.markup,
      status_margem: computed.status_margem,
      indicadores: computed as any,
    });
    await supabase.from("historico_precificacao").insert({
      proposal_id: proposalId,
      simulacao_id: sim.id,
      proposal_item_id: item.id,
      acao: "aplicada_individual",
      valor_anterior: valorAnterior,
      valor_novo: computed.preco_arredondado,
      detalhes: { regra: "individual" } as any,
    });
  } catch {
    /* histórico é best-effort */
  }
}

/* ---------------- Revisões ---------------- */

export async function listRevisions(proposalId: string): Promise<any[]> {
  const rv = await supabase.from("proposal_revisions").select("*").eq("proposal_id", proposalId).order("revisao", { ascending: false });
  return rv.data || [];
}

export async function addRevisao(proposalId: string, titulo: string, descricao: string): Promise<void> {
  await supabase.rpc("add_proposal_revision", { _proposal_id: proposalId, _titulo: titulo, _descricao: descricao });
}
