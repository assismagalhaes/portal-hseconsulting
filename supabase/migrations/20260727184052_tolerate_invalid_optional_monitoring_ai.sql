-- Defesa final no banco para sugestões opcionais de monitoramento geradas por IA.
--
-- A função estrita continua sendo a autoridade para catálogo, fatores, tratamento
-- e ações obrigatórias. Esta camada remove somente vínculos opcionais que não
-- podem ser aplicados: medida não essencial ou segunda medida para o mesmo fator
-- em monitoramento preventivo.
ALTER FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  RENAME TO psico_aplicar_plano_ia_strict_v1;

REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

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
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  -- Preserva na função estrita os erros estruturais e de autorização.
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
    -- Seleções malformadas seguem intactas para a validação estrita.
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

    -- Catálogo inválido segue intacto para falhar fechado na função estrita.
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

      -- Fator inexistente, ação recomendada, sem ação e tratamento inválido
      -- permanecem no payload para a autoridade estrita decidir/falhar fechado.
      IF NOT FOUND OR _tratamento <> 'monitoramento_preventivo' THEN
        _fatores_sanitizados :=
          _fatores_sanitizados || jsonb_build_array(_fator_codigo);
        CONTINUE;
      END IF;

      -- Monitoramento é opcional: medida incompatível ou repetida é ignorada,
      -- sem impedir que o plano válido (inclusive vazio) seja preservado.
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

COMMENT ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text) IS
  'Sanitiza apenas sugestões opcionais inválidas/duplicadas de monitoramento e delega todas as demais validações à implementação estrita.';
