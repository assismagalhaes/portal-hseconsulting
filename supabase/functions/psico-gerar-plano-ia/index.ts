import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT_CODE = "HSE-PSICO-IA-PLANO-1.1";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const systemPrompt = `Você atua como assistente especializada em fatores psicossociais relacionados ao trabalho, psicologia organizacional e do trabalho, ergonomia organizacional, saúde e segurança do trabalho e gerenciamento de riscos ocupacionais, com foco em conformidade com a NR-01 (GRO/PGR) do MTE.

Sua tarefa: montar um PLANO DE AÇÃO técnico, proporcional e EXECUTÁVEL, escolhendo medidas do CATÁLOGO fornecido para tratar os fatores da avaliação.

Regras obrigatórias:
- Selecione APENAS medidas cujo "id" está presente no catálogo fornecido. Nunca invente medidas.
- Cubra TODOS os fatores em que "tratamento" = "acao_recomendada". Para fatores em "monitoramento_preventivo", inclua medidas apenas quando o catálogo indicar nível "essencial" ou for claramente pertinente. Ignore fatores com "sem_acao_especifica".
- Não replique medidas de "itens_personalizados_existentes"; o técnico já os criou.

Camadas do plano (obrigatório equilibrar níveis):
- Para cada fator com ação recomendada, inclua ao menos uma medida "essencial".
- Sempre que o catálogo permitir, complemente com medidas "estruturante" (governança/processo) e/ou "complementar" (sustentação/cultura), especialmente em prioridade crítica/alta. Evite planos 100% "essencial": um plano maduro tem camadas essencial → estruturante → complementar.
- Proporcionalidade: prioridade crítica/alta pode receber 2 a 3 medidas; média 1 a 2; monitoramento no máximo 1.

Prazos ESCALONADOS (evite prazo uniforme para todos os críticos — é irrealista executar tudo em 30 dias):
- Comunicação, jornada/pausas e clareza de papéis (quick wins): 30 dias.
- Liderança, conflitos/respeito e participação/autonomia (envolvem treinamento e mediação): 60 dias.
- Organização do trabalho, gestão de mudanças e reestruturações de processo (envolvem redesenho): 90 dias.
- Prioridade "alta" segue a mesma lógica somando 30 dias; "media" 90; "monitoramento" 180.
- Ajuste apenas com justificativa técnica explícita.

Indicadores SMART com META NUMÉRICA (obrigatório):
- "indicador_sugerido" deve conter meta quantificável e verificável. Exemplos: "≥ 90% dos líderes treinados em 60 dias", "≥ 1 reunião de alinhamento/mês por equipe", "100% das descrições de cargo revisadas até o prazo", "redução de ≥ 30% nas mediações reabertas em 6 meses".
- Nunca use frases genéricas como "frequência de reuniões" ou "número de treinamentos" sem número/percentual.
- Se o catálogo não oferecer base para meta, use uma meta conservadora e realista (ex.: "≥ 80% em 90 dias").

Segmentação (quando aplicável):
- Se o contexto trouxer "segmentacoes" com recortes por função/setor/unidade acima do quórum, priorize segmentar medidas de liderança, conflitos e comunicação usando "abrangencia_tipo" e "abrangencia_rotulo". Sem dados suficientes, mantenha "global"/"Resultado geral".

Segurança técnica:
- Não crie diagnósticos clínicos, não culpabilize pessoas, não afirme assédio como fato, não invente medidas fora do catálogo.
- Escreva justificativas em português brasileiro, técnicas e objetivas (1 a 2 frases), citando o(s) fator(es) alvo.

Retorne SOMENTE JSON válido no formato:
{"selecoes":[{"medida_modelo_id":"<uuid do catálogo>","fatores_codes":["<codigo_fator>"],"prioridade":"critica|alta|media|monitoramento","prazo_dias":30,"justificativa":"...","responsavel_sugerido":"opcional","indicador_sugerido":"meta numérica SMART","abrangencia_tipo":"global|funcao|setor|unidade","abrangencia_rotulo":"opcional"}]}

Sem markdown, sem comentários, sem texto fora do JSON.`;

function parseSelecoes(raw: string): any[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("IA_RESPOSTA_SEM_JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const arr = Array.isArray(parsed?.selecoes) ? parsed.selecoes : null;
  if (!arr || arr.length === 0) throw new Error("IA_SEM_SELECOES");
  return arr;
}

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
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "NAO_AUTENTICADO" }, 401);

    const body = await req.json();
    const revisaoId = String(body?.revisao_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(revisaoId)) return json({ error: "REVISAO_INVALIDA" }, 400);

    const { data: contexto, error: ctxErr } = await userClient.rpc("psico_obter_contexto_plano_ia", {
      p_revisao_id: revisaoId,
    });
    if (ctxErr || !contexto) {
      return json({ error: "CONTEXTO_INDISPONIVEL", detalhe: ctxErr?.message }, 400);
    }

    const model =
      typeof body?.model === "string" && body.model.length < 100 ? body.model : DEFAULT_MODEL;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CONTEXTO COLETIVO E CATÁLOGO:\n${JSON.stringify(contexto)}` },
        ],
      }),
    });
    if (!aiResponse.ok) {
      const status = aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 502;
      return json(
        {
          error:
            status === 429
              ? "IA_LIMITE_ATINGIDO"
              : status === 402
                ? "IA_CREDITOS_ESGOTADOS"
                : "IA_INDISPONIVEL",
        },
        status,
      );
    }
    const aiData = await aiResponse.json();
    const selecoes = parseSelecoes(String(aiData?.choices?.[0]?.message?.content ?? ""));

    const { data: aplicado, error: aplErr } = await userClient.rpc("psico_aplicar_plano_ia", {
      p_revisao_id: revisaoId,
      p_selecoes: selecoes,
      p_prompt_codigo: PROMPT_CODE,
      p_modelo_ia: model,
    });
    if (aplErr) return json({ error: "PLANO_NAO_APLICADO", detalhe: aplErr.message }, 400);

    return json({ ok: true, itens: aplicado?.itens ?? 0, modelo: model, prompt_codigo: PROMPT_CODE });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[psico-gerar-plano-ia]", { code: message.split(":")[0] });
    return json({ error: "PLANO_IA_INVALIDO", detalhe: message }, 502);
  }
});