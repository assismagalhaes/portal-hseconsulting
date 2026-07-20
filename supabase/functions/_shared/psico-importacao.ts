// Helpers compartilhados para as edge functions de importação de avaliações históricas (Fase 9).
// - Autenticação por JWT (verify_jwt=false → validamos manualmente)
// - Checagem de papel (admin | tecnico)
// - Clients Supabase com service role e com JWT do usuário
// - Parser CSV simples + wrapper XLSX
// - Normalização de opções de resposta (nunca/raramente/às vezes/frequentemente/sempre)
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
export { normalizarData } from './psico-importacao-dates.ts'

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

// ---------- SHA-256 ----------
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------- HMAC-SHA256 (identificador de origem) ----------
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------- Detecção de codificação (UTF-8 / UTF-8 BOM / Windows-1252) ----------
export function decodificarBytes(bytes: Uint8Array): { texto: string; codificacao: string; corrigida: boolean } {
  // BOM UTF-8
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { texto: new TextDecoder('utf-8').decode(bytes.subarray(3)), codificacao: 'utf-8-bom', corrigida: false }
  }
  // Tenta UTF-8 estrito
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Heurística de mojibake: sequências típicas (Ã§, Ã£, Ã©, Ã¡, Ã³) indicam Latin1 lido como UTF-8
    if (/Ã[\u0080-\u00BF]/.test(t)) {
      const latin = new TextDecoder('windows-1252').decode(bytes)
      return { texto: latin.normalize('NFC'), codificacao: 'windows-1252', corrigida: true }
    }
    return { texto: t.normalize('NFC'), codificacao: 'utf-8', corrigida: false }
  } catch {
    const latin = new TextDecoder('windows-1252').decode(bytes)
    return { texto: latin.normalize('NFC'), codificacao: 'windows-1252', corrigida: true }
  }
}

// ---------- Normalização de cabeçalhos ----------
function _norm(s: string): string {
  return stripDiacritics(String(s || '').toLowerCase())
    .replace(/[:*]/g, ' ').replace(/\s+/g, ' ').trim()
}

const HEADERS_ID: string[] = [
  'id da resposta', 'id resposta', 'response id', 'responseid', 'response_id',
]
const HEADERS_TIMESTAMP: string[] = [
  'carimbo de data hora', 'carimbo de data/hora', 'timestamp',
  'data hora da resposta', 'data/hora da resposta', 'data da resposta',
]
const HEADERS_NOME: string[] = [
  'informe seu nome completo', 'nome completo', 'nome',
  'colaborador', 'funcionario', 'trabalhador',
]
const HEADERS_FUNCAO: string[] = [
  'informe a sua funcao', 'informe sua funcao', 'informe a funcao',
  'funcao', 'cargo', 'ocupacao',
]

function matches(header: string, dicionario: string[]): boolean {
  const h = _norm(header)
  return dicionario.some(d => h === _norm(d))
}

// ---------- Detecção do layout (3 layouts do Google Forms) ----------
export type LayoutDetectado =
  | 'id_respostas' | 'id_nome_funcao_respostas' | 'id_nome_respostas' | 'nao_identificado'

export interface DeteccaoLayout {
  layout: LayoutDetectado
  coluna_identificador: string | null
  tipo_identificador: 'response_id' | 'timestamp' | null
  idx_identificador: number
  coluna_nome: string | null
  idx_nome: number
  coluna_funcao: string | null
  idx_funcao: number
  colunas_perguntas: Array<{ numero: number; idx: number; header: string }>
  total_perguntas_detectadas: number
  confianca: number
  avisos: string[]
  erros: string[]
}

// Extrai número inicial "NN" ou "NN." ou "NN)" de um cabeçalho de pergunta
function numeroPergunta(header: string): number | null {
  const m = /^\s*0*(\d{1,3})\s*[.)\-–]/.exec(String(header || ''))
  if (m) return parseInt(m[1], 10)
  return null
}

export function detectarLayoutImportacaoPsico(headers: string[]): DeteccaoLayout {
  const avisos: string[] = []
  const erros: string[] = []
  let idxId = -1, tipoId: 'response_id' | 'timestamp' | null = null
  let idxNome = -1, idxFuncao = -1
  const perguntas: Array<{ numero: number; idx: number; header: string }> = []

  headers.forEach((h, i) => {
    if (idxId < 0 && matches(h, HEADERS_ID)) { idxId = i; tipoId = 'response_id' }
  })
  if (idxId < 0) {
    headers.forEach((h, i) => {
      if (idxId < 0 && matches(h, HEADERS_TIMESTAMP)) { idxId = i; tipoId = 'timestamp' }
    })
  }
  headers.forEach((h, i) => {
    if (i === idxId) return
    const num = numeroPergunta(h)
    if (num !== null && num >= 1 && num <= 60) {
      perguntas.push({ numero: num, idx: i, header: h })
      return
    }
    if (idxNome < 0 && matches(h, HEADERS_NOME)) { idxNome = i; return }
    if (idxFuncao < 0 && matches(h, HEADERS_FUNCAO)) { idxFuncao = i; return }
  })

  const total = perguntas.length
  if (idxId < 0) erros.push('IDENTIFICADOR_ORIGEM_AUSENTE')
  if (total !== 35) erros.push(total < 35 ? 'PERGUNTAS_INSUFICIENTES' : 'PERGUNTAS_EXCEDENTES')

  // Duplicidade de números de perguntas
  const nums = new Set<number>()
  for (const p of perguntas) {
    if (nums.has(p.numero)) { erros.push('PERGUNTA_DUPLICADA'); break }
    nums.add(p.numero)
  }

  let layout: LayoutDetectado = 'nao_identificado'
  if (erros.length === 0) {
    if (idxNome >= 0 && idxFuncao >= 0) layout = 'id_nome_funcao_respostas'
    else if (idxNome >= 0) layout = 'id_nome_respostas'
    else if (idxNome < 0 && idxFuncao < 0) layout = 'id_respostas'
    else erros.push('LAYOUT_AMBIGUO')
  }

  const confianca = layout === 'nao_identificado' ? 0 : Math.min(1, 0.6 + 0.4 * (total / 35))
  return {
    layout,
    coluna_identificador: idxId >= 0 ? headers[idxId] : null,
    tipo_identificador: tipoId,
    idx_identificador: idxId,
    coluna_nome: idxNome >= 0 ? headers[idxNome] : null,
    idx_nome: idxNome,
    coluna_funcao: idxFuncao >= 0 ? headers[idxFuncao] : null,
    idx_funcao: idxFuncao,
    colunas_perguntas: perguntas.sort((a, b) => a.numero - b.numero),
    total_perguntas_detectadas: total,
    confianca,
    avisos, erros,
  }
}

// ---------- Mascaramento de nome (apenas para prévia) ----------
export function mascararNome(nome: string | null | undefined): string {
  if (!nome) return ''
  return String(nome).trim().split(/\s+/).map(p =>
    p.length <= 1 ? p : p[0] + '*'.repeat(Math.max(1, p.length - 1)),
  ).join(' ')
}

// ---------- Detecção de delimitador (para CSV) ----------
export function detectarDelimitador(text: string): ',' | ';' | '\t' {
  const linha = text.split(/\r?\n/).find(l => l.trim().length > 0) || ''
  const v = (linha.match(/,/g) || []).length
  const p = (linha.match(/;/g) || []).length
  const t = (linha.match(/\t/g) || []).length
  if (t > v && t > p) return '\t'
  if (p > v) return ';'
  return ','
}

// ---------- CSV parser (RFC 4180 simplificado, aceita ; ou ,) ----------
export function parseCsv(text: string, delimitador?: string): string[][] {
  // Detecta separador na 1ª linha não vazia se não fornecido
  const sep = delimitador ?? detectarDelimitador(text)

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
