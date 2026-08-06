-- Corrige a cadeia transitive de wrappers SECURITY DEFINER do relatorio.
-- A fachada publica ja usava can_see_psico(), mas os wrappers historicos
-- ainda bloqueavam o profissional tecnico antes da criacao da versao R00.
DO $migration$
DECLARE
  v_signature text;
  v_definition text;
  v_remaining integer;
  v_signatures constant text[] := ARRAY[
    'public.psico_preparar_emissao_relatorio(uuid,text,text)',
    'public.psico_obter_conteudo_aprovado_relatorio(uuid)',
    'public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(uuid)',
    'public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(uuid)',
    'public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(uuid)',
    'public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(uuid)',
    'public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid)'
  ];
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao de autorizacao public.can_see_psico(uuid) nao encontrada';
  END IF;

  FOREACH v_signature IN ARRAY v_signatures LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'Funcao obrigatoria da cadeia de emissao nao encontrada: %', v_signature;
    END IF;

    SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
    IF v_definition LIKE '%can_see_internal%' THEN
      v_definition := replace(v_definition, 'public.can_see_internal(', 'public.can_see_psico(');
      v_definition := replace(v_definition, 'can_see_internal(', 'public.can_see_psico(');
      EXECUTE v_definition;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_remaining
  FROM unnest(v_signatures) AS item(signature)
  WHERE pg_get_functiondef(to_regprocedure(item.signature)) LIKE '%can_see_internal%';

  IF v_remaining > 0 THEN
    RAISE EXCEPTION '% funcao(oes) da cadeia de emissao ainda usam can_see_internal', v_remaining;
  END IF;
END;
$migration$;

-- Apenas as fachadas continuam expostas ao cliente autenticado. Os wrappers
-- historicos permanecem privados e sao chamados internamente.
REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_preparar_emissao_relatorio(uuid,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;
