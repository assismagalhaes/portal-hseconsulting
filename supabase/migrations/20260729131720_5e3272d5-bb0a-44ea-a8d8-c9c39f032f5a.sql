-- A IA pode sugerir uma medida para um fator que a revisao tecnica marcou como
-- sem_acao_especifica. Esse vinculo e sabidamente inaplicavel e deve ser
-- descartado pela camada publica, sem abortar as demais sugestoes validas.
--
-- A implementacao strict_v1 permanece inalterada e continua falhando fechado
-- para chamadas internas/diretas, catalogo invalido, fator inexistente,
-- autorizacao e ausencia de cobertura de acoes obrigatorias.
CREATE OR REPLACE FUNCTION public.psico_aplicar_plano_ia(
  p_revisao_id uuid,
  p_selecoes jsonb,
  p_prompt_codigo text DEFAULT NULL::text,
  p_modelo_ia text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _biblioteca_versao_id uuid;
  _selecoes_sanitizadas jsonb := '[]'::jsonb;
  _sel jsonb;
  _fatores_sanitizados jsonb;
  _fator_codigo text;
  _tratamento text;
  _nivel_recomendacao text;
  _monitoramentos_usados text[] := '{}';
BEGIN
  IF NOT public.can_see_internal((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF jsonb_typeof(p_selecoes) <> 'array' THEN
    RETURN public.psico_aplicar_plano_ia_strict_v1(
      p_revisao_id,
      p_selecoes,
      p_prompt_codigo,
      p_modelo_ia
    );
  END IF;

  SELECT r.biblioteca_versao_id
    INTO _biblioteca_versao_id
    FROM public.psico_revisoes_tecnicas r
   WHERE r.id = p_revisao_id;

  FOR _sel IN SELECT value FROM jsonb_array_elements(p_selecoes)
  LOOP
    IF jsonb_typeof(_sel->'fatores_codes') <> 'array' THEN
      _selecoes_sanitizadas := _selecoes_sanitizadas || jsonb_build_array(_sel);
      CONTINUE;
    END IF;

    SELECT m.nivel_recomendacao::text
      INTO _nivel_recomendacao
      FROM public.psico_medidas_modelos m
     WHERE m.id = NULLIF(_sel->>'medida_modelo_id', '')::uuid
       AND m.biblioteca_versao_id = _biblioteca_versao_id
       AND m.ativo = true;

    IF NOT FOUND THEN
      _selecoes_sanitizadas := _selecoes_sanitizadas || jsonb_build_array(_sel);
      CONTINUE;
    END IF;

    _fatores_sanitizados := '[]'::jsonb;

    FOR _fator_codigo IN
      SELECT DISTINCT value
        FROM jsonb_array_elements_text(_sel->'fatores_codes')
    LOOP
      SELECT rf.tratamento_tecnico::text
        INTO _tratamento
        FROM public.psico_revisoes_fatores rf
       WHERE rf.revisao_id = p_revisao_id
         AND rf.fator_codigo = _fator_codigo
         AND rf.resultado_fator_id IS NOT NULL;

      IF NOT FOUND OR _tratamento NOT IN (
        'acao_recomendada',
        'monitoramento_preventivo',
        'sem_acao_especifica'
      ) THEN
        _fatores_sanitizados :=
          _fatores_sanitizados || jsonb_build_array(_fator_codigo);
        CONTINUE;
      END IF;

      IF _tratamento = 'sem_acao_especifica' THEN
        CONTINUE;
      END IF;

      IF _tratamento = 'acao_recomendada' THEN
        _fatores_sanitizados :=
          _fatores_sanitizados || jsonb_build_array(_fator_codigo);
        CONTINUE;
      END IF;

      IF _nivel_recomendacao <> 'essencial'
         OR _fator_codigo = ANY(_monitoramentos_usados) THEN
        CONTINUE;
      END IF;

      _monitoramentos_usados :=
        array_append(_monitoramentos_usados, _fator_codigo);
      _fatores_sanitizados :=
        _fatores_sanitizados || jsonb_build_array(_fator_codigo);
    END LOOP;

    IF jsonb_array_length(_fatores_sanitizados) > 0 THEN
      _selecoes_sanitizadas := _selecoes_sanitizadas || jsonb_build_array(
        jsonb_set(_sel, '{fatores_codes}', _fatores_sanitizados, true)
      );
    END IF;
  END LOOP;

  RETURN public.psico_aplicar_plano_ia_strict_v1(
    p_revisao_id,
    _selecoes_sanitizadas,
    p_prompt_codigo,
    p_modelo_ia
  );
END;
$$;

REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(
  uuid,
  jsonb,
  text,
  text
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text) IS
  'Sanitiza vinculos opcionais ou inaplicaveis gerados por IA e delega autorizacao, catalogo, fatores e cobertura obrigatoria para a implementacao estrita.';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260729130714', 'tolerate_ai_links_without_action', ARRAY['-- applied'])
ON CONFLICT (version) DO NOTHING;