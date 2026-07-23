// Admin utility: remove uma resposta pública anônima por (avaliacao_id, nome).
// Recomputa o hash HMAC do nome usando a mesma normalização de psico-responder-publico
// e apaga a linha correspondente em psico_respostas_publicas.
// Requer usuário autenticado interno (can_see_internal = true).
import { createClient } from 'npm:@supabase/supabase-js@2'

const HASH_SECRET = Deno.env.get('PSICO_PUBLIC_HASH_SECRET')
  || Deno.env.get('PSICO_INVITE_SIGNING_SECRET')
  || Deno.env.get('PSICO_RATE_LIMIT_SECRET')
  || 'dev-secret-change-me'

const CORS: HeadersInit = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmac(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'não autenticado' }), { status: 401, headers: CORS })
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: userData } = await userClient.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return new Response(JSON.stringify({ error: 'sessão inválida' }), { status: 401, headers: CORS })
    const { data: interno } = await admin.rpc('can_see_internal', { _uid: uid })
    if (!interno) return new Response(JSON.stringify({ error: 'acesso negado' }), { status: 403, headers: CORS })

    const body = await req.json().catch(() => ({}))
    const avaliacao_id = String(body?.avaliacao_id || '')
    const nome = String(body?.nome || '')
    if (!avaliacao_id || !nome.trim()) {
      return new Response(JSON.stringify({ error: 'avaliacao_id e nome são obrigatórios' }), { status: 400, headers: CORS })
    }

    const hashNome = (await hmac(HASH_SECRET, `${avaliacao_id}:${normalize(nome)}`)).slice(0, 40)
    const { data: encontrado, error: selErr } = await admin
      .from('psico_respostas_publicas')
      .select('id, created_at, funcao')
      .eq('avaliacao_id', avaliacao_id)
      .eq('hash_nome', hashNome)
    if (selErr) return new Response(JSON.stringify({ error: selErr.message }), { status: 500, headers: CORS })
    if (!encontrado?.length) {
      return new Response(JSON.stringify({ ok: false, removidos: 0, hash: hashNome }), { status: 404, headers: CORS })
    }
    const { error: delErr } = await admin
      .from('psico_respostas_publicas')
      .delete()
      .eq('avaliacao_id', avaliacao_id)
      .eq('hash_nome', hashNome)
    if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: CORS })

    return new Response(JSON.stringify({ ok: true, removidos: encontrado.length, itens: encontrado }), { headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: CORS })
  }
})