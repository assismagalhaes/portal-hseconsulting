// Helpers compartilhados para as edge functions de importação de avaliações históricas (Fase 9).
// - Autenticação por JWT (verify_jwt=false → validamos manualmente)
// - Checagem de papel (admin | tecnico)
// - Clients Supabase com service role e com JWT do usuário
// - Parser CSV simples + wrapper XLSX
// - Normalização de opções de resposta (nunca/raramente/às vezes/frequentemente/sempre)
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

export function svcClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

export function userClient(jwt: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
  )
}

export async function authAdminOrTecnico(req: Request): Promise<{ jwt: string; userId: string } | null> {
  const authz = req.headers.get('authorization') || ''
  const jwt = authz.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null
  const svc = svcClient()
  const { data: userData } = await svc.auth.getUser(jwt)
  const uid = userData?.user?.id
  if (!uid) return null
  const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', uid)
  const set = new Set((roles || []).map((r: { role: string }) => r.role))
  if (!set.has('admin') && !set.has('tecnico')) return null
  return { jwt, userId: uid }
}

// ---------- Normalização ----------
const OPCAO_MAP: Record<string, string> = {
  'nunca': 'nunca',
  'raramente': 'raramente',
  'as vezes': 'as_vezes',
  'as_vezes': 'as_vezes',
  'às vezes': 'as_vezes',
  'as veze': 'as_vezes',
  'as-vezes': 'as_vezes',
  'frequentemente': 'frequentemente',
  'sempre': 'sempre',
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizarOpcao(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const raw = String(valor).trim().toLowerCase()
  if (!raw) return null
  const k = stripDiacritics(raw).replace(/\s+/g, ' ')
  return OPCAO_MAP[k] ?? OPCAO_MAP[k.replace(' ', '_')] ?? null
}

export function normalizarTexto(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

export function normalizarChaveClassificacao(v: unknown): string | null {
  const s = normalizarTexto(v)
  if (!s) return null
  return stripDiacritics(s.toLowerCase()).replace(/\s+/g, ' ')
}

export function normalizarData(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  // ISO
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // Google Forms (pt-BR): dd/mm/yyyy HH:MM:SS
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  // dd-mm-yyyy
  const br2 = /^(\d{2})-(\d{2})-(\d{4})/.exec(s)
  if (br2) return `${br2[3]}-${br2[2]}-${br2[1]}`
  return null
}

// ---------- SHA-256 ----------
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------- CSV parser (RFC 4180 simplificado, aceita ; ou ,) ----------
export function parseCsv(text: string): string[][] {
  // Detecta separador na 1ª linha não vazia
  const sample = text.split(/\r?\n/).find(l => l.trim().length > 0) || ''
  const commaCount = (sample.match(/,/g) || []).length
  const semiCount = (sample.match(/;/g) || []).length
  const sep = semiCount > commaCount ? ';' : ','

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const n = text.length
  for (let i = 0; i < n; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === sep) { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* ignora */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  // remove linhas 100% vazias no final
  while (rows.length && rows[rows.length - 1].every(x => x.trim() === '')) rows.pop()
  return rows
}

// ---------- XLSX (lazy import) ----------
export async function parseXlsx(bytes: Uint8Array): Promise<string[][]> {
  const XLSX = await import('npm:xlsx@0.18.5')
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const arr = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
  return arr.map(row => (row as unknown[]).map(v => (v == null ? '' : String(v))))
}