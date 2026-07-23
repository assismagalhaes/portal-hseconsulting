-- Correções de integridade da avaliação psicossocial individual.
-- Compatível com formulários já emitidos: não altera instrumentos publicados.

CREATE OR REPLACE FUNCTION public.psico_ind_finalizar_submissao(
  p_public_id uuid, p_token_version integer, p_papel text,
  p_instrumento_versao_id uuid, p_respostas jsonb,
  p_livres jsonb DEFAULT '[]'::jsonb, p_ip_hash text DEFAULT NULL,
  p_ua_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conv record; v_form_id uuid; v_r jsonb; v_valor numeric;
  v_instrumento_esperado uuid; v_obrigatorias integer; v_recebidas integer;
  v_limite integer;
BEGIN
  IF p_papel NOT IN ('empregado','empregador')
     OR jsonb_typeof(coalesce(p_respostas, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_livres, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_respostas, '[]'::jsonb)) > 100
     OR jsonb_array_length(coalesce(p_livres, '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'payload_invalido';
  END IF;

  SELECT c.*,
    CASE WHEN p_papel='empregado' THEN a.instrumento_empregado_versao_id
         ELSE a.instrumento_empregador_versao_id END AS instrumento_esperado
    INTO v_conv
    FROM public.psico_individual_convites c
    JOIN public.psico_avaliacoes a ON a.id=c.avaliacao_id
   WHERE c.public_id=p_public_id FOR UPDATE OF c;
  IF NOT FOUND OR v_conv.token_version<>p_token_version THEN RAISE EXCEPTION 'token_invalido'; END IF;
  IF v_conv.status<>'ativo' THEN RAISE EXCEPTION 'ja_respondido'; END IF;
  IF v_conv.papel<>p_papel THEN RAISE EXCEPTION 'papel_invalido'; END IF;
  IF v_conv.instrumento_esperado IS NULL OR v_conv.instrumento_esperado<>p_instrumento_versao_id
    THEN RAISE EXCEPTION 'instrumento_invalido'; END IF;
  IF v_conv.expira_em IS NOT NULL AND v_conv.expira_em<now() THEN
    UPDATE public.psico_individual_convites SET status='expirado' WHERE id=v_conv.id;
    RAISE EXCEPTION 'expirado';
  END IF;

  SELECT count(*) INTO v_obrigatorias
    FROM public.psico_individual_perguntas
   WHERE instrumento_versao_id=p_instrumento_versao_id AND papel=p_papel
     AND ativa AND obrigatoria AND tipo<>'livre';
  SELECT count(DISTINCT (x->>'pergunta_id')::uuid) INTO v_recebidas
    FROM jsonb_array_elements(coalesce(p_respostas,'[]'::jsonb)) x
    JOIN public.psico_individual_perguntas q
      ON q.id=(x->>'pergunta_id')::uuid
     AND q.instrumento_versao_id=p_instrumento_versao_id
     AND q.papel=p_papel AND q.ativa AND q.obrigatoria AND q.tipo<>'livre';
  IF v_recebidas<>v_obrigatorias THEN RAISE EXCEPTION 'respostas_obrigatorias_incompletas'; END IF;

  INSERT INTO public.psico_individual_formularios(
    avaliacao_id, convite_id, instrumento_versao_id, papel,
    iniciado_em, concluido_em, ip_hash, user_agent_hash
  ) VALUES (
    v_conv.avaliacao_id, v_conv.id, p_instrumento_versao_id, p_papel,
    now(), now(), p_ip_hash, p_ua_hash
  ) RETURNING id INTO v_form_id;

  FOR v_r IN SELECT * FROM jsonb_array_elements(coalesce(p_respostas,'[]'::jsonb)) LOOP
    SELECT o.valor_numerico INTO STRICT v_valor
      FROM public.psico_individual_opcoes o
      JOIN public.psico_individual_perguntas q ON q.id=o.pergunta_id
     WHERE o.id=(v_r->>'opcao_id')::uuid
       AND q.id=(v_r->>'pergunta_id')::uuid
       AND q.instrumento_versao_id=p_instrumento_versao_id
       AND q.papel=p_papel AND q.ativa AND q.tipo<>'livre';
    INSERT INTO public.psico_individual_respostas(formulario_id,pergunta_id,opcao_id,valor_numerico)
    VALUES(v_form_id,(v_r->>'pergunta_id')::uuid,(v_r->>'opcao_id')::uuid,v_valor);
  END LOOP;

  FOR v_r IN SELECT * FROM jsonb_array_elements(coalesce(p_livres,'[]'::jsonb)) LOOP
    SELECT least(coalesce(q.limite_texto,500),1000) INTO STRICT v_limite
      FROM public.psico_individual_perguntas q
     WHERE q.id=(v_r->>'pergunta_id')::uuid
       AND q.instrumento_versao_id=p_instrumento_versao_id
       AND q.papel=p_papel AND q.ativa AND q.tipo='livre';
    IF length(coalesce(v_r->>'conteudo',''))>v_limite THEN RAISE EXCEPTION 'texto_livre_excede_limite'; END IF;
    IF btrim(coalesce(v_r->>'conteudo',''))<>'' THEN
      INSERT INTO public.psico_individual_respostas_livres(formulario_id,pergunta_id,conteudo)
      VALUES(v_form_id,(v_r->>'pergunta_id')::uuid,btrim(v_r->>'conteudo'));
    END IF;
  END LOOP;

  UPDATE public.psico_individual_convites SET status='respondido',consumido_em=now() WHERE id=v_conv.id;
  RETURN jsonb_build_object('status','registrada','formulario_id',v_form_id);
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'resposta_duplicada_ou_formulario_existente';
  WHEN no_data_found THEN RAISE EXCEPTION 'pergunta_ou_opcao_invalida';
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_finalizar_submissao(uuid,integer,text,uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.psico_ind_finalizar_submissao(uuid,integer,text,uuid,jsonb,jsonb,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.psico_ind_ler_entradas_para_motor(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' AND NOT public.can_see_internal(auth.uid())
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH fe AS (
    SELECT * FROM public.psico_individual_formularios
     WHERE avaliacao_id=p_avaliacao AND papel='empregado' AND concluido_em IS NOT NULL
     ORDER BY concluido_em DESC LIMIT 1
  ), fr AS (
    SELECT * FROM public.psico_individual_formularios
     WHERE avaliacao_id=p_avaliacao AND papel='empregador' AND concluido_em IS NOT NULL
     ORDER BY concluido_em DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'avaliacao_id',p_avaliacao,
    'formulario_empregado',(SELECT jsonb_build_object('id',id,'instrumento_versao_id',instrumento_versao_id,'concluido_em',concluido_em) FROM fe),
    'formulario_empregador',(SELECT jsonb_build_object('id',id,'instrumento_versao_id',instrumento_versao_id,'concluido_em',concluido_em) FROM fr),
    'respostas_empregado',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'pergunta_id',r.pergunta_id,'fator',q.fator_codigo,'chave',q.chave_pareamento,
      'periodo',q.periodo_referencia,'valor',r.valor_numerico,'significa_exposicao',o.significa_exposicao
    ) ORDER BY q.fator_codigo,q.ordem) FROM fe JOIN public.psico_individual_respostas r ON r.formulario_id=fe.id
      JOIN public.psico_individual_perguntas q ON q.id=r.pergunta_id LEFT JOIN public.psico_individual_opcoes o ON o.id=r.opcao_id),'[]'::jsonb),
    'respostas_empregador',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'pergunta_id',r.pergunta_id,'fator',q.fator_codigo,'chave',q.chave_pareamento,
      'periodo',q.periodo_referencia,'valor',r.valor_numerico,'significa_exposicao',o.significa_exposicao
    ) ORDER BY q.fator_codigo,q.ordem) FROM fr JOIN public.psico_individual_respostas r ON r.formulario_id=fr.id
      JOIN public.psico_individual_perguntas q ON q.id=r.pergunta_id LEFT JOIN public.psico_individual_opcoes o ON o.id=r.opcao_id),'[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_ler_entradas_para_motor(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_ler_entradas_para_motor(uuid) TO authenticated,service_role;

-- O schema de formulários não possui coluna status; conclusão é indicada por concluido_em.
CREATE OR REPLACE FUNCTION public.psico_ind_formulario_concluido(p_avaliacao uuid,p_papel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.psico_individual_formularios
    WHERE avaliacao_id=p_avaliacao AND papel=p_papel AND concluido_em IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.psico_ind_formulario_concluido(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_formulario_concluido(uuid,text) TO authenticated,service_role;

-- Compatibilidade com os gates PR6, que referenciam status apesar de a coluna
-- não existir no schema original. Todo formulário só é criado na submissão final.
ALTER TABLE public.psico_individual_formularios
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submetido'
  CHECK (status IN ('submetido'));

-- Evita colisão de versão em emissões concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_ind_relatorio_avaliacao_versao
  ON public.psico_ind_relatorios(avaliacao_id,versao);

-- SECURITY DEFINER não deve tentar trocar a role da sessão. Preserva o restante
-- da função publicada e remove apenas essa instrução inválida.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_preparar_relatorio(uuid,text,text)'::regprocedure)
    INTO v_def;
  v_def := regexp_replace(
    v_def,
    'PERFORM[[:space:]]+set_config\(''role''[^;]*;',
    'PERFORM 1;',
    'i'
  );
  EXECUTE v_def;
END $$;
