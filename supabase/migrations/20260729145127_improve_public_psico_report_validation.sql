CREATE OR REPLACE FUNCTION public.psico_validar_publico_relatorio(
  p_codigo_validacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v record;
  v_codigo text;
  v_extraido text;
  v_cnpj_digits text;
  v_cnpj_mascarado text;
BEGIN
  v_extraido := substring(
    upper(coalesce(p_codigo_validacao, ''))
    FROM '([0-9A-F]{4}(-[0-9A-F]{4}){7})'
  );
  v_codigo := coalesce(
    v_extraido,
    upper(regexp_replace(trim(coalesce(p_codigo_validacao, '')), '[[:space:]]+', '', 'g'))
  );

  IF length(v_codigo) < 20 THEN
    RETURN jsonb_build_object('encontrado', false, 'valido', false);
  END IF;

  SELECT
    vs.*,
    r.codigo AS codigo_rafp,
    r.status AS relatorio_status,
    rev.responsavel_snapshot,
    coalesce(c.nome_fantasia, c.razao_social) AS organizacao,
    c.cnpj_cpf,
    vigente.codigo_revisao AS revisao_vigente
  INTO v
  FROM public.psico_relatorios_versoes AS vs
  JOIN public.psico_relatorios AS r
    ON r.id = vs.relatorio_id
  JOIN public.psico_avaliacoes AS a
    ON a.id = vs.avaliacao_id
  LEFT JOIN public.clients AS c
    ON c.id = a.cliente_id
  LEFT JOIN public.psico_revisoes_tecnicas AS rev
    ON rev.id = vs.revisao_tecnica_id
  LEFT JOIN LATERAL (
    SELECT atual.codigo_revisao
    FROM public.psico_relatorios_versoes AS atual
    WHERE atual.relatorio_id = vs.relatorio_id
      AND atual.status = 'emitido'
    ORDER BY atual.numero_revisao DESC
    LIMIT 1
  ) AS vigente ON true
  WHERE vs.codigo_validacao = v_codigo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false, 'valido', false);
  END IF;

  v_cnpj_digits := regexp_replace(coalesce(v.cnpj_cpf, ''), '\D', '', 'g');
  v_cnpj_mascarado := CASE
    WHEN length(v_cnpj_digits) = 14
      THEN '**.***.***/****-' || right(v_cnpj_digits, 2)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'encontrado', true,
    'valido', v.status IN ('emitido', 'substituido', 'revogado'),
    'codigo_rafp', v.codigo_rafp,
    'codigo_revisao', v.codigo_revisao,
    'revisao_vigente', v.revisao_vigente,
    'organizacao', v.organizacao,
    'cnpj_mascarado', v_cnpj_mascarado,
    'data_emissao', v.emitido_em,
    'status', CASE
      WHEN v.status = 'revogado' OR v.relatorio_status = 'revogado' THEN 'Revogado'
      WHEN v.status = 'substituido' THEN 'Substituído'
      WHEN v.status = 'emitido' THEN 'Emitido'
      ELSE 'Indisponível'
    END,
    'modelo', v.modelo_codigo || ' ' || v.modelo_versao,
    'responsavel_tecnico', jsonb_build_object(
      'nome', coalesce(
        v.responsavel_snapshot->>'nome_responsavel',
        v.responsavel_snapshot->>'nome'
      ),
      'registro', v.responsavel_snapshot->>'registro_profissional'
    ),
    'hash_abreviado', substr(coalesce(v.pdf_hash_sha256, ''), 1, 12)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.psico_validar_publico_relatorio(text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_validar_publico_relatorio(text)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_validar_publico_relatorio(text)
  TO anon, authenticated, service_role;
