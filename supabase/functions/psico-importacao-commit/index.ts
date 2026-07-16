// Fase 9 — Modo Bruto: commit da importação. Cria (ou reutiliza) a avaliação
// histórica, transfere o staging para respostas anônimas + itens, e purga o
// arquivo temporário do bucket privado.
import { authAdminOrTecnico, corsHeaders, json, svcClient } from '../_shared/psico-importacao.ts'

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

  // Commit precisa de auth.uid — chama via client autenticado do usuário
  const { userClient } = await import('../_shared/psico-importacao.ts')
  const userSvc = userClient(auth.jwt)

  const payload = {
    avaliacao_id: body.avaliacao_id || null,
    titulo: body.titulo || null,
    unidade: body.unidade || null,
    data_inicio: body.data_inicio || null,
    data_fim: body.data_fim || null,
    observacao_origem: body.observacao_origem || null,
  }

  const { data: commitData, error: commitErr } = await userSvc.rpc('psico_importacao_commit_bruta', {
    p_importacao_id: importacaoId,
    p_avaliacao: payload,
  })
  if (commitErr) {
    return json(400, { error: 'commit_falhou', detalhe: commitErr.message })
  }

  // Purga arquivo do bucket (padrão: true)
  const purgar = body.purgar_arquivo !== false
  if (purgar) {
    const { data: imp } = await svc
      .from('psico_importacoes_avaliacoes')
      .select('arquivo_temporario_path').eq('id', importacaoId).single()
    if (imp?.arquivo_temporario_path) {
      await svc.storage.from('psico-importacoes').remove([imp.arquivo_temporario_path])
    }
    await userSvc.rpc('psico_importacao_purgar_arquivo', { p_importacao_id: importacaoId })
  }

  return json(200, { ok: true, ...(commitData as Record<string, unknown>) })
})