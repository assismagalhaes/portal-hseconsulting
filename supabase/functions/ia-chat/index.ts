// Edge function: IA chat - copiloto interno HSE
// Recebe { modulo, pergunta, entidade_tipo?, entidade_id?, history? }
// Carrega contexto autorizado do banco, chama Lovable AI Gateway, registra interacao.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

type Modulo = "geral" | "proposta" | "precificacao" | "documento" | "os" | "execucao" | "crm" | "financeiro" | "alertas";

interface Body {
  modulo?: Modulo;
  pergunta: string;
  entidade_tipo?: string;
  entidade_id?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  model?: string;
}

async function loadContext(supabase: ReturnType<typeof createClient>, body: Body) {
  const ctx: Record<string, unknown> = {};
  const limit = 20;

  // dados globais resumidos
  const [propostas, os, docs, alertas] = await Promise.all([
    supabase.from("proposals").select("id,numero,titulo,status,valor_total,validade_ate,client_id,created_at").order("created_at", { ascending: false }).limit(limit),
    supabase.from("ordens_servico").select("id,numero,titulo,status,prioridade,data_prevista_conclusao,responsavel_tecnico_id,client_id,cliente_nome").order("created_at", { ascending: false }).limit(limit),
    supabase.from("documentos_tecnicos").select("id,numero,titulo,tipo,status,data_emissao,data_vencimento,client_id,cliente_nome").order("created_at", { ascending: false }).limit(limit),
    supabase.from("ia_alertas").select("id,tipo,gravidade,titulo,status,client_id").in("status", ["novo", "em_analise"]).limit(limit),
  ]);
  ctx.propostas_recentes = propostas.data ?? [];
  ctx.os_recentes = os.data ?? [];
  ctx.documentos_recentes = docs.data ?? [];
  ctx.alertas_abertos = alertas.data ?? [];

  // contexto específico
  if (body.entidade_tipo && body.entidade_id) {
    if (body.entidade_tipo === "proposta") {
      const [p, items] = await Promise.all([
        supabase.from("proposals").select("*").eq("id", body.entidade_id).maybeSingle(),
        supabase.from("proposal_items").select("*").eq("proposal_id", body.entidade_id),
      ]);
      ctx.proposta = p.data; ctx.itens = items.data ?? [];
    } else if (body.entidade_tipo === "os") {
      const [o, vis, ck] = await Promise.all([
        supabase.from("ordens_servico").select("*").eq("id", body.entidade_id).maybeSingle(),
        supabase.from("os_visitas").select("*").eq("os_id", body.entidade_id),
        supabase.from("os_checklist").select("*").eq("os_id", body.entidade_id),
      ]);
      ctx.os = o.data; ctx.visitas = vis.data ?? []; ctx.checklist = ck.data ?? [];
    } else if (body.entidade_tipo === "documento") {
      const d = await supabase.from("documentos_tecnicos").select("*").eq("id", body.entidade_id).maybeSingle();
      ctx.documento = d.data;
    } else if (body.entidade_tipo === "cliente") {
      const [c, hist] = await Promise.all([
        supabase.from("clients").select("*").eq("id", body.entidade_id).maybeSingle(),
        supabase.from("crm_historico").select("*").eq("client_id", body.entidade_id).order("created_at", { ascending: false }).limit(20),
      ]);
      ctx.cliente = c.data; ctx.historico = hist.data ?? [];
    }
  }

  return ctx;
}

async function getPrompt(supabase: ReturnType<typeof createClient>, modulo: Modulo) {
  const r = await supabase.from("ia_prompts").select("prompt_base").eq("modulo", modulo).eq("ativo", true).order("versao", { ascending: false }).limit(1).maybeSingle();
  return r.data?.prompt_base ?? "Você é o copiloto interno da HSE Consulting. Responda em português, objetivamente.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Body;
    const modulo: Modulo = body.modulo ?? "geral";
    const model = body.model ?? "google/gemini-3-flash-preview";

    const [systemPrompt, ctx] = await Promise.all([getPrompt(supabase, modulo), loadContext(supabase, body)]);

    const messages = [
      { role: "system", content: systemPrompt + "\n\nCONTEXTO INTERNO (JSON):\n" + JSON.stringify(ctx).slice(0, 60000) + "\n\nResponda em português, formate em markdown. Use bullets quando útil. Toda recomendação é uma sugestão sujeita à validação humana." },
      ...(body.history ?? []),
      { role: "user", content: body.pergunta },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Falha na IA", detalhe: txt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const resposta = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? {};

    await supabase.from("ia_interacoes").insert({
      user_id: user.id,
      modulo,
      entidade_tipo: body.entidade_tipo ?? null,
      entidade_id: body.entidade_id ?? null,
      pergunta: body.pergunta,
      resposta,
      contexto: { keys: Object.keys(ctx) },
      model,
      tokens_input: usage.prompt_tokens ?? null,
      tokens_output: usage.completion_tokens ?? null,
    });

    return new Response(JSON.stringify({ resposta, model }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});