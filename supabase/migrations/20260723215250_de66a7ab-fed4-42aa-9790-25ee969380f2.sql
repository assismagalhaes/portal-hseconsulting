-- Fix: contexto_para_ia referenciava colunas inexistentes em clients (atividade_principal/ramo_atividade)
CREATE OR REPLACE FUNCTION public.psico_ind_contexto_para_ia(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'avaliacao', jsonb_build_object(
      'id', av.id, 'codigo', av.codigo, 'titulo', av.titulo,
      'modalidade', av.modalidade, 'unidade', av.unidade
    ),
    'empresa', jsonb_build_object(
      'porte', c.porte,
      'cnae_principal', c.cnae_principal,
      'qtd_funcionarios', c.qtd_funcionarios
    ),
    'processamento', jsonb_build_object(
      'id', p.id, 'engine_versao', p.engine_versao,
      'regras_versao', p.versao_regra, 'imutavel', p.imutavel
    ),
    'achados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'fator_codigo', a.fator_codigo, 'perigo_codigo', a.perigo_codigo,
        'condicao_preliminar', a.condicao_preliminar, 'nivel_evidencia', a.nivel_evidencia,
        'estado_convergencia', a.estado_convergencia, 'estado_final', a.estado_final,
        'frequencia_exposicao', a.frequencia_exposicao, 'intensidade_exigencia', a.intensidade_exigencia,
        'controle_existente', a.controle_existente, 'eficacia_controle', a.eficacia_controle,
        'necessita_acao', a.necessita_acao,
        'fundamentacao_sanitizada', a.fundamentacao_sanitizada,
        'regra_codigo', a.regra_codigo
      ) ORDER BY a.fator_codigo)
      FROM public.psico_individual_achados a
      WHERE a.avaliacao_id = p_avaliacao AND a.processamento_id = p.id
    ), '[]'::jsonb),
    'catalogo', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'codigo', m.codigo, 'titulo', m.titulo,
        'fator_codigo', m.fator_codigo,
        'nivel_recomendacao', m.nivel_recomendacao,
        'o_que_significa', m.o_que_significa,
        'responsaveis_sugeridos', m.responsaveis_sugeridos,
        'evidencias_recomendadas', m.evidencias_recomendadas,
        'indicadores_sugeridos', m.indicadores_sugeridos,
        'prazo_sugerido_dias', m.prazo_sugerido_dias
      ) ORDER BY m.fator_codigo, m.ordem)
      FROM public.psico_medidas_modelos m
      WHERE m.ativo = true
        AND m.fator_codigo IN (
          SELECT DISTINCT a.fator_codigo FROM public.psico_individual_achados a
           WHERE a.avaliacao_id = p_avaliacao AND a.processamento_id = p.id
        )
    ), '[]'::jsonb)
  ) INTO v_out
  FROM public.psico_avaliacoes av
  JOIN public.clients c ON c.id = av.client_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.psico_individual_processamentos pp
     WHERE pp.avaliacao_id = av.id AND pp.imutavel = true
     ORDER BY pp.aprovado_em DESC NULLS LAST LIMIT 1
  ) p ON true
  WHERE av.id = p_avaliacao;

  IF v_out IS NULL THEN RAISE EXCEPTION 'avaliacao_nao_encontrada'; END IF;
  RETURN v_out;
END $$;