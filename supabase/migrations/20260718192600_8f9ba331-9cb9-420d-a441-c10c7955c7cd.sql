CREATE OR REPLACE FUNCTION public.psico_sanitize_snapshot(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  chaves_proibidas text[] := ARRAY[
    'nome','nome_completo','email','telefone','celular','matricula','cpf','rg',
    'participante_id','convite_id','public_id','token','resposta_id','respondente','respondentes',
    'participantes_lista','pendentes_lista','lista_nominal','ip','ip_address','user_agent','fingerprint',
    'respostas','respostas_brutas','resposta','data_resposta','hora_resposta','respondido_em','submetido_em',
    'observacoes_privadas'
  ];
  k text;
  v jsonb;
  out_obj jsonb;
  out_arr jsonb;
  item jsonb;
  responsavel_seguro jsonb;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;

  IF jsonb_typeof(p_data) = 'object' THEN
    out_obj := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(p_data) LOOP
      IF k = 'responsavel' AND jsonb_typeof(v) = 'object' THEN
        responsavel_seguro := jsonb_strip_nulls(jsonb_build_object(
          'nome_responsavel', COALESCE(v->>'nome_responsavel', v->>'nome'),
          'cargo', v->>'cargo',
          'registro_profissional', v->>'registro_profissional',
          'aprovado_em', v->>'aprovado_em'
        ));
        out_obj := out_obj || jsonb_build_object(
          k,
          public.psico_sanitize_snapshot(responsavel_seguro)
        );
      ELSIF NOT (k = ANY(chaves_proibidas)) THEN
        out_obj := out_obj || jsonb_build_object(k, public.psico_sanitize_snapshot(v));
      END IF;
    END LOOP;
    RETURN out_obj;
  ELSIF jsonb_typeof(p_data) = 'array' THEN
    out_arr := '[]'::jsonb;
    FOR item IN SELECT * FROM jsonb_array_elements(p_data) LOOP
      out_arr := out_arr || jsonb_build_array(public.psico_sanitize_snapshot(item));
    END LOOP;
    RETURN out_arr;
  END IF;

  RETURN p_data;
END
$$;