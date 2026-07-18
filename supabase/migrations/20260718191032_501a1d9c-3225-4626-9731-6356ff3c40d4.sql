CREATE OR REPLACE FUNCTION public.documentos_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_nome IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(nome_fantasia, razao_social) INTO NEW.cliente_nome
      FROM public.clients WHERE id = NEW.client_id;
    END IF;
    NEW.tipo_label := NEW.tipo::text;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Mudanca de status', OLD.status::text || ' -> ' || NEW.status::text, auth.uid());
    IF NEW.status = 'emitido' AND NEW.data_emissao IS NULL THEN
      NEW.data_emissao := CURRENT_DATE;
    END IF;
    IF NEW.status = 'aprovado' AND NEW.data_aprovacao IS NULL THEN
      NEW.data_aprovacao := CURRENT_DATE;
      NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
      NEW.aprovado_por := COALESCE(NEW.aprovado_por, auth.uid());
    END IF;
  END IF;

  IF NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Vencimento alterado', 'Nova validade: ' || COALESCE(NEW.data_vencimento::text, '-'), auth.uid());
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.documentos_timeline_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
  VALUES (
    NEW.id,
    'Documento criado',
    'Status inicial: ' || NEW.status::text,
    COALESCE(auth.uid(), NEW.created_by)
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_documentos_timeline_after_insert ON public.documentos_tecnicos;
CREATE TRIGGER trg_documentos_timeline_after_insert
  AFTER INSERT ON public.documentos_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.documentos_timeline_after_insert();

REVOKE ALL ON FUNCTION public.documentos_timeline_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.documentos_timeline_after_insert() TO service_role;

CREATE OR REPLACE FUNCTION public.psico_preparar_emissao_relatorio(
  p_avaliacao_id uuid, p_confirmacao text, p_descricao_revisao text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_rev record;
  v_relatorio public.psico_relatorios%ROWTYPE;
  v_versao public.psico_relatorios_versoes%ROWTYPE;
  v_existente public.psico_relatorios_versoes%ROWTYPE;
  v_conteudo jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_numero int;
  v_codigo_rev text;
  v_validacao jsonb;
  v_retentativa boolean := false;
  v_modelo_codigo text := 'HSE-PSICO-REL-1.0';
  v_modelo_versao text := '1.0.0';
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_av
  FROM public.psico_avaliacoes
  WHERE id = p_avaliacao_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_inexistente'; END IF;
  IF p_confirmacao IS DISTINCT FROM ('EMITIR ' || v_av.codigo) THEN
    RAISE EXCEPTION 'confirmacao_invalida';
  END IF;

  v_validacao := public.psico_validar_emissao_relatorio(p_avaliacao_id);
  IF NOT (v_validacao->>'pode_emitir')::boolean THEN
    RAISE EXCEPTION 'validacao_falhou: %', v_validacao->>'erros';
  END IF;

  SELECT * INTO v_rev
  FROM public.psico_revisoes_tecnicas
  WHERE avaliacao_id = p_avaliacao_id
    AND ativa = true
    AND status = 'aprovada'
  ORDER BY versao DESC
  LIMIT 1;

  SELECT * INTO v_relatorio
  FROM public.psico_relatorios
  WHERE avaliacao_id = p_avaliacao_id
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.psico_relatorios (avaliacao_id, criado_por)
    VALUES (p_avaliacao_id, v_uid)
    RETURNING * INTO v_relatorio;
  END IF;

  SELECT coalesce(max(numero_revisao), -1) + 1 INTO v_numero
  FROM public.psico_relatorios_versoes
  WHERE relatorio_id = v_relatorio.id
    AND status IN ('emitido', 'substituido');
  v_codigo_rev := 'R' || lpad(v_numero::text, 2, '0');

  IF v_numero > 0 AND coalesce(trim(p_descricao_revisao), '') = '' THEN
    RAISE EXCEPTION 'descricao_revisao_obrigatoria';
  END IF;

  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id);
  IF v_conteudo IS NULL THEN RAISE EXCEPTION 'conteudo_indisponivel'; END IF;
  v_snapshot := public.psico_sanitize_snapshot(v_conteudo) || jsonb_build_object(
    'modelo', jsonb_build_object('codigo', v_modelo_codigo, 'versao', v_modelo_versao));
  v_hash := public.psico_hash_snapshot(v_snapshot);

  SELECT * INTO v_existente
  FROM public.psico_relatorios_versoes
  WHERE relatorio_id = v_relatorio.id
    AND revisao_tecnica_id = v_rev.id
    AND processamento_id = v_av.processamento_resultado_ativo_id
    AND snapshot_hash = v_hash
    AND modelo_codigo = v_modelo_codigo
    AND modelo_versao = v_modelo_versao
    AND status = 'emitido'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'relatorio_id', v_relatorio.id,
      'relatorio_versao_id', v_existente.id,
      'codigo', v_relatorio.codigo,
      'codigo_revisao', v_existente.codigo_revisao,
      'reutilizada', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.psico_relatorios_versoes
    WHERE relatorio_id = v_relatorio.id
      AND status IN ('preparando', 'gerando')
  ) THEN
    RAISE EXCEPTION 'emissao_em_andamento';
  END IF;

  SELECT * INTO v_versao
  FROM public.psico_relatorios_versoes
  WHERE relatorio_id = v_relatorio.id
    AND numero_revisao = v_numero
    AND status = 'falhou'
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_retentativa := true;
    UPDATE public.psico_relatorios_versoes
    SET revisao_tecnica_id = v_rev.id,
        processamento_id = v_av.processamento_resultado_ativo_id,
        codigo_revisao = v_codigo_rev,
        descricao_revisao = CASE
          WHEN v_numero = 0 THEN coalesce(p_descricao_revisao, 'Emissao inicial')
          ELSE p_descricao_revisao
        END,
        status = 'gerando',
        modelo_codigo = v_modelo_codigo,
        modelo_versao = v_modelo_versao,
        snapshot_conteudo = v_snapshot,
        snapshot_hash = v_hash,
        arquivo_storage_path = NULL,
        arquivo_nome = NULL,
        arquivo_mime_type = NULL,
        arquivo_tamanho_bytes = NULL,
        arquivo_paginas = NULL,
        pdf_hash_sha256 = NULL,
        documento_tecnico_revisao_id = NULL,
        geracao_iniciada_em = now(),
        geracao_concluida_em = NULL,
        emitido_por = v_uid,
        emitido_em = NULL,
        erro_codigo = NULL
    WHERE id = v_versao.id
    RETURNING * INTO v_versao;
  ELSE
    INSERT INTO public.psico_relatorios_versoes (
      relatorio_id, avaliacao_id, revisao_tecnica_id, processamento_id,
      numero_revisao, codigo_revisao, descricao_revisao, status,
      modelo_codigo, modelo_versao, snapshot_conteudo, snapshot_hash, emitido_por
    ) VALUES (
      v_relatorio.id, p_avaliacao_id, v_rev.id, v_av.processamento_resultado_ativo_id,
      v_numero, v_codigo_rev,
      CASE WHEN v_numero = 0 THEN coalesce(p_descricao_revisao, 'Emissao inicial') ELSE p_descricao_revisao END,
      'gerando', v_modelo_codigo, v_modelo_versao, v_snapshot, v_hash, v_uid
    ) RETURNING * INTO v_versao;
  END IF;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES (
    'relatorio_versao',
    v_versao.id,
    CASE WHEN v_retentativa THEN 'emissao_relatorio_retentada' ELSE 'emissao_relatorio_preparada' END,
    v_uid,
    jsonb_build_object(
      'codigo_rafp', v_relatorio.codigo,
      'codigo_revisao', v_codigo_rev,
      'modelo', v_modelo_codigo,
      'avaliacao_id', p_avaliacao_id,
      'retentativa', v_retentativa,
      'resumo', CASE
        WHEN v_retentativa THEN 'Emissao retentada: '
        ELSE 'Emissao preparada: '
      END || v_relatorio.codigo || ' ' || v_codigo_rev
    )
  );

  RETURN jsonb_build_object(
    'relatorio_id', v_relatorio.id,
    'relatorio_versao_id', v_versao.id,
    'codigo', v_relatorio.codigo,
    'codigo_revisao', v_codigo_rev,
    'reutilizada', false,
    'retentativa', v_retentativa);
END
$$;

REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text) TO authenticated, service_role;