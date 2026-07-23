// Valida convite individual (token v2 assinado) sem autenticação.
// - CORS restrito por PSICO_PUBLIC_ALLOWED_ORIGINS
// - Verifica assinatura HMAC do token v2 e reconfere estado no banco
// - O tipo de respondente vem SEMPRE do payload assinado, nunca do cliente
// - Devolve sessão temporária + estrutura do formulário (perguntas + opções)
import { createClient } from 'npm:@supabase/supabase-js@2'

const SECRET = Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || ''
const SESSION_SECRET = Deno.env.get('PSICO_FORM_SESSION_SECRET') || ''
const RL_SECRET = Deno.env.get('PSICO_RATE_LIMIT_SECRET') || SECRET
const ALLOWED = (Deno.env.get('PSICO_PUBLIC_ALLOWED_ORIGINS') ||
  'https://portal.hseconsulting.com.br,https://portal-hseconsulting.lovable.app')
  .split(',').map((s) => s.trim()).filter(Boolean)
const IS_DEV = (Deno.env.get('DENO_ENV') || '') === 'development'

function pickOrigin(o: string | null) {
  if (!o) return null
  if (ALLOWED.includes(o)) return o
  if (IS_DEV && /^http:\/\/localhost(:\d+)?$/.test(o)) return o
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
function invalid(o: string | null) {
  return new Response(
    JSON.stringify({ valido: false, estado: 'invalido', mensagem: 'Não foi possível validar este acesso.' }),
    { status: 200, headers: baseHeaders(o) },
  )
}
async function hmacB64(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string) {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}
async function verifyV2(token: string) {
  if (!token || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v2') return null
  const [, body, sig] = parts
  const expected = await hmacB64(SECRET, `v2.${body}`)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const p = JSON.parse(b64urlDecode(body))
    if (typeof p !== 'object' || p == null) return null
    if (!/^[0-9a-f-]{36}$/i.test(String(p.pid))) return null
    if (!/^[0-9a-f-]{36}$/i.test(String(p.av))) return null
    if (!/^[0-9a-f-]{36}$/i.test(String(p.iv))) return null
    if (!['empregado', 'empregador'].includes(String(p.tipo))) return null
    if (!Number.isInteger(p.tv) || p.tv < 0) return null
    if (p.exp && p.exp < Math.floor(Date.now() / 1000)) return null
    return p as { pid: string; tv: number; tipo: 'empregado'|'empregador'; av: string; iv: string; exp: number }
  } catch { return null }
}
async function signSession(payload: Record<string, unknown>): Promise<string> {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64(payload)
  const sig = await hmacB64(SESSION_SECRET, `${h}.${p}`)
  return `${h}.${p}.${sig}`
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    const ok = pickOrigin(origin)
    return new Response(ok ? null : 'forbidden', { status: ok ? 204 : 403, headers: baseHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: baseHeaders(origin) })
  }
  if (origin && !pickOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: baseHeaders(origin) })
  }

  try {
    const raw = await req.text()
    if (raw.length > 4096) return invalid(origin)
    let body: any = {}
    try { body = JSON.parse(raw) } catch { return invalid(origin) }
    const token = String(body?.token || '')
    if (!token || token.length > 2048) return invalid(origin)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Rate limit por IP e por fingerprint do token
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [oh, th] = await Promise.all([
      hmacB64(RL_SECRET, `ind_val_o:${ip}`),
      hmacB64(RL_SECRET, `ind_val_t:${token.slice(0, 128)}`),
    ])
    const [{ data: okO }, { data: okT }] = await Promise.all([
      admin.rpc('psico_rate_limit_hit', { _bucket: 'ind_val_o', _key_hash: oh.slice(0,24), _window_seconds: 600, _max: 60 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'ind_val_t', _key_hash: th.slice(0,24), _window_seconds: 600, _max: 12 }),
    ])
    if (okO === false || okT === false) {
      return new Response(
        JSON.stringify({ valido: false, estado: 'rate_limited', mensagem: 'Muitas tentativas. Tente novamente em instantes.' }),
        { status: 429, headers: baseHeaders(origin) },
      )
    }

    const parsed = await verifyV2(token)
    if (!parsed) return invalid(origin)

    // Reconfere no banco (public_id + token_version + status)
    const { data: conv } = await admin
      .from('psico_individual_convites')
      .select('id, status, token_version, avaliacao_id, papel, expira_em')
      .eq('public_id', parsed.pid).maybeSingle()
    if (!conv || conv.token_version !== parsed.tv || conv.papel !== parsed.tipo) return invalid(origin)

    let estado = 'disponivel'
    if (conv.status === 'revogado') estado = 'revogado'
    else if (conv.status === 'expirado') estado = 'expirado'
    else if (conv.status === 'respondido') estado = 'ja_respondido'
    else if (conv.expira_em && new Date(conv.expira_em) < new Date()) estado = 'expirado'

    const mensagens: Record<string, string> = {
      disponivel: 'Formulário disponível.',
      ja_respondido: 'Este convite já foi utilizado.',
      revogado: 'Este convite foi cancelado. Solicite um novo link.',
      expirado: 'Este convite expirou.',
    }

    const { data: av } = await admin
      .from('psico_avaliacoes').select('id, titulo, status, cliente_id, modalidade').eq('id', conv.avaliacao_id).maybeSingle()
    if (!av || av.modalidade !== 'individual_microempresa') return invalid(origin)
    if (av.status === 'cancelada') estado = 'cancelado'

    let empresa: string | null = null
    if (av.cliente_id) {
      const { data: cli } = await admin.from('clients').select('razao_social, nome_fantasia').eq('id', av.cliente_id).maybeSingle()
      empresa = cli?.nome_fantasia || cli?.razao_social || null
    }

    if (estado !== 'disponivel' || !SESSION_SECRET) {
      return new Response(JSON.stringify({
        valido: false, estado, empresa,
        mensagem: mensagens[estado] || 'Convite indisponível.',
      }), { status: 200, headers: baseHeaders(origin) })
    }

    // Carrega perguntas + opções do instrumento
    const { data: perguntas } = await admin
      .from('psico_individual_perguntas')
      .select('id, ordem, numero, texto, tipo, obrigatoria, fator_codigo, limite_texto, regra_condicional, codigo, chave_pareamento, periodo_referencia')
      .eq('instrumento_versao_id', parsed.iv)
      .eq('papel', parsed.tipo)
      .eq('ativa', true)
      .order('ordem')

    const perguntaIds = (perguntas || []).map((p: any) => p.id)
    const { data: opcoes } = perguntaIds.length
      ? await admin
          .from('psico_individual_opcoes')
          .select('id, pergunta_id, ordem, rotulo, valor_numerico')
          .in('pergunta_id', perguntaIds)
          .order('ordem')
      : { data: [] as any[] }

    const nowSec = Math.floor(Date.now() / 1000)
    const sessao = await signSession({
      v: 1,
      pid: parsed.pid,
      tv: parsed.tv,
      tipo: parsed.tipo,
      av: av.id,
      iv: parsed.iv,
      iat: nowSec,
      exp: nowSec + 4 * 3600,
      n: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/=+$/, ''),
    })

    return new Response(JSON.stringify({
      valido: true,
      estado: 'disponivel',
      modalidade: 'individual',
      tipo: parsed.tipo,
      empresa,
      sessao,
      formulario: {
        titulo: parsed.tipo === 'empregado'
          ? 'Avaliação Assistida Individual — Empregado'
          : 'Avaliação Assistida Individual — Empregador',
        tempo_estimado_minutos: 12,
        perguntas: (perguntas || []).map((p: any) => ({
          id: p.id,
          numero: p.numero,
          texto: p.texto,
          tipo: p.tipo,
          fator: p.fator_codigo,
          obrigatoria: !!p.obrigatoria,
          limite_texto: p.limite_texto || 500,
          regra_condicional: p.regra_condicional || null,
          opcoes: (opcoes || [])
            .filter((o: any) => o.pergunta_id === p.id)
            .map((o: any) => ({ id: o.id, rotulo: o.rotulo, valor: o.valor_numerico })),
        })),
      },
    }), { status: 200, headers: baseHeaders(origin) })
  } catch {
    return invalid(origin)
  }
})