// psico-individual-processar
// Roda o motor determinístico e persiste o processamento + achados via RPC.
// Acessível apenas a usuários internos autenticados (verify_jwt = true, ver config.toml).
import { createClient } from "npm:@supabase/supabase-js@2";
import { processar, ENGINE_VERSAO, REGRAS_VERSAO, runSelfTests } from "../_shared/psico-individual-engine.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("authorization") || "";

  // Autoriza: valida usuário interno via can_see_internal
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json(401, { error: "unauthorized" });

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }

  // Self-test opcional (não altera dados)
  if (body?.op === "self_test") {
    const r = await runSelfTests();
    return json(r.ok ? 200 : 422, { ...r, engine_versao: ENGINE_VERSAO, regras_versao: REGRAS_VERSAO });
  }

  const avaliacaoId = body?.avaliacao_id as string | undefined;
  if (!avaliacaoId || typeof avaliacaoId !== "string") return json(400, { error: "avaliacao_id_obrigatorio" });

  const admin = createClient(url, service);

  // Confirma que o usuário é interno
  const { data: canSee } = await admin.rpc("can_see_internal", { _user: userData.user.id });
  if (!canSee) return json(403, { error: "forbidden" });

  // Confirma modalidade individual e recupera formulários/entradas
  const { data: av, error: eAv } = await admin
    .from("psico_avaliacoes")
    .select("id, modalidade, status")
    .eq("id", avaliacaoId)
    .maybeSingle();
  if (eAv || !av) return json(404, { error: "avaliacao_nao_encontrada" });
  if (av.modalidade !== "individual_microempresa") return json(400, { error: "modalidade_invalida" });

  const { data: entrada, error: eEnt } = await admin.rpc("psico_ind_ler_entradas_para_motor", { p_avaliacao: avaliacaoId });
  if (eEnt) return json(500, { error: "ler_entradas_falhou", detail: eEnt.message });

  const saida = await processar(entrada as any);

  if (saida.bloqueado) {
    return json(422, { status: "bloqueado", motivo: saida.motivo_bloqueio, engine_versao: ENGINE_VERSAO });
  }

  const instrEmp = (entrada as any)?.formulario_empregado?.instrumento_versao_id ?? null;
  const instrRep = (entrada as any)?.formulario_empregador?.instrumento_versao_id ?? null;

  const { data: procId, error: ePer } = await admin.rpc("psico_ind_persistir_processamento", {
    p_avaliacao: avaliacaoId,
    p_engine_versao: saida.engine_versao,
    p_versao_regra: saida.regras_versao,
    p_hash: saida.resultado_hash,
    p_snapshot: entrada,
    p_achados: saida.achados,
    p_instrumento_emp: instrEmp,
    p_instrumento_rep: instrRep,
  });
  if (ePer) return json(500, { error: "persistencia_falhou", detail: ePer.message });

  return json(200, {
    status: "ok",
    processamento_id: procId,
    engine_versao: saida.engine_versao,
    regras_versao: saida.regras_versao,
    resultado_hash: saida.resultado_hash,
    convergencias: saida.convergencias,
    divergencias: saida.divergencias,
    evidencia_insuficiente: saida.evidencia_insuficiente,
    total_achados: saida.achados.length,
  });
});