// psico-individual-sugerir-plano
// Gera sugestões de plano de ação individual usando IA (Lovable AI Gateway).
// Retorna sugestões validadas para o técnico revisar; NÃO persiste itens no plano.
// Toda execução (com prompt e resposta) é auditada via psico_ind_log_sugestao_ia.
//
// Contexto permitido: achados sanitizados + catálogo + porte/CNAE.
// Contexto proibido: respostas brutas, texto livre, PII, IP, diagnóstico clínico.
//
// verify_jwt = true (ver supabase/config.toml).
import { createClient } from "npm:@supabase/supabase-js@2";

const PROMPT_VERSAO = "HSE-PSICO-IND-PLANO-1.0";
const MODELO = "google/gemini-2.5-flash"; // custo-benefício alto para JSON estruturado
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// Termos proibidos: garantem que a IA não invente linguagem clínica ou identificação.
const TERMOS_PROIBIDOS = [
  /\bdiagn[oó]stico\b/i, /\bpaciente\b/i, /\bcid[-\s]?\d/i, /\btranstorno\b/i,
  /\bpsicopatolog/i, /\btratamento cl[ií]nico\b/i, /\bmedica[çc][aã]o\b/i,
  /\bnome\s*[:=]/i, /\be-?mail\s*[:=]/i, /\bcpf\b/i, /\bendere[cç]o\s*[:=]/i,
  /\bip\s*:/i,
];
function contemProibido(txt: string): string | null {
  for (const r of TERMOS_PROIBIDOS) if (r.test(txt)) return r.source;
  return null;
}

type Sugestao = {
  achado_id: string;
  titulo: string;
  objetivo: string;
  acao: string;
  responsavel_sugerido: string;
  prazo_dias: number;
  evidencia: string;
  indicador_eficacia: string;
  justificativa: string;
  medida_catalogo_id?: string | null;
  medida_catalogo_codigo?: string | null;
};

function ehString(x: unknown, min = 1, max = 4000): x is string {
  return typeof x === "string" && x.trim().length >= min && x.length <= max;
}

function validarSugestao(s: any, achadosMap: Map<string, any>, catalogoMap: Map<string, any>): { ok: true; sug: Sugestao } | { ok: false; motivo: string; raw: any } {
  if (!s || typeof s !== "object") return { ok: false, motivo: "formato_invalido", raw: s };
  const achado = achadosMap.get(String(s.achado_id || ""));
  if (!achado) return { ok: false, motivo: "achado_inexistente", raw: s };
  const campos = ["titulo","objetivo","acao","responsavel_sugerido","evidencia","indicador_eficacia","justificativa"];
  for (const c of campos) {
    if (!ehString(s[c], 3, 2000)) return { ok: false, motivo: `campo_invalido:${c}`, raw: s };
  }
  const prazo = Number(s.prazo_dias);
  if (!Number.isFinite(prazo) || prazo < 1 || prazo > 720) return { ok: false, motivo: "prazo_invalido", raw: s };
  // Nenhum termo proibido em campos textuais
  const blob = campos.map((c) => String(s[c] ?? "")).join("\n");
  const proib = contemProibido(blob);
  if (proib) return { ok: false, motivo: `termo_proibido:${proib}`, raw: s };
  // Medida do catálogo: se citada, precisa existir e ser do mesmo fator
  let medId: string | null = null, medCodigo: string | null = null;
  if (s.medida_catalogo_id) {
    const m = catalogoMap.get(String(s.medida_catalogo_id));
    if (!m) return { ok: false, motivo: "medida_catalogo_inexistente", raw: s };
    if (m.fator_codigo !== achado.fator_codigo) return { ok: false, motivo: "medida_fator_incompativel", raw: s };
    medId = m.id; medCodigo = m.codigo;
  }
  return {
    ok: true,
    sug: {
      achado_id: achado.id,
      titulo: String(s.titulo).trim(),
      objetivo: String(s.objetivo).trim(),
      acao: String(s.acao).trim(),
      responsavel_sugerido: String(s.responsavel_sugerido).trim(),
      prazo_dias: Math.round(prazo),
      evidencia: String(s.evidencia).trim(),
      indicador_eficacia: String(s.indicador_eficacia).trim(),
      justificativa: String(s.justificativa).trim(),
      medida_catalogo_id: medId,
      medida_catalogo_codigo: medCodigo,
    },
  };
}

function montarPromptSistema(): string {
  return [
    "Você é um assistente técnico especialista em SST psicossocial (NR-01/PGR).",
    "Sua tarefa: sugerir ações organizacionais para um plano de ação de MICROEMPRESA, com base em achados JÁ CONCILIADOS e classificados pelo motor determinístico e revisados por um técnico humano.",
    "REGRAS RÍGIDAS:",
    "- NUNCA altere a classificação do achado (estado_final, condicao_preliminar, necessita_acao). Você só sugere ações.",
    "- NUNCA invente um achado; use apenas os achado_id fornecidos.",
    "- Nunca use linguagem clínica (diagnóstico, transtorno, CID, paciente, tratamento clínico, medicação).",
    "- Nunca cite nomes, e-mails, CPF, endereços, IPs ou qualquer identificação individual.",
    "- Ações devem ser ORGANIZACIONAIS (processo, gestão, comunicação, treinamento coletivo, redesenho de tarefa). Nunca proponha ações exclusivamente individuais (ex.: 'terapia para o funcionário') como resposta a problema organizacional.",
    "- Cada achado com necessita_acao=true PRECISA de pelo menos uma ação.",
    "- Cada achado com estado_final='prioritario' PRECISA de pelo menos uma ação urgente (prazo_dias <= 30).",
    "- Prefira uma medida do catálogo quando ela cobrir o achado; use medida_catalogo_id nesse caso.",
    "- Todos os campos textuais em pt-BR, objetivos e curtos.",
    "- Responda EXCLUSIVAMENTE em JSON válido no formato solicitado. Sem markdown, sem comentários.",
  ].join("\n");
}

function montarPromptUsuario(ctx: any): string {
  return [
    "CONTEXTO DA MICROEMPRESA (sanitizado):",
    JSON.stringify({ empresa: ctx.empresa, avaliacao: ctx.avaliacao }, null, 2),
    "",
    "ACHADOS REVISADOS (usar apenas estes IDs):",
    JSON.stringify(ctx.achados, null, 2),
    "",
    "CATÁLOGO DE MEDIDAS DISPONÍVEIS (preferir quando aplicável):",
    JSON.stringify(ctx.catalogo, null, 2),
    "",
    "FORMATO DA RESPOSTA (JSON):",
    `{
  "sugestoes": [
    {
      "achado_id": "<uuid do achado>",
      "titulo": "string curta",
      "objetivo": "o que resolver, em uma frase",
      "acao": "descrição da ação organizacional a executar",
      "responsavel_sugerido": "papel/área (ex.: 'Empregador / Gestão'; nunca nome pessoal)",
      "prazo_dias": 30,
      "evidencia": "documento/registro que comprova execução",
      "indicador_eficacia": "métrica ou verificação para medir eficácia",
      "justificativa": "por que essa ação responde ao achado",
      "medida_catalogo_id": "<uuid da medida do catálogo, ou null>"
    }
  ]
}`,
    "",
    "Gere de 1 a 3 ações por achado que exija ação. Não inclua ações para achados nao_aplicavel ou evidencia_insuficiente.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const authHeader = req.headers.get("authorization") || "";

  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json(401, { error: "unauthorized" });

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const avaliacaoId = body?.avaliacao_id as string | undefined;
  if (!avaliacaoId) return json(400, { error: "avaliacao_id_obrigatorio" });

  const admin = createClient(url, service);
  const { data: canSee } = await admin.rpc("can_see_internal", { _user: userData.user.id });
  if (!canSee) return json(403, { error: "forbidden" });

  // Contexto sanitizado (RPC exige service_role)
  const { data: ctx, error: eCtx } = await admin.rpc("psico_ind_contexto_para_ia", { p_avaliacao: avaliacaoId });
  if (eCtx || !ctx) return json(500, { error: "contexto_indisponivel", detail: eCtx?.message });

  const processamentoImutavel = (ctx as any)?.processamento?.imutavel === true;
  if (!processamentoImutavel) {
    return json(422, { error: "processamento_nao_aprovado", detail: "Aprove a conciliação antes de sugerir plano." });
  }

  const achadosArr = ((ctx as any)?.achados ?? []) as any[];
  const achadosAcao = achadosArr.filter((a) => a.necessita_acao === true);
  if (achadosAcao.length === 0) {
    return json(200, { sugestoes: [], nota: "Nenhum achado exige ação." });
  }

  if (!lovableKey) {
    // IA indisponível: criação manual continua funcionando (aceite documentado)
    return json(503, { error: "ia_indisponivel", detail: "LOVABLE_API_KEY ausente." });
  }

  const prompt_sistema = montarPromptSistema();
  const prompt_usuario = montarPromptUsuario({ ...(ctx as any), achados: achadosAcao });

  // Chamada à IA
  let respostaBruta: any = null;
  let iaTexto = "";
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [
          { role: "system", content: prompt_sistema },
          { role: "user", content: prompt_usuario },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      await admin.rpc("psico_ind_log_sugestao_ia", {
        p_avaliacao: avaliacaoId, p_processamento: (ctx as any)?.processamento?.id ?? null,
        p_modelo: MODELO, p_prompt_versao: PROMPT_VERSAO,
        p_prompt_sistema: prompt_sistema, p_prompt_usuario: prompt_usuario,
        p_resposta: { http_status: resp.status, body: txt.slice(0, 4000) },
        p_sugestoes: [], p_rejeitadas: [],
        p_status: "falha_ia", p_erro: `status=${resp.status}`,
      });
      if (resp.status === 429) return json(429, { error: "rate_limit", detail: "IA indisponível no momento. Tente novamente ou crie manualmente." });
      if (resp.status === 402) return json(402, { error: "credito_insuficiente", detail: "Créditos de IA esgotados. Crie ações manualmente." });
      return json(502, { error: "ia_falhou", detail: txt.slice(0, 500) });
    }
    respostaBruta = await resp.json();
    iaTexto = respostaBruta?.choices?.[0]?.message?.content ?? "";
  } catch (e: any) {
    return json(502, { error: "ia_erro_rede", detail: e?.message });
  }

  // Parse JSON
  let payload: any = null;
  try { payload = JSON.parse(iaTexto); } catch { payload = null; }
  if (!payload || !Array.isArray(payload.sugestoes)) {
    await admin.rpc("psico_ind_log_sugestao_ia", {
      p_avaliacao: avaliacaoId, p_processamento: (ctx as any)?.processamento?.id ?? null,
      p_modelo: MODELO, p_prompt_versao: PROMPT_VERSAO,
      p_prompt_sistema: prompt_sistema, p_prompt_usuario: prompt_usuario,
      p_resposta: respostaBruta, p_sugestoes: [], p_rejeitadas: [],
      p_status: "falha_schema", p_erro: "sugestoes_ausentes_ou_invalidas",
    });
    return json(422, { error: "resposta_invalida", detail: "IA não retornou o formato esperado." });
  }

  // Validação por sugestão
  const achadosMap = new Map(achadosAcao.map((a) => [String(a.id), a]));
  const catalogoMap = new Map(((ctx as any).catalogo ?? []).map((m: any) => [String(m.id), m]));
  const ok: Sugestao[] = [];
  const rejeitadas: any[] = [];
  for (const s of payload.sugestoes) {
    const v = validarSugestao(s, achadosMap, catalogoMap);
    if (v.ok) ok.push(v.sug); else rejeitadas.push({ motivo: v.motivo, raw: v.raw });
  }

  // Gate: todo achado prioritário precisa de ação
  const prioritarios = achadosAcao.filter((a) => a.estado_final === "prioritario").map((a) => a.id);
  const cobertoPor = new Set(ok.map((s) => s.achado_id));
  const prioSemAcao = prioritarios.filter((id) => !cobertoPor.has(id));
  const status = ok.length > 0 && prioSemAcao.length === 0 ? "ok" : "falha_gate";
  if (prioSemAcao.length > 0) {
    for (const id of prioSemAcao) rejeitadas.push({ motivo: "prioritario_sem_acao", achado_id: id });
  }

  const { data: logId } = await admin.rpc("psico_ind_log_sugestao_ia", {
    p_avaliacao: avaliacaoId, p_processamento: (ctx as any)?.processamento?.id ?? null,
    p_modelo: MODELO, p_prompt_versao: PROMPT_VERSAO,
    p_prompt_sistema: prompt_sistema, p_prompt_usuario: prompt_usuario,
    p_resposta: respostaBruta,
    p_sugestoes: ok as any, p_rejeitadas: rejeitadas as any,
    p_status: status, p_erro: prioSemAcao.length > 0 ? "gate_prioritario_incompleto" : null,
  });

  return json(200, {
    log_id: logId,
    modelo: MODELO,
    prompt_versao: PROMPT_VERSAO,
    sugestoes: ok,
    rejeitadas,
    gate_prioritario_incompleto: prioSemAcao.length > 0,
    prioritarios_sem_acao: prioSemAcao,
  });
});