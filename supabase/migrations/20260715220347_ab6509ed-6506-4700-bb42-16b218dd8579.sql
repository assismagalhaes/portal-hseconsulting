
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUMS
DO $$ BEGIN CREATE TYPE public.psico_relatorio_status AS ENUM ('ativo','revogado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.psico_relatorio_versao_status AS ENUM ('preparando','gerando','emitido','falhou','substituido','revogado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SEQUENCE + CÓDIGOS
CREATE SEQUENCE IF NOT EXISTS public.psico_relatorio_numero_seq;

CREATE OR REPLACE FUNCTION public.psico_gerar_codigo_relatorio()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN n := nextval('public.psico_relatorio_numero_seq');
  RETURN 'RAFP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY') || '-' || lpad(n::text, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.psico_gerar_codigo_validacao()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h text;
BEGIN
  h := upper(encode(gen_random_bytes(16), 'hex'));
  RETURN substr(h,1,4)||'-'||substr(h,5,4)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||
         substr(h,17,4)||'-'||substr(h,21,4)||'-'||substr(h,25,4)||'-'||substr(h,29,4);
END $$;

CREATE OR REPLACE FUNCTION public.psico_hash_snapshot(p_snapshot jsonb)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT encode(digest(convert_to(p_snapshot::text, 'UTF8'), 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.psico_sanitize_snapshot(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  chaves_proibidas text[] := ARRAY['nome','nome_completo','email','telefone','celular','matricula','cpf','rg',
    'participante_id','convite_id','public_id','token','resposta_id','respondente','respondentes',
    'participantes_lista','pendentes_lista','lista_nominal','ip','ip_address','user_agent','fingerprint',
    'respostas','respostas_brutas','resposta','data_resposta','hora_resposta','respondido_em','submetido_em','observacoes_privadas'];
  k text; v jsonb; out_obj jsonb; out_arr jsonb; item jsonb;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_data) = 'object' THEN
    out_obj := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(p_data) LOOP
      IF NOT (k = ANY(chaves_proibidas)) THEN
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
  ELSE RETURN p_data; END IF;
END $$;

-- TABELA: psico_relatorios
CREATE TABLE IF NOT EXISTS public.psico_relatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  avaliacao_id UUID NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL UNIQUE DEFAULT public.psico_gerar_codigo_relatorio(),
  titulo TEXT NOT NULL DEFAULT 'Relatório de Avaliação de Fatores Psicossociais',
  status public.psico_relatorio_status NOT NULL DEFAULT 'ativo',
  versao_ativa_id UUID NULL,
  documento_tecnico_id UUID NULL REFERENCES public.documentos_tecnicos(id) ON DELETE SET NULL,
  criado_por UUID NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  revogado_por UUID NULL,
  revogado_em TIMESTAMPTZ NULL,
  motivo_revogacao TEXT NULL,
  CONSTRAINT psico_relatorios_avaliacao_unica UNIQUE (avaliacao_id)
);
CREATE INDEX IF NOT EXISTS psico_relatorios_status_idx ON public.psico_relatorios(status);
CREATE INDEX IF NOT EXISTS psico_relatorios_documento_idx ON public.psico_relatorios(documento_tecnico_id);

GRANT SELECT ON public.psico_relatorios TO authenticated;
GRANT ALL ON public.psico_relatorios TO service_role;
ALTER TABLE public.psico_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psico_relatorios_select_interno" ON public.psico_relatorios
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));

CREATE TRIGGER tg_psico_relatorios_touch
  BEFORE UPDATE ON public.psico_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated();

-- TABELA: psico_relatorios_versoes
CREATE TABLE IF NOT EXISTS public.psico_relatorios_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relatorio_id UUID NOT NULL REFERENCES public.psico_relatorios(id) ON DELETE RESTRICT,
  avaliacao_id UUID NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  revisao_tecnica_id UUID NOT NULL REFERENCES public.psico_revisoes_tecnicas(id) ON DELETE RESTRICT,
  processamento_id UUID NOT NULL REFERENCES public.psico_resultado_processamentos(id) ON DELETE RESTRICT,
  numero_revisao INTEGER NOT NULL,
  codigo_revisao TEXT NOT NULL,
  descricao_revisao TEXT NULL,
  status public.psico_relatorio_versao_status NOT NULL DEFAULT 'preparando',
  modelo_codigo TEXT NOT NULL,
  modelo_versao TEXT NOT NULL,
  snapshot_conteudo JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  arquivo_storage_path TEXT NULL,
  arquivo_nome TEXT NULL,
  arquivo_mime_type TEXT NULL,
  arquivo_tamanho_bytes BIGINT NULL,
  arquivo_paginas INTEGER NULL,
  pdf_hash_sha256 TEXT NULL,
  codigo_validacao TEXT NOT NULL UNIQUE DEFAULT public.psico_gerar_codigo_validacao(),
  documento_tecnico_revisao_id UUID NULL,
  geracao_iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  geracao_concluida_em TIMESTAMPTZ NULL,
  emitido_por UUID NULL,
  emitido_em TIMESTAMPTZ NULL,
  substituido_em TIMESTAMPTZ NULL,
  substituido_por_versao_id UUID NULL REFERENCES public.psico_relatorios_versoes(id) ON DELETE SET NULL,
  revogado_em TIMESTAMPTZ NULL,
  revogado_por UUID NULL,
  motivo_revogacao TEXT NULL,
  erro_codigo TEXT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT psico_rel_versao_unica UNIQUE (relatorio_id, numero_revisao)
);
CREATE INDEX IF NOT EXISTS psico_rel_ver_relatorio_idx ON public.psico_relatorios_versoes(relatorio_id);
CREATE INDEX IF NOT EXISTS psico_rel_ver_avaliacao_idx ON public.psico_relatorios_versoes(avaliacao_id);
CREATE INDEX IF NOT EXISTS psico_rel_ver_status_idx ON public.psico_relatorios_versoes(status);
CREATE INDEX IF NOT EXISTS psico_rel_ver_valcode_idx ON public.psico_relatorios_versoes(codigo_validacao);

ALTER TABLE public.psico_relatorios
  ADD CONSTRAINT psico_relatorios_versao_ativa_fk
  FOREIGN KEY (versao_ativa_id) REFERENCES public.psico_relatorios_versoes(id) ON DELETE SET NULL;

GRANT SELECT ON public.psico_relatorios_versoes TO authenticated;
GRANT ALL ON public.psico_relatorios_versoes TO service_role;
ALTER TABLE public.psico_relatorios_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psico_rel_ver_select_interno" ON public.psico_relatorios_versoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));

-- Guard: campos imutáveis após emissão
CREATE OR REPLACE FUNCTION public.psico_rel_ver_guard_imutavel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'emitido' AND NEW.status NOT IN ('substituido','revogado') AND (
    NEW.snapshot_conteudo IS DISTINCT FROM OLD.snapshot_conteudo OR
    NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash OR
    NEW.modelo_codigo IS DISTINCT FROM OLD.modelo_codigo OR
    NEW.modelo_versao IS DISTINCT FROM OLD.modelo_versao OR
    NEW.numero_revisao IS DISTINCT FROM OLD.numero_revisao OR
    NEW.codigo_revisao IS DISTINCT FROM OLD.codigo_revisao OR
    NEW.arquivo_storage_path IS DISTINCT FROM OLD.arquivo_storage_path OR
    NEW.pdf_hash_sha256 IS DISTINCT FROM OLD.pdf_hash_sha256 OR
    NEW.codigo_validacao IS DISTINCT FROM OLD.codigo_validacao
  ) THEN
    RAISE EXCEPTION 'psico_rel_ver_imutavel: versão emitida não pode ser alterada';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_psico_rel_ver_imutavel
  BEFORE UPDATE ON public.psico_relatorios_versoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_rel_ver_guard_imutavel();

-- BUCKET RLS (bucket já criado via tool)
CREATE POLICY "psico_rel_bucket_service_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'psico-relatorios')
  WITH CHECK (bucket_id = 'psico-relatorios');

CREATE POLICY "psico_rel_bucket_select_interno"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'psico-relatorios' AND public.can_see_internal(auth.uid()));

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.psico_validar_emissao_relatorio(p_avaliacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record; v_rev record; v_proc record; v_plano record;
  erros text[] := ARRAY[]::text[]; avisos text[] := ARRAY[]::text[];
  v_proxima text := 'R00';
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RETURN jsonb_build_object('valido', false, 'pode_emitir', false,
      'erros', jsonb_build_array('nao_autorizado'), 'avisos', '[]'::jsonb);
  END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'pode_emitir', false,
      'erros', jsonb_build_array('avaliacao_inexistente'), 'avisos', '[]'::jsonb);
  END IF;
  IF v_av.status NOT IN ('resultado_pronto','relatorio_emitido') THEN
    erros := erros || 'status_avaliacao_incompativel';
  END IF;
  IF v_av.processamento_resultado_ativo_id IS NULL THEN
    erros := erros || 'sem_processamento_ativo';
  ELSE
    SELECT * INTO v_proc FROM public.psico_resultado_processamentos WHERE id = v_av.processamento_resultado_ativo_id;
    IF NOT FOUND OR v_proc.status_processamento IS DISTINCT FROM 'concluido' THEN
      erros := erros || 'processamento_invalido';
    END IF;
  END IF;
  SELECT * INTO v_rev FROM public.psico_revisoes_tecnicas
    WHERE avaliacao_id = p_avaliacao_id AND ativa = true ORDER BY versao DESC LIMIT 1;
  IF NOT FOUND THEN erros := erros || 'sem_revisao_tecnica';
  ELSE
    IF v_rev.status <> 'aprovada' THEN erros := erros || 'revisao_nao_aprovada'; END IF;
    IF coalesce(trim(v_rev.conclusao_tecnica),'') = '' THEN erros := erros || 'conclusao_vazia'; END IF;
    IF coalesce(trim(v_rev.limitacoes),'') = '' THEN erros := erros || 'limitacoes_vazias'; END IF;
    IF v_rev.responsavel_snapshot IS NULL OR v_rev.responsavel_snapshot = '{}'::jsonb THEN
      erros := erros || 'responsavel_tecnico_ausente';
    END IF;
    SELECT * INTO v_plano FROM public.psico_planos_acao WHERE revisao_id = v_rev.id;
    IF NOT FOUND THEN erros := erros || 'sem_plano_acao';
    ELSIF v_plano.status <> 'aprovado' THEN erros := erros || 'plano_nao_aprovado';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.psico_relatorios r
             JOIN public.psico_relatorios_versoes v ON v.relatorio_id = r.id
             WHERE r.avaliacao_id = p_avaliacao_id AND v.status IN ('preparando','gerando')) THEN
    erros := erros || 'emissao_em_andamento';
  END IF;
  SELECT 'R' || lpad((coalesce(max(v.numero_revisao), -1) + 1)::text, 2, '0') INTO v_proxima
  FROM public.psico_relatorios r JOIN public.psico_relatorios_versoes v ON v.relatorio_id = r.id
  WHERE r.avaliacao_id = p_avaliacao_id AND v.status IN ('emitido','substituido');
  RETURN jsonb_build_object(
    'valido', array_length(erros,1) IS NULL, 'pode_emitir', array_length(erros,1) IS NULL,
    'avaliacao_codigo', v_av.codigo,
    'revisao_tecnica_aprovada', coalesce(v_rev.status = 'aprovada', false),
    'processamento_valido', coalesce(v_proc.status_processamento = 'concluido', false),
    'plano_aprovado', coalesce(v_plano.status = 'aprovado', false),
    'responsavel_tecnico_valido', v_rev.responsavel_snapshot IS NOT NULL AND v_rev.responsavel_snapshot <> '{}'::jsonb,
    'modelo', 'HSE-PSICO-REL-1.0', 'proxima_revisao', coalesce(v_proxima, 'R00'),
    'erros', to_jsonb(erros), 'avisos', to_jsonb(avisos));
END $$;
REVOKE ALL ON FUNCTION public.psico_validar_emissao_relatorio(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_validar_emissao_relatorio(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_emissao_relatorio(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.psico_preparar_emissao_relatorio(
  p_avaliacao_id uuid, p_confirmacao text, p_descricao_revisao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record; v_rev record;
  v_relatorio public.psico_relatorios%ROWTYPE;
  v_versao public.psico_relatorios_versoes%ROWTYPE;
  v_existente public.psico_relatorios_versoes%ROWTYPE;
  v_conteudo jsonb; v_snapshot jsonb; v_hash text;
  v_numero int; v_codigo_rev text; v_validacao jsonb;
  v_modelo_codigo text := 'HSE-PSICO-REL-1.0';
  v_modelo_versao text := '1.0.0';
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_inexistente'; END IF;
  IF p_confirmacao IS DISTINCT FROM ('EMITIR ' || v_av.codigo) THEN RAISE EXCEPTION 'confirmacao_invalida'; END IF;
  v_validacao := public.psico_validar_emissao_relatorio(p_avaliacao_id);
  IF NOT (v_validacao->>'pode_emitir')::boolean THEN
    RAISE EXCEPTION 'validacao_falhou: %', v_validacao->>'erros'; END IF;
  SELECT * INTO v_rev FROM public.psico_revisoes_tecnicas
    WHERE avaliacao_id = p_avaliacao_id AND ativa = true AND status = 'aprovada'
    ORDER BY versao DESC LIMIT 1;

  SELECT * INTO v_relatorio FROM public.psico_relatorios WHERE avaliacao_id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.psico_relatorios (avaliacao_id, criado_por) VALUES (p_avaliacao_id, v_uid)
    RETURNING * INTO v_relatorio;
  END IF;

  SELECT coalesce(max(numero_revisao), -1) + 1 INTO v_numero
  FROM public.psico_relatorios_versoes
  WHERE relatorio_id = v_relatorio.id AND status IN ('emitido','substituido');
  v_codigo_rev := 'R' || lpad(v_numero::text, 2, '0');

  IF v_numero > 0 AND coalesce(trim(p_descricao_revisao),'') = '' THEN
    RAISE EXCEPTION 'descricao_revisao_obrigatoria'; END IF;

  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id);
  IF v_conteudo IS NULL THEN RAISE EXCEPTION 'conteudo_indisponivel'; END IF;
  v_snapshot := public.psico_sanitize_snapshot(v_conteudo) || jsonb_build_object(
    'modelo', jsonb_build_object('codigo', v_modelo_codigo, 'versao', v_modelo_versao));
  v_hash := public.psico_hash_snapshot(v_snapshot);

  SELECT * INTO v_existente FROM public.psico_relatorios_versoes
    WHERE relatorio_id = v_relatorio.id AND revisao_tecnica_id = v_rev.id
      AND processamento_id = v_av.processamento_resultado_ativo_id
      AND snapshot_hash = v_hash AND modelo_codigo = v_modelo_codigo
      AND modelo_versao = v_modelo_versao AND status = 'emitido' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('relatorio_id', v_relatorio.id, 'relatorio_versao_id', v_existente.id,
      'codigo', v_relatorio.codigo, 'codigo_revisao', v_existente.codigo_revisao, 'reutilizada', true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.psico_relatorios_versoes
             WHERE relatorio_id = v_relatorio.id AND status IN ('preparando','gerando')) THEN
    RAISE EXCEPTION 'emissao_em_andamento'; END IF;

  INSERT INTO public.psico_relatorios_versoes (
    relatorio_id, avaliacao_id, revisao_tecnica_id, processamento_id,
    numero_revisao, codigo_revisao, descricao_revisao, status,
    modelo_codigo, modelo_versao, snapshot_conteudo, snapshot_hash, emitido_por
  ) VALUES (
    v_relatorio.id, p_avaliacao_id, v_rev.id, v_av.processamento_resultado_ativo_id,
    v_numero, v_codigo_rev,
    CASE WHEN v_numero = 0 THEN coalesce(p_descricao_revisao, 'Emissão inicial') ELSE p_descricao_revisao END,
    'gerando', v_modelo_codigo, v_modelo_versao, v_snapshot, v_hash, v_uid
  ) RETURNING * INTO v_versao;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('relatorio_versao', v_versao.id, 'emissao_relatorio_preparada', v_uid,
    jsonb_build_object('codigo_rafp', v_relatorio.codigo, 'codigo_revisao', v_codigo_rev,
      'modelo', v_modelo_codigo, 'avaliacao_id', p_avaliacao_id,
      'resumo', 'Emissão preparada: ' || v_relatorio.codigo || ' ' || v_codigo_rev));
  RETURN jsonb_build_object('relatorio_id', v_relatorio.id, 'relatorio_versao_id', v_versao.id,
    'codigo', v_relatorio.codigo, 'codigo_revisao', v_codigo_rev, 'reutilizada', false);
END $$;
REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.psico_concluir_emissao_relatorio(
  p_relatorio_versao_id uuid, p_storage_path text, p_nome_arquivo text,
  p_tamanho_bytes bigint, p_quantidade_paginas integer, p_pdf_hash text,
  p_emitido_por uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_versao public.psico_relatorios_versoes%ROWTYPE;
  v_relatorio public.psico_relatorios%ROWTYPE;
  v_av public.psico_avaliacoes%ROWTYPE;
  v_doc_id uuid; v_cliente record;
BEGIN
  SELECT * INTO v_versao FROM public.psico_relatorios_versoes WHERE id = p_relatorio_versao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'versao_inexistente'; END IF;
  IF v_versao.status <> 'gerando' THEN RAISE EXCEPTION 'estado_invalido'; END IF;
  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes <= 0 THEN RAISE EXCEPTION 'arquivo_invalido'; END IF;
  IF p_quantidade_paginas IS NULL OR p_quantidade_paginas <= 0 THEN RAISE EXCEPTION 'paginas_invalidas'; END IF;
  IF coalesce(trim(p_pdf_hash),'') = '' THEN RAISE EXCEPTION 'hash_invalido'; END IF;

  SELECT * INTO v_relatorio FROM public.psico_relatorios WHERE id = v_versao.relatorio_id FOR UPDATE;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = v_versao.avaliacao_id FOR UPDATE;
  SELECT id, razao_social, nome_fantasia INTO v_cliente FROM public.clients WHERE id = v_av.cliente_id;

  IF v_relatorio.versao_ativa_id IS NOT NULL AND v_relatorio.versao_ativa_id <> v_versao.id THEN
    UPDATE public.psico_relatorios_versoes
       SET status = 'substituido', substituido_em = now(), substituido_por_versao_id = v_versao.id
     WHERE id = v_relatorio.versao_ativa_id;
  END IF;

  UPDATE public.psico_relatorios_versoes
     SET status = 'emitido', arquivo_storage_path = p_storage_path, arquivo_nome = p_nome_arquivo,
         arquivo_mime_type = 'application/pdf', arquivo_tamanho_bytes = p_tamanho_bytes,
         arquivo_paginas = p_quantidade_paginas, pdf_hash_sha256 = p_pdf_hash,
         geracao_concluida_em = now(), emitido_em = now(),
         emitido_por = coalesce(p_emitido_por, emitido_por)
   WHERE id = v_versao.id;

  UPDATE public.psico_relatorios SET versao_ativa_id = v_versao.id, atualizado_em = now()
    WHERE id = v_relatorio.id;

  IF v_relatorio.documento_tecnico_id IS NULL THEN
    INSERT INTO public.documentos_tecnicos (
      tipo, titulo, status, client_id, conteudo_json,
      arquivo_final_path, data_emissao, cliente_nome, tipo_label, revisao,
      created_by, updated_by
    ) VALUES (
      'Avaliacao_Psicossocial', 'Relatório de Avaliação de Fatores Psicossociais',
      'emitido', v_av.cliente_id,
      jsonb_build_object('codigo_rafp', v_relatorio.codigo, 'avaliacao_id', v_av.id,
        'avaliacao_codigo', v_av.codigo, 'modelo', v_versao.modelo_codigo),
      p_storage_path, current_date,
      coalesce(v_cliente.nome_fantasia, v_cliente.razao_social),
      'Avaliação de Fatores Psicossociais', v_versao.numero_revisao,
      coalesce(p_emitido_por, v_versao.emitido_por),
      coalesce(p_emitido_por, v_versao.emitido_por)
    ) RETURNING id INTO v_doc_id;
    UPDATE public.psico_relatorios SET documento_tecnico_id = v_doc_id WHERE id = v_relatorio.id;
  ELSE
    UPDATE public.documentos_tecnicos
       SET arquivo_final_path = p_storage_path, status = 'emitido',
           data_emissao = current_date, revisao = v_versao.numero_revisao,
           updated_by = coalesce(p_emitido_por, updated_by)
     WHERE id = v_relatorio.documento_tecnico_id;
    v_doc_id := v_relatorio.documento_tecnico_id;
  END IF;

  UPDATE public.psico_relatorios_versoes SET documento_tecnico_revisao_id = v_doc_id WHERE id = v_versao.id;

  IF v_av.status <> 'relatorio_emitido' THEN
    UPDATE public.psico_avaliacoes SET status = 'relatorio_emitido' WHERE id = v_av.id;
  END IF;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('relatorio_versao', v_versao.id, 'emissao_relatorio_concluida', coalesce(p_emitido_por, v_versao.emitido_por),
    jsonb_build_object('codigo_rafp', v_relatorio.codigo, 'codigo_revisao', v_versao.codigo_revisao,
      'paginas', p_quantidade_paginas, 'tamanho', p_tamanho_bytes,
      'hash_abrev', substr(p_pdf_hash, 1, 12),
      'resumo', 'Relatório emitido: ' || v_relatorio.codigo || ' ' || v_versao.codigo_revisao));
  RETURN jsonb_build_object('ok', true, 'documento_tecnico_id', v_doc_id);
END $$;
REVOKE ALL ON FUNCTION public.psico_concluir_emissao_relatorio(uuid, text, text, bigint, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_concluir_emissao_relatorio(uuid, text, text, bigint, integer, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_concluir_emissao_relatorio(uuid, text, text, bigint, integer, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.psico_falhar_emissao_relatorio(
  p_relatorio_versao_id uuid, p_erro_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_versao public.psico_relatorios_versoes%ROWTYPE;
  v_codigos text[] := ARRAY['SNAPSHOT_INVALIDO','MODELO_NAO_LOCALIZADO','ERRO_RENDERIZACAO',
    'ERRO_GRAFICO','PDF_INVALIDO','ERRO_STORAGE','ERRO_INTEGRACAO_DOCUMENTOS','TEMPO_LIMITE','ERRO_INTERNO'];
BEGIN
  IF NOT (p_erro_codigo = ANY(v_codigos)) THEN p_erro_codigo := 'ERRO_INTERNO'; END IF;
  SELECT * INTO v_versao FROM public.psico_relatorios_versoes WHERE id = p_relatorio_versao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'versao_inexistente'; END IF;
  UPDATE public.psico_relatorios_versoes
     SET status = 'falhou', erro_codigo = p_erro_codigo, geracao_concluida_em = now()
   WHERE id = p_relatorio_versao_id;
  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, metadados)
  VALUES ('relatorio_versao', p_relatorio_versao_id, 'emissao_relatorio_falhou',
    jsonb_build_object('erro_codigo', p_erro_codigo, 'resumo', 'Falha na emissão: ' || p_erro_codigo));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.psico_falhar_emissao_relatorio(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_falhar_emissao_relatorio(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.psico_obter_versao_download(p_relatorio_versao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v record;
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501'; END IF;
  SELECT vs.*, r.codigo AS codigo_rafp, r.status AS relatorio_status INTO v
  FROM public.psico_relatorios_versoes vs
  JOIN public.psico_relatorios r ON r.id = vs.relatorio_id
  WHERE vs.id = p_relatorio_versao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'versao_inexistente'; END IF;
  IF v.status NOT IN ('emitido','substituido') THEN RAISE EXCEPTION 'nao_disponivel'; END IF;
  IF v.relatorio_status = 'revogado' OR v.status = 'revogado' THEN RAISE EXCEPTION 'documento_revogado'; END IF;
  IF v.arquivo_storage_path IS NULL THEN RAISE EXCEPTION 'arquivo_indisponivel'; END IF;
  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('relatorio_versao', p_relatorio_versao_id, 'relatorio_baixado', v_uid,
    jsonb_build_object('codigo_rafp', v.codigo_rafp, 'codigo_revisao', v.codigo_revisao,
      'resumo', 'Download solicitado: ' || v.codigo_rafp || ' ' || v.codigo_revisao));
  RETURN jsonb_build_object('storage_path', v.arquivo_storage_path,
    'nome_arquivo', v.arquivo_nome, 'paginas', v.arquivo_paginas, 'tamanho', v.arquivo_tamanho_bytes);
END $$;
REVOKE ALL ON FUNCTION public.psico_obter_versao_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_versao_download(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.psico_revogar_versao_relatorio(
  p_relatorio_versao_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_versao public.psico_relatorios_versoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501'; END IF;
  IF coalesce(length(trim(p_motivo)),0) < 20 THEN RAISE EXCEPTION 'motivo_curto'; END IF;
  SELECT * INTO v_versao FROM public.psico_relatorios_versoes WHERE id = p_relatorio_versao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'versao_inexistente'; END IF;
  IF v_versao.status NOT IN ('emitido','substituido') THEN RAISE EXCEPTION 'estado_invalido'; END IF;
  UPDATE public.psico_relatorios_versoes
     SET status = 'revogado', revogado_em = now(), revogado_por = v_uid, motivo_revogacao = p_motivo
   WHERE id = p_relatorio_versao_id;
  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('relatorio_versao', p_relatorio_versao_id, 'relatorio_revogado', v_uid,
    jsonb_build_object('codigo_revisao', v_versao.codigo_revisao,
      'resumo', 'Versão revogada: ' || v_versao.codigo_revisao));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.psico_revogar_versao_relatorio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_revogar_versao_relatorio(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.psico_validar_publico_relatorio(p_codigo_validacao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF p_codigo_validacao IS NULL OR length(p_codigo_validacao) < 20 THEN
    RETURN jsonb_build_object('valido', false); END IF;
  SELECT vs.*, r.codigo AS codigo_rafp, r.status AS relatorio_status,
         rev.responsavel_snapshot INTO v
  FROM public.psico_relatorios_versoes vs
  JOIN public.psico_relatorios r ON r.id = vs.relatorio_id
  LEFT JOIN public.psico_revisoes_tecnicas rev ON rev.id = vs.revisao_tecnica_id
  WHERE vs.codigo_validacao = p_codigo_validacao;
  IF NOT FOUND THEN RETURN jsonb_build_object('valido', false); END IF;
  RETURN jsonb_build_object(
    'valido', v.status IN ('emitido','substituido','revogado'),
    'codigo_rafp', v.codigo_rafp, 'codigo_revisao', v.codigo_revisao,
    'data_emissao', v.emitido_em,
    'status', CASE
      WHEN v.status = 'emitido' AND v.relatorio_status <> 'revogado' THEN 'Emitido'
      WHEN v.status = 'substituido' THEN 'Substituído'
      WHEN v.status = 'revogado' OR v.relatorio_status = 'revogado' THEN 'Revogado'
      ELSE 'Indisponível' END,
    'modelo', v.modelo_codigo || ' ' || v.modelo_versao,
    'responsavel_tecnico', jsonb_build_object(
      'nome', v.responsavel_snapshot->>'nome',
      'registro', v.responsavel_snapshot->>'registro_profissional'),
    'hash_abreviado', substr(coalesce(v.pdf_hash_sha256,''), 1, 12));
END $$;
REVOKE ALL ON FUNCTION public.psico_validar_publico_relatorio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_validar_publico_relatorio(text) TO anon, authenticated, service_role;
