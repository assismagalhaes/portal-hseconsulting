
CREATE OR REPLACE FUNCTION public.psico_hash_entrada_resultado(p_avaliacao_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_txt text;
  v_hash text;
  v_qv uuid;
  v_mv uuid;
BEGIN
  SELECT questionario_versao_id, metodologia_versao_id
    INTO v_qv, v_mv
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;

  SELECT string_agg(linha, E'\n' ORDER BY linha) INTO v_txt
  FROM (
    SELECT r.id::text || '|' || i.pergunta_id::text || '|' || i.opcao_resposta_id::text AS linha
      FROM public.psico_respostas r
      JOIN public.psico_respostas_itens i ON i.resposta_id = r.id
     WHERE r.avaliacao_id = p_avaliacao_id
  ) s;

  v_txt := coalesce(p_avaliacao_id::text,'') || '|' ||
           coalesce(v_qv::text,'') || '|' ||
           coalesce(v_mv::text,'') || E'\n' || coalesce(v_txt,'');

  v_hash := encode(extensions.digest(v_txt, 'sha256'::text), 'hex');
  RETURN v_hash;
END;
$function$;
