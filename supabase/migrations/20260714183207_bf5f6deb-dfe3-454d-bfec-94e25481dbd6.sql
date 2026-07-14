
-- =========================================================
-- FASE 4 — Abertura, submissão confidencial e encerramento
-- =========================================================

-- ---------- 1. Novos campos em psico_avaliacoes ----------
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS coleta_aberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS coleta_aberta_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS coleta_encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS coleta_encerrada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_encerramento text,
  ADD COLUMN IF NOT EXISTS coleta_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS quantidade_participantes_abertura integer,
  ADD COLUMN IF NOT EXISTS quantidade_convites_abertura integer,
  ADD COLUMN IF NOT EXISTS coleta_prorrogada_em timestamptz,
  ADD COLUMN IF NOT EXISTS coleta_prorrogada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_prorrogacao text;

-- ---------- 2. Tabela psico_respostas ----------
CREATE TABLE IF NOT EXISTS public.psico_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  questionario_versao_id uuid NOT NULL REFERENCES public.psico_questionarios_versoes(id) ON DELETE RESTRICT,
  metodologia_versao_id uuid NOT NULL REFERENCES public.psico_metodologias_versoes(id) ON DELETE RESTRICT,
  funcao text,
  setor text,
  unidade text,
  funcao_normalizada text,
  setor_normalizado text,
  unidade_normalizada text,
  data_resposta date NOT NULL,
  versao_aviso_confidencialidade text,
  quantidade_itens integer NOT NULL DEFAULT 35 CHECK (quantidade_itens = 35)
);

GRANT ALL ON public.psico_respostas TO service_role;
-- authenticated NÃO tem grants → sem acesso direto
ALTER TABLE public.psico_respostas ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy → tudo bloqueado exceto service_role via bypass

CREATE INDEX IF NOT EXISTS psico_respostas_aval_idx ON public.psico_respostas(avaliacao_id);
CREATE INDEX IF NOT EXISTS psico_respostas_quest_idx ON public.psico_respostas(questionario_versao_id);
CREATE INDEX IF NOT EXISTS psico_respostas_metod_idx ON public.psico_respostas(metodologia_versao_id);
CREATE INDEX IF NOT EXISTS psico_respostas_data_idx ON public.psico_respostas(data_resposta);
CREATE INDEX IF NOT EXISTS psico_respostas_fun_idx ON public.psico_respostas(funcao_normalizada);
CREATE INDEX IF NOT EXISTS psico_respostas_set_idx ON public.psico_respostas(setor_normalizado);
CREATE INDEX IF NOT EXISTS psico_respostas_uni_idx ON public.psico_respostas(unidade_normalizada);

-- ---------- 3. Tabela psico_respostas_itens ----------
CREATE TABLE IF NOT EXISTS public.psico_respostas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.psico_respostas(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.psico_perguntas(id) ON DELETE RESTRICT,
  opcao_resposta_id uuid NOT NULL REFERENCES public.psico_opcoes_resposta(id) ON DELETE RESTRICT,
  UNIQUE (resposta_id, pergunta_id)
);

GRANT ALL ON public.psico_respostas_itens TO service_role;
ALTER TABLE public.psico_respostas_itens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_resp_itens_resp_idx ON public.psico_respostas_itens(resposta_id);
CREATE INDEX IF NOT EXISTS psico_resp_itens_perg_idx ON public.psico_respostas_itens(pergunta_id);

-- ---------- 4. Trigger de imutabilidade ----------
CREATE OR REPLACE FUNCTION public.psico_respostas_bloquear_edicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Respostas psicossociais são imutáveis após o envio.';
END $$;

DROP TRIGGER IF EXISTS trg_psico_respostas_no_update ON public.psico_respostas;
CREATE TRIGGER trg_psico_respostas_no_update
BEFORE UPDATE OR DELETE ON public.psico_respostas
FOR EACH ROW EXECUTE FUNCTION public.psico_respostas_bloquear_edicao();

DROP TRIGGER IF EXISTS trg_psico_respostas_itens_no_update ON public.psico_respostas_itens;
CREATE TRIGGER trg_psico_respostas_itens_no_update
BEFORE UPDATE OR DELETE ON public.psico_respostas_itens
FOR EACH ROW EXECUTE FUNCTION public.psico_respostas_bloquear_edicao();

-- ---------- 5. Constraint deferrable: exatamente 35 itens ----------
CREATE OR REPLACE FUNCTION public.psico_respostas_validar_35()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_min integer;
  v_max integer;
  v_distinct integer;
  v_quest uuid;
  v_metod uuid;
  v_bad integer;
BEGIN
  SELECT questionario_versao_id, metodologia_versao_id
    INTO v_quest, v_metod
    FROM public.psico_respostas WHERE id = NEW.resposta_id;

  IF v_quest IS NULL THEN
    RAISE EXCEPTION 'Resposta base inexistente ao validar itens.';
  END IF;

  -- valida quantidade
  SELECT count(*), min(p.numero), max(p.numero), count(DISTINCT p.numero)
    INTO v_count, v_min, v_max, v_distinct
    FROM public.psico_respostas_itens i
    JOIN public.psico_perguntas p ON p.id = i.pergunta_id
    WHERE i.resposta_id = NEW.resposta_id;

  IF v_count <> 35 THEN
    RAISE EXCEPTION 'Submissão inválida: são exigidos exatamente 35 itens (recebidos %).', v_count;
  END IF;
  IF v_min <> 1 OR v_max <> 35 OR v_distinct <> 35 THEN
    RAISE EXCEPTION 'Submissão inválida: numeração das perguntas deve ser 1..35 sem duplicidades.';
  END IF;

  -- perguntas devem pertencer ao mesmo questionário e estar ativas
  SELECT count(*) INTO v_bad
    FROM public.psico_respostas_itens i
    JOIN public.psico_perguntas p ON p.id = i.pergunta_id
    WHERE i.resposta_id = NEW.resposta_id
      AND (p.questionario_versao_id <> v_quest OR p.ativa = false);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Submissão inválida: pergunta de outra versão ou inativa.';
  END IF;

  -- opções devem pertencer à mesma metodologia e estar ativas
  SELECT count(*) INTO v_bad
    FROM public.psico_respostas_itens i
    JOIN public.psico_opcoes_resposta o ON o.id = i.opcao_resposta_id
    WHERE i.resposta_id = NEW.resposta_id
      AND (o.metodologia_versao_id <> v_metod OR o.ativo = false);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Submissão inválida: opção de outra metodologia ou inativa.';
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_psico_respostas_check35 ON public.psico_respostas_itens;
CREATE CONSTRAINT TRIGGER trg_psico_respostas_check35
AFTER INSERT ON public.psico_respostas_itens
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.psico_respostas_validar_35();

-- ---------- 6. RPC: psico_abrir_coleta ----------
CREATE OR REPLACE FUNCTION public.psico_abrir_coleta(
  p_avaliacao_id uuid,
  p_confirmacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_esperado text;
  v_qtd_part integer;
  v_qtd_prep integer;
  v_qtd_ativos_sem_prep integer;
  v_qtd_resp integer;
  v_qtd_perg integer;
  v_qtd_opc integer;
  v_expira timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para abrir coleta.';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada.'; END IF;
  IF v_av.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente avaliações em rascunho podem ser abertas.';
  END IF;

  v_esperado := 'ABRIR ' || v_av.codigo;
  IF coalesce(p_confirmacao,'') <> v_esperado THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite exatamente: %', v_esperado;
  END IF;

  IF v_av.questionario_versao_id IS NULL OR v_av.metodologia_versao_id IS NULL THEN
    RAISE EXCEPTION 'Questionário e metodologia devem estar vinculados.';
  END IF;
  IF v_av.data_fim_prevista IS NULL THEN
    RAISE EXCEPTION 'Defina a data de encerramento prevista antes de abrir.';
  END IF;
  IF v_av.data_fim_prevista < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'A data de encerramento não pode estar no passado.';
  END IF;

  -- perguntas e opções
  SELECT count(*) INTO v_qtd_perg FROM public.psico_perguntas
    WHERE questionario_versao_id = v_av.questionario_versao_id AND ativa = true;
  IF v_qtd_perg <> 35 THEN RAISE EXCEPTION 'O questionário precisa ter exatamente 35 perguntas ativas (atual: %).', v_qtd_perg; END IF;
  SELECT count(*) INTO v_qtd_opc FROM public.psico_opcoes_resposta
    WHERE metodologia_versao_id = v_av.metodologia_versao_id AND ativo = true;
  IF v_qtd_opc <> 5 THEN RAISE EXCEPTION 'A metodologia precisa ter exatamente 5 opções de resposta ativas.'; END IF;

  -- participantes
  SELECT count(*) INTO v_qtd_part FROM public.psico_participantes
    WHERE avaliacao_id = p_avaliacao_id AND ativo = true;
  IF v_qtd_part < 2 THEN
    RAISE EXCEPTION 'É necessário pelo menos 2 participantes ativos (atual: %).', v_qtd_part;
  END IF;

  -- todos com convite preparado
  SELECT count(*) INTO v_qtd_ativos_sem_prep
    FROM public.psico_participantes p
    WHERE p.avaliacao_id = p_avaliacao_id AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM public.psico_convites c
        WHERE c.participante_id = p.id AND c.status = 'preparado'
      );
  IF v_qtd_ativos_sem_prep > 0 THEN
    RAISE EXCEPTION '% participantes ativos ainda não possuem link preparado.', v_qtd_ativos_sem_prep;
  END IF;

  -- nenhum respondido
  SELECT count(*) INTO v_qtd_resp FROM public.psico_convites
    WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';
  IF v_qtd_resp > 0 THEN
    RAISE EXCEPTION 'Já existem convites respondidos nesta avaliação; abertura bloqueada.';
  END IF;

  -- expira em fim do dia São Paulo
  v_expira := ((v_av.data_fim_prevista::text || ' 23:59:59')::timestamp AT TIME ZONE 'America/Sao_Paulo');

  SELECT count(*) INTO v_qtd_prep FROM public.psico_convites
    WHERE avaliacao_id = p_avaliacao_id AND status = 'preparado';

  UPDATE public.psico_convites
    SET status = 'ativo', ativado_em = now(), expira_em = v_expira
    WHERE avaliacao_id = p_avaliacao_id AND status = 'preparado';

  UPDATE public.psico_avaliacoes
    SET status = 'coleta_em_andamento',
        coleta_aberta_em = now(),
        coleta_aberta_por = v_uid,
        coleta_expira_em = v_expira,
        quantidade_participantes_abertura = v_qtd_part,
        quantidade_convites_abertura = v_qtd_prep,
        atualizado_por = v_uid
    WHERE id = p_avaliacao_id;

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados)
  VALUES ('avaliacao', p_avaliacao_id, 'coleta_aberta',
    jsonb_build_object('participantes', v_qtd_part, 'convites_ativados', v_qtd_prep, 'expira_em', v_expira));

  RETURN jsonb_build_object(
    'status','coleta_em_andamento',
    'participantes', v_qtd_part,
    'convites_ativados', v_qtd_prep,
    'expira_em', v_expira
  );
END $$;

REVOKE ALL ON FUNCTION public.psico_abrir_coleta(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_abrir_coleta(uuid,text) TO authenticated;

-- ---------- 7. RPC: psico_prorrogar_coleta ----------
CREATE OR REPLACE FUNCTION public.psico_prorrogar_coleta(
  p_avaliacao_id uuid,
  p_nova_data_fim date,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_expira timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  IF p_nova_data_fim IS NULL THEN RAISE EXCEPTION 'Nova data é obrigatória.'; END IF;
  IF length(coalesce(trim(p_motivo),'')) < 10 THEN
    RAISE EXCEPTION 'Motivo deve ter no mínimo 10 caracteres.';
  END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR v_av.status <> 'coleta_em_andamento' THEN
    RAISE EXCEPTION 'Somente coletas em andamento podem ser prorrogadas.';
  END IF;
  IF p_nova_data_fim <= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Nova data deve ser posterior a hoje.';
  END IF;
  IF v_av.data_fim_prevista IS NOT NULL AND p_nova_data_fim <= v_av.data_fim_prevista THEN
    RAISE EXCEPTION 'Nova data deve ser posterior ao prazo vigente.';
  END IF;

  v_expira := ((p_nova_data_fim::text || ' 23:59:59')::timestamp AT TIME ZONE 'America/Sao_Paulo');

  UPDATE public.psico_avaliacoes
    SET data_fim_prevista = p_nova_data_fim,
        coleta_expira_em = v_expira,
        coleta_prorrogada_em = now(),
        coleta_prorrogada_por = v_uid,
        motivo_prorrogacao = p_motivo,
        atualizado_por = v_uid
    WHERE id = p_avaliacao_id;

  UPDATE public.psico_convites
    SET expira_em = v_expira
    WHERE avaliacao_id = p_avaliacao_id AND status = 'ativo';

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados)
  VALUES ('avaliacao', p_avaliacao_id, 'prazo_coleta_prorrogado',
    jsonb_build_object('prazo_anterior', v_av.data_fim_prevista, 'prazo_novo', p_nova_data_fim, 'motivo_informado', true));

  RETURN jsonb_build_object('status','ok','expira_em', v_expira);
END $$;

REVOKE ALL ON FUNCTION public.psico_prorrogar_coleta(uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_prorrogar_coleta(uuid,date,text) TO authenticated;

-- ---------- 8. RPC: psico_encerrar_coleta ----------
CREATE OR REPLACE FUNCTION public.psico_encerrar_coleta(
  p_avaliacao_id uuid,
  p_confirmacao text,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_esperado text;
  v_resp integer;
  v_expirados integer;
BEGIN
  IF v_uid IS NULL OR NOT can_see_internal(v_uid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR v_av.status <> 'coleta_em_andamento' THEN
    RAISE EXCEPTION 'Somente coletas em andamento podem ser encerradas.';
  END IF;
  v_esperado := 'ENCERRAR ' || v_av.codigo;
  IF coalesce(p_confirmacao,'') <> v_esperado THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite exatamente: %', v_esperado;
  END IF;
  IF p_motivo IS NOT NULL AND length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Motivo, quando informado, deve ter no mínimo 10 caracteres.';
  END IF;

  SELECT count(*) INTO v_resp FROM public.psico_convites
    WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';

  WITH x AS (
    UPDATE public.psico_convites SET status='expirado', expirado_em = now()
     WHERE avaliacao_id = p_avaliacao_id AND status = 'ativo'
     RETURNING 1
  ) SELECT count(*) INTO v_expirados FROM x;

  UPDATE public.psico_avaliacoes
    SET status = 'coleta_encerrada',
        coleta_encerrada_em = now(),
        coleta_encerrada_por = v_uid,
        motivo_encerramento = p_motivo,
        atualizado_por = v_uid
    WHERE id = p_avaliacao_id;

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados)
  VALUES ('avaliacao', p_avaliacao_id, 'coleta_encerrada',
    jsonb_build_object('respondidos', v_resp, 'expirados', v_expirados, 'motivo_informado', p_motivo IS NOT NULL));

  RETURN jsonb_build_object('status','coleta_encerrada','respondidos', v_resp, 'expirados', v_expirados);
END $$;

REVOKE ALL ON FUNCTION public.psico_encerrar_coleta(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_encerrar_coleta(uuid,text,text) TO authenticated;

-- ---------- 9. RPC: psico_resumo_coleta ----------
CREATE OR REPLACE FUNCTION public.psico_resumo_coleta(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_part_ativos integer;
  v_convites_ativos integer;
  v_convites_distr integer;
  v_acessaram integer;
  v_resp integer;
  v_pendentes integer;
  v_anon integer;
  v_perc numeric;
  v_prazo_exp boolean;
BEGIN
  IF v_uid IS NULL OR NOT can_see_internal(v_uid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada.'; END IF;

  SELECT count(*) INTO v_part_ativos FROM public.psico_participantes WHERE avaliacao_id = p_avaliacao_id AND ativo = true;
  SELECT count(*) INTO v_convites_ativos FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND status = 'ativo';
  SELECT count(*) INTO v_convites_distr FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND distribuido_em IS NOT NULL;
  SELECT count(*) INTO v_acessaram FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND primeiro_acesso_em IS NOT NULL;
  SELECT count(*) INTO v_resp FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';
  v_pendentes := GREATEST(v_part_ativos - v_resp, 0);
  SELECT count(*) INTO v_anon FROM public.psico_respostas WHERE avaliacao_id = p_avaliacao_id;
  v_perc := CASE WHEN v_part_ativos > 0 THEN round((v_resp::numeric / v_part_ativos::numeric) * 100, 1) ELSE 0 END;
  v_prazo_exp := v_av.coleta_expira_em IS NOT NULL AND now() > v_av.coleta_expira_em;

  RETURN jsonb_build_object(
    'status', v_av.status,
    'prazo', v_av.data_fim_prevista,
    'coleta_expira_em', v_av.coleta_expira_em,
    'prazo_expirado', v_prazo_exp,
    'participantes_previstos', v_av.quantidade_participantes_prevista,
    'participantes_na_abertura', v_av.quantidade_participantes_abertura,
    'participantes_ativos_atuais', v_part_ativos,
    'convites_ativos', v_convites_ativos,
    'convites_distribuidos', v_convites_distr,
    'acessaram', v_acessaram,
    'respondidos', v_resp,
    'pendentes', v_pendentes,
    'respostas_anonimas', v_anon,
    'percentual_participacao', v_perc,
    'integridade_ok', (v_anon = v_resp),
    'quantidade_minima_global', 2,
    'amostra_suficiente_global', v_anon >= 2,
    'coleta_aberta_em', v_av.coleta_aberta_em,
    'coleta_encerrada_em', v_av.coleta_encerrada_em
  );
END $$;

REVOKE ALL ON FUNCTION public.psico_resumo_coleta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_resumo_coleta(uuid) TO authenticated;

-- ---------- 10. RPC: psico_finalizar_submissao (SERVICE ROLE ONLY) ----------
CREATE OR REPLACE FUNCTION public.psico_finalizar_submissao(
  p_public_id uuid,
  p_token_version integer,
  p_respostas jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_av record;
  v_part record;
  v_resp_id uuid;
  v_nums integer[];
  v_data date;
  r jsonb;
  v_pergunta uuid;
  v_opcao uuid;
  v_num int;
  v_cod text;
  v_count int;
BEGIN
  IF jsonb_typeof(p_respostas) <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  IF jsonb_array_length(p_respostas) <> 35 THEN
    RAISE EXCEPTION 'invalid_count';
  END IF;

  SELECT * INTO v_conv FROM public.psico_convites
    WHERE public_id = p_public_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'convite_inexistente'; END IF;
  IF v_conv.token_version <> p_token_version THEN RAISE EXCEPTION 'token_invalido'; END IF;
  IF v_conv.status = 'respondido' OR v_conv.respondido_em IS NOT NULL THEN
    RETURN jsonb_build_object('status','ja_respondido');
  END IF;
  IF v_conv.status <> 'ativo' THEN RAISE EXCEPTION 'convite_indisponivel'; END IF;
  IF v_conv.expira_em IS NOT NULL AND now() > v_conv.expira_em THEN
    RAISE EXCEPTION 'prazo_encerrado';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = v_conv.avaliacao_id;
  IF v_av.status <> 'coleta_em_andamento' THEN RAISE EXCEPTION 'coleta_indisponivel'; END IF;
  IF v_av.coleta_expira_em IS NOT NULL AND now() > v_av.coleta_expira_em THEN
    RAISE EXCEPTION 'prazo_encerrado';
  END IF;

  SELECT * INTO v_part FROM public.psico_participantes WHERE id = v_conv.participante_id;
  IF NOT FOUND OR v_part.ativo = false THEN RAISE EXCEPTION 'participante_indisponivel'; END IF;

  v_data := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  INSERT INTO public.psico_respostas(
    avaliacao_id, questionario_versao_id, metodologia_versao_id,
    funcao, setor, unidade,
    funcao_normalizada, setor_normalizado, unidade_normalizada,
    data_resposta, versao_aviso_confidencialidade, quantidade_itens
  ) VALUES (
    v_av.id, v_av.questionario_versao_id, v_av.metodologia_versao_id,
    v_part.funcao, v_part.setor, v_part.unidade,
    v_part.funcao_normalizada, v_part.setor_normalizada, v_part.unidade_normalizada,
    v_data, 'v1', 35
  ) RETURNING id INTO v_resp_id;

  v_nums := ARRAY[]::int[];
  FOR r IN SELECT * FROM jsonb_array_elements(p_respostas) LOOP
    v_num := (r->>'numero')::int;
    v_cod := r->>'opcao';
    IF v_num IS NULL OR v_num < 1 OR v_num > 35 THEN RAISE EXCEPTION 'numero_invalido'; END IF;
    IF v_num = ANY(v_nums) THEN RAISE EXCEPTION 'numero_duplicado'; END IF;
    IF v_cod NOT IN ('nunca','raramente','as_vezes','frequentemente','sempre') THEN
      RAISE EXCEPTION 'opcao_invalida';
    END IF;
    v_nums := v_nums || v_num;

    SELECT id INTO v_pergunta FROM public.psico_perguntas
      WHERE questionario_versao_id = v_av.questionario_versao_id AND numero = v_num AND ativa = true;
    IF v_pergunta IS NULL THEN RAISE EXCEPTION 'pergunta_indisponivel'; END IF;
    SELECT id INTO v_opcao FROM public.psico_opcoes_resposta
      WHERE metodologia_versao_id = v_av.metodologia_versao_id AND codigo = v_cod AND ativo = true;
    IF v_opcao IS NULL THEN RAISE EXCEPTION 'opcao_indisponivel'; END IF;

    INSERT INTO public.psico_respostas_itens(resposta_id, pergunta_id, opcao_resposta_id)
    VALUES (v_resp_id, v_pergunta, v_opcao);
  END LOOP;

  UPDATE public.psico_convites
    SET status = 'respondido', respondido_em = now()
    WHERE id = v_conv.id;

  RETURN jsonb_build_object('status','registrada');
END $$;

REVOKE ALL ON FUNCTION public.psico_finalizar_submissao(uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_finalizar_submissao(uuid,integer,jsonb) TO service_role;

-- ---------- 11. RPC: psico_registrar_acesso_convite (service role) ----------
CREATE OR REPLACE FUNCTION public.psico_registrar_acesso_convite(p_public_id uuid, p_token_version int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.psico_convites
    SET primeiro_acesso_em = COALESCE(primeiro_acesso_em, now()),
        ultimo_acesso_em = now()
    WHERE public_id = p_public_id AND token_version = p_token_version;
END $$;

REVOKE ALL ON FUNCTION public.psico_registrar_acesso_convite(uuid,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_registrar_acesso_convite(uuid,int) TO service_role;

-- ---------- 12. Convite novo durante coleta nasce ativo ----------
CREATE OR REPLACE FUNCTION public.psico_convite_ativar_se_coleta_aberta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_av record;
BEGIN
  IF NEW.status = 'preparado' THEN
    SELECT status, coleta_expira_em INTO v_av
      FROM public.psico_avaliacoes WHERE id = NEW.avaliacao_id;
    IF v_av.status = 'coleta_em_andamento' THEN
      NEW.status := 'ativo';
      NEW.ativado_em := now();
      NEW.expira_em := v_av.coleta_expira_em;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_conv_ativar_coleta ON public.psico_convites;
CREATE TRIGGER trg_psico_conv_ativar_coleta
BEFORE INSERT ON public.psico_convites
FOR EACH ROW EXECUTE FUNCTION public.psico_convite_ativar_se_coleta_aberta();

-- ---------- 13. Constraint temporal: encerramento >= abertura ----------
-- (usando trigger em vez de CHECK por causa de now())
CREATE OR REPLACE FUNCTION public.psico_avaliacoes_validar_datas_coleta()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.coleta_encerrada_em IS NOT NULL AND NEW.coleta_aberta_em IS NOT NULL
     AND NEW.coleta_encerrada_em < NEW.coleta_aberta_em THEN
    RAISE EXCEPTION 'coleta_encerrada_em não pode ser anterior a coleta_aberta_em';
  END IF;
  IF NEW.coleta_expira_em IS NOT NULL AND NEW.coleta_aberta_em IS NOT NULL
     AND NEW.coleta_expira_em <= NEW.coleta_aberta_em THEN
    RAISE EXCEPTION 'coleta_expira_em deve ser posterior a coleta_aberta_em';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_aval_datas_coleta ON public.psico_avaliacoes;
CREATE TRIGGER trg_psico_aval_datas_coleta
BEFORE INSERT OR UPDATE ON public.psico_avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.psico_avaliacoes_validar_datas_coleta();
