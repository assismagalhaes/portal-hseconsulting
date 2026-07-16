// Fase 9: cancela uma importação em andamento, limpa staging e remove o
// arquivo temporário do bucket privado.
import { authAdminOrTecnico, corsHeaders, json, svcClient, userClient } from '../_shared/psico-importacao.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const auth = await authAdminOrTecnico(req)
  if (!auth) return json(401, { error: 'unauthorized' })

  let body: { importacao_id?: string; motivo?: string }
  try { body = await req.json() } catch { return json(400, { error: 'json_invalido' }) }
  const importacaoId = String(body.importacao_id || '')
  if (!importacaoId) return json(400, { error: 'importacao_obrigatoria' })

  const svc = svcClient()
  const userSvc = userClient(auth.jwt)

  const { data: imp } = await svc
    .from('psico_importacoes_avaliacoes')
    .select('arquivo_temporario_path, status').eq('id', importacaoId).single()

  const { error: cancelErr } = await userSvc.rpc('psico_importacao_cancelar', {
    p_importacao_id: importacaoId,
    p_motivo: (body.motivo || '').slice(0, 200),
  })
  if (cancelErr) return json(400, { error: 'cancelar_falhou', detalhe: cancelErr.message })

  if (imp?.arquivo_temporario_path) {
    await svc.storage.from('psico-importacoes').remove([imp.arquivo_temporario_path])
    await userSvc.rpc('psico_importacao_purgar_arquivo', { p_importacao_id: importacaoId })
  }

  return json(200, { ok: true })
})