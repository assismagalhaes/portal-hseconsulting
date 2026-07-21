// Coleta pública anônima de respostas psicossociais.
// - Um único link por avaliação (modo_coleta = 'publico_anonimo')
// - Sem autenticação; CORS restrito e rate-limit por IP/token
// - Duas ações: `validar` e `submeter`
// - Grava via RPC psico_submeter_resposta_publica (dedup por hash HMAC do nome)
import { createClient } from 'npm:@supabase/supabase-js@2'

const RL_SECRET = Deno.env.get('PSICO_RATE_LIMIT_SECRET')
  || Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || 'dev-secret-change-me'
const HASH_SECRET = Deno.env.get('PSICO_PUBLIC_HASH_SECRET')
  || Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || RL_SECRET
const ALLOWED = (Deno.env.get('PSICO_PUBLIC_ALLOWED_ORIGINS') ||
  'https://portal.hseconsulting.com.br,https://portal-hseconsulting.lovable.app')
  .split(',').map((s) => s.trim()).filter(Boolean)

function pickOrigin(o: string | null) {
  if (!o) return null
  if (ALLOWED.includes(o)) return o
  // Aceita localhost (dev do Lovable/preview local) e subdomínios de preview do Lovable
  if (/^http:\/\/localhost(:\d+)?$/.test(o)) return o
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o)) return o
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(o)) return o
  return null
}
function baseHeaders(o: string | null): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache', 'Expires': '0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), interest-cohort=()',
    'Vary': 'Origin',
  }
  const ok = pickOrigin(o)
  if (ok) {
    h['Access-Control-Allow-Origin'] = ok
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
    h['Access-Control-Max-Age'] = '3600'
  }
  return h
}

async function hmac(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Normalização robusta para evitar duplicatas por variações triviais de escrita:
// - Remove acentos (NFD)
// - Converte para minúsculas
// - Remove pontuação/símbolos (mantém apenas letras, dígitos e espaço)
// - Colapsa múltiplos espaços
// - Ordena tokens alfabeticamente (ignora ordem: "Joao Silva" == "Silva Joao")
// Ex.: "Nome A", "NOME A", "NOme A", "Nôme  A.", "nome-a" => todos geram o mesmo hash.
function normalize(s: string): string {
  const base = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return ''
  const tokens = base.split(' ').filter((t) => t.length > 0)
  tokens.sort()
  return tokens.join(' ')
}

function invalid(origin: string | null, msg = 'Link inválido ou expirado.'): Response {
  return new Response(JSON.stringify({ ok: false, error: 'invalido', mensagem: msg }),
    { status: 200, headers: baseHeaders(origin) })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    const ok = pickOrigin(origin)
    return new Response(ok ? null : 'forbidden', { status: ok ? 204 : 403, headers: baseHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: baseHeaders(origin) })
  }
  if (origin && !pickOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }),
      { status: 403, headers: baseHeaders(origin) })
  }

  try {
    const raw = await req.text()
    if (raw.length > 32 * 1024) return invalid(origin)
    let body: any = {}
    try { body = JSON.parse(raw) } catch { return invalid(origin) }

    const action = String(body?.action || '')
    const token = String(body?.token || '').trim()
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(token)) return invalid(origin)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Rate limit por IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip') || 'unknown'
    const ipHash = (await hmac(RL_SECRET, `ip:${ip}`)).slice(0, 24)
    const bucket = action === 'submeter' ? 'publico_submeter' : 'publico_validar'
    const maxHits = action === 'submeter' ? 10 : 60
    const { data: okRate } = await admin.rpc('psico_rate_limit_hit', {
      _bucket: bucket, _key_hash: ipHash, _window_seconds: 600, _max: maxHits,
    })
    if (okRate === false) {
      return new Response(JSON.stringify({ ok: false, error: 'rate_limited',
        mensagem: 'Muitas tentativas. Aguarde alguns minutos.' }),
        { status: 429, headers: baseHeaders(origin) })
    }

    // Busca avaliação pelo token
    const { data: av } = await admin
      .from('psico_avaliacoes')
      .select('id, titulo, status, cliente_id, modo_coleta, campos_identificacao, registrar_participacao, questionario_versao_id, metodologia_versao_id, coleta_expira_em')
      .eq('link_publico_token', token)
      .maybeSingle()
    if (!av || av.modo_coleta !== 'publico_anonimo') return invalid(origin)

    // Empresa (nome)
    let empresa: string | null = null
    if (av.cliente_id) {
      const { data: cli } = await admin.from('clients')
        .select('razao_social, nome_fantasia').eq('id', av.cliente_id).maybeSingle()
      empresa = cli?.nome_fantasia || cli?.razao_social || null
    }

    const abertaParaColeta =
      av.status === 'coleta_em_andamento'
      && (!av.coleta_expira_em || new Date(av.coleta_expira_em).getTime() > Date.now())

    // ===== VALIDAR =====
    if (action === 'validar') {
      if (!abertaParaColeta) {
        return new Response(JSON.stringify({
          ok: true, disponivel: false, empresa, titulo: av.titulo,
          mensagem: av.status === 'coleta_em_andamento'
            ? 'O prazo desta avaliação foi encerrado.'
            : 'Esta avaliação ainda não está aberta para coleta.',
        }), { status: 200, headers: baseHeaders(origin) })
      }

      const [{ data: quest }, { data: perguntas }, { data: opcoes }] = await Promise.all([
        admin.from('psico_questionarios_versoes')
          .select('nome, subtitulo, texto_abertura, aviso_nao_avaliacao_psicologica, orientacao_periodo_referencia, fonte_referencia, nota_metodologica, quantidade_perguntas_publicada, quantidade_perguntas_prevista')
          .eq('id', av.questionario_versao_id).maybeSingle(),
        admin.from('psico_perguntas')
          .select('numero, texto, texto_apoio_exemplo')
          .eq('questionario_versao_id', av.questionario_versao_id)
          .eq('ativa', true).order('numero'),
        admin.from('psico_opcoes_resposta')
          .select('codigo, rotulo, ordem')
          .eq('metodologia_versao_id', av.metodologia_versao_id)
          .eq('ativo', true).order('ordem'),
      ])
      const qtd = quest?.quantidade_perguntas_publicada || quest?.quantidade_perguntas_prevista || (perguntas || []).length || 35

      return new Response(JSON.stringify({
        ok: true,
        disponivel: true,
        empresa,
        titulo: av.titulo,
        campos_identificacao: av.campos_identificacao,
        registrar_participacao: av.registrar_participacao,
        questionario: {
          nome: quest?.nome || 'Questionário de Percepção Psicoorganizacional no Trabalho',
          subtitulo: quest?.subtitulo || null,
          texto_abertura: quest?.texto_abertura || null,
          aviso_nao_avaliacao_psicologica: quest?.aviso_nao_avaliacao_psicologica || null,
          orientacao_periodo_referencia: quest?.orientacao_periodo_referencia || null,
          fonte_referencia: quest?.fonte_referencia || null,
          nota_metodologica: quest?.nota_metodologica || null,
          quantidade_perguntas: qtd,
          tempo_estimado_minutos: 10,
          perguntas: (perguntas || []).map((p: any) => ({
            numero: p.numero, texto: p.texto, exemplo: p.texto_apoio_exemplo || null,
          })),
          opcoes: (opcoes || []).map((o: any) => ({ codigo: o.codigo, rotulo: o.rotulo })),
        },
      }), { status: 200, headers: baseHeaders(origin) })
    }

    // ===== SUBMETER =====
    if (action === 'verificar_duplicado') {
      if (!abertaParaColeta) return invalid(origin, 'Esta avaliação não está aberta.')
      const ident = body?.identificacao || {}
      const nome = typeof ident.nome === 'string' ? ident.nome.trim().slice(0, 200) : ''
      if (!nome || nome.length < 2) {
        return new Response(JSON.stringify({ ok: true, duplicado: false }),
          { status: 200, headers: baseHeaders(origin) })
      }
      const hashNome = (await hmac(HASH_SECRET, `${av.id}:${normalize(nome)}`)).slice(0, 40)
      const { data: existente } = await admin
        .from('psico_respostas_publicas')
        .select('id')
        .eq('avaliacao_id', av.id)
        .eq('hash_nome', hashNome)
        .maybeSingle()
      return new Response(JSON.stringify({
        ok: true,
        duplicado: !!existente,
        mensagem: existente ? 'Uma resposta com esse nome já foi registrada nesta avaliação.' : null,
      }), { status: 200, headers: baseHeaders(origin) })
    }

    if (action === 'submeter') {
      if (!abertaParaColeta) return invalid(origin, 'Esta avaliação não está aberta.')

      const ident = body?.identificacao || {}
      const respostas = body?.respostas
      if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) return invalid(origin, 'Respostas inválidas.')

      // Validação de campos obrigatórios conforme configuração
      const config = av.campos_identificacao || {}
      const nome = typeof ident.nome === 'string' ? ident.nome.trim().slice(0, 200) : ''
      const funcao = typeof ident.funcao === 'string' ? ident.funcao.trim().slice(0, 150) : ''
      const setor = typeof ident.setor === 'string' ? ident.setor.trim().slice(0, 150) : ''
      const unidade = typeof ident.unidade === 'string' ? ident.unidade.trim().slice(0, 150) : ''

      if (config.nome?.ativo && config.nome?.obrigatorio && nome.length < 2) return invalid(origin, 'Informe seu nome.')
      if (config.funcao?.ativo && config.funcao?.obrigatorio && funcao.length < 2) return invalid(origin, 'Informe sua função.')
      if (config.setor?.ativo && config.setor?.obrigatorio && setor.length < 2) return invalid(origin, 'Informe seu setor.')
      if (config.unidade?.ativo && config.unidade?.obrigatorio && unidade.length < 2) return invalid(origin, 'Informe sua unidade.')

      // Validação de respostas: 35 chaves numéricas 1..35 com códigos string curtos
      const chaves = Object.keys(respostas)
      if (chaves.length < 1 || chaves.length > 200) return invalid(origin, 'Respostas fora do formato esperado.')
      for (const k of chaves) {
        const v = (respostas as any)[k]
        if (typeof v !== 'string' || v.length > 32) return invalid(origin, 'Respostas fora do formato esperado.')
      }

      const hashNome = nome ? (await hmac(HASH_SECRET, `${av.id}:${normalize(nome)}`)).slice(0, 40) : ''
      const ipHashCurto = ipHash.slice(0, 16)
      const uaHash = (await hmac(RL_SECRET, `ua:${req.headers.get('user-agent') || ''}`)).slice(0, 16)

      const { data: result, error: rpcErr } = await admin.rpc('psico_submeter_resposta_publica', {
        p_token: token,
        p_hash_nome: hashNome,
        p_nome_para_registro: av.registrar_participacao ? nome : '',
        p_funcao: funcao,
        p_setor: setor,
        p_unidade: unidade,
        p_respostas: respostas,
        p_ip_hash: ipHashCurto,
        p_ua_hash: uaHash,
      })
      if (rpcErr) {
        console.error('psico-responder-publico: rpc erro', rpcErr.message)
        return new Response(JSON.stringify({ ok: false, error: 'erro_interno' }),
          { status: 500, headers: baseHeaders(origin) })
      }

      const res = result as any
      if (res?.ok) {
        return new Response(JSON.stringify({ ok: true, status: 'registrada' }),
          { status: 200, headers: baseHeaders(origin) })
      }
      if (res?.error === 'ja_respondido') {
        return new Response(JSON.stringify({ ok: false, status: 'ja_respondido',
          mensagem: 'Uma resposta com esse nome já foi registrada nesta avaliação.' }),
          { status: 200, headers: baseHeaders(origin) })
      }
      return new Response(JSON.stringify({ ok: false, error: res?.error || 'erro',
        mensagem: 'Não foi possível registrar sua resposta.' }),
        { status: 200, headers: baseHeaders(origin) })
    }

    return invalid(origin, 'Ação desconhecida.')
  } catch (e) {
    console.error('psico-responder-publico: exceção', (e as Error).message)
    return invalid(origin)
  }
})