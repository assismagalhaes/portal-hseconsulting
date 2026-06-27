// Edge function: gera alertas inteligentes cruzando dados de propostas, OS, documentos, CRM e financeiro.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(SUPABASE_URL, SERVICE_ROLE);
    const alertas: Array<Record<string, unknown>> = [];
    const hoje = new Date();
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // Propostas aprovadas sem OS
    const { data: aprovadas } = await db.from("proposals").select("id,numero,titulo,client_id").eq("status", "aprovada");
    for (const p of aprovadas ?? []) {
      const { count } = await db.from("ordens_servico").select("id", { count: "exact", head: true }).eq("proposal_id", p.id);
      if ((count ?? 0) === 0) {
        alertas.push({ tipo: "proposta_sem_os", gravidade: "alta", modulo: "alertas", client_id: p.client_id, entidade_tipo: "proposta", entidade_id: p.id,
          titulo: `Proposta aprovada sem OS: ${p.numero ?? ""}`, descricao: p.titulo, acao_sugerida: "Criar Ordem de Serviço a partir desta proposta." });
      }
    }

    // OS sem responsável
    const { data: osSemResp } = await db.from("ordens_servico").select("id,numero,titulo,client_id,cliente_nome").is("responsavel_tecnico_id", null).neq("status", "finalizada");
    for (const o of osSemResp ?? []) {
      alertas.push({ tipo: "os_sem_responsavel", gravidade: "media", modulo: "alertas", client_id: o.client_id, entidade_tipo: "os", entidade_id: o.id,
        titulo: `OS sem responsável técnico: ${o.numero ?? ""}`, descricao: `${o.cliente_nome ?? ""} — ${o.titulo ?? ""}`, acao_sugerida: "Atribuir responsável técnico." });
    }

    // Documentos vencendo em 30 dias
    const { data: docsVenc } = await db.from("documentos_tecnicos").select("id,numero,titulo,client_id,cliente_nome,data_vencimento").lte("data_vencimento", em30).gte("data_vencimento", hoje.toISOString().slice(0, 10));
    for (const d of docsVenc ?? []) {
      alertas.push({ tipo: "documento_vencendo", gravidade: "alta", modulo: "alertas", client_id: d.client_id, entidade_tipo: "documento", entidade_id: d.id,
        titulo: `Documento vence em breve: ${d.numero ?? ""}`, descricao: `${d.cliente_nome ?? ""} — vence ${d.data_vencimento}`, acao_sugerida: "Programar renovação ou nova emissão." });
    }

    // Parcelas vencidas
    const { data: parcVenc } = await db.from("financeiro_parcelas").select("id,client_id,numero,valor,data_vencimento").eq("status", "vencida").limit(50);
    for (const p of parcVenc ?? []) {
      alertas.push({ tipo: "parcela_vencida", gravidade: "critica", modulo: "financeiro", client_id: p.client_id, entidade_tipo: "parcela", entidade_id: p.id,
        titulo: `Parcela vencida nº ${p.numero}`, descricao: `Valor R$ ${p.valor} vencido em ${p.data_vencimento}`, acao_sugerida: "Realizar cobrança amigável." });
    }

    let inseridos = 0;
    for (const a of alertas) {
      const { data: existe } = await db.from("ia_alertas").select("id").eq("tipo", a.tipo).eq("entidade_id", a.entidade_id as string).in("status", ["novo", "em_analise"]).maybeSingle();
      if (!existe) {
        await db.from("ia_alertas").insert(a);
        inseridos++;
      }
    }

    return new Response(JSON.stringify({ ok: true, gerados: inseridos, total: alertas.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});