import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT_CODE = "HSE-PSICO-IA-PARECER-1.2";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const REQUIRED_KEYS = [
  "sintese_resultados",
  "interpretacao_integrada",
  "prioridades_intervencao",
  "recomendacoes",
  "limitacoes",
  "conclusao",
] as const;
const HEADER_KEYS = [
  "contexto_organizacional",
  "limitacoes_estudo",
  "recomendacao_geral",
] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseStructuredContent(raw: string): Record<string, string> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("IA_RESPOSTA_SEM_JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("IA_ESTRUTURA_INVALIDA");
  for (const key of [...REQUIRED_KEYS, ...HEADER_KEYS]) {
    if (typeof parsed[key] !== "string" || parsed[key].trim().length < 20) {
      throw new Error(`IA_CAMPO_INVALIDO:${key}`);
    }
  }
  return Object.fromEntries(
    [...REQUIRED_KEYS, ...HEADER_KEYS].map((key) => [key, parsed[key].trim()]),
  );
}

const systemPrompt = `Você atua como assistente especializada em fatores psicossociais relacionados ao trabalho, psicologia organizacional e do trabalho, ergonomia organizacional, saúde e segurança do trabalho e gerenciamento de riscos ocupacionais.

Objetivo: produzir uma minuta de parecer técnico conclusivo sobre resultados coletivos de avaliação de fatores psicossociais relacionados ao trabalho.

Regras obrigatórias:
- Escreva em português brasileiro, com linguagem técnica acessível e profissional.
- Separe fatos calculados de interpretação e não extrapole os dados fornecidos.
- Não altere cálculos, classificação, significância ou prioridade.
- Não realize diagnóstico clínico, não classifique pessoas, não indique doença e não afirme causalidade.
- Não use linguagem acusatória, não atribua culpa e não afirme assédio como fato comprovado pelo questionário.
- Não invente informações nem identifique pessoa ou grupo.
- Reconheça limitações da amostra e explique divergência entre score e prioridade quando existir.
- Destaque fatores significativos, oriente análise do trabalho real e proponha ações organizacionais já compatíveis com o plano aprovado.
- Trate prazos como recomendados, não como prazos legais.
- Mencione verificação de eficácia, responsabilidade da empresa e integração com AEP, Inventário de Riscos e Plano de Ação do PGR, conforme aplicável.
- Esclareça que os resultados são coletivos, o questionário não constitui diagnóstico e a implementação compete à empresa, salvo contratação específica.

REGRAS ADICIONAIS v1.2 (obrigatórias):
- REGRA DE AMOSTRA CRÍTICA: se o número de respondentes (n) for menor que 5, adote OBRIGATORIAMENTE tom preliminar/exploratório em todos os campos. Evite afirmações conclusivas, use expressões como "indícios preliminares", "sinaliza tendência a ser confirmada" e recomende reavaliação em até 6 meses com amostra ampliada. Problematize explicitamente o risco de viés amostral quando muitos fatores aparecerem críticos com n pequeno.
- ANTI-ALUCINAÇÃO NUMÉRICA: NUNCA cite scores, médias ou percentuais que não estejam literalmente presentes no JSON de contexto. Se precisar referenciar intensidade, use categorias qualitativas (baixo/moderado/alto/crítico) exatamente como fornecidas. Proibido inventar valores decimais.
- ESTRUTURA POR EIXOS NR-01: em "interpretacao_integrada" e "recomendacoes", agrupe os fatores nos eixos da NR-01 quando aplicável: (1) Organização do trabalho e demandas; (2) Autonomia e controle; (3) Relações socioprofissionais e liderança; (4) Reconhecimento e crescimento; (5) Interface trabalho-vida; (6) Assédio, violência e discriminação. Apenas cite eixos efetivamente presentes nos dados.
- FECHAMENTO DO LOOP COM PLANO DE AÇÃO: em "prioridades_intervencao" e "conclusao", referencie nominalmente ao menos 2 medidas concretas do Plano de Ação consolidado (quando disponível no contexto), pelo título/descrição da ação, demonstrando alinhamento entre o parecer e o plano aprovado.

Você também deve compor três campos de CABEÇALHO técnico (todos obrigatórios, mínimo 20 caracteres cada):
- "contexto_organizacional": descreva o contexto factual da avaliação (cliente, unidade, período, participantes previstos vs. respondentes, modalidade de coleta), extraído do contexto estruturado fornecido. Objetivo, sem interpretação.
- "limitacoes_estudo": registre limites metodológicos observáveis (adesão, supressão por sigilo NR-01, natureza autorrelatada, coleta anônima quando aplicável).
- "recomendacao_geral": recomendação-síntese objetiva integrando o resultado ao ciclo PGR (NR-01) — 2 a 4 frases.

Retorne SOMENTE JSON válido, sem markdown, exatamente com as chaves:
{"contexto_organizacional":"...","limitacoes_estudo":"...","recomendacao_geral":"...","sintese_resultados":"...","interpretacao_integrada":"...","prioridades_intervencao":"...","recomendacoes":"...","limitacoes":"...","conclusao":"..."}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METODO_NAO_PERMITIDO" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
    if (!gatewayKey) return json({ error: "IA_NAO_CONFIGURADA" }, 503);

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "NAO_AUTENTICADO" }, 401);

    const body = await req.json();
    const revisaoId = String(body?.revisao_id ?? "");
    const confirmar = body?.confirmar_substituicao === true;
    if (!/^[0-9a-f-]{36}$/i.test(revisaoId)) return json({ error: "REVISAO_INVALIDA" }, 400);

    const { data: revisao, error: revisaoError } = await userClient
      .from("psico_revisoes_tecnicas")
      .select("parecer_conclusivo,status")
      .eq("id", revisaoId)
      .maybeSingle();
    if (revisaoError || !revisao) return json({ error: "REVISAO_NAO_LOCALIZADA" }, 404);
    if (revisao.status === "aprovada") return json({ error: "REVISAO_IMUTAVEL" }, 409);
    if (revisao.parecer_conclusivo && !confirmar) {
      return json({ error: "CONFIRMACAO_REGENERACAO_NECESSARIA" }, 409);
    }

    const { data: contexto, error: contextoError } = await userClient.rpc("psico_obter_contexto_parecer_ia", {
      p_revisao_id: revisaoId,
    });
    if (contextoError || !contexto) return json({ error: "CONTEXTO_INDISPONIVEL", detalhe: contextoError?.message }, 400);

    const model = typeof body?.model === "string" && body.model.length < 100 ? body.model : DEFAULT_MODEL;
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CONTEXTO COLETIVO E ESTRUTURADO:\n${JSON.stringify(contexto)}` },
        ],
      }),
    });
    if (!aiResponse.ok) {
      const status = aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 502;
      return json({ error: status === 429 ? "IA_LIMITE_ATINGIDO" : status === 402 ? "IA_CREDITOS_ESGOTADOS" : "IA_INDISPONIVEL" }, status);
    }

    const aiData = await aiResponse.json();
    const full = parseStructuredContent(String(aiData?.choices?.[0]?.message?.content ?? ""));
    const parecer = Object.fromEntries(REQUIRED_KEYS.map((k) => [k, full[k]]));
    const cabecalho = {
      contexto_organizacional: full.contexto_organizacional,
      limitacoes: full.limitacoes_estudo,
      recomendacao_geral: full.recomendacao_geral,
    };

    // Persist header fields (ignore silently if column set differs; parecer is the critical part)
    const { error: headerError } = await userClient
      .from("psico_revisoes_tecnicas")
      .update(cabecalho)
      .eq("id", revisaoId);
    if (headerError) console.warn("[psico-gerar-parecer] cabeçalho não salvo:", headerError.message);

    const { data: saved, error: saveError } = await userClient.rpc("psico_salvar_parecer_conclusivo", {
      p_revisao_id: revisaoId,
      p_parecer: parecer,
      p_origem: "ia",
      p_prompt_codigo: PROMPT_CODE,
      p_modelo_ia: model,
    });
    if (saveError) return json({ error: "PARECER_NAO_SALVO", detalhe: saveError.message }, 400);

    return json({
      ok: true,
      parecer,
      cabecalho,
      prompt_codigo: PROMPT_CODE,
      modelo: model,
      versao: saved?.versao,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[psico-gerar-parecer]", { code: message.split(":")[0] });
    return json({ error: "PARECER_IA_INVALIDO", detalhe: message }, 502);
  }
});
