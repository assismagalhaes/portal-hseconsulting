
-- =============================================================
-- FASE 5 — BLOQUEIO PÓS-ENCERRAMENTO DA COLETA
-- =============================================================

-- Helper: avaliação está em estado bloqueado?
CREATE OR REPLACE FUNCTION public.psico_avaliacao_bloqueada(_avaliacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.psico_avaliacoes
    WHERE id = _avaliacao_id
      AND status IN ('coleta_encerrada','resultado_pronto','relatorio_emitido')
  );
$$;

-- Helper: flag de sessão para permitir correção administrativa
CREATE OR REPLACE FUNCTION public.psico_admin_correcao_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('psico.admin_correcao', true), '') = 'on';
$$;

-- =============================================================
-- PARTICIPANTES
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_participantes_bloqueio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aval uuid;
BEGIN
  v_aval := COALESCE(NEW.avaliacao_id, OLD.avaliacao_id);
  IF NOT public.psico_avaliacao_bloqueada(v_aval) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Após encerramento: INSERT e DELETE sempre bloqueados
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'A coleta foi encerrada. Os participantes, os dados de segmentação e as respostas estão bloqueados para preservar a integridade dos resultados.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A coleta foi encerrada. Os participantes, os dados de segmentação e as respostas estão bloqueados para preservar a integridade dos resultados.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: só correção administrativa (nome/email/telefone) via RPC segura
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.psico_admin_correcao_ativa() THEN
      RAISE EXCEPTION 'A coleta foi encerrada. Os participantes, os dados de segmentação e as respostas estão bloqueados para preservar a integridade dos resultados.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Campos que NÃO podem mudar mesmo em correção administrativa
    IF NEW.avaliacao_id IS DISTINCT FROM OLD.avaliacao_id
       OR NEW.funcao IS DISTINCT FROM OLD.funcao
       OR NEW.setor IS DISTINCT FROM OLD.setor
       OR NEW.unidade IS DISTINCT FROM OLD.unidade
       OR NEW.funcao_normalizada IS DISTINCT FROM OLD.funcao_normalizada
       OR NEW.setor_normalizada IS DISTINCT FROM OLD.setor_normalizada
       OR NEW.unidade_normalizada IS DISTINCT FROM OLD.unidade_normalizada
       OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.origem_cadastro IS DISTINCT FROM OLD.origem_cadastro
       OR NEW.importacao_id IS DISTINCT FROM OLD.importacao_id
    THEN
      RAISE EXCEPTION 'Após o encerramento só é permitida correção administrativa de nome, e-mail e telefone.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_part_bloqueio ON public.psico_participantes;
CREATE TRIGGER trg_psico_part_bloqueio
BEFORE INSERT OR UPDATE OR DELETE ON public.psico_participantes
FOR EACH ROW EXECUTE FUNCTION public.psico_participantes_bloqueio();

-- =============================================================
-- CONVITES
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_convites_bloqueio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aval uuid;
BEGIN
  v_aval := COALESCE(NEW.avaliacao_id, OLD.avaliacao_id);
  IF NOT public.psico_avaliacao_bloqueada(v_aval) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Após encerramento, convites ficam imutáveis (nada de preparar/regenerar/revogar/apagar)
  RAISE EXCEPTION 'A coleta foi encerrada. Os convites estão bloqueados para preservar a integridade dos resultados.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_conv_bloqueio ON public.psico_convites;
CREATE TRIGGER trg_psico_conv_bloqueio
BEFORE INSERT OR UPDATE OR DELETE ON public.psico_convites
FOR EACH ROW EXECUTE FUNCTION public.psico_convites_bloqueio();

-- =============================================================
-- AVALIAÇÃO — bloquear troca de questionário/metodologia/prazo/status
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_avaliacoes_bloqueio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só nos importa quando o estado ANTERIOR já era bloqueado
  IF OLD.status NOT IN ('coleta_encerrada','resultado_pronto','relatorio_emitido') THEN
    RETURN NEW;
  END IF;

  -- Bloquear reabertura direta da coleta via UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('rascunho','coleta_em_andamento')
  THEN
    RAISE EXCEPTION 'A coleta foi encerrada. Não é possível reabrir a coleta alterando o status diretamente.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloquear troca de questionário/metodologia/prazo
  IF NEW.questionario_versao_id IS DISTINCT FROM OLD.questionario_versao_id
     OR NEW.metodologia_versao_id IS DISTINCT FROM OLD.metodologia_versao_id
     OR NEW.coleta_expira_em IS DISTINCT FROM OLD.coleta_expira_em
  THEN
    RAISE EXCEPTION 'A coleta foi encerrada. Questionário, metodologia e prazo da coleta estão bloqueados.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_aval_bloqueio ON public.psico_avaliacoes;
CREATE TRIGGER trg_psico_aval_bloqueio
BEFORE UPDATE ON public.psico_avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.psico_avaliacoes_bloqueio();

-- =============================================================
-- RPC: correção administrativa de contato pós-encerramento
-- =============================================================
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

  -- Auditoria (best-effort — tabela pode ter colunas variáveis)
  BEGIN
    INSERT INTO public.psico_auditoria (avaliacao_id, acao, usuario_id, detalhes, criado_em)
    VALUES (v_row.avaliacao_id, 'participante_correcao_pos_coleta', v_uid,
            jsonb_build_object(
              'participante_id', p_participante_id,
              'justificativa', p_justificativa
            ), now());
  EXCEPTION WHEN OTHERS THEN
    -- não bloquear correção se schema de auditoria divergir
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'participante_id', p_participante_id);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_corrigir_participante_pos_coleta(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_corrigir_participante_pos_coleta(uuid, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.psico_avaliacao_bloqueada IS 'Retorna true quando a avaliação está em coleta_encerrada/resultado_pronto/relatorio_emitido.';
COMMENT ON FUNCTION public.psico_corrigir_participante_pos_coleta IS 'Correção administrativa de nome/e-mail/telefone após encerramento da coleta. Exige justificativa.';
