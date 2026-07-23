// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const ALLOWED_ORIGINS = (Deno.env.get("PSICO_PUBLIC_ALLOWED_ORIGINS") ??
  "https://portal.hseconsulting.com.br,https://portal-hseconsulting.lovable.app")
  .split(",").map((v) => v.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const PROMPT_CODE = "HSE-PSICO-IA-PARECER-INDIVIDUAL-1.0";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const REQUIRED_KEYS = [
  "sintese_caso",
  "interpretacao_convergencia",
  "prioridades",
  "recomendacoes_organizacionais",
  "limitacoes",
  "conclusao",
] as const;

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseStructured(raw: string): Record<string, string> {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const s = clean.indexOf("{"); const e = clean.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("IA_RESPOSTA_SEM_JSON");
  const parsed = JSON.parse(clean.slice(s, e + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("IA_ESTRUTURA_INVALIDA");
  for (const k of REQUIRED_KEYS) {
    if (typeof parsed[k] !== "string" || parsed[k].trim().length < 20) {
      throw new Error(`IA_CAMPO_INVALIDO:${k}`);
    }
  }
  return Object.fromEntries(REQUIRED_KEYS.map((k) => [k, parsed[k].trim()]));
}

const systemPrompt = `Você é assistente especializada em fatores psicossociais relacionados ao trabalho — modalidade Avaliação Assistida Individual (microempresa).

Objetivo: produzir MINUTA de parecer técnico conclusivo referente a UM único caso (um empregado + um empregador), com base em conciliação determinística já realizada e no plano de ação aprovado.

Regras obrigatórias:
- Português brasileiro, técnico, sem diagnóstico clínico, sem julgamento de pessoa.
- Trate os achados como CONDIÇÕES ORGANIZACIONAIS a serem verificadas no trabalho real, não como fatos consumados.
- Confidencialidade: NUNCA cite nomes, e-mails, telefones, cargos identificáveis ou qualquer dado pessoal. Não prometa anonimato estatístico; refira-se sempre a "o(a) empregado(a)" e "o(a) empregador(a)".
- ANTI-ALUCINAÇÃO NUMÉRICA: nunca invente scores. Use categorias qualitativas exatamente como fornecidas (baixo, moderado, alto, crítico).
- LINGUAGEM NATURAL DOS FATORES: nunca use identificadores em snake_case. Converta "carga_excessiva" → "Carga excessiva de trabalho", etc.
- Explique claramente eventuais DIVERGÊNCIAS entre percepção do(a) empregado(a) e do(a) empregador(a) e a decisão técnica adotada.
- Referencie nominalmente pelo menos 2 medidas do plano de ação quando existirem, demonstrando alinhamento entre parecer e plano.
- Trate prazos como recomendados, integrando ao ciclo do PGR (NR-01).
- Reconheça as LIMITAÇÕES desta modalidade (um empregado e uma fonte empregadora, autorrelato, ausência de estatística coletiva).

Estrutura (todos os campos obrigatórios, mínimo 20 caracteres):
- "sintese_caso": descrição factual do caso (modalidade individual, dois papéis, número de achados por classificação).
- "interpretacao_convergencia": análise dos pontos de convergência e divergência entre as percepções, sinalizando os fatores prioritários.
- "prioridades": lista textual (em parágrafo ou bullets em texto corrido) das prioridades de intervenção referenciando o plano.
- "recomendacoes_organizacionais": recomendações agrupadas pelos eixos da NR-01 aplicáveis a microempresa.
- "limitacoes": limitações metodológicas da modalidade individual.
- "conclusao": fechamento integrando parecer, plano e ciclo PGR/NR-01.

Retorne SOMENTE JSON válido, sem markdown, exatamente com as chaves:
{"sintese_caso":"...","interpretacao_convergencia":"...","prioridades":"...","recomendacoes_organizacionais":"...","limitacoes":"...","conclusao":"..."}`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const respond = (body: unknown, status = 200) => json(body, status, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return respond({ error: "ORIGEM_NAO_PERMITIDA" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return respond({ error: "METODO_NAO_PERMITIDO" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
    if (!gatewayKey) return respond({ error: "IA_NAO_CONFIGURADA" }, 503);

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond({ error: "NAO_AUTENTICADO" }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const avaliacaoId = String(body?.avaliacao_id ?? "");
    const confirmar = body?.confirmar_substituicao === true;
    if (!/^[0-9a-f-]{36}$/i.test(avaliacaoId)) return respond({ error: "AVALIACAO_INVALIDA" }, 400);

    const { data: avaliacaoVisivel, error: visError } = await userClient
      .from("psico_avaliacoes").select("id").eq("id", avaliacaoId).maybeSingle();
    if (visError || !avaliacaoVisivel) return respond({ error: "NAO_AUTORIZADO" }, 403);

    // Verifica se já há parecer aprovado
    const { data: existente } = await userClient
      .from("psico_individual_revisoes")
      .select("id,parecer,status,imutavel")
      .eq("avaliacao_id", avaliacaoId)
      .eq("ativa", true)
      .maybeSingle();
    if (existente?.imutavel) return respond({ error: "REVISAO_IMUTAVEL" }, 409);
    if (existente?.parecer && !confirmar) {
      return respond({ error: "CONFIRMACAO_REGENERACAO_NECESSARIA" }, 409);
    }

    // Contexto (sem PII) — reusa RPC do PR5 que já traz achados + plano sanitizados
    // A RPC é service_role-only; a autorização do usuário já foi confirmada
    // pela autenticação e pela leitura protegida por RLS acima.
    const { data: contexto, error: ctxErr } = await admin
      .rpc("psico_ind_contexto_para_ia", { p_avaliacao: avaliacaoId });
    if (ctxErr || !contexto) return respond({ error: "CONTEXTO_INDISPONIVEL", detalhe: ctxErr?.message }, 400);

    const model = typeof body?.model === "string" && body.model.length < 100 ? body.model : DEFAULT_MODEL;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({
        model, stream: false, temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CONTEXTO INDIVIDUAL SANITIZADO:\n${JSON.stringify(contexto)}` },
        ],
      }),
    });
    if (!aiResp.ok) {
      const s = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 502;
      return respond({ error: s === 429 ? "IA_LIMITE_ATINGIDO" : s === 402 ? "IA_CREDITOS_ESGOTADOS" : "IA_INDISPONIVEL" }, s);
    }
    const aiData = await aiResp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parecer = parseStructured(String(aiData.choices?.[0]?.message?.content ?? ""));

    const { data: saved, error: saveErr } = await userClient.rpc("psico_ind_salvar_parecer", {
      p_avaliacao: avaliacaoId,
      p_parecer: parecer,
      p_prompt_codigo: PROMPT_CODE,
      p_modelo_ia: model,
    });
    if (saveErr) return respond({ error: "PARECER_NAO_SALVO", detalhe: saveErr.message }, 400);

    const savedResult = saved as { revisao_id?: string; versao?: number } | null;
    return respond({
      ok: true, parecer,
      prompt_codigo: PROMPT_CODE, modelo: model,
      revisao_id: savedResult?.revisao_id,
      versao: savedResult?.versao,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[psico-gerar-parecer-individual]", { code: msg.split(":")[0] });
    return respond({ error: "PARECER_IA_INVALIDO", detalhe: msg }, 502);
  }
});
