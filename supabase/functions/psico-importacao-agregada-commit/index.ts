// Fase 9 — Modo Agregado: baixa o arquivo (CSV/XLSX) do bucket privado,
// interpreta contagens por pergunta (quantidade_nunca..quantidade_sempre),
// cria/atualiza a avaliação histórica e grava psico_dados_agregados_perguntas
// via RPC transacional. Nenhuma resposta artificial é criada.
import {
  authAdminOrTecnico, corsHeaders, json, parseCsv, parseXlsx, svcClient, userClient,
} from '../_shared/psico-importacao.ts'

const CANON: Record<string, string> = {
  numero: 'numero', 'nº': 'numero', 'n': 'numero', 'pergunta': 'numero', 'num': 'numero',
  'nunca': 'quantidade_nunca', 'qtd_nunca': 'quantidade_nunca', 'quantidade_nunca': 'quantidade_nunca',
  'raramente': 'quantidade_raramente', 'qtd_raramente': 'quantidade_raramente', 'quantidade_raramente': 'quantidade_raramente',
  'as vezes': 'quantidade_as_vezes', 'as_vezes': 'quantidade_as_vezes', 'às vezes': 'quantidade_as_vezes',
  'quantidade_as_vezes': 'quantidade_as_vezes', 'qtd_as_vezes': 'quantidade_as_vezes',
  'frequentemente': 'quantidade_frequentemente', 'quantidade_frequentemente': 'quantidade_frequentemente', 'qtd_frequentemente': 'quantidade_frequentemente',
  'sempre': 'quantidade_sempre', 'quantidade_sempre': 'quantidade_sempre', 'qtd_sempre': 'quantidade_sempre',
}

function normHead(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const auth = await authAdminOrTecnico(req)
  if (!auth) return json(401, { error: 'unauthorized' })

  let body: {
    importacao_id?: string
    avaliacao_id?: string
    titulo?: string
    unidade?: string
    data_inicio?: string
    data_fim?: string
    observacao_origem?: string
    purgar_arquivo?: boolean
  }
  try { body = await req.json() } catch { return json(400, { error: 'json_invalido' }) }
  const importacaoId = String(body.importacao_id || '')
  if (!importacaoId) return json(400, { error: 'importacao_obrigatoria' })

  const svc = svcClient()
  const userSvc = userClient(auth.jwt)

  const { data: imp, error: impErr } = await svc
    .from('psico_importacoes_avaliacoes')
    .select('id, formato, tipo, questionario_versao_id, arquivo_temporario_path')
    .eq('id', importacaoId).single()
  if (impErr || !imp) return json(404, { error: 'importacao_nao_encontrada' })
  if (imp.tipo !== 'agregada_perguntas') return json(400, { error: 'tipo_invalido' })
  if (!imp.arquivo_temporario_path) return json(400, { error: 'arquivo_indisponivel' })

  const dl = await svc.storage.from('psico-importacoes').download(imp.arquivo_temporario_path)
  if (dl.error || !dl.data) return json(500, { error: 'download_falhou' })
  const bytes = new Uint8Array(await dl.data.arrayBuffer())

  let rows: string[][]
  try {
    rows = imp.formato === 'csv'
      ? parseCsv(new TextDecoder('utf-8').decode(bytes))
      : await parseXlsx(bytes)
  } catch (e) { return json(400, { error: 'parse_falhou', detalhe: (e as Error).message }) }
  if (rows.length < 2) return json(400, { error: 'arquivo_sem_dados' })

  const headers = rows[0].map(h => normHead(h))
  const idx: Record<string, number> = {}
  headers.forEach((h, i) => {
    const c = CANON[h]
    if (c && !(c in idx)) idx[c] = i
  })
  const requiredCols = ['numero', 'quantidade_nunca', 'quantidade_raramente', 'quantidade_as_vezes', 'quantidade_frequentemente', 'quantidade_sempre']
  const faltando = requiredCols.filter(c => !(c in idx))
  if (faltando.length > 0) return json(400, { error: 'colunas_faltando', faltando, headers_recebidos: rows[0] })

  const linhas: any[] = []
  const erros: any[] = []
  for (let r = 1; r < rows.length; r++) {
    const linha = rows[r]
    if (!linha || linha.every(c => (c ?? '').toString().trim() === '')) continue
    const numero = parseInt(String(linha[idx.numero] || '').trim(), 10)
    if (!Number.isFinite(numero)) {
      erros.push({ numero_linha: r + 1, codigo: 'numero_invalido', severidade: 'erro' })
      continue
    }
    const parseInt0 = (v: unknown) => {
      const n = parseInt(String(v ?? '').trim(), 10)
      return Number.isFinite(n) && n >= 0 ? n : 0
    }
    linhas.push({
      numero,
      quantidade_nunca: parseInt0(linha[idx.quantidade_nunca]),
      quantidade_raramente: parseInt0(linha[idx.quantidade_raramente]),
      quantidade_as_vezes: parseInt0(linha[idx.quantidade_as_vezes]),
      quantidade_frequentemente: parseInt0(linha[idx.quantidade_frequentemente]),
      quantidade_sempre: parseInt0(linha[idx.quantidade_sempre]),
    })
  }
  if (linhas.length === 0) return json(400, { error: 'sem_linhas_validas' })

  if (erros.length > 0) {
    await svc.rpc('psico_importacao_registrar_erros', { p_importacao_id: importacaoId, p_erros: erros })
  }

  const payload = {
    avaliacao_id: body.avaliacao_id || null,
    titulo: body.titulo || null,
    unidade: body.unidade || null,
    data_inicio: body.data_inicio || null,
    data_fim: body.data_fim || null,
    observacao_origem: body.observacao_origem || null,
  }

  const { data: commitData, error: commitErr } = await userSvc.rpc('psico_importacao_commit_agregada', {
    p_importacao_id: importacaoId,
    p_avaliacao: payload,
    p_linhas: linhas,
  })
  if (commitErr) return json(400, { error: 'commit_falhou', detalhe: commitErr.message })

  const purgar = body.purgar_arquivo !== false
  if (purgar && imp.arquivo_temporario_path) {
    await svc.storage.from('psico-importacoes').remove([imp.arquivo_temporario_path])
    await userSvc.rpc('psico_importacao_purgar_arquivo', { p_importacao_id: importacaoId })
  }

  return json(200, { ok: true, ...(commitData as Record<string, unknown>) })
})