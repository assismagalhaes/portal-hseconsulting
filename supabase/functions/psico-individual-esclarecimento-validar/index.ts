// Validação pública de convite de esclarecimento AQI.
// O token é opaco, armazenado somente como SHA-256, e gera uma sessão curta.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SESSION_SECRET = Deno.env.get('PSICO_FORM_SESSION_SECRET') || ''
const RL_SECRET = Deno.env.get('PSICO_RATE_LIMIT_SECRET') || SESSION_SECRET
const ALLOWED = (Deno.env.get('PSICO_PUBLIC_ALLOWED_ORIGINS') ||
  'https://portal.hseconsulting.com.br,https://portal-hseconsulting.lovable.app')
  .split(',').map((s) => s.trim()).filter(Boolean)
const IS_DEV = (Deno.env.get('DENO_ENV') || '') === 'development'

function originAllowed(origin: string | null) {
  return !origin || ALLOWED.includes(origin) || (IS_DEV && /^http:\/\/localhost(:\d+)?$/.test(origin))
}
function headers(origin: string | null): HeadersInit {
  const result: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    'Vary': 'Origin',
  }
  if (origin && originAllowed(origin)) {
    result['Access-Control-Allow-Origin'] = origin
    result['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    result['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
  }
  return result
}
function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) })
}
async function hmac(secret: string, message: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function b64(value: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function signSession(payload: Record<string, unknown>) {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64(payload)
  return `${head}.${body}.${await hmac(SESSION_SECRET, `${head}.${body}`)}`
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: originAllowed(origin) ? 204 : 403, headers: headers(origin) })
  }
  if (req.method !== 'POST') return json(origin, { valido: false }, 405)
  if (!originAllowed(origin)) return json(origin, { valido: false }, 403)
  try {
    const raw = await req.text()
    if (raw.length > 4096 || !SESSION_SECRET) return json(origin, { valido: false })
    const token = String(JSON.parse(raw)?.token || '')
    if (!/^esc\.[A-Za-z0-9_-]{40,80}$/.test(token)) return json(origin, { valido: false })
    const tokenHash = await sha256(token)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [ipKey, tokenKey] = await Promise.all([
      hmac(RL_SECRET, `escl_val_ip:${ip}`),
      hmac(RL_SECRET, `escl_val_token:${tokenHash}`),
    ])
    const [{ data: ipOk }, { data: tokenOk }] = await Promise.all([
      admin.rpc('psico_rate_limit_hit', { _bucket: 'escl_val_ip', _key_hash: ipKey.slice(0, 24), _window_seconds: 600, _max: 60 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'escl_val_token', _key_hash: tokenKey.slice(0, 24), _window_seconds: 600, _max: 12 }),
    ])
    if (ipOk === false || tokenOk === false) return json(origin, { valido: false, estado: 'rate_limited' }, 429)

    const { data: convite } = await admin
      .from('psico_individual_esclarecimento_convites')
      .select('id, esclarecimento_id, papel, status, expira_em')
      .eq('token_hash', tokenHash).maybeSingle()
    if (!convite) return json(origin, { valido: false, estado: 'invalido' })
    if (convite.status === 'respondido') return json(origin, { valido: false, estado: 'ja_respondido' })
    if (convite.status !== 'ativo' || new Date(convite.expira_em) < new Date()) {
      return json(origin, { valido: false, estado: 'expirado' })
    }
    const { data: esclarecimento } = await admin
      .from('psico_individual_esclarecimentos')
      .select('id, status, fator_codigo, perigo_codigo, achado_id, avaliacao_id')
      .eq('id', convite.esclarecimento_id).maybeSingle()
    if (!esclarecimento || !['aguardando_respostas', 'parcial'].includes(esclarecimento.status)) {
      return json(origin, { valido: false, estado: 'indisponivel' })
    }
    const { data: achado } = await admin
      .from('psico_individual_achados')
      .select('descricao_organizacional')
      .eq('id', esclarecimento.achado_id).maybeSingle()
    const now = Math.floor(Date.now() / 1000)
    const sessao = await signSession({
      v: 1, cid: convite.id, eid: esclarecimento.id, papel: convite.papel,
      th: tokenHash, iat: now, exp: now + 2 * 3600,
    })
    return json(origin, {
      valido: true,
      estado: 'disponivel',
      modalidade: 'esclarecimento_individual',
      papel: convite.papel,
      sessao,
      contexto: {
        fator_codigo: esclarecimento.fator_codigo,
        perigo_codigo: esclarecimento.perigo_codigo,
        descricao: achado?.descricao_organizacional || null,
      },
      formulario: {
        titulo: 'Esclarecimento complementar da avaliação',
        perguntas: [
          {
            id: 'frequencia', tipo: 'opcao', obrigatoria: true,
            texto: 'Com que frequência essa condição ocorre na rotina de trabalho?',
            opcoes: [
              ['nao_ocorre', 'Não ocorre'], ['raramente', 'Raramente'], ['as_vezes', 'Às vezes'],
              ['frequente', 'Frequentemente'], ['continua', 'De forma contínua'],
            ],
          },
          {
            id: 'controle', tipo: 'opcao', obrigatoria: true,
            texto: 'Como você avalia os controles existentes para essa condição?',
            opcoes: [
              ['eficaz', 'Existem e são eficazes'], ['parcial', 'Existem, mas funcionam parcialmente'],
              ['ineficaz', 'Existem, mas não são eficazes'], ['inexistente', 'Não existem'],
              ['nao_sei', 'Não tenho elementos para avaliar'],
            ],
          },
          {
            id: 'aplicacao', tipo: 'opcao', obrigatoria: true,
            texto: 'Os controles descritos são aplicados de forma consistente na prática?',
            opcoes: [
              ['sempre', 'Sim, de forma consistente'], ['parcialmente', 'Apenas em parte'],
              ['nao', 'Não'], ['nao_se_aplica', 'Não se aplica'],
            ],
          },
          {
            id: 'exemplo', tipo: 'texto', obrigatoria: false, limite: 1000,
            texto: 'Se possível, descreva um exemplo recente, sem citar nomes ou dados pessoais.',
          },
          {
            id: 'evidencia', tipo: 'texto', obrigatoria: false, limite: 1000,
            texto: convite.papel === 'empregador'
              ? 'Indique procedimento, registro ou outra evidência organizacional existente, sem inserir dados pessoais.'
              : 'Indique algum registro ou elemento verificável, sem inserir nomes ou dados pessoais.',
          },
        ],
      },
    })
  } catch {
    return json(origin, { valido: false, estado: 'invalido' })
  }
})
