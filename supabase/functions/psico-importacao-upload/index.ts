// Fase 9 — Modo Bruto: recebe o arquivo (CSV/XLSX), calcula hash, sobe para o
// bucket privado psico-importacoes, registra a importação e devolve os
// cabeçalhos detectados para o passo de mapeamento.
// Nenhum dado pessoal é persistido nesta etapa — o arquivo bruto vive apenas
// no bucket privado até o commit ou cancelamento.
import {
  authAdminOrTecnico, corsHeaders, json, parseCsv, parseXlsx, sha256Hex, svcClient,
} from '../_shared/psico-importacao.ts'

const MAX_BYTES = 25 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const auth = await authAdminOrTecnico(req)
  if (!auth) return json(401, { error: 'unauthorized' })

  let form: FormData
  try { form = await req.formData() }
  catch { return json(400, { error: 'form_invalido' }) }

  const arquivo = form.get('arquivo')
  const clienteId = String(form.get('cliente_id') || '')
  const tipo = String(form.get('tipo') || 'bruta_respondentes')
  const questionarioVersaoId = String(form.get('questionario_versao_id') || '')
  const metodologiaVersaoId = String(form.get('metodologia_versao_id') || '')
  const idempotencyKey = String(form.get('idempotency_key') || crypto.randomUUID())

  if (!(arquivo instanceof File)) return json(400, { error: 'arquivo_ausente' })
  if (!clienteId || !questionarioVersaoId || !metodologiaVersaoId) {
    return json(400, { error: 'parametros_obrigatorios' })
  }
  if (tipo !== 'bruta_respondentes' && tipo !== 'agregada_perguntas') {
    return json(400, { error: 'tipo_invalido' })
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  if (bytes.length === 0) return json(400, { error: 'arquivo_vazio' })
  if (bytes.length > MAX_BYTES) return json(413, { error: 'arquivo_muito_grande' })

  const nome = arquivo.name || 'arquivo'
  const ext = nome.toLowerCase().split('.').pop() || ''
  let formato: 'csv' | 'xlsx'
  if (ext === 'csv' || (arquivo.type || '').includes('csv')) formato = 'csv'
  else if (ext === 'xlsx' || ext === 'xls' || (arquivo.type || '').includes('sheet')) formato = 'xlsx'
  else return json(400, { error: 'formato_nao_suportado' })

  const hash = await sha256Hex(bytes)
  const svc = svcClient()

  const storagePath = `${clienteId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${formato}`
  const up = await svc.storage.from('psico-importacoes').upload(storagePath, bytes, {
    contentType: formato === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: false,
  })
  if (up.error) {
    console.error('storage_upload_fail', up.error.message)
    return json(500, { error: 'storage_falhou' })
  }

  // Chama RPC iniciar com JWT do usuário → registra iniciado_por corretamente
  const { data: importacaoId, error: rpcErr } = await svc.rpc('psico_importacao_iniciar', {
    p_cliente_id: clienteId,
    p_tipo: tipo,
    p_formato: formato,
    p_nome_arquivo: nome.slice(0, 200),
    p_hash_sha256: hash,
    p_tamanho_bytes: bytes.length,
    p_questionario_versao_id: questionarioVersaoId,
    p_metodologia_versao_id: metodologiaVersaoId,
    p_arquivo_path: storagePath,
    p_idempotency_key: idempotencyKey,
  })
  if (rpcErr) {
    // remove arquivo se falhou o registro
    await svc.storage.from('psico-importacoes').remove([storagePath])
    return json(400, { error: 'iniciar_falhou', detalhe: rpcErr.message })
  }

  // Ajusta iniciado_por para o usuário real (auth.uid não existe com service role)
  await svc.from('psico_importacoes_avaliacoes').update({ iniciado_por: auth.userId }).eq('id', importacaoId)

  // Extrai apenas cabeçalhos + amostra (10 primeiras linhas) — sem persistir dados
  let cabecalhos: string[] = []
  let amostra: string[][] = []
  try {
    if (formato === 'csv') {
      const text = new TextDecoder('utf-8').decode(bytes)
      const rows = parseCsv(text)
      cabecalhos = (rows[0] || []).map(h => h.trim())
      amostra = rows.slice(1, 11)
    } else {
      const rows = await parseXlsx(bytes)
      cabecalhos = (rows[0] || []).map(h => String(h).trim())
      amostra = rows.slice(1, 11)
    }
  } catch (e) {
    console.error('parse_headers_fail', (e as Error).message)
  }

  return json(200, {
    importacao_id: importacaoId,
    formato,
    hash_sha256: hash,
    tamanho_bytes: bytes.length,
    cabecalhos,
    amostra,
  })
})