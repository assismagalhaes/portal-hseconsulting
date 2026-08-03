-- =====================================================================
-- PR 6 — Parecer + Relatório individual + Gates de emissão
-- =====================================================================

-- 1) Campos de parecer/assinatura em psico_individual_revisoes
ALTER TABLE public.psico_individual_revisoes
  ADD COLUMN IF NOT EXISTS parecer jsonb,
  ADD COLUMN IF NOT EXISTS parecer_versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_codigo text,
  ADD COLUMN IF NOT EXISTS modelo_ia text,
  ADD COLUMN IF NOT EXISTS responsavel_profissional_id uuid,
  ADD COLUMN IF NOT EXISTS assinatura_storage_path text,
  ADD COLUMN IF NOT EXISTS assinatura_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS assinatura_mime_type text,
  ADD COLUMN IF NOT EXISTS imutavel boolean NOT NULL DEFAULT false;

-- 2) Tabela de relatórios individuais (versionada)
CREATE TABLE IF NOT EXISTS public.psico_ind_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  revisao_id uuid NOT NULL REFERENCES public.psico_individual_revisoes(id) ON DELETE RESTRICT,
  processamento_id uuid REFERENCES public.psico_individual_processamentos(id) ON DELETE SET NULL,
  versao integer NOT NULL DEFAULT 1,
  codigo text NOT NULL,
  codigo_validacao text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'preparando'
    CHECK (status IN ('preparando','gerando','emitido','falhou','revogado')),
  modelo_codigo text NOT NULL,
  modelo_versao text NOT NULL,
  storage_path text,
  nome_arquivo text,
  tamanho_bytes integer,
  quantidade_paginas integer,
  pdf_hash text,
  snapshot_conteudo jsonb NOT NULL,
  erro_codigo text,
  emitido_por uuid,
  emitido_em timestamptz,
  revogado_por uuid,
  revogado_em timestamptz,
  motivo_revogacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.psico_ind_relatorios TO authenticated;
GRANT ALL ON public.psico_ind_relatorios TO service_role;
ALTER TABLE public.psico_ind_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_rel_leitura_interna"
  ON public.psico_ind_relatorios FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ind_rel_aval ON public.psico_ind_relatorios(avaliacao_id, versao DESC);
CREATE INDEX IF NOT EXISTS idx_ind_rel_status ON public.psico_ind_relatorios(status);

CREATE OR REPLACE FUNCTION public.psico_ind_relatorios_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ind_rel_touch ON public.psico_ind_relatorios;
CREATE TRIGGER trg_ind_rel_touch BEFORE UPDATE ON public.psico_ind_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_relatorios_touch();

-- Bloqueio de mutação após emitido (só permite mudar para 'revogado' via RPC específica)
CREATE OR REPLACE FUNCTION public.psico_ind_relatorios_bloq_emitido()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'emitido' AND NEW.status <> 'revogado' THEN
    RAISE EXCEPTION 'relatorio_emitido_imutavel';
  END IF;
  IF OLD.status = 'revogado' THEN
    RAISE EXCEPTION 'relatorio_revogado_imutavel';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ind_rel_bloq ON public.psico_ind_relatorios;
CREATE TRIGGER trg_ind_rel_bloq BEFORE UPDATE ON public.psico_ind_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_relatorios_bloq_emitido();

-- 3) RPC: salvar parecer (persistido em revisão ativa)
CREATE OR REPLACE FUNCTION public.psico_ind_salvar_parecer(
  p_avaliacao uuid, p_parecer jsonb, p_prompt_codigo text, p_modelo_ia text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rev uuid; v_ver integer;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role'
     AND NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- garante uma revisão "em_edicao" ativa
  SELECT id INTO v_rev FROM public.psico_individual_revisoes
   WHERE avaliacao_id = p_avaliacao AND ativa = true AND status <> 'aprovada'
   ORDER BY created_at DESC LIMIT 1;

  IF v_rev IS NULL THEN
    -- desativa anteriores e cria nova
    UPDATE public.psico_individual_revisoes SET ativa = false WHERE avaliacao_id = p_avaliacao;
    INSERT INTO public.psico_individual_revisoes(avaliacao_id, status, ativa)
      VALUES (p_avaliacao, 'em_edicao', true)
      RETURNING id INTO v_rev;
  END IF;

  UPDATE public.psico_individual_revisoes
     SET parecer = p_parecer,
         parecer_versao = coalesce(parecer_versao,0) + 1,
         prompt_codigo = p_prompt_codigo,
         modelo_ia = p_modelo_ia,
         status = 'em_edicao',
         updated_at = now()
   WHERE id = v_rev
   RETURNING parecer_versao INTO v_ver;

  RETURN jsonb_build_object('revisao_id', v_rev, 'versao', v_ver);
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_salvar_parecer(uuid,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_salvar_parecer(uuid,jsonb,text,text) TO authenticated, service_role;

-- 4) RPC: aprovar revisão individual (torna imutável)
CREATE OR REPLACE FUNCTION public.psico_ind_aprovar_revisao(
  p_revisao uuid, p_responsavel_profissional uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.psico_individual_revisoes WHERE id = p_revisao;
  IF NOT FOUND THEN RAISE EXCEPTION 'revisao_nao_encontrada'; END IF;
  IF r.imutavel THEN RAISE EXCEPTION 'revisao_imutavel'; END IF;
  IF r.parecer IS NULL THEN RAISE EXCEPTION 'parecer_ausente'; END IF;
  IF p_responsavel_profissional IS NULL THEN RAISE EXCEPTION 'responsavel_obrigatorio'; END IF;

  UPDATE public.psico_individual_revisoes
     SET status = 'aprovada',
         ativa = true,
         aprovado_em = now(),
         aprovado_por = auth.uid(),
         responsavel_profissional_id = p_responsavel_profissional,
         imutavel = true,
         updated_at = now()
   WHERE id = p_revisao;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_aprovar_revisao(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_aprovar_revisao(uuid,uuid) TO authenticated, service_role;

-- 5) RPC: gates de emissão (checagem completa)
CREATE OR REPLACE FUNCTION public.psico_ind_gates_emissao(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proc RECORD;
  v_rev RECORD;
  v_plano jsonb;
  v_prio integer;
  v_diver integer;
  v_erros jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- processamento aprovado
  SELECT * INTO v_proc FROM public.psico_individual_processamentos
   WHERE avaliacao_id = p_avaliacao AND imutavel = true
   ORDER BY aprovado_em DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    v_erros := v_erros || jsonb_build_object('codigo','processamento_pendente','mensagem','Conciliação não aprovada.');
  END IF;

  -- respostas dos dois formulários existem
  IF NOT EXISTS (
    SELECT 1 FROM public.psico_individual_respostas r
     JOIN public.psico_individual_formularios f ON f.id = r.formulario_id
     WHERE f.avaliacao_id = p_avaliacao AND f.papel = 'empregado' AND f.status = 'submetido'
  ) THEN
    v_erros := v_erros || jsonb_build_object('codigo','formulario_empregado_pendente','mensagem','Formulário do empregado não submetido.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.psico_individual_respostas r
     JOIN public.psico_individual_formularios f ON f.id = r.formulario_id
     WHERE f.avaliacao_id = p_avaliacao AND f.papel = 'empregador' AND f.status = 'submetido'
  ) THEN
    v_erros := v_erros || jsonb_build_object('codigo','formulario_empregador_pendente','mensagem','Formulário do empregador não submetido.');
  END IF;

  -- divergência forte não tratada
  SELECT count(*) INTO v_diver FROM public.psico_individual_achados a
   WHERE a.avaliacao_id = p_avaliacao
     AND a.estado_convergencia = 'divergente'
     AND coalesce(a.decisao_tecnica, '') = '';
  IF v_diver > 0 THEN
    v_erros := v_erros || jsonb_build_object('codigo','divergencia_nao_tratada','mensagem', v_diver || ' achado(s) divergente(s) sem decisão técnica.');
  END IF;

  -- plano: gates
  BEGIN
    v_plano := public.psico_ind_plano_gates(p_avaliacao);
  EXCEPTION WHEN OTHERS THEN v_plano := NULL; END;

  IF v_plano IS NULL OR NOT coalesce((v_plano->>'pronto_para_aprovacao')::boolean, false) THEN
    v_erros := v_erros || jsonb_build_object('codigo','plano_pendente','mensagem','Plano de ação incompleto ou não aprovado.','detalhes', coalesce(v_plano,'{}'::jsonb));
  END IF;

  -- plano aprovado (todos itens imutáveis)
  IF EXISTS (
    SELECT 1 FROM public.psico_ind_plano_itens i
     WHERE i.avaliacao_id = p_avaliacao AND i.imutavel = false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.psico_ind_plano_itens i WHERE i.avaliacao_id = p_avaliacao
  ) THEN
    v_erros := v_erros || jsonb_build_object('codigo','plano_nao_aprovado','mensagem','O plano precisa ser aprovado (todos os itens congelados).');
  END IF;

  -- revisão + parecer + assinatura + responsável
  SELECT * INTO v_rev FROM public.psico_individual_revisoes
   WHERE avaliacao_id = p_avaliacao AND ativa = true
   ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    v_erros := v_erros || jsonb_build_object('codigo','revisao_ausente','mensagem','Nenhuma revisão técnica ativa.');
  ELSE
    IF v_rev.parecer IS NULL THEN
      v_erros := v_erros || jsonb_build_object('codigo','parecer_incompleto','mensagem','Parecer conclusivo não gerado.');
    END IF;
    IF v_rev.status <> 'aprovada' OR v_rev.imutavel IS NOT TRUE THEN
      v_erros := v_erros || jsonb_build_object('codigo','revisao_nao_aprovada','mensagem','Revisão técnica ainda não aprovada.');
    END IF;
    IF v_rev.responsavel_profissional_id IS NULL THEN
      v_erros := v_erros || jsonb_build_object('codigo','responsavel_ausente','mensagem','Responsável técnico não definido.');
    END IF;
    IF v_rev.assinatura_storage_path IS NULL THEN
      v_erros := v_erros || jsonb_build_object('codigo','assinatura_ausente','mensagem','Assinatura do responsável não anexada.');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pode_emitir', jsonb_array_length(v_erros) = 0,
    'erros', v_erros,
    'plano_gates', v_plano,
    'revisao_id', (SELECT id FROM public.psico_individual_revisoes WHERE avaliacao_id = p_avaliacao AND ativa = true ORDER BY created_at DESC LIMIT 1),
    'processamento_id', (v_proc.id)
  );
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_gates_emissao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_gates_emissao(uuid) TO authenticated, service_role;

-- 6) RPC: snapshot sanitizado para o relatório
CREATE OR REPLACE FUNCTION public.psico_ind_snapshot_relatorio(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'avaliacao', jsonb_build_object(
      'id', av.id, 'codigo', av.codigo, 'titulo', av.titulo,
      'modalidade', av.modalidade, 'unidade', av.unidade,
      'data_referencia', av.data_referencia
    ),
    'empresa', jsonb_build_object(
      'razao_social', c.razao_social, 'nome_fantasia', c.nome_fantasia,
      'cnpj_cpf', c.cnpj_cpf, 'porte', c.porte,
      'cnae_principal', c.cnae_principal, 'qtd_funcionarios', c.qtd_funcionarios,
      'cidade', c.cidade, 'uf', c.uf
    ),
    'processamento', jsonb_build_object(
      'id', p.id, 'engine_versao', p.engine_versao,
      'versao_regra', p.versao_regra, 'aprovado_em', p.aprovado_em
    ),
    'achados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'fator_codigo', a.fator_codigo, 'perigo_codigo', a.perigo_codigo,
        'condicao_preliminar', a.condicao_preliminar, 'nivel_evidencia', a.nivel_evidencia,
        'estado_convergencia', a.estado_convergencia, 'estado_final', a.estado_final,
        'frequencia_exposicao', a.frequencia_exposicao, 'intensidade_exigencia', a.intensidade_exigencia,
        'controle_existente', a.controle_existente, 'eficacia_controle', a.eficacia_controle,
        'necessita_acao', a.necessita_acao,
        'fundamentacao_sanitizada', a.fundamentacao_sanitizada,
        'justificativa_alteracao', a.justificativa_alteracao,
        'regra_codigo', a.regra_codigo, 'regra_versao', a.regra_versao
      ) ORDER BY (a.estado_final='prioritario') DESC, a.fator_codigo)
      FROM public.psico_individual_achados a
      WHERE a.avaliacao_id = p_avaliacao AND a.processamento_id = p.id
    ), '[]'::jsonb),
    'plano', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'achado_id', i.achado_id, 'fator_codigo', i.fator_codigo,
        'origem', i.origem, 'titulo', i.titulo, 'objetivo', i.objetivo,
        'acao', i.acao_recomendada,
        'responsavel', coalesce(i.responsavel_definido, i.responsavel_sugerido),
        'prazo', coalesce(to_char(i.prazo_definido,'YYYY-MM-DD'), (i.prazo_sugerido_dias||' dias')),
        'evidencia', coalesce(i.evidencia_definida, i.evidencia_recomendada),
        'indicador', i.indicador_eficacia, 'justificativa', i.justificativa
      ) ORDER BY i.fator_codigo, i.ordem)
      FROM public.psico_ind_plano_itens i
      WHERE i.avaliacao_id = p_avaliacao AND i.imutavel = true
    ), '[]'::jsonb),
    'revisao', jsonb_build_object(
      'id', rv.id, 'parecer', rv.parecer,
      'prompt_codigo', rv.prompt_codigo, 'modelo_ia', rv.modelo_ia,
      'parecer_versao', rv.parecer_versao,
      'aprovado_em', rv.aprovado_em,
      'responsavel', jsonb_build_object(
        'profissional_id', rv.responsavel_profissional_id,
        'nome_responsavel', coalesce(prof.nome, prf.full_name),
        'cargo', coalesce(prof.cargo, prf.cargo),
        'registro_profissional', prof.registro_profissional,
        'assinatura_storage_path', rv.assinatura_storage_path,
        'assinatura_mime_type', rv.assinatura_mime_type,
        'assinatura_hash_sha256', rv.assinatura_hash_sha256
      )
    )
  ) INTO v_out
  FROM public.psico_avaliacoes av
  JOIN public.clients c ON c.id = av.client_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.psico_individual_processamentos pp
     WHERE pp.avaliacao_id = av.id AND pp.imutavel = true
     ORDER BY pp.aprovado_em DESC NULLS LAST LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT * FROM public.psico_individual_revisoes r
     WHERE r.avaliacao_id = av.id AND r.ativa = true
     ORDER BY r.created_at DESC LIMIT 1
  ) rv ON true
  LEFT JOIN public.execucao_profissionais prof ON prof.id = rv.responsavel_profissional_id
  LEFT JOIN public.profiles prf ON prf.id = rv.responsavel_profissional_id
  WHERE av.id = p_avaliacao;

  IF v_out IS NULL THEN RAISE EXCEPTION 'avaliacao_nao_encontrada'; END IF;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_snapshot_relatorio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_snapshot_relatorio(uuid) TO service_role;

-- 7) RPC: preparar emissão (cria versão, valida gates, retorna código de validação)
CREATE OR REPLACE FUNCTION public.psico_ind_preparar_relatorio(
  p_avaliacao uuid, p_modelo_codigo text, p_modelo_versao text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gates jsonb; v_snap jsonb; v_id uuid; v_rev uuid; v_proc uuid;
  v_versao integer; v_codigo text; v_val text; v_aval RECORD;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role'
     AND NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_gates := public.psico_ind_gates_emissao(p_avaliacao);
  IF NOT coalesce((v_gates->>'pode_emitir')::boolean, false) THEN
    RAISE EXCEPTION 'gates_nao_atendidos: %', v_gates::text;
  END IF;

  v_rev := (v_gates->>'revisao_id')::uuid;
  v_proc := (v_gates->>'processamento_id')::uuid;

  -- monta snapshot (service_role bypass — chamamos via SECURITY DEFINER)
  PERFORM set_config('role', 'service_role', true); -- no-op: SECURITY DEFINER já roda como owner
  SELECT public.psico_ind_snapshot_relatorio(p_avaliacao) INTO v_snap;

  SELECT * INTO v_aval FROM public.psico_avaliacoes WHERE id = p_avaliacao;
  SELECT coalesce(max(versao),0) + 1 INTO v_versao FROM public.psico_ind_relatorios
   WHERE avaliacao_id = p_avaliacao;

  v_codigo := 'RAFPI-' || coalesce(v_aval.codigo, substr(p_avaliacao::text,1,8)) || '-R' || lpad(v_versao::text,2,'0');
  v_val := encode(gen_random_bytes(9), 'hex');

  INSERT INTO public.psico_ind_relatorios(
    avaliacao_id, revisao_id, processamento_id, versao,
    codigo, codigo_validacao, status,
    modelo_codigo, modelo_versao, snapshot_conteudo
  ) VALUES (
    p_avaliacao, v_rev, v_proc, v_versao,
    v_codigo, v_val, 'preparando',
    p_modelo_codigo, p_modelo_versao, v_snap
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id, 'versao', v_versao,
    'codigo', v_codigo, 'codigo_validacao', v_val
  );
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_preparar_relatorio(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_preparar_relatorio(uuid,text,text) TO service_role;

-- 8) RPC: concluir emissão
CREATE OR REPLACE FUNCTION public.psico_ind_concluir_relatorio(
  p_id uuid, p_storage_path text, p_nome_arquivo text,
  p_tamanho_bytes integer, p_quantidade_paginas integer,
  p_pdf_hash text, p_emitido_por uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.psico_ind_relatorios
     SET status = 'emitido',
         storage_path = p_storage_path,
         nome_arquivo = p_nome_arquivo,
         tamanho_bytes = p_tamanho_bytes,
         quantidade_paginas = p_quantidade_paginas,
         pdf_hash = p_pdf_hash,
         emitido_por = p_emitido_por,
         emitido_em = now(),
         updated_at = now()
   WHERE id = p_id AND status IN ('preparando','gerando');
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_concluir_relatorio(uuid,text,text,integer,integer,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_concluir_relatorio(uuid,text,text,integer,integer,text,uuid) TO service_role;

-- 9) RPC: falhar emissão
CREATE OR REPLACE FUNCTION public.psico_ind_falhar_relatorio(p_id uuid, p_erro text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.psico_ind_relatorios
     SET status = 'falhou', erro_codigo = p_erro, updated_at = now()
   WHERE id = p_id AND status IN ('preparando','gerando');
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_falhar_relatorio(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_falhar_relatorio(uuid,text) TO service_role;

-- 10) RPC: listar relatórios individuais
CREATE OR REPLACE FUNCTION public.psico_ind_listar_relatorios(p_avaliacao uuid)
RETURNS SETOF public.psico_ind_relatorios
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.psico_ind_relatorios
   WHERE avaliacao_id = p_avaliacao
     AND public.can_see_internal(auth.uid())
   ORDER BY versao DESC;
$$;
REVOKE ALL ON FUNCTION public.psico_ind_listar_relatorios(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_listar_relatorios(uuid) TO authenticated, service_role;