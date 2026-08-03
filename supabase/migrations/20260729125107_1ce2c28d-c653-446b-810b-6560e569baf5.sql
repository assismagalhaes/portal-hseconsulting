ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_storage_path text,
  ADD COLUMN IF NOT EXISTS logo_mime_type text,
  ADD COLUMN IF NOT EXISTS logo_hash_sha256 text;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_logo_storage_path_check,
  DROP CONSTRAINT IF EXISTS clients_logo_mime_type_check,
  DROP CONSTRAINT IF EXISTS clients_logo_hash_sha256_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_logo_storage_path_check
    CHECK (
      logo_storage_path IS NULL
      OR logo_storage_path ~ ('^' || id::text || '/logo\.(png|jpg)$')
    ),
  ADD CONSTRAINT clients_logo_mime_type_check
    CHECK (
      logo_mime_type IS NULL
      OR logo_mime_type IN ('image/png', 'image/jpeg')
    ),
  ADD CONSTRAINT clients_logo_hash_sha256_check
    CHECK (
      logo_hash_sha256 IS NULL
      OR logo_hash_sha256 ~ '^[0-9a-f]{64}$'
    );

DROP POLICY IF EXISTS "client branding internal select" ON storage.objects;
CREATE POLICY "client branding internal select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-branding'
  AND public.can_see_internal((SELECT auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$'
);

DROP POLICY IF EXISTS "client branding internal insert" ON storage.objects;
CREATE POLICY "client branding internal insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-branding'
  AND public.can_see_internal((SELECT auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$'
);

DROP POLICY IF EXISTS "client branding internal update" ON storage.objects;
CREATE POLICY "client branding internal update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-branding'
  AND public.can_see_internal((SELECT auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$'
)
WITH CHECK (
  bucket_id = 'client-branding'
  AND public.can_see_internal((SELECT auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$'
);

DROP POLICY IF EXISTS "client branding internal delete" ON storage.objects;
CREATE POLICY "client branding internal delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-branding'
  AND public.can_see_internal((SELECT auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$'
);

ALTER FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  RENAME TO psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6;

REVOKE ALL ON FUNCTION
  public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(uuid)
  TO service_role;

CREATE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(
  p_avaliacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conteudo jsonb;
  v_branding jsonb;
BEGIN
  IF NOT public.can_see_internal((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  v_conteudo :=
    public.psico_obter_conteudo_aprovado_relatorio_sem_branding_v1_6(
      p_avaliacao_id
    );

  IF v_conteudo IS NULL
     OR COALESCE((v_conteudo->>'ok')::boolean, false) = false THEN
    RETURN v_conteudo;
  END IF;

  SELECT jsonb_strip_nulls(jsonb_build_object(
    'logo_storage_path', c.logo_storage_path,
    'logo_mime_type', c.logo_mime_type,
    'logo_hash_sha256', c.logo_hash_sha256
  ))
  INTO v_branding
  FROM public.psico_avaliacoes a
  JOIN public.clients c ON c.id = a.cliente_id
  WHERE a.id = p_avaliacao_id;

  RETURN jsonb_set(
    v_conteudo,
    '{avaliacao,organizacao_branding}',
    COALESCE(v_branding, '{}'::jsonb),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.psico_obter_conteudo_aprovado_relatorio(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.psico_obter_conteudo_aprovado_relatorio(uuid)
  TO authenticated, service_role;

DO $migration$
DECLARE
  v_definition text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(
    'public.psico_preparar_emissao_relatorio(uuid, text, text)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'psico_preparar_emissao_relatorio nao encontrada';
  END IF;

  IF position('v_modelo_versao text := ''1.6.0''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('v_modelo_versao text := ''1.5.1''' IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Versao base inesperada em psico_preparar_emissao_relatorio';
  END IF;

  v_new := replace(
    v_definition,
    'v_modelo_versao text := ''1.5.1''',
    'v_modelo_versao text := ''1.6.0'''
  );

  EXECUTE v_new;
END
$migration$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260728183448', 'add_client_report_branding', ARRAY['-- applied via lovable'])
ON CONFLICT (version) DO NOTHING;