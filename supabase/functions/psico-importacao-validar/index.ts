// Fase 9 — Modo Bruto: aplica o mapeamento, baixa o arquivo do bucket,
// parseia, normaliza (removendo colunas de PII), grava staging técnico,
// registra erros/avisos e finaliza a validação.
import {
  authAdminOrTecnico, corsHeaders, json, normalizarChaveClassificacao,
  normalizarData, normalizarOpcao, normalizarTexto, parseCsv, parseXlsx, svcClient,
} from '../_shared/psico-importacao.ts'

type Mapeamento = {
  // nome da coluna no arquivo → tipo
  data_resposta?: string
  funcao?: string
  setor?: string
  unidade?: string
  // mapa numero_pergunta (1..N) → nome da coluna no arquivo
  perguntas: Record<string, string>
  // colunas explicitamente ignoradas (nome, email, telefone, timestamp completo etc.)
  ignoradas?: string[]
  // formato de datas esperado (opcional)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const auth = await authAdminOrTecnico(req)
  if (!auth) return json(401, { error: 'unauthorized' })

  let body: { importacao_id?: string; mapeamento?: Mapeamento }
  try { body = await req.json() } catch { return json(400, { error: 'json_invalido' }) }
  const importacaoId = String(body.importacao_id || '')
  const mapeamento = body.mapeamento
  if (!importacaoId || !mapeamento || !mapeamento.perguntas) {
    return json(400, { error: 'parametros_obrigatorios' })
  }

  const svc = svcClient()

  // Salva mapeamento
  const salvar = await svc.rpc('psico_importacao_salvar_mapeamento', {
    p_importacao_id: importacaoId,
    p_mapeamento: mapeamento,
  })
  if (salvar.error) return json(400, { error: 'mapeamento_falhou', detalhe: salvar.error.message })

  // Busca info da importação (path + questionário)
  const { data: imp, error: impErr } = await svc
    .from('psico_importacoes_avaliacoes')
    .select('id, formato, questionario_versao_id, metodologia_versao_id, arquivo_temporario_path, status, tipo')
    .eq('id', importacaoId).single()
  if (impErr || !imp) return json(404, { error: 'importacao_nao_encontrada' })
  if (imp.tipo !== 'bruta_respondentes') return json(400, { error: 'tipo_invalido' })
  if (!imp.arquivo_temporario_path) return json(400, { error: 'arquivo_indisponivel' })

  // Perguntas válidas do questionário
  const { data: perguntas } = await svc
    .from('psico_perguntas').select('numero')
    .eq('questionario_versao_id', imp.questionario_versao_id)
  const numerosValidos = new Set((perguntas || []).map((p: { numero: number }) => p.numero))

  // Baixa arquivo
  const dl = await svc.storage.from('psico-importacoes').download(imp.arquivo_temporario_path)
  if (dl.error || !dl.data) return json(500, { error: 'download_falhou' })
  const bytes = new Uint8Array(await dl.data.arrayBuffer())

  let rows: string[][]
  try {
    rows = imp.formato === 'csv'
      ? parseCsv(new TextDecoder('utf-8').decode(bytes))
      : await parseXlsx(bytes)
  } catch (e) {
    return json(400, { error: 'parse_falhou', detalhe: (e as Error).message })
  }
  if (rows.length < 2) return json(400, { error: 'arquivo_sem_dados' })

  const headers = rows[0].map(h => (h || '').trim())
  const idxOf = (col?: string) => (col ? headers.indexOf(col) : -1)
  const idxData = idxOf(mapeamento.data_resposta)
  const idxFuncao = idxOf(mapeamento.funcao)
  const idxSetor = idxOf(mapeamento.setor)
  const idxUnidade = idxOf(mapeamento.unidade)

  const idxPerguntas: Array<{ numero: number; idx: number }> = []
  for (const [numStr, col] of Object.entries(mapeamento.perguntas)) {
    const numero = parseInt(numStr, 10)
    const idx = idxOf(col)
    if (!Number.isFinite(numero) || !numerosValidos.has(numero) || idx < 0) continue
    idxPerguntas.push({ numero, idx })
  }
  if (idxPerguntas.length === 0) return json(400, { error: 'mapeamento_perguntas_vazio' })

  // Processa linhas — nunca extrai/loga colunas ignoradas (PII)
  const staging: unknown[] = []
  const erros: unknown[] = []
  let linhasValidas = 0
  let linhasInvalidas = 0
  let linhasIgnoradas = 0
  let dataMin: string | null = null
  let dataMax: string | null = null

  for (let r = 1; r < rows.length; r++) {
    const linha = rows[r]
    if (!linha || linha.every(c => (c ?? '').toString().trim() === '')) {
      linhasIgnoradas++
      continue
    }
    const respostas: Record<string, string> = {}
    let opcoesInvalidas = 0
    let opcoesValidas = 0
    for (const { numero, idx } of idxPerguntas) {
      const bruto = linha[idx]
      const norm = normalizarOpcao(bruto)
      if (!norm) {
        if ((bruto ?? '').toString().trim() !== '') opcoesInvalidas++
        continue
      }
      respostas[String(numero)] = norm
      opcoesValidas++
    }
    if (opcoesValidas === 0) {
      linhasInvalidas++
      erros.push({ numero_linha: r + 1, codigo: 'linha_sem_respostas_validas', severidade: 'erro',
        mensagem: 'Nenhuma opção de resposta reconhecida.' })
      continue
    }
    if (opcoesInvalidas > 0) {
      erros.push({ numero_linha: r + 1, codigo: 'opcao_desconhecida', severidade: 'aviso',
        mensagem: `${opcoesInvalidas} coluna(s) com valor não reconhecido foram ignoradas.` })
    }
    const dataResp = idxData >= 0 ? normalizarData(linha[idxData]) : null
    if (dataResp) {
      if (!dataMin || dataResp < dataMin) dataMin = dataResp
      if (!dataMax || dataResp > dataMax) dataMax = dataResp
    }
    const funcao = idxFuncao >= 0 ? normalizarTexto(linha[idxFuncao]) : null
    const setor = idxSetor >= 0 ? normalizarTexto(linha[idxSetor]) : null
    const unidade = idxUnidade >= 0 ? normalizarTexto(linha[idxUnidade]) : null

    staging.push({
      data_resposta: dataResp,
      funcao, setor, unidade,
      funcao_normalizada: normalizarChaveClassificacao(funcao),
      setor_normalizado: normalizarChaveClassificacao(setor),
      unidade_normalizada: normalizarChaveClassificacao(unidade),
      respostas,
    })
    linhasValidas++
  }

  // Limpa staging anterior desta importação antes de reingerir
  await svc.from('psico_importacao_staging_respostas').delete().eq('importacao_id', importacaoId)

  // Ingere em lotes de 500
  for (let i = 0; i < staging.length; i += 500) {
    const lote = staging.slice(i, i + 500)
    const ing = await svc.rpc('psico_importacao_ingerir_staging_bruta', {
      p_importacao_id: importacaoId,
      p_linhas: lote,
    })
    if (ing.error) return json(500, { error: 'ingestao_falhou', detalhe: ing.error.message })
  }

  // Registra erros em lotes
  if (erros.length > 0) {
    for (let i = 0; i < erros.length; i += 500) {
      const lote = erros.slice(i, i + 500)
      await svc.rpc('psico_importacao_registrar_erros', {
        p_importacao_id: importacaoId,
        p_erros: lote,
      })
    }
  }

  const totalLinhas = rows.length - 1
  const resumo = {
    total_linhas: totalLinhas,
    linhas_validas: linhasValidas,
    linhas_invalidas: linhasInvalidas,
    linhas_ignoradas: linhasIgnoradas,
    perguntas_mapeadas: idxPerguntas.length,
    perguntas_esperadas: numerosValidos.size,
    avisos: erros.filter((e: unknown) => (e as { severidade?: string }).severidade === 'aviso').length,
  }

  const fin = await svc.rpc('psico_importacao_finalizar_validacao', {
    p_importacao_id: importacaoId,
    p_total_linhas: totalLinhas,
    p_linhas_validas: linhasValidas,
    p_linhas_invalidas: linhasInvalidas,
    p_linhas_ignoradas: linhasIgnoradas,
    p_data_min: dataMin,
    p_data_max: dataMax,
    p_resumo: resumo,
  })
  if (fin.error) return json(500, { error: 'finalizar_falhou', detalhe: fin.error.message })

  return json(200, { ok: true, resumo, erros_registrados: erros.length })
})