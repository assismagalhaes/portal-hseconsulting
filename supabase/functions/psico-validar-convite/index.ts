// Valida convite público sem autenticação. Retorna apenas informações mínimas.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SECRET = Deno.env.get('PSICO_INVITE_SIGNING_SECRET') || ''

async function verify(token: string): Promise<{ publicId: string; ver: number } | null> {
  if (!token || token.length > 500) return null
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  const [, publicId, verStr, sig] = parts
  const ver = Number(verStr)
  if (!/^[0-9a-f-]{36}$/i.test(publicId) || !Number.isInteger(ver)) return null
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`v1.${publicId}.${ver}`))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  // constant-time compare
  if (b64.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < b64.length; i++) diff |= b64.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? { publicId, ver } : null
}

const invalid = () =>
  new Response(JSON.stringify({ valido: false, estado: 'invalido', mensagem: 'Link inválido ou expirado.' }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '')
    const parsed = await verify(token)
    if (!parsed) return invalid()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: conv } = await admin
      .from('psico_convites')
      .select('id, status, token_version, avaliacao_id')
      .eq('public_id', parsed.publicId)
      .maybeSingle()
    if (!conv) return invalid()
    if (conv.token_version !== parsed.ver) return invalid()

    let estado = 'aguardando_abertura'
    if (conv.status === 'revogado') estado = 'revogado'
    else if (conv.status === 'expirado') estado = 'expirado'
    else if (conv.status === 'respondido') estado = 'ja_respondido'

    const { data: av } = await admin
      .from('psico_avaliacoes')
      .select('id, titulo, status, cliente_id')
      .eq('id', conv.avaliacao_id)
      .maybeSingle()
    if (!av) return invalid()
    if (av.status === 'cancelada') estado = 'cancelado'

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
      aguardando_abertura: 'Esta avaliação ainda não está aberta para preenchimento.',
      ja_respondido: 'Este convite já foi utilizado.',
      expirado: 'Este convite expirou.',
      revogado: 'Este convite foi cancelado. Solicite um novo link.',
      cancelado: 'Esta avaliação foi cancelada.',
    }

    return new Response(
      JSON.stringify({
        valido: estado === 'aguardando_abertura' || estado === 'disponivel',
        estado,
        titulo_avaliacao: 'Questionário de Percepção Psicoorganizacional no Trabalho',
        titulo_interno: av.titulo,
        empresa,
        mensagem: mensagemPorEstado[estado] || 'Convite indisponível.',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    )
  } catch {
    return invalid()
  }
})