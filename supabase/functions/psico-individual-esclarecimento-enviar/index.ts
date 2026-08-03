// Submissão pública de esclarecimento AQI com sessão curta assinada.
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
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
  }
  if (origin && originAllowed(origin)) {
    result['Access-Control-Allow-Origin'] = origin
    result['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    result['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
  }
  return result
}
function response(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) })
}
async function hmac(secret: string, message: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function decode(value: string) {
  const pad = value.length % 4 === 2 ? '==' : value.length % 4 === 3 ? '=' : ''
  return JSON.parse(decodeURIComponent(escape(atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad))))
}
async function verifySession(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const expected = await hmac(SESSION_SECRET, `${parts[0]}.${parts[1]}`)
  if (expected.length !== parts[2].length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i)
  if (diff !== 0) return null
  try {
    const payload = decode(parts[1])
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!/^[0-9a-f-]{36}$/i.test(payload.cid) || !/^[0-9a-f]{64}$/.test(payload.th)) return null
    if (!['empregado', 'empregador'].includes(payload.papel)) return null
    return payload as { cid: string; eid: string; papel: string; th: string; exp: number }
  } catch { return null }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: originAllowed(origin) ? 204 : 403, headers: headers(origin) })
  if (req.method !== 'POST') return response(origin, { status: 'method' }, 405)
  if (!originAllowed(origin)) return response(origin, { status: 'origin' }, 403)
  try {
    const raw = await req.text()
    if (raw.length > 8192 || !SESSION_SECRET) return response(origin, { status: 'invalido' }, 400)
    const body = JSON.parse(raw)
    const parsed = await verifySession(String(body?.sessao || ''))
    if (!parsed || typeof body?.respostas !== 'object' || Array.isArray(body.respostas)) {
      return response(origin, { status: 'sessao' }, 401)
    }
    const clean = {
      frequencia: String(body.respostas.frequencia || ''),
      controle: String(body.respostas.controle || ''),
      aplicacao: String(body.respostas.aplicacao || ''),
      exemplo: String(body.respostas.exemplo || '').trim().slice(0, 1000),
      evidencia: String(body.respostas.evidencia || '').trim().slice(0, 1000),
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [ipKey, inviteKey] = await Promise.all([
      hmac(RL_SECRET, `escl_sub_ip:${ip}`),
      hmac(RL_SECRET, `escl_sub_inv:${parsed.cid}`),
    ])
    const [{ data: ipOk }, { data: inviteOk }] = await Promise.all([
      admin.rpc('psico_rate_limit_hit', { _bucket: 'escl_sub_ip', _key_hash: ipKey.slice(0, 24), _window_seconds: 600, _max: 20 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'escl_sub_inv', _key_hash: inviteKey.slice(0, 24), _window_seconds: 600, _max: 5 }),
    ])
    if (ipOk === false || inviteOk === false) return response(origin, { status: 'rate_limited' }, 429)
    const { data, error } = await admin.rpc('psico_ind_finalizar_esclarecimento', {
      p_convite: parsed.cid, p_token_hash: parsed.th, p_respostas: clean,
    })
    if (error) {
      const known = ['ja_respondido', 'convite_expirado', 'convite_indisponivel', 'respostas_invalidas']
        .find((code) => error.message.includes(code))
      return response(origin, { status: known || 'falha' }, known === 'ja_respondido' ? 200 : 400)
    }
    return response(origin, data || { status: 'registrada' })
  } catch {
    return response(origin, { status: 'invalido' }, 400)
  }
})
