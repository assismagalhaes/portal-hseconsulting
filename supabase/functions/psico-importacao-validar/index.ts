// Fase 9A — Importação bruta com detecção automática de 3 layouts.
// - Detecta layout id_respostas / id_nome_funcao_respostas / id_nome_respostas.
// - Lê bytes do arquivo, detecta codificação (UTF-8, UTF-8 BOM, Windows-1252),
//   corrige mojibake, detecta delimitador do CSV.
// - Calcula HMAC-SHA256(PSICO_IMPORT_ROW_SECRET, hash_arquivo + identificador_origem).
// - Descarta nomes ANTES de gravar staging. Persiste função apenas no Layout 2.
import {
  authAdminOrTecnico, corsHeaders, detectarLayoutImportacaoPsico, decodificarBytes,
  detectarDelimitador, hmacSha256Hex, json, normalizarChaveClassificacao,
  normalizarData, normalizarOpcao, normalizarTexto, parseCsv, parseXlsx, svcClient,
} from '../_shared/psico-importacao.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const auth = await authAdminOrTecnico(req)
  if (!auth) return json(401, { error: 'unauthorized' })

  let body: { importacao_id?: string }
  try { body = await req.json() } catch { return json(400, { error: 'json_invalido' }) }
  const importacaoId = String(body.importacao_id || '')
  if (!importacaoId) return json(400, { error: 'parametros_obrigatorios' })

  const rowSecret = Deno.env.get('PSICO_IMPORT_ROW_SECRET')
  if (!rowSecret) return json(500, { error: 'row_secret_ausente' })

  const svc = svcClient()

  // Busca info da importação (path + questionário)
  const { data: imp, error: impErr } = await svc
    .from('psico_importacoes_avaliacoes')
    .select('id, formato, questionario_versao_id, metodologia_versao_id, arquivo_temporario_path, status, tipo, hash_arquivo_sha256')
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
  let codificacao = 'utf-8'
  let codCorrigida = false
  let delimitador: string | null = null
  try {
    if (imp.formato === 'csv') {
      const dec = decodificarBytes(bytes)
      codificacao = dec.codificacao
      codCorrigida = dec.corrigida
      delimitador = detectarDelimitador(dec.texto)
      rows = parseCsv(dec.texto, delimitador)
    } else {
      rows = await parseXlsx(bytes)
    }
  } catch (e) {
    return json(400, { error: 'parse_falhou', detalhe: (e as Error).message })
  }
  if (rows.length < 2) return json(400, { error: 'arquivo_sem_dados' })

  const headers = rows[0].map(h => (h || '').trim())
  const deteccao = detectarLayoutImportacaoPsico(headers)
  if (deteccao.erros.length > 0 || deteccao.layout === 'nao_identificado') {
    return json(400, {
      error: 'layout_nao_identificado',
      deteccao: { ...deteccao, colunas_perguntas: undefined },
    })
  }
  const idxPerguntas = deteccao.colunas_perguntas
    .filter(p => numerosValidos.has(p.numero))
    .map(p => ({ numero: p.numero, idx: p.idx }))
  if (idxPerguntas.length !== 35) {
    return json(400, { error: 'perguntas_incompativeis_versao', detalhe: `${idxPerguntas.length}/35` })
  }

  const layout = deteccao.layout
  const idxId = deteccao.idx_identificador
  const idxNome = deteccao.idx_nome
  const idxFuncao = layout === 'id_nome_funcao_respostas' ? deteccao.idx_funcao : -1

  // Registra layout detectado antes de qualquer ingestão
  const regLayout = await svc.rpc('psico_importacao_registrar_layout', {
    p_importacao_id: importacaoId,
    p_layout: {
      layout,
      coluna_identificador: deteccao.coluna_identificador,
      tipo_identificador: deteccao.tipo_identificador,
      coluna_nome: deteccao.coluna_nome,
      coluna_funcao: deteccao.coluna_funcao,
      nome_presente: idxNome >= 0,
      funcao_presente: idxFuncao >= 0,
      segmentacao_funcao_disponivel: layout === 'id_nome_funcao_respostas',
      delimitador: delimitador ?? null,
      codificacao,
      codificacao_corrigida: codCorrigida,
    },
  })
  if (regLayout.error) return json(500, { error: 'registrar_layout_falhou', detalhe: regLayout.error.message })

  // Processa linhas — nunca extrai/loga colunas ignoradas (PII)
  const staging: unknown[] = []
  const erros: unknown[] = []
  const previa: Array<{ linha: number; identificador_mascarado: string; nome_mascarado?: string; funcao?: string | null; status: string }> = []
  let linhasValidas = 0
  let linhasInvalidas = 0
  let linhasIgnoradas = 0
  let dataMin: string | null = null
  let dataMax: string | null = null
  const hashesVistos = new Map<string, number>()

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
    // Identificador de origem: timestamp fornece também data_resposta
    const identificadorBruto = idxId >= 0 ? String(linha[idxId] ?? '').trim() : ''
    const dataResp = deteccao.tipo_identificador === 'timestamp'
      ? normalizarData(identificadorBruto) : null
    if (dataResp) {
      if (!dataMin || dataResp < dataMin) dataMin = dataResp
      if (!dataMax || dataResp > dataMax) dataMax = dataResp
    }
    // Função persistida SOMENTE no Layout 2
    const funcao = idxFuncao >= 0 ? normalizarTexto(linha[idxFuncao]) : null
    if (layout === 'id_nome_funcao_respostas' && !funcao) {
      erros.push({ numero_linha: r + 1, codigo: 'FUNCAO_NAO_INFORMADA', severidade: 'aviso',
        mensagem: 'Função vazia — resposta manterá escopo global apenas.' })
    }

    // HMAC do identificador de origem (nunca guarda o valor bruto)
    const idHash = identificadorBruto
      ? await hmacSha256Hex(rowSecret, `${imp.hash_arquivo_sha256 || ''}::${identificadorBruto}`)
      : null
    if (idHash && deteccao.tipo_identificador === 'response_id') {
      const anterior = hashesVistos.get(idHash)
      if (anterior) {
        erros.push({ numero_linha: r + 1, codigo: 'IDENTIFICADOR_DUPLICADO',
          severidade: 'aviso',
          mensagem: `Identificador duplicado da linha ${anterior} — revise antes do commit.` })
      } else {
        hashesVistos.set(idHash, r + 1)
      }
    }

    // Nome: lido apenas para prévia mascarada, NUNCA vai para staging
    const nomeBruto = idxNome >= 0 ? normalizarTexto(linha[idxNome]) : null
    if (previa.length < 20) {
      const idMask = idHash ? `${idHash.slice(0, 6)}…${idHash.slice(-4)}` : ''
      previa.push({
        linha: r + 1,
        identificador_mascarado: idMask,
        nome_mascarado: nomeBruto ? mascararNomeLocal(nomeBruto) : undefined,
        funcao: layout === 'id_nome_funcao_respostas' ? funcao : undefined,
        status: 'valida',
      })
    }

    staging.push({
      data_resposta: dataResp,
      // Layouts 1 e 3: função permanece nula; setor/unidade sempre nulos (3 layouts do Google Forms)
      funcao: layout === 'id_nome_funcao_respostas' ? funcao : null,
      setor: null,
      unidade: null,
      funcao_normalizada: layout === 'id_nome_funcao_respostas' ? normalizarChaveClassificacao(funcao) : null,
      setor_normalizado: null,
      unidade_normalizada: null,
      respostas,
      layout_detectado: layout,
      identificador_origem_hash: idHash,
      tipo_identificador: deteccao.tipo_identificador,
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
    layout,
    tipo_identificador: deteccao.tipo_identificador,
    coluna_identificador: deteccao.coluna_identificador,
    nome_presente: idxNome >= 0,
    funcao_presente: idxFuncao >= 0,
    segmentacao_funcao_disponivel: layout === 'id_nome_funcao_respostas',
    delimitador,
    codificacao,
    codificacao_corrigida: codCorrigida,
    total_linhas: totalLinhas,
    linhas_validas: linhasValidas,
    linhas_invalidas: linhasInvalidas,
    linhas_ignoradas: linhasIgnoradas,
    perguntas_mapeadas: idxPerguntas.length,
    perguntas_esperadas: numerosValidos.size,
    avisos: erros.filter((e: unknown) => (e as { severidade?: string }).severidade === 'aviso').length,
    previa,
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

  return json(200, { ok: true, resumo, erros_registrados: erros.length, deteccao: {
    layout,
    coluna_identificador: deteccao.coluna_identificador,
    tipo_identificador: deteccao.tipo_identificador,
    coluna_nome: deteccao.coluna_nome,
    coluna_funcao: deteccao.coluna_funcao,
    total_perguntas_detectadas: deteccao.total_perguntas_detectadas,
    confianca: deteccao.confianca,
    avisos: deteccao.avisos,
  } })
})

// Mascara nome: "Maria da Silva" → "M**** d* S****"
function mascararNomeLocal(nome: string): string {
  return nome.trim().split(/\s+/).map(p =>
    p.length <= 1 ? p : p[0] + '*'.repeat(Math.max(1, p.length - 1)),
  ).join(' ')
}