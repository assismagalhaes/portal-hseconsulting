// Backend seguro para gerar links assinados de convites (uso interno).
// - Autentica usuário interno via JWT
// - Assina HMAC-SHA256(public_id|token_version) com PSICO_INVITE_SIGNING_SECRET
// - Não persiste o token; apenas devolve o link/token para cópia manual/exportação
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SECRET = Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || ''
const PUBLIC_BASE = Deno.env.get('PSICO_PUBLIC_BASE_URL') || ''

async function sign(publicId: string, tokenVersion: number): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const msg = `v1.${publicId}.${tokenVersion}`
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `v1.${publicId}.${tokenVersion}.${b64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (!SECRET) throw new Error('PSICO_INVITE_SIGNING_SECRET não configurado')
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token)
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const conviteIds: string[] = Array.isArray(body.convite_ids) ? body.convite_ids : []
    if (!conviteIds.length) {
      return new Response(JSON.stringify({ error: 'convite_ids obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // RLS já garante que só usuário interno vê os convites; se não vir, nada é retornado
    const { data, error } = await supabase
      .from('psico_convites')
      .select('id, public_id, token_version, status')
      .in('id', conviteIds)
    if (error) throw error

    // Preferir SEMPRE a URL pública publicada (evita gerar links apontando
    // para o preview privado do Lovable, que exige login do Lovable).
    const reqOrigin = req.headers.get('origin') || ''
    const isPreviewOrigin = /id-preview--.*\.lovable\.app$/i.test(reqOrigin) || /localhost(:\d+)?$/i.test(reqOrigin)
    const origin = PUBLIC_BASE
      || (reqOrigin && !isPreviewOrigin ? reqOrigin : '')
      || new URL(req.url).origin.replace(/\/functions.*$/, '')

    const result = [] as any[]
    for (const r of data || []) {
      if (r.status === 'revogado' || r.status === 'expirado') {
        result.push({ id: r.id, status: r.status, link: null, token: null })
        continue
      }
      const tok = await sign(r.public_id, r.token_version)
      result.push({
        id: r.id,
        status: r.status,
        token: tok,
        link: `${origin}/avaliacao/psicossocial#token=${tok}`,
      })
    }
    return new Response(JSON.stringify({ convites: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})