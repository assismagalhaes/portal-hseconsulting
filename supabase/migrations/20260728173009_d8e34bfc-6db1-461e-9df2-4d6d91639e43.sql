-- Corrige a chamada legada de is_admin com parâmetro. A função de autorização
-- disponível no projeto avalia o usuário autenticado e não recebe argumentos.
CREATE OR REPLACE FUNCTION public.psico_reabrir_revisao_tecnica(
  p_revisao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revisao record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF length(coalesce(p_motivo, '')) < 20 THEN
    RAISE EXCEPTION 'MOTIVO_INSUFICIENTE_MIN_20';
  END IF;

  SELECT *
    INTO v_revisao
    FROM public.psico_revisoes_tecnicas
   WHERE id = p_revisao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA';
  END IF;

  IF v_revisao.status <> 'aprovada' THEN
    RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', v_revisao.status;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.psico_avaliacoes
     WHERE id = v_revisao.avaliacao_id
       AND status = 'relatorio_emitido'
  ) THEN
    RAISE EXCEPTION 'RELATORIO_JA_EMITIDO_CRIE_NOVA_VERSAO';
  END IF;

  UPDATE public.psico_revisoes_tecnicas
     SET status = 'reaberta',
         reaberta_por = auth.uid(),
         reaberta_em = now(),
         motivo_reabertura = p_motivo
   WHERE id = p_revisao_id;

  UPDATE public.psico_planos_acao
     SET status = 'rascunho'
   WHERE revisao_id = p_revisao_id;

  INSERT INTO public.psico_auditoria (
    entidade,
    entidade_id,
    acao,
    metadados,
    usuario_id,
    created_at
  )
  VALUES (
    'revisao_tecnica',
    p_revisao_id,
    'revisao_reaberta',
    jsonb_build_object('motivo_hash', md5(p_motivo)),
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_reabrir_revisao_tecnica(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_reabrir_revisao_tecnica(uuid, text)
  TO authenticated;