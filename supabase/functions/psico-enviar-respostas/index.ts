// Submissão pública das respostas do questionário psicossocial.
// - CORS restrito por PSICO_PUBLIC_ALLOWED_ORIGINS
// - Valida sessão HMAC assinada por PSICO_FORM_SESSION_SECRET
// - Aplica rate limiting por origem, por sessão e por public_id
// - Chama RPC psico_finalizar_submissao (service role) transacional
// - Não registra tokens/respostas em log
import { createClient } from 'npm:@supabase/supabase-js@2'

const SESSION_SECRET = Deno.env.get('PSICO_FORM_SESSION_SECRET') || ''
const RL_SECRET = Deno.env.get('PSICO_RATE_LIMIT_SECRET') || SESSION_SECRET
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
async function hmacB64(secret: string, msg: string) {
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
async function verifySession(t: string) {
  if (!t || t.length > 2048) return null
  const parts = t.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts
  const expected = await hmacB64(SESSION_SECRET, `${h}.${p}`)
  if (expected.length !== sig.length) return null
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const payload = JSON.parse(b64urlDecode(p))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.pid || typeof payload.tv !== 'number') return null
    return payload as { pid: string; tv: number; av: string; qv: string; exp: number }
  } catch { return null }
}
function err(o: string | null, code: string, status = 400) {
  return new Response(JSON.stringify({ status: 'erro', codigo: code }), { status, headers: baseHeaders(o) })
}

const OPCOES = new Set(['nunca', 'raramente', 'as_vezes', 'frequentemente', 'sempre'])

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    const ok = pickOrigin(origin)
    return new Response('ok', { status: ok ? 204 : 403, headers: baseHeaders(origin) })
  }
  if (req.method !== 'POST') return err(origin, 'method', 405)
  if (origin && !pickOrigin(origin)) return err(origin, 'origin', 403)

  try {
    const raw = await req.text()
    if (raw.length > 32768) return err(origin, 'body_too_large', 413)
    let body: any
    try { body = JSON.parse(raw) } catch { return err(origin, 'json') }

    const sessao = String(body?.sessao || '')
    const respostas = body?.respostas
    if (!Array.isArray(respostas) || respostas.length !== 35) return err(origin, 'itens')

    const parsed = await verifySession(sessao)
    if (!parsed) return err(origin, 'sessao', 401)

    // Valida estrutura e opções permitidas
    const seen = new Set<number>()
    const clean: { numero: number; opcao: string }[] = []
    for (const r of respostas) {
      const numero = Number(r?.numero)
      const opcao = String(r?.opcao || '')
      if (!Number.isInteger(numero) || numero < 1 || numero > 35) return err(origin, 'numero')
      if (seen.has(numero)) return err(origin, 'duplicado')
      if (!OPCOES.has(opcao)) return err(origin, 'opcao')
      seen.add(numero)
      clean.push({ numero, opcao })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Rate limits
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const [oh, sh, ph] = await Promise.all([
      hmacB64(RL_SECRET, `sub_o:${ip}`),
      hmacB64(RL_SECRET, `sub_s:${sessao.slice(0, 128)}`),
      hmacB64(RL_SECRET, `sub_p:${parsed.pid}`),
    ])
    const [{ data: ao }, { data: as }, { data: ap }] = await Promise.all([
      admin.rpc('psico_rate_limit_hit', { _bucket: 'sub_o', _key_hash: oh.slice(0, 24), _window_seconds: 600, _max: 20 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'sub_s', _key_hash: sh.slice(0, 24), _window_seconds: 600, _max: 6 }),
      admin.rpc('psico_rate_limit_hit', { _bucket: 'sub_p', _key_hash: ph.slice(0, 24), _window_seconds: 60, _max: 3 }),
    ])
    if (ao === false || as === false || ap === false) {
      return new Response(JSON.stringify({ status: 'rate_limited' }), { status: 429, headers: baseHeaders(origin) })
    }

    const { data, error } = await admin.rpc('psico_finalizar_submissao', {
      p_public_id: parsed.pid,
      p_token_version: parsed.tv,
      p_respostas: clean,
    })
    if (error) {
      const code = (error.message || '').includes('ja_respondido')
        ? 'ja_respondido' : 'falha'
      return new Response(JSON.stringify({ status: code }), {
        status: code === 'ja_respondido' ? 200 : 400,
        headers: baseHeaders(origin),
      })
    }
    return new Response(JSON.stringify(data || { status: 'registrada' }), {
      status: 200, headers: baseHeaders(origin),
    })
  } catch {
    return err(origin, 'unexpected', 500)
  }
})