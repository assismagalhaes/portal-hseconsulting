
-- =============================================================
-- FASE 5 · BLOCO 2 — TABELAS DE RESULTADOS E CLASSIFICAÇÃO
-- =============================================================

-- 0) Colunas novas em psico_avaliacoes -------------------------
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS processamento_resultado_ativo_id uuid,
  ADD COLUMN IF NOT EXISTS resultado_processado_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_processado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS versao_motor_resultado text;

-- 1) Enums usados pelas tabelas de resultados -----------------
DO $$ BEGIN
  CREATE TYPE public.psico_resultado_proc_status AS ENUM
    ('processando','concluido','falhou','substituido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_resultado_escopo_tipo AS ENUM
    ('global','funcao','setor','unidade');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_classificacao_risco AS ENUM
    ('Risco Irrelevante','Risco Baixo','Risco Médio','Risco Alto','Risco Crítico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_prioridade_fator AS ENUM
    ('Monitoramento','Média','Alta','Crítica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) psico_resultado_processamentos ---------------------------
CREATE TABLE IF NOT EXISTS public.psico_resultado_processamentos (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id                uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  questionario_versao_id      uuid NOT NULL REFERENCES public.psico_questionarios_versoes(id) ON DELETE RESTRICT,
  metodologia_versao_id       uuid NOT NULL REFERENCES public.psico_metodologias_versoes(id) ON DELETE RESTRICT,
  versao_motor                text NOT NULL,
  status                      public.psico_resultado_proc_status NOT NULL DEFAULT 'processando',
  hash_entrada                text NOT NULL,
  total_respondentes          integer NOT NULL DEFAULT 0,
  total_itens                 integer NOT NULL DEFAULT 0,
  total_escopos               integer NOT NULL DEFAULT 0,
  escopos_funcao_elegiveis    integer NOT NULL DEFAULT 0,
  escopos_setor_elegiveis     integer NOT NULL DEFAULT 0,
  escopos_unidade_elegiveis   integer NOT NULL DEFAULT 0,
  escopos_suprimidos          integer NOT NULL DEFAULT 0,
  ativo                       boolean NOT NULL DEFAULT false,
  iniciado_por                uuid REFERENCES auth.users(id),
  iniciado_em                 timestamptz NOT NULL DEFAULT now(),
  concluido_em                timestamptz,
  substituido_em              timestamptz,
  erro_codigo                 text,
  metadados                   jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS psico_res_proc_ativo_uniq
  ON public.psico_resultado_processamentos (avaliacao_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS psico_res_proc_aval_idx
  ON public.psico_resultado_processamentos (avaliacao_id, iniciado_em DESC);
CREATE INDEX IF NOT EXISTS psico_res_proc_hash_idx
  ON public.psico_resultado_processamentos (avaliacao_id, hash_entrada, versao_motor);

GRANT SELECT ON public.psico_resultado_processamentos TO authenticated;
GRANT ALL ON public.psico_resultado_processamentos TO service_role;
ALTER TABLE public.psico_resultado_processamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_res_proc_select_interno"
  ON public.psico_resultado_processamentos FOR SELECT
  TO authenticated USING (public.can_see_internal(auth.uid()));

-- FK para a coluna adicionada em psico_avaliacoes
ALTER TABLE public.psico_avaliacoes
  DROP CONSTRAINT IF EXISTS psico_aval_proc_ativo_fk;
ALTER TABLE public.psico_avaliacoes
  ADD CONSTRAINT psico_aval_proc_ativo_fk
  FOREIGN KEY (processamento_resultado_ativo_id)
  REFERENCES public.psico_resultado_processamentos(id) ON DELETE SET NULL;

-- 3) psico_resultado_escopos ----------------------------------
CREATE TABLE IF NOT EXISTS public.psico_resultado_escopos (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processamento_id          uuid NOT NULL REFERENCES public.psico_resultado_processamentos(id) ON DELETE CASCADE,
  tipo                      public.psico_resultado_escopo_tipo NOT NULL,
  chave_normalizada         text,
  rotulo                    text NOT NULL,
  respondentes              integer NOT NULL,
  participantes_elegiveis   integer,
  percentual_participacao   numeric(18,6),
  minimo_aplicado           integer NOT NULL,
  total_itens               integer NOT NULL,
  indice_geral_descritivo   numeric(18,6) NOT NULL,
  classificacao_indice_geral public.psico_classificacao_risco NOT NULL,
  fatores_significativos    integer NOT NULL DEFAULT 0,
  prioridade_maxima         public.psico_prioridade_fator NOT NULL DEFAULT 'Monitoramento',
  amostra_reduzida          boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Único global por processamento
CREATE UNIQUE INDEX IF NOT EXISTS psico_res_esc_global_uniq
  ON public.psico_resultado_escopos (processamento_id) WHERE tipo = 'global';
-- Uniqueness per tipo+chave
CREATE UNIQUE INDEX IF NOT EXISTS psico_res_esc_chave_uniq
  ON public.psico_resultado_escopos (processamento_id, tipo, chave_normalizada)
  WHERE chave_normalizada IS NOT NULL;
CREATE INDEX IF NOT EXISTS psico_res_esc_proc_idx
  ON public.psico_resultado_escopos (processamento_id, tipo);

GRANT SELECT ON public.psico_resultado_escopos TO authenticated;
GRANT ALL ON public.psico_resultado_escopos TO service_role;
ALTER TABLE public.psico_resultado_escopos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_res_esc_select_interno"
  ON public.psico_resultado_escopos FOR SELECT
  TO authenticated USING (public.can_see_internal(auth.uid()));

-- 4) psico_resultados_fatores ---------------------------------
CREATE TABLE IF NOT EXISTS public.psico_resultados_fatores (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo_id                   uuid NOT NULL REFERENCES public.psico_resultado_escopos(id) ON DELETE CASCADE,
  fator_id                    uuid NOT NULL REFERENCES public.psico_fatores(id) ON DELETE RESTRICT,
  ordem                       integer NOT NULL,
  quantidade_perguntas        integer NOT NULL,
  total_respostas_validas     integer NOT NULL,
  soma_pesos                  numeric(18,6) NOT NULL,
  score_medio                 numeric(18,6) NOT NULL,
  classificacao_media         public.psico_classificacao_risco NOT NULL,
  quantidade_irrelevante      integer NOT NULL DEFAULT 0,
  quantidade_baixo            integer NOT NULL DEFAULT 0,
  quantidade_medio            integer NOT NULL DEFAULT 0,
  quantidade_alto             integer NOT NULL DEFAULT 0,
  quantidade_critico          integer NOT NULL DEFAULT 0,
  percentual_irrelevante      numeric(18,6) NOT NULL DEFAULT 0,
  percentual_baixo            numeric(18,6) NOT NULL DEFAULT 0,
  percentual_medio            numeric(18,6) NOT NULL DEFAULT 0,
  percentual_alto             numeric(18,6) NOT NULL DEFAULT 0,
  percentual_critico          numeric(18,6) NOT NULL DEFAULT 0,
  percentual_medio_alto_critico numeric(18,6) NOT NULL DEFAULT 0,
  percentual_alto_critico     numeric(18,6) NOT NULL DEFAULT 0,
  criterio_principal          boolean NOT NULL DEFAULT false,
  criterio_agravamento        boolean NOT NULL DEFAULT false,
  criterio_critico_automatico boolean NOT NULL DEFAULT false,
  criterios_acionados         text[] NOT NULL DEFAULT '{}',
  significativo               boolean NOT NULL DEFAULT false,
  prioridade                  public.psico_prioridade_fator NOT NULL DEFAULT 'Monitoramento',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escopo_id, fator_id)
);

CREATE INDEX IF NOT EXISTS psico_res_fat_esc_idx
  ON public.psico_resultados_fatores (escopo_id, ordem);

GRANT SELECT ON public.psico_resultados_fatores TO authenticated;
GRANT ALL ON public.psico_resultados_fatores TO service_role;
ALTER TABLE public.psico_resultados_fatores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_res_fat_select_interno"
  ON public.psico_resultados_fatores FOR SELECT
  TO authenticated USING (public.can_see_internal(auth.uid()));

-- 5) psico_resultados_perguntas -------------------------------
CREATE TABLE IF NOT EXISTS public.psico_resultados_perguntas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo_id                   uuid NOT NULL REFERENCES public.psico_resultado_escopos(id) ON DELETE CASCADE,
  pergunta_id                 uuid NOT NULL REFERENCES public.psico_perguntas(id) ON DELETE RESTRICT,
  fator_id                    uuid REFERENCES public.psico_fatores(id) ON DELETE SET NULL,
  numero                      integer NOT NULL,
  total_respostas_validas     integer NOT NULL,
  soma_pesos                  numeric(18,6) NOT NULL,
  score_medio                 numeric(18,6) NOT NULL,
  classificacao_media         public.psico_classificacao_risco NOT NULL,
  quantidade_nunca            integer NOT NULL DEFAULT 0,
  quantidade_raramente        integer NOT NULL DEFAULT 0,
  quantidade_as_vezes         integer NOT NULL DEFAULT 0,
  quantidade_frequentemente   integer NOT NULL DEFAULT 0,
  quantidade_sempre           integer NOT NULL DEFAULT 0,
  percentual_nunca            numeric(18,6) NOT NULL DEFAULT 0,
  percentual_raramente        numeric(18,6) NOT NULL DEFAULT 0,
  percentual_as_vezes         numeric(18,6) NOT NULL DEFAULT 0,
  percentual_frequentemente   numeric(18,6) NOT NULL DEFAULT 0,
  percentual_sempre           numeric(18,6) NOT NULL DEFAULT 0,
  quantidade_peso_0           integer NOT NULL DEFAULT 0,
  quantidade_peso_1           integer NOT NULL DEFAULT 0,
  quantidade_peso_2           integer NOT NULL DEFAULT 0,
  quantidade_peso_3           integer NOT NULL DEFAULT 0,
  quantidade_peso_4           integer NOT NULL DEFAULT 0,
  percentual_peso_0           numeric(18,6) NOT NULL DEFAULT 0,
  percentual_peso_1           numeric(18,6) NOT NULL DEFAULT 0,
  percentual_peso_2           numeric(18,6) NOT NULL DEFAULT 0,
  percentual_peso_3           numeric(18,6) NOT NULL DEFAULT 0,
  percentual_peso_4           numeric(18,6) NOT NULL DEFAULT 0,
  percentual_desfavoravel     numeric(18,6) NOT NULL DEFAULT 0,
  percentual_alto_critico     numeric(18,6) NOT NULL DEFAULT 0,
  percentual_critico          numeric(18,6) NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escopo_id, pergunta_id)
);

CREATE INDEX IF NOT EXISTS psico_res_perg_esc_idx
  ON public.psico_resultados_perguntas (escopo_id, numero);

GRANT SELECT ON public.psico_resultados_perguntas TO authenticated;
GRANT ALL ON public.psico_resultados_perguntas TO service_role;
ALTER TABLE public.psico_resultados_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_res_perg_select_interno"
  ON public.psico_resultados_perguntas FOR SELECT
  TO authenticated USING (public.can_see_internal(auth.uid()));

-- 6) FUNÇÃO: classificar score ---------------------------------
CREATE OR REPLACE FUNCTION public.psico_classificar_score(
  p_metodologia_versao_id uuid,
  p_score numeric
) RETURNS public.psico_classificacao_risco
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.psico_metodologias_versoes%ROWTYPE;
BEGIN
  IF p_score IS NULL THEN
    RAISE EXCEPTION 'Score nulo.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_score < 0 OR p_score > 4 THEN
    RAISE EXCEPTION 'Score fora do intervalo válido (0..4): %', p_score
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO m FROM public.psico_metodologias_versoes WHERE id = p_metodologia_versao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Metodologia inexistente.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Aplica limites gravados na metodologia (menor-ou-igual: faixa fechada à direita)
  IF p_score <= COALESCE(m.faixa_irrelevante_max, 0.80) THEN
    RETURN 'Risco Irrelevante'::public.psico_classificacao_risco;
  ELSIF p_score <= COALESCE(m.faixa_baixo_max, 1.60) THEN
    RETURN 'Risco Baixo'::public.psico_classificacao_risco;
  ELSIF p_score <= COALESCE(m.faixa_medio_max, 2.40) THEN
    RETURN 'Risco Médio'::public.psico_classificacao_risco;
  ELSIF p_score <= COALESCE(m.faixa_alto_max, 3.20) THEN
    RETURN 'Risco Alto'::public.psico_classificacao_risco;
  ELSE
    RETURN 'Risco Crítico'::public.psico_classificacao_risco;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_classificar_score(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_classificar_score(uuid, numeric) TO authenticated, service_role;

-- 7) TRIGGERS DE IMUTABILIDADE --------------------------------
-- Regra: uma vez que o processamento estiver "concluido", nem ele
-- nem seus escopos/resultados podem ser alterados ou deletados.

CREATE OR REPLACE FUNCTION public.psico_res_proc_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'concluido' THEN
      RAISE EXCEPTION 'Processamento concluído é imutável.' USING ERRCODE='check_violation';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.status = 'concluido' THEN
    -- Só permitimos marcar como "substituido" (para futura reprocessamento admin)
    IF NEW.status = 'substituido' AND OLD.status = 'concluido'
       AND NEW.hash_entrada = OLD.hash_entrada
       AND NEW.total_respondentes = OLD.total_respondentes
       AND NEW.total_itens = OLD.total_itens
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processamento concluído é imutável.' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_res_proc_imut ON public.psico_resultado_processamentos;
CREATE TRIGGER trg_psico_res_proc_imut
BEFORE UPDATE OR DELETE ON public.psico_resultado_processamentos
FOR EACH ROW EXECUTE FUNCTION public.psico_res_proc_imutavel();

-- Genérica p/ tabelas-filhas: se o processamento pai está concluído, bloquear
CREATE OR REPLACE FUNCTION public.psico_res_filho_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc uuid;
  v_status public.psico_resultado_proc_status;
BEGIN
  IF TG_TABLE_NAME = 'psico_resultado_escopos' THEN
    v_proc := COALESCE(OLD.processamento_id, NEW.processamento_id);
  ELSE
    SELECT e.processamento_id INTO v_proc
      FROM public.psico_resultado_escopos e
     WHERE e.id = COALESCE(OLD.escopo_id, NEW.escopo_id);
  END IF;

  IF v_proc IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO v_status
    FROM public.psico_resultado_processamentos WHERE id = v_proc;

  IF v_status = 'concluido' THEN
    RAISE EXCEPTION 'Resultado do processamento concluído é imutável.'
      USING ERRCODE='check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_res_esc_imut ON public.psico_resultado_escopos;
CREATE TRIGGER trg_psico_res_esc_imut
BEFORE UPDATE OR DELETE ON public.psico_resultado_escopos
FOR EACH ROW EXECUTE FUNCTION public.psico_res_filho_imutavel();

DROP TRIGGER IF EXISTS trg_psico_res_fat_imut ON public.psico_resultados_fatores;
CREATE TRIGGER trg_psico_res_fat_imut
BEFORE UPDATE OR DELETE ON public.psico_resultados_fatores
FOR EACH ROW EXECUTE FUNCTION public.psico_res_filho_imutavel();

DROP TRIGGER IF EXISTS trg_psico_res_perg_imut ON public.psico_resultados_perguntas;
CREATE TRIGGER trg_psico_res_perg_imut
BEFORE UPDATE OR DELETE ON public.psico_resultados_perguntas
FOR EACH ROW EXECUTE FUNCTION public.psico_res_filho_imutavel();

-- updated_at nos processamentos
CREATE TRIGGER trg_psico_res_proc_upd
BEFORE UPDATE ON public.psico_resultado_processamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Correção: auditoria da RPC do Bloco 1 usava colunas erradas
CREATE OR REPLACE FUNCTION public.psico_corrigir_participante_pos_coleta(
  p_participante_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_justificativa text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.psico_participantes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta correção.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_justificativa IS NULL OR btrim(p_justificativa) = '' OR length(p_justificativa) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_row FROM public.psico_participantes WHERE id = p_participante_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM set_config('psico.admin_correcao', 'on', true);
  BEGIN
    UPDATE public.psico_participantes
       SET nome = p_nome,
           email = NULLIF(btrim(p_email), ''),
           telefone = NULLIF(btrim(p_telefone), ''),
           nome_normalizado = lower(btrim(p_nome)),
           email_normalizado = lower(NULLIF(btrim(p_email), '')),
           telefone_normalizado = regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'),
           atualizado_por = v_uid,
           updated_at = now()
     WHERE id = p_participante_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('psico.admin_correcao', 'off', true);
    RAISE;
  END;
  PERFORM set_config('psico.admin_correcao', 'off', true);

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('psico_participante', p_participante_id, 'participante_correcao_pos_coleta', v_uid,
          jsonb_build_object(
            'avaliacao_id', v_row.avaliacao_id,
            'justificativa', p_justificativa
          ));

  RETURN jsonb_build_object('ok', true, 'participante_id', p_participante_id);
END;
$$;

COMMENT ON TABLE public.psico_resultado_processamentos IS 'Cada execução do motor de cálculo dos resultados (versionada e imutável quando concluída).';
COMMENT ON TABLE public.psico_resultado_escopos IS 'Escopos analisados (global ou segmentação elegível) dentro de um processamento.';
COMMENT ON TABLE public.psico_resultados_fatores IS 'Resultado consolidado por fator dentro de um escopo.';
COMMENT ON TABLE public.psico_resultados_perguntas IS 'Resultado por pergunta dentro de um escopo.';
COMMENT ON FUNCTION public.psico_classificar_score IS 'Classifica score 0..4 nas faixas gravadas na versão da metodologia.';
