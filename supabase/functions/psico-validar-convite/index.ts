// Valida convite público sem autenticação.
// - Retorna respostas genéricas para tokens inválidos
// - CORS restrito por PSICO_PUBLIC_ALLOWED_ORIGINS
// - Cabeçalhos de segurança e no-store
// - Rate limiting por origem e por fingerprint do token
import { createClient } from 'npm:@supabase/supabase-js@2'

const SECRET = Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || ''
const SESSION_SECRET = Deno.env.get('PSICO_FORM_SESSION_SECRET') || ''
const RL_SECRET = Deno.env.get('PSICO_RATE_LIMIT_SECRET') || SECRET
const ALLOWED = (Deno.env.get('PSICO_PUBLIC_ALLOWED_ORIGINS') ||
  'https://portal.hseconsulting.com.br,https://portal-hseconsulting.lovable.app')
  .split(',').map((s) => s.trim()).filter(Boolean)
const IS_DEV = (Deno.env.get('DENO_ENV') || '') === 'development'

function pickOrigin(origin: string | null): string | null {
  if (!origin) return null
  if (ALLOWED.includes(origin)) return origin
  if (IS_DEV && /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
  return null
}

function baseHeaders(origin: string | null): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), interest-cohort=()',
    'Vary': 'Origin',
  }
  const ok = pickOrigin(origin)
  if (ok) {
    h['Access-Control-Allow-Origin'] = ok
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
    h['Access-Control-Max-Age'] = '3600'
  }
  return h
}

async function hmacB64(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verify(token: string): Promise<{ publicId: string; ver: number } | null> {
  if (!token || typeof token !== 'string' || token.length > 512) return null
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  const [, publicId, verStr, sig] = parts
  const ver = Number(verStr)
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return null
  if (!Number.isInteger(ver) || ver < 0 || ver > 1_000_000) return null
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(sig)) return null
  const expected = await hmacB64(SECRET, `v1.${publicId}.${ver}`)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? { publicId, ver } : null
}

async function signSession(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const h = b64(header)
  const p = b64(payload)
  const msg = `${h}.${p}`
  const sig = await hmacB64(SESSION_SECRET, msg)
  return `${msg}.${sig}`
}

function invalid(origin: string | null): Response {
  return new Response(
    JSON.stringify({ valido: false, estado: 'invalido', mensagem: 'Não foi possível validar este acesso.' }),
    { status: 200, headers: baseHeaders(origin) },
  )
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    const ok = pickOrigin(origin)
    return new Response('ok', { status: ok ? 204 : 403, headers: baseHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: baseHeaders(origin) })
  }
  if (origin && !pickOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: baseHeaders(origin) })
  }
  try {
    // Limita payload
    const raw = await req.text()
    if (raw.length > 2048) return invalid(origin)
    let body: any = {}
    try { body = JSON.parse(raw) } catch { return invalid(origin) }
    const token = String(body?.token || '')
    if (!token || token.length > 512) return invalid(origin)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Rate limit por origem derivada (não armazena IP bruto)
    const originIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip') || 'unknown'
    const originHash = await hmacB64(RL_SECRET, `origin:${originIp}`)
    const tokenHash = await hmacB64(RL_SECRET, `token:${token.slice(0, 128)}`)
    const [{ data: okOrigin }, { data: okToken }] = await Promise.all([
      admin.rpc('psico_rate_limit_hit', { _bucket: 'validar_origin', _key_hash: originHash.slice(0, 24), _window_seconds: 600, _max: 60 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'validar_token', _key_hash: tokenHash.slice(0, 24), _window_seconds: 600, _max: 12 }),
    ])
    if (okOrigin === false || okToken === false) {
      return new Response(
        JSON.stringify({ valido: false, estado: 'rate_limited', mensagem: 'Muitas tentativas. Tente novamente em instantes.' }),
        { status: 429, headers: baseHeaders(origin) },
      )
    }

    const parsed = await verify(token)
    if (!parsed) return invalid(origin)

    const { data: conv } = await admin
      .from('psico_convites')
      .select('id, status, token_version, avaliacao_id, expira_em')
      .eq('public_id', parsed.publicId)
      .maybeSingle()
    if (!conv || conv.token_version !== parsed.ver) {
      console.log('validar-convite: convite não encontrado ou token_version diverge', {
        publicId: parsed.publicId, ver: parsed.ver, found: !!conv, tv: conv?.token_version,
      })
      return invalid(origin)
    }

    let estado = 'aguardando_abertura'
    if (conv.status === 'revogado') estado = 'revogado'
    else if (conv.status === 'expirado') estado = 'expirado'
    else if (conv.status === 'respondido') estado = 'ja_respondido'

    const { data: av } = await admin
      .from('psico_avaliacoes')
      .select('id, titulo, status, cliente_id, questionario_versao_id, metodologia_versao_id, coleta_expira_em')
      .eq('id', conv.avaliacao_id)
      .maybeSingle()
    if (!av) return invalid(origin)
    if (av.status === 'cancelada') estado = 'cancelado'
    else if (conv.status === 'ativo' && av.status === 'coleta_em_andamento') {
      const now = Date.now()
      const prazo = av.coleta_expira_em ? new Date(av.coleta_expira_em).getTime() : null
      if (prazo && now > prazo) estado = 'prazo_encerrado'
      else estado = 'disponivel'
    }
    console.log('validar-convite: estado calculado', {
      publicId: parsed.publicId,
      conv_status: conv.status,
      av_status: av.status,
      coleta_expira_em: av.coleta_expira_em,
      estado,
      has_session_secret: !!SESSION_SECRET,
    })

    let empresa: string | null = null
    if (av.cliente_id) {
      const { data: cli } = await admin
        .from('clients')
        .select('razao_social, nome_fantasia')
        .eq('id', av.cliente_id)
        .maybeSingle()
      empresa = cli?.nome_fantasia || cli?.razao_social || null
    }

    const mensagemPorEstado: Record<string, string> = {
      aguardando_abertura: 'Seu acesso individual foi validado. Esta avaliação ainda não está aberta para preenchimento.',
      ja_respondido: 'Este convite já foi utilizado.',
      disponivel: 'Sua avaliação está disponível.',
      prazo_encerrado: 'O prazo desta avaliação foi encerrado.',
      expirado: 'Este convite expirou.',
      revogado: 'Este convite foi cancelado. Solicite um novo link.',
      cancelado: 'Esta avaliação foi cancelada.',
    }

    // Estado disponível: gerar sessão e conteúdo público do questionário
    if (estado === 'disponivel' && SESSION_SECRET) {
      await admin.rpc('psico_registrar_acesso_convite', {
        p_public_id: parsed.publicId, p_token_version: parsed.ver,
      })
      const nonce = crypto.getRandomValues(new Uint8Array(16))
      const nonceStr = btoa(String.fromCharCode(...nonce)).replace(/=+$/, '')
      const nowSec = Math.floor(Date.now() / 1000)
      const sessao = await signSession({
        v: 1,
        pid: parsed.publicId,
        tv: parsed.ver,
        av: av.id,
        qv: av.questionario_versao_id,
        iat: nowSec,
        exp: nowSec + 4 * 3600,
        n: nonceStr,
      })
      const [{ data: perguntas }, { data: opcoes }] = await Promise.all([
        admin.from('psico_perguntas')
          .select('numero, texto, texto_apoio_exemplo')
          .eq('questionario_versao_id', av.questionario_versao_id)
          .eq('ativa', true).order('numero'),
        admin.from('psico_opcoes_resposta')
          .select('codigo, rotulo, ordem')
          .eq('metodologia_versao_id', av.metodologia_versao_id)
          .eq('ativo', true).order('ordem'),
      ])
      return new Response(JSON.stringify({
        valido: true,
        estado: 'disponivel',
        sessao,
        empresa,
        questionario: {
          nome: 'Questionário de Percepção Psicoorganizacional no Trabalho',
          subtitulo: 'Instrumento coletivo de percepção sobre fatores psicossociais relacionados às condições e à organização do trabalho.',
          quantidade_perguntas: 35,
          tempo_estimado_minutos: 10,
          perguntas: (perguntas || []).map((p: any) => ({
            numero: p.numero, texto: p.texto, exemplo: p.texto_apoio_exemplo || null,
          })),
          opcoes: (opcoes || []).map((o: any) => ({ codigo: o.codigo, rotulo: o.rotulo })),
        },
      }), { status: 200, headers: baseHeaders(origin) })
    }

    return new Response(
      JSON.stringify({
        valido: estado === 'aguardando_abertura',
        estado,
        titulo_avaliacao: 'Questionário de Percepção Psicoorganizacional no Trabalho',
        empresa,
        mensagem: mensagemPorEstado[estado] || 'Convite indisponível.',
      }),
      { status: 200, headers: baseHeaders(origin) },
    )
  } catch {
    return invalid(origin)
  }
})