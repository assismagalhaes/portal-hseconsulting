// Emissão de convites individuais (AQI) — modalidade "individual_microempresa".
// - Autentica usuário interno via JWT
// - Cria (upsert) os dois convites da avaliação (empregado + empregador) se ainda não existirem
// - Assina token v2 com payload contendo: pid, tv, tipo, av, iv, exp
// - Nunca persiste tokens em log; devolve apenas o link/token
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SECRET = Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || ''
const PUBLIC_BASE = Deno.env.get('PSICO_PUBLIC_BASE_URL') || ''
const TTL_DIAS = 30

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlJson(o: unknown): string {
  return btoa(JSON.stringify(o))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return b64url(sig)
}
async function signV2(payload: Record<string, unknown>): Promise<string> {
  const body = b64urlJson(payload)
  const sig = await hmac(`v2.${body}`)
  return `v2.${body}.${sig}`
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
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token)
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const avaliacaoId = String(body?.avaliacao_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(avaliacaoId)) {
      return new Response(JSON.stringify({ error: 'avaliacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Confirma modalidade e instrumentos vigentes (RLS garante acesso do usuário interno)
    const { data: av, error: avErr } = await supabase
      .from('psico_avaliacoes')
      .select('id, modalidade, instrumento_empregado_versao_id, instrumento_empregador_versao_id')
      .eq('id', avaliacaoId)
      .maybeSingle()
    if (avErr || !av) throw new Error('avaliacao_nao_encontrada')
    if (av.modalidade !== 'individual_microempresa') {
      return new Response(JSON.stringify({ error: 'modalidade_invalida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Usa service_role para upsert idempotente dos dois convites
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const expira = new Date(Date.now() + TTL_DIAS * 24 * 3600 * 1000).toISOString()
    const papeis: Array<{ papel: 'empregado' | 'empregador'; iv: string }> = [
      { papel: 'empregado', iv: av.instrumento_empregado_versao_id },
      { papel: 'empregador', iv: av.instrumento_empregador_versao_id },
    ]

    const reqOrigin = req.headers.get('origin') || ''
    const isPreview = /id-preview--.*\.lovable\.app$/i.test(reqOrigin) || /localhost(:\d+)?$/i.test(reqOrigin)
    const origin = PUBLIC_BASE
      || (reqOrigin && !isPreview ? reqOrigin : '')
      || new URL(req.url).origin.replace(/\/functions.*$/, '')

    const result: any[] = []
    for (const { papel, iv } of papeis) {
      let { data: conv } = await admin
        .from('psico_individual_convites')
        .select('id, public_id, token_version, status, expira_em')
        .eq('avaliacao_id', avaliacaoId).eq('papel', papel).maybeSingle()
      if (!conv) {
        const ins = await admin.from('psico_individual_convites').insert({
          avaliacao_id: avaliacaoId,
          papel,
          token_hash: 'v2', // não usamos hash; guardamos marcador
          expira_em: expira,
          criado_por: claims.claims.sub,
          status: 'ativo',
        }).select('id, public_id, token_version, status, expira_em').single()
        if (ins.error) throw ins.error
        conv = ins.data
      }
      if (conv.status !== 'ativo') {
        result.push({ papel, status: conv.status, link: null, token: null })
        continue
      }
      const exp = Math.floor(new Date(conv.expira_em || expira).getTime() / 1000)
      const tok = await signV2({
        pid: conv.public_id,
        tv: conv.token_version,
        tipo: papel,
        av: avaliacaoId,
        iv,
        exp,
      })
      result.push({
        papel,
        status: conv.status,
        token: tok,
        link: `${origin}/avaliacao/psicossocial#token=${tok}`,
        expira_em: conv.expira_em,
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