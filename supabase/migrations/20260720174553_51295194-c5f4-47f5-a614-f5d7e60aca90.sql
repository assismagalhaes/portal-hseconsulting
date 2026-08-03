-- HSE-PSICO-REL-1.4.0
ALTER TABLE public.psico_revisoes_tecnicas
  ADD COLUMN IF NOT EXISTS parecer_conclusivo jsonb,
  ADD COLUMN IF NOT EXISTS parecer_origem text,
  ADD COLUMN IF NOT EXISTS parecer_prompt_codigo text,
  ADD COLUMN IF NOT EXISTS parecer_modelo_ia text,
  ADD COLUMN IF NOT EXISTS parecer_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS parecer_editado_em timestamptz;

ALTER TABLE public.psico_revisoes_tecnicas
  DROP CONSTRAINT IF EXISTS psico_revisoes_tecnicas_parecer_origem_check;
ALTER TABLE public.psico_revisoes_tecnicas
  ADD CONSTRAINT psico_revisoes_tecnicas_parecer_origem_check
  CHECK (parecer_origem IS NULL OR parecer_origem IN ('manual', 'ia', 'editado_ia', 'migrado'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assinatura_modo text NOT NULL DEFAULT 'em_branco',
  ADD COLUMN IF NOT EXISTS assinatura_storage_path text,
  ADD COLUMN IF NOT EXISTS assinatura_nome_arquivo text,
  ADD COLUMN IF NOT EXISTS assinatura_mime_type text,
  ADD COLUMN IF NOT EXISTS assinatura_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS assinatura_carregada_por uuid,
  ADD COLUMN IF NOT EXISTS assinatura_carregada_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_ativa boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_assinatura_modo_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assinatura_modo_check
  CHECK (assinatura_modo IN ('em_branco', 'imagem'));
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_assinatura_mime_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assinatura_mime_type_check
  CHECK (assinatura_mime_type IS NULL OR assinatura_mime_type IN ('image/png', 'image/jpeg'));

CREATE TABLE IF NOT EXISTS public.psico_parecer_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id uuid NOT NULL REFERENCES public.psico_revisoes_tecnicas(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  conteudo jsonb NOT NULL,
  origem text NOT NULL CHECK (origem IN ('manual', 'ia', 'editado_ia', 'migrado', 'restaurado')),
  prompt_codigo text,
  modelo_ia text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revisao_id, numero)
);

GRANT SELECT ON public.psico_parecer_versoes TO authenticated;
GRANT ALL ON public.psico_parecer_versoes TO service_role;
ALTER TABLE public.psico_parecer_versoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "internal all parecer versoes" ON public.psico_parecer_versoes;
CREATE POLICY "internal all parecer versoes"
  ON public.psico_parecer_versoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

CREATE OR REPLACE FUNCTION public.psico_guard_assinatura_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND (
    OLD.assinatura_modo IS DISTINCT FROM NEW.assinatura_modo OR
    OLD.assinatura_storage_path IS DISTINCT FROM NEW.assinatura_storage_path OR
    OLD.assinatura_nome_arquivo IS DISTINCT FROM NEW.assinatura_nome_arquivo OR
    OLD.assinatura_mime_type IS DISTINCT FROM NEW.assinatura_mime_type OR
    OLD.assinatura_hash_sha256 IS DISTINCT FROM NEW.assinatura_hash_sha256 OR
    OLD.assinatura_carregada_por IS DISTINCT FROM NEW.assinatura_carregada_por OR
    OLD.assinatura_carregada_em IS DISTINCT FROM NEW.assinatura_carregada_em OR
    OLD.assinatura_ativa IS DISTINCT FROM NEW.assinatura_ativa
  ) THEN
    RAISE EXCEPTION 'ASSINATURA_ALTERACAO_SOMENTE_VIA_FLUXO_SEGURO';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tg_profiles_guard_assinatura ON public.profiles;
CREATE TRIGGER tg_profiles_guard_assinatura
BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.psico_guard_assinatura_profile();

ALTER TABLE public.psico_revisoes_tecnicas DISABLE TRIGGER tg_psico_revisao_guard;
UPDATE public.psico_revisoes_tecnicas
SET parecer_conclusivo = jsonb_build_object(
      'sintese_resultados', COALESCE(NULLIF(BTRIM(conclusao_tecnica), ''), 'Síntese técnica registrada na revisão aprovada.'),
      'interpretacao_integrada', COALESCE(NULLIF(BTRIM(contexto_organizacional), ''), 'Os resultados devem ser confrontados com as condições reais de trabalho.'),
      'prioridades_intervencao', COALESCE(NULLIF(BTRIM(recomendacao_geral), ''), 'Priorizar as medidas aprovadas no plano de ação.'),
      'recomendacoes', COALESCE(NULLIF(BTRIM(recomendacao_geral), ''), 'Implementar as medidas, comunicar as equipes e verificar a eficácia.'),
      'limitacoes', COALESCE(NULLIF(BTRIM(limitacoes), ''), 'Os resultados são coletivos e não constituem diagnóstico individual.'),
      'conclusao', COALESCE(NULLIF(BTRIM(conclusao_tecnica), ''), 'Manter acompanhamento organizacional e integrar os resultados ao gerenciamento de riscos ocupacionais.')
    ),
    parecer_origem = COALESCE(parecer_origem, 'migrado')
WHERE parecer_conclusivo IS NULL
  AND NULLIF(BTRIM(conclusao_tecnica), '') IS NOT NULL;
ALTER TABLE public.psico_revisoes_tecnicas ENABLE TRIGGER tg_psico_revisao_guard;

CREATE OR REPLACE FUNCTION public.psico_parecer_valido(p_parecer jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_parecer) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'sintese_resultados', 'interpretacao_integrada', 'prioridades_intervencao',
        'recomendacoes', 'limitacoes', 'conclusao'
      ]) AS k(chave)
      WHERE length(btrim(COALESCE(p_parecer ->> k.chave, ''))) < CASE WHEN k.chave = 'conclusao' THEN 50 ELSE 20 END
    );
$$;

CREATE OR REPLACE FUNCTION public.psico_salvar_parecer_conclusivo(
  p_revisao_id uuid,
  p_parecer jsonb,
  p_origem text DEFAULT 'manual',
  p_prompt_codigo text DEFAULT NULL,
  p_modelo_ia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev public.psico_revisoes_tecnicas%ROWTYPE;
  v_numero integer;
  v_origem text;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO v_rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF v_rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_IMUTAVEL'; END IF;
  IF NOT public.psico_parecer_valido(p_parecer) THEN RAISE EXCEPTION 'PARECER_ESTRUTURA_INVALIDA'; END IF;
  IF COALESCE(p_origem, '') NOT IN ('manual', 'ia', 'editado_ia', 'restaurado') THEN RAISE EXCEPTION 'PARECER_ORIGEM_INVALIDA'; END IF;

  v_origem := CASE WHEN p_origem = 'restaurado' THEN 'manual' ELSE p_origem END;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM public.psico_parecer_versoes WHERE revisao_id = p_revisao_id;

  INSERT INTO public.psico_parecer_versoes
    (revisao_id, numero, conteudo, origem, prompt_codigo, modelo_ia, criado_por)
  VALUES
    (p_revisao_id, v_numero, p_parecer, p_origem, p_prompt_codigo, p_modelo_ia, auth.uid());

  PERFORM set_config('psico.parecer_rpc', 'on', true);
  UPDATE public.psico_revisoes_tecnicas
  SET parecer_conclusivo = p_parecer,
      parecer_origem = v_origem,
      parecer_prompt_codigo = COALESCE(p_prompt_codigo, parecer_prompt_codigo),
      parecer_modelo_ia = COALESCE(p_modelo_ia, parecer_modelo_ia),
      parecer_gerado_em = CASE WHEN p_origem = 'ia' THEN now() ELSE parecer_gerado_em END,
      parecer_editado_em = CASE WHEN p_origem IN ('manual', 'editado_ia', 'restaurado') THEN now() ELSE parecer_editado_em END,
      conclusao_tecnica = p_parecer ->> 'conclusao',
      atualizada_por = auth.uid()
  WHERE id = p_revisao_id;

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('revisao_tecnica', p_revisao_id, 'parecer_salvo',
    jsonb_build_object('versao', v_numero, 'origem', p_origem, 'prompt', p_prompt_codigo, 'modelo', p_modelo_ia),
    auth.uid(), now());

  RETURN jsonb_build_object('ok', true, 'versao', v_numero);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_salvar_parecer_conclusivo(uuid,jsonb,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_salvar_parecer_conclusivo(uuid,jsonb,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_guard_parecer_revisao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND COALESCE(current_setting('psico.parecer_rpc', true), '') <> 'on'
    AND (
      OLD.parecer_conclusivo IS DISTINCT FROM NEW.parecer_conclusivo OR
      OLD.parecer_origem IS DISTINCT FROM NEW.parecer_origem OR
      OLD.parecer_prompt_codigo IS DISTINCT FROM NEW.parecer_prompt_codigo OR
      OLD.parecer_modelo_ia IS DISTINCT FROM NEW.parecer_modelo_ia OR
      OLD.parecer_gerado_em IS DISTINCT FROM NEW.parecer_gerado_em OR
      OLD.parecer_editado_em IS DISTINCT FROM NEW.parecer_editado_em
    ) THEN
    RAISE EXCEPTION 'PARECER_ALTERACAO_SOMENTE_VIA_RPC';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tg_psico_revisao_guard_parecer ON public.psico_revisoes_tecnicas;
CREATE TRIGGER tg_psico_revisao_guard_parecer
BEFORE UPDATE ON public.psico_revisoes_tecnicas FOR EACH ROW
EXECUTE FUNCTION public.psico_guard_parecer_revisao();

ALTER FUNCTION public.psico_validar_revisao_tecnica(uuid)
  RENAME TO psico_validar_revisao_tecnica_sem_parecer_v1_4;
REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica_sem_parecer_v1_4(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica_sem_parecer_v1_4(uuid) TO service_role;

CREATE FUNCTION public.psico_validar_revisao_tecnica(p_revisao_id uuid)
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
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  v_base := public.psico_validar_revisao_tecnica_sem_parecer_v1_4(p_revisao_id);
  SELECT parecer_conclusivo INTO v_parecer FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id;
  IF NOT public.psico_parecer_valido(v_parecer) THEN
    v_erros := COALESCE(v_base->'erros', '[]'::jsonb) || jsonb_build_array('PARECER_CONCLUSIVO_INCOMPLETO');
    v_base := jsonb_set(jsonb_set(v_base, '{erros}', v_erros, true), '{valido}', 'false'::jsonb, true);
  END IF;
  RETURN v_base;
END;
$$;
REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_obter_contexto_parecer_ia(p_revisao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev public.psico_revisoes_tecnicas%ROWTYPE;
  v_escopo_id uuid;
  v_contexto jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO v_rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF v_rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_IMUTAVEL'; END IF;

  SELECT id INTO v_escopo_id FROM public.psico_resultado_escopos
  WHERE processamento_id = v_rev.processamento_id AND tipo = 'global' LIMIT 1;

  SELECT jsonb_build_object(
    'metodologia', (SELECT jsonb_build_object('codigo', mv.codigo, 'versao', mv.versao, 'criterio_principal_percentual', mv.criterio_principal_percentual, 'criterio_agravamento_percentual', mv.criterio_agravamento_percentual, 'criterio_critico_percentual', mv.criterio_critico_percentual)
      FROM public.psico_resultado_processamentos rp JOIN public.psico_metodologias_versoes mv ON mv.id = rp.metodologia_versao_id WHERE rp.id = v_rev.processamento_id),
    'participacao', (SELECT jsonb_build_object('respondentes', e.respondentes, 'participantes_elegiveis', e.participantes_elegiveis, 'percentual_participacao', e.percentual_participacao, 'indice_geral_descritivo', e.indice_geral_descritivo, 'amostra_reduzida', e.amostra_reduzida) FROM public.psico_resultado_escopos e WHERE e.id = v_escopo_id),
    'contexto_organizacional', v_rev.contexto_organizacional,
    'limitacoes', v_rev.limitacoes,
    'fatores', (SELECT COALESCE(jsonb_agg(jsonb_build_object('codigo', rf.fator_codigo, 'score', res.score_medio, 'classificacao', res.classificacao_media, 'mac', res.percentual_medio_alto_critico, 'ac', res.percentual_alto_critico, 'critico', res.percentual_critico, 'criterios', res.criterios_acionados, 'significativo', rf.significativo_calculado, 'prioridade', rf.prioridade_calculada, 'tratamento', rf.tratamento_tecnico, 'observacao_tecnica', rf.observacao_tecnica) ORDER BY rf.ordem_relatorio), '[]'::jsonb)
      FROM public.psico_revisoes_fatores rf JOIN public.psico_resultados_fatores res ON res.id = rf.resultado_fator_id WHERE rf.revisao_id = v_rev.id),
    'perguntas_agregadas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('numero', rp.numero, 'fator_codigo', f.codigo, 'texto', p.texto, 'score', rp.score_medio, 'classificacao', rp.classificacao_media, 'desfavoravel', rp.percentual_desfavoravel, 'ac', rp.percentual_alto_critico, 'critico', rp.percentual_critico) ORDER BY f.ordem, rp.numero), '[]'::jsonb)
      FROM public.psico_resultados_perguntas rp JOIN public.psico_perguntas p ON p.id = rp.pergunta_id LEFT JOIN public.psico_fatores f ON f.id = COALESCE(rp.fator_id, p.fator_id) WHERE rp.escopo_id = v_escopo_id),
    'plano_aprovado', (SELECT COALESCE(jsonb_agg(jsonb_build_object('titulo', i.titulo, 'objetivo', i.objetivo, 'acao', i.acao_recomendada, 'orientacoes', i.orientacoes_praticas, 'exemplos', i.exemplos_aplicacao, 'responsavel', COALESCE(i.responsavel_definido, array_to_string(i.responsaveis_sugeridos, ', ')), 'prazo_dias', i.prazo_sugerido_dias, 'indicador', i.indicador_sugerido) ORDER BY i.ordem), '[]'::jsonb)
      FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = v_rev.id AND i.selecionado)
  ) INTO v_contexto;
  RETURN v_contexto;
END;
$$;
REVOKE ALL ON FUNCTION public.psico_obter_contexto_parecer_ia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_contexto_parecer_ia(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_aprovar_revisao_tecnica(p_revisao_id uuid, p_confirmacao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev record;
  v_val jsonb;
  v_esperado text;
  v_snap jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, a.codigo AS avaliacao_codigo INTO v_rev
  FROM public.psico_revisoes_tecnicas r JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
  WHERE r.id = p_revisao_id FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  v_esperado := 'APROVAR ' || v_rev.avaliacao_codigo;
  IF p_confirmacao <> v_esperado THEN RAISE EXCEPTION 'CONFIRMACAO_INVALIDA: use "%"', v_esperado; END IF;
  IF v_rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_JA_APROVADA'; END IF;
  v_val := public.psico_validar_revisao_tecnica(p_revisao_id);
  IF COALESCE((v_val->>'valido')::boolean, false) = false THEN RAISE EXCEPTION 'CHECKLIST_INCOMPLETO: %', v_val->>'erros'; END IF;

  SELECT jsonb_strip_nulls(jsonb_build_object(
    'nome', COALESCE(NULLIF(BTRIM(nome), ''), email),
    'cargo', NULLIF(BTRIM(cargo), ''),
    'registro_profissional', NULLIF(BTRIM(registro_profissional), ''),
    'aprovado_em', now(),
    'assinatura_modo', assinatura_modo,
    'assinatura_storage_path', CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_storage_path END,
    'assinatura_mime_type', CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_mime_type END,
    'assinatura_hash_sha256', CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_hash_sha256 END
  )) INTO v_snap FROM public.profiles WHERE id = v_rev.responsavel_tecnico_id;

  UPDATE public.psico_revisoes_tecnicas
  SET status = 'aprovada', aprovada_por = auth.uid(), aprovada_em = now(),
      responsavel_snapshot = v_snap, atualizada_por = auth.uid()
  WHERE id = p_revisao_id;
  UPDATE public.psico_planos_acao SET status = 'aprovado', aprovado_em = now(), atualizado_por = auth.uid()
  WHERE revisao_id = p_revisao_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('revisao_tecnica', p_revisao_id, 'revisao_aprovada', jsonb_build_object('avaliacao_codigo', v_rev.avaliacao_codigo, 'itens', v_val->>'itens', 'parecer_origem', v_rev.parecer_origem, 'assinatura_modo', v_snap->>'assinatura_modo'), auth.uid(), now());
  RETURN jsonb_build_object('ok', true, 'status', 'aprovada');
END;
$$;
REVOKE ALL ON FUNCTION public.psico_aprovar_revisao_tecnica(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_aprovar_revisao_tecnica(uuid,text) TO authenticated;

ALTER FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  RENAME TO psico_obter_conteudo_aprovado_relatorio_sem_v1_4;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(uuid) TO service_role;

CREATE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conteudo jsonb;
  v_rev public.psico_revisoes_tecnicas%ROWTYPE;
  v_escopo_id uuid;
  v_perguntas jsonb;
  v_plano jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio_sem_v1_4(p_avaliacao_id);
  IF v_conteudo IS NULL OR COALESCE((v_conteudo->>'ok')::boolean, false) = false THEN RETURN v_conteudo; END IF;

  SELECT * INTO v_rev FROM public.psico_revisoes_tecnicas
  WHERE id = NULLIF(v_conteudo #>> '{revisao,id}', '')::uuid;
  SELECT id INTO v_escopo_id FROM public.psico_resultado_escopos
  WHERE processamento_id = v_rev.processamento_id AND tipo = 'global' LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'numero', rp.numero, 'texto', p.texto, 'fator_codigo', f.codigo, 'fator_nome', f.nome,
    'score_medio', rp.score_medio, 'classificacao', rp.classificacao_media,
    'percentual_desfavoravel', rp.percentual_desfavoravel,
    'percentual_alto_critico', rp.percentual_alto_critico,
    'percentual_critico', rp.percentual_critico
  ) ORDER BY f.ordem, rp.numero), '[]'::jsonb) INTO v_perguntas
  FROM public.psico_resultados_perguntas rp
  JOIN public.psico_perguntas p ON p.id = rp.pergunta_id
  LEFT JOIN public.psico_fatores f ON f.id = COALESCE(rp.fator_id, p.fator_id)
  WHERE rp.escopo_id = v_escopo_id;

  SELECT jsonb_build_object(
    'status', pa.status, 'quantidade', pa.quantidade_itens, 'titulo', pa.titulo, 'descricao', pa.descricao,
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'titulo', i.titulo, 'acao', i.acao_recomendada, 'objetivo', i.objetivo,
      'orientacoes_praticas', i.orientacoes_praticas, 'exemplos_aplicacao', i.exemplos_aplicacao,
      'nivel', i.nivel_recomendacao, 'grupo', i.grupo_transversal, 'prioridade', i.prioridade,
      'prazo_dias', i.prazo_sugerido_dias, 'prazo_texto', i.prazo_sugerido_texto,
      'responsavel', COALESCE(i.responsavel_definido, array_to_string(i.responsaveis_sugeridos, ', ')),
      'evidencias', i.evidencias_recomendadas, 'indicador_eficacia', i.indicador_sugerido,
      'abrangencia', i.abrangencia_rotulo,
      'fatores', (SELECT array_agg(pif.fator_codigo ORDER BY pif.fator_codigo) FROM public.psico_plano_item_fatores pif WHERE pif.plano_item_id = i.id)
    ) ORDER BY i.ordem, i.criado_em) FROM public.psico_plano_acao_itens i WHERE i.plano_id = pa.id AND i.selecionado), '[]'::jsonb)
  ) INTO v_plano
  FROM public.psico_planos_acao pa WHERE pa.revisao_id = v_rev.id
  ORDER BY pa.aprovado_em DESC NULLS LAST, pa.criado_em DESC LIMIT 1;

  v_conteudo := jsonb_set(v_conteudo, '{revisao,parecer_conclusivo}', COALESCE(v_rev.parecer_conclusivo, '{}'::jsonb), true);
  v_conteudo := jsonb_set(v_conteudo, '{revisao,parecer_origem}', to_jsonb(COALESCE(v_rev.parecer_origem, 'manual')), true);
  v_conteudo := jsonb_set(v_conteudo, '{revisao,parecer_prompt_codigo}', COALESCE(to_jsonb(v_rev.parecer_prompt_codigo), 'null'::jsonb), true);
  v_conteudo := jsonb_set(v_conteudo, '{revisao,parecer_modelo_ia}', COALESCE(to_jsonb(v_rev.parecer_modelo_ia), 'null'::jsonb), true);
  v_conteudo := jsonb_set(v_conteudo, '{perguntas}', v_perguntas, true);
  v_conteudo := jsonb_set(v_conteudo, '{plano}', COALESCE(v_plano, '{}'::jsonb), true);
  RETURN v_conteudo;
END;
$$;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.psico_sanitize_snapshot(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  chaves_proibidas text[] := ARRAY['nome','nome_completo','email','telefone','celular','matricula','cpf','rg','participante_id','convite_id','public_id','token','resposta_id','respondente','respondentes','participantes_lista','pendentes_lista','lista_nominal','ip','ip_address','user_agent','fingerprint','respostas','respostas_brutas','resposta','data_resposta','hora_resposta','respondido_em','submetido_em','observacoes_privadas'];
  k text; v jsonb; out_obj jsonb; out_arr jsonb; item jsonb; responsavel_seguro jsonb;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_data) = 'object' THEN
    out_obj := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(p_data) LOOP
      IF k = 'responsavel' AND jsonb_typeof(v) = 'object' THEN
        responsavel_seguro := jsonb_strip_nulls(jsonb_build_object(
          'nome_responsavel', COALESCE(v->>'nome_responsavel', v->>'nome'),
          'cargo', v->>'cargo', 'registro_profissional', v->>'registro_profissional',
          'aprovado_em', v->>'aprovado_em', 'assinatura_modo', v->>'assinatura_modo',
          'assinatura_storage_path', v->>'assinatura_storage_path',
          'assinatura_mime_type', v->>'assinatura_mime_type',
          'assinatura_hash_sha256', v->>'assinatura_hash_sha256'));
        out_obj := out_obj || jsonb_build_object(k, public.psico_sanitize_snapshot(responsavel_seguro));
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
END;
$$;

UPDATE public.proposal_template SET telefone = '(85) 9.9142-6534';

DO $migration$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.psico_preparar_emissao_relatorio(uuid,text,text)'::regprocedure) INTO v_definition;
  IF position('v_modelo_versao text := ''1.4.0''' IN v_definition) > 0 THEN RETURN; END IF;
  IF position('v_modelo_versao text := ''1.3.0''' IN v_definition) = 0 THEN RAISE EXCEPTION 'Versao base inesperada em psico_preparar_emissao_relatorio'; END IF;
  v_definition := replace(v_definition, 'v_modelo_versao text := ''1.3.0''', 'v_modelo_versao text := ''1.4.0''');
  EXECUTE v_definition;
END
$migration$;