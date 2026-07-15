CREATE OR REPLACE FUNCTION public.psico_listar_escopos_resultado(p_avaliacao_id uuid)
 RETURNS TABLE(id uuid, tipo psico_resultado_escopo_tipo, chave_normalizada text, rotulo text, respondentes integer, minimo_aplicado integer, total_itens integer, indice_geral_descritivo numeric, classificacao_indice_geral psico_classificacao_risco, fatores_significativos integer, prioridade_maxima psico_prioridade_fator, amostra_reduzida boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_proc uuid;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT a.processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes a WHERE a.id = p_avaliacao_id;
  IF v_proc IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT e.id, e.tipo, e.chave_normalizada, e.rotulo, e.respondentes, e.minimo_aplicado,
           e.total_itens, e.indice_geral_descritivo, e.classificacao_indice_geral,
           e.fatores_significativos, e.prioridade_maxima, e.amostra_reduzida
      FROM public.psico_resultado_escopos e
     WHERE e.processamento_id = v_proc
     ORDER BY CASE e.tipo WHEN 'global' THEN 0 WHEN 'funcao' THEN 1 WHEN 'setor' THEN 2 ELSE 3 END,
              e.rotulo;
END;$function$;