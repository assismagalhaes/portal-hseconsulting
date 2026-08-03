-- Mantem a metodologia efetivamente vinculada a avaliacao dentro do snapshot
-- imutavel do relatorio. Em coletas normais, o campo agregado e nulo; portanto,
-- a biblioteca de medidas nao pode ser usada como fallback de metodologia.

ALTER FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  RENAME TO psico_obter_conteudo_aprovado_relatorio_sem_metodologia;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conteudo jsonb;
  v_metodologia jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(
    p_avaliacao_id
  );

  IF v_conteudo IS NULL OR coalesce(v_conteudo->>'ok', 'false') <> 'true' THEN
    RETURN v_conteudo;
  END IF;

  SELECT jsonb_build_object(
    'codigo', mv.codigo,
    'versao', mv.versao
  )
  INTO v_metodologia
  FROM public.psico_avaliacoes av
  JOIN public.psico_resultado_processamentos proc
    ON proc.id = av.processamento_resultado_ativo_id
  JOIN public.psico_metodologias_versoes mv
    ON mv.id = proc.metodologia_versao_id
  WHERE av.id = p_avaliacao_id;

  IF v_metodologia IS NULL THEN
    RAISE EXCEPTION 'METODOLOGIA_NAO_LOCALIZADA';
  END IF;

  RETURN jsonb_set(
    v_conteudo,
    '{avaliacao,metodologia}',
    v_metodologia,
    true
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  TO authenticated;