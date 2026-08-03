CREATE OR REPLACE FUNCTION public.psico_abrir_coleta(p_avaliacao_id uuid, p_confirmacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_publico boolean;
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

  SELECT count(*) INTO v_qtd_perg FROM public.psico_perguntas
    WHERE questionario_versao_id = v_av.questionario_versao_id AND ativa = true;
  IF v_qtd_perg <> 35 THEN RAISE EXCEPTION 'O questionário precisa ter exatamente 35 perguntas ativas (atual: %).', v_qtd_perg; END IF;
  SELECT count(*) INTO v_qtd_opc FROM public.psico_opcoes_resposta
    WHERE metodologia_versao_id = v_av.metodologia_versao_id AND ativo = true;
  IF v_qtd_opc <> 5 THEN RAISE EXCEPTION 'A metodologia precisa ter exatamente 5 opções de resposta ativas.'; END IF;

  v_publico := (v_av.modo_coleta = 'publico_anonimo');

  SELECT count(*) INTO v_qtd_part FROM public.psico_participantes
    WHERE avaliacao_id = p_avaliacao_id AND ativo = true;

  IF NOT v_publico THEN
    IF v_qtd_part < 2 THEN
      RAISE EXCEPTION 'É necessário pelo menos 2 participantes ativos (atual: %).', v_qtd_part;
    END IF;

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

    SELECT count(*) INTO v_qtd_resp FROM public.psico_convites
      WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';
    IF v_qtd_resp > 0 THEN
      RAISE EXCEPTION 'Já existem convites respondidos nesta avaliação; abertura bloqueada.';
    END IF;
  END IF;

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
    jsonb_build_object('participantes', v_qtd_part, 'convites_ativados', v_qtd_prep, 'expira_em', v_expira, 'modo_coleta', v_av.modo_coleta));

  RETURN jsonb_build_object(
    'status','coleta_em_andamento',
    'participantes', v_qtd_part,
    'convites_ativados', v_qtd_prep,
    'expira_em', v_expira,
    'modo_coleta', v_av.modo_coleta
  );
END $function$;