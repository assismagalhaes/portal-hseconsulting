-- Permite concluir o plano coletivo sem itens quando nenhum fator recebeu
-- tratamento técnico "acao_recomendada". Os demais gates da revisão técnica
-- continuam obrigatórios para a aprovação final e emissão do relatório.
CREATE OR REPLACE FUNCTION public.psico_validar_revisao_tecnica(p_revisao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base jsonb;
  v_parecer jsonb;
  v_erros jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  v_base := public.psico_validar_revisao_tecnica_sem_parecer_v1_4(p_revisao_id);

  -- Recalcula os gates do plano. A implementação anterior exigia ao menos
  -- um item de forma incondicional e tratava monitoramento como ação.
  SELECT COALESCE(jsonb_agg(codigo), '[]'::jsonb)
    INTO v_erros
    FROM jsonb_array_elements_text(COALESCE(v_base->'erros', '[]'::jsonb)) AS e(codigo)
   WHERE codigo NOT IN ('PLANO_SEM_ACOES', 'FATOR_SIGNIFICATIVO_SEM_ACAO');

  IF EXISTS (
    SELECT 1
     FROM public.psico_revisoes_fatores rf
     WHERE rf.revisao_id = p_revisao_id
       AND rf.tratamento_tecnico = 'acao_recomendada'
       AND NOT EXISTS (
         SELECT 1
           FROM public.psico_plano_item_fatores pif
           JOIN public.psico_plano_acao_itens i ON i.id = pif.plano_item_id
           JOIN public.psico_planos_acao p ON p.id = i.plano_id
          WHERE p.revisao_id = p_revisao_id
            AND i.selecionado = true
            AND pif.fator_codigo = rf.fator_codigo
       )
  ) THEN
    v_erros := v_erros || jsonb_build_array('FATOR_SIGNIFICATIVO_SEM_ACAO');
  END IF;

  SELECT parecer_conclusivo
    INTO v_parecer
    FROM public.psico_revisoes_tecnicas
   WHERE id = p_revisao_id;

  IF NOT public.psico_parecer_valido(v_parecer) THEN
    v_erros := v_erros || jsonb_build_array('PARECER_CONCLUSIVO_INCOMPLETO');
  END IF;

  v_base := jsonb_set(v_base, '{erros}', v_erros, true);
  v_base := jsonb_set(v_base, '{valido}', to_jsonb(jsonb_array_length(v_erros) = 0), true);
  RETURN v_base;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(uuid) TO authenticated;

COMMENT ON FUNCTION public.psico_validar_revisao_tecnica(uuid) IS
  'Valida revisão e plano; zero ações é válido quando nenhum fator possui tratamento acao_recomendada.';
