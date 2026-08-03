import { createClient } from 'npm:@supabase/supabase-js@2'

const INTERNAL_ROLES = new Set(['admin', 'comercial', 'tecnico'])

export async function requireInternalUser(req: Request): Promise<string | null> {
  const authorization = req.headers.get('authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return 'service_role'

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const { data } = await service.auth.getUser(token)
  const userId = data.user?.id
  if (!userId) return null

  const { data: roles } = await service.from('user_roles').select('role').eq('user_id', userId)
  return (roles ?? []).some(({ role }) => INTERNAL_ROLES.has(role)) ? userId : null
}
