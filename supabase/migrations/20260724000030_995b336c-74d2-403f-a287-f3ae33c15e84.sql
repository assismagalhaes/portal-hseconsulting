-- ==== 20260723235900_fix_psico_individual_integrity_v2 ====
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

CREATE OR REPLACE FUNCTION public.psico_ind_formulario_concluido(p_avaliacao uuid,p_papel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.psico_individual_formularios
    WHERE avaliacao_id=p_avaliacao AND papel=p_papel AND concluido_em IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.psico_ind_formulario_concluido(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_formulario_concluido(uuid,text) TO authenticated,service_role;

ALTER TABLE public.psico_individual_formularios
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submetido'
  CHECK (status IN ('submetido'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_ind_relatorio_avaliacao_versao
  ON public.psico_ind_relatorios(avaliacao_id,versao);

DO $fix_preparar$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_preparar_relatorio(uuid,text,text)'::regprocedure)
    INTO v_def;
  v_def := regexp_replace(v_def,'PERFORM[[:space:]]+set_config\(''role''[^;]*;','PERFORM 1;','i');
  EXECUTE v_def;
END $fix_preparar$;

-- ==== 20260723235910_seed_aqi_individual_v2 ====
DO $seed$
DECLARE v_emp uuid; v_rep uuid;
BEGIN
  INSERT INTO public.psico_individual_instrumentos_versoes
    (codigo,versao,nome,vigente,publicado_em,observacoes)
  VALUES
    ('AQI-EMPREGADO','2.0','AQI Empregado — v2.0',false,NULL,
     'Sete fatores organizacionais; sem perguntas clínicas ou cálculo estatístico.'),
    ('AQI-EMPREGADOR','2.0','AQI Empregador — v2.0',false,NULL,
     'Verificação qualitativa de controles organizacionais pareada ao AQI Empregado 2.0.')
  ON CONFLICT (codigo,versao) DO NOTHING;

  SELECT id INTO v_emp FROM public.psico_individual_instrumentos_versoes WHERE codigo='AQI-EMPREGADO' AND versao='2.0';
  SELECT id INTO v_rep FROM public.psico_individual_instrumentos_versoes WHERE codigo='AQI-EMPREGADOR' AND versao='2.0';

  IF NOT EXISTS (SELECT 1 FROM public.psico_individual_perguntas WHERE instrumento_versao_id=v_emp) THEN
    INSERT INTO public.psico_individual_perguntas
      (instrumento_versao_id,papel,fator_codigo,ordem,numero,codigo,chave_pareamento,texto,tipo,obrigatoria,limite_texto,periodo_referencia)
    VALUES
      (v_emp,'empregado','demandas',1,'01','AQI2-E-01','AQI2-DEMANDAS-VOLUME','O volume de trabalho ultrapassa o tempo disponível para realizá-lo.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','demandas',2,'02','AQI2-E-02','AQI2-DEMANDAS-RITMO','Trabalho sob ritmo, pressão ou prazos difíceis de sustentar.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','controle',3,'03','AQI2-E-03','AQI2-CONTROLE-AUTONOMIA','Tenho pouca autonomia para organizar a ordem e o método das tarefas.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','controle',4,'04','AQI2-E-04','AQI2-CONTROLE-PARTICIPACAO','Mudanças no meu trabalho são decididas sem que eu possa contribuir.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','apoio_chefia',5,'05','AQI2-E-05','AQI2-APOIO-CHEFIA-ORIENTACAO','Deixo de receber orientação da chefia quando encontro dificuldades.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','apoio_chefia',6,'06','AQI2-E-06','AQI2-APOIO-CHEFIA-FEEDBACK','Não recebo retorno claro e respeitoso sobre o meu trabalho.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','apoio_operacional',7,'07','AQI2-E-07','AQI2-APOIO-OPERACIONAL-RECURSOS','Faltam informações, ferramentas ou recursos para executar as tarefas.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','apoio_operacional',8,'08','AQI2-E-08','AQI2-APOIO-OPERACIONAL-AJUDA','Quando preciso, não existe apoio operacional disponível.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','relacionamentos',9,'09','AQI2-E-09','AQI2-RELACIONAMENTOS-RESPEITO','Vivencio comunicação desrespeitosa, hostil ou constrangedora no trabalho.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','relacionamentos',10,'10','AQI2-E-10','AQI2-RELACIONAMENTOS-CONFLITOS','Conflitos permanecem sem tratamento adequado.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','papel',11,'11','AQI2-E-11','AQI2-PAPEL-CLAREZA','Não estão claras minhas responsabilidades e prioridades.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','papel',12,'12','AQI2-E-12','AQI2-PAPEL-CONFLITO','Recebo solicitações incompatíveis ou orientações conflitantes.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','mudancas',13,'13','AQI2-E-13','AQI2-MUDANCAS-COMUNICACAO','Mudanças que afetam meu trabalho ocorrem sem comunicação prévia suficiente.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','mudancas',14,'14','AQI2-E-14','AQI2-MUDANCAS-SUPORTE','Não recebo preparação ou suporte suficiente durante mudanças.','escala',true,NULL,'últimos 3 meses'),
      (v_emp,'empregado','geral',15,'15','AQI2-E-L1','AQI2-CONTEXTO-LIVRE','Se desejar, descreva uma situação de trabalho que ajude a compreender as respostas, sem informar nomes ou dados pessoais.','livre',false,500,'últimos 3 meses');

    INSERT INTO public.psico_individual_opcoes(pergunta_id,ordem,rotulo,valor_numerico,significa_exposicao)
    SELECT p.id,o.ordem,o.rotulo,o.valor,(o.valor>=3)
      FROM public.psico_individual_perguntas p
      CROSS JOIN (VALUES
        (1,'Nunca',1::numeric),(2,'Raramente',2::numeric),
        (3,'Às vezes',3::numeric),(4,'Frequentemente',4::numeric),
        (5,'Quase sempre',5::numeric)
      ) o(ordem,rotulo,valor)
     WHERE p.instrumento_versao_id=v_emp AND p.tipo='escala';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.psico_individual_perguntas WHERE instrumento_versao_id=v_rep) THEN
    INSERT INTO public.psico_individual_perguntas
      (instrumento_versao_id,papel,fator_codigo,ordem,numero,codigo,chave_pareamento,texto,tipo,obrigatoria,limite_texto,periodo_referencia)
    VALUES
      (v_rep,'empregador','demandas',1,'01','AQI2-R-01','AQI2-DEMANDAS-VOLUME','Há controle da distribuição do volume de trabalho conforme o tempo e a capacidade disponíveis.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','demandas',2,'02','AQI2-R-02','AQI2-DEMANDAS-RITMO','Há controle de ritmo, pressão, horas trabalhadas e viabilidade dos prazos.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','controle',3,'03','AQI2-R-03','AQI2-CONTROLE-AUTONOMIA','O empregado possui autonomia definida para organizar tarefas e métodos.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','controle',4,'04','AQI2-R-04','AQI2-CONTROLE-PARTICIPACAO','O empregado participa das decisões que alteram seu trabalho.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','apoio_chefia',5,'05','AQI2-R-05','AQI2-APOIO-CHEFIA-ORIENTACAO','Existe rotina efetiva de orientação e apoio da chefia diante de dificuldades.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','apoio_chefia',6,'06','AQI2-R-06','AQI2-APOIO-CHEFIA-FEEDBACK','Existe rotina de feedback claro, respeitoso e verificável.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','apoio_operacional',7,'07','AQI2-R-07','AQI2-APOIO-OPERACIONAL-RECURSOS','Informações, ferramentas e recursos necessários são verificados e disponibilizados.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','apoio_operacional',8,'08','AQI2-R-08','AQI2-APOIO-OPERACIONAL-AJUDA','Existe apoio operacional acessível quando solicitado.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','relacionamentos',9,'09','AQI2-R-09','AQI2-RELACIONAMENTOS-RESPEITO','Existem regras e práticas efetivas para comunicação respeitosa e prevenção de condutas inadequadas.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','relacionamentos',10,'10','AQI2-R-10','AQI2-RELACIONAMENTOS-CONFLITOS','Existe procedimento seguro e efetivo para tratar conflitos.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','papel',11,'11','AQI2-R-11','AQI2-PAPEL-CLAREZA','Responsabilidades, limites e prioridades do cargo estão definidos e atualizados.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','papel',12,'12','AQI2-R-12','AQI2-PAPEL-CONFLITO','Há mecanismo para identificar e resolver solicitações incompatíveis.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','mudancas',13,'13','AQI2-R-13','AQI2-MUDANCAS-COMUNICACAO','Mudanças são comunicadas previamente com motivo, impacto e cronograma.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','mudancas',14,'14','AQI2-R-14','AQI2-MUDANCAS-SUPORTE','Mudanças incluem preparação, recursos e acompanhamento de adaptação.','escala',true,NULL,'últimos 3 meses'),
      (v_rep,'empregador','geral',15,'15','AQI2-R-L1','AQI2-CONTEXTO-LIVRE','Se desejar, descreva controles ou evidências organizacionais relevantes, sem informar dados pessoais.','livre',false,500,'últimos 3 meses');

    INSERT INTO public.psico_individual_opcoes(pergunta_id,ordem,rotulo,valor_numerico,significa_exposicao)
    SELECT p.id,o.ordem,o.rotulo,o.valor,o.deficit
      FROM public.psico_individual_perguntas p
      CROSS JOIN (VALUES
        (1,'Não existe',5::numeric,true),
        (2,'Existe informalmente, sem verificação',3::numeric,true),
        (3,'Existe parcialmente',2::numeric,true),
        (4,'Existe e funciona de forma verificável',5::numeric,false),
        (5,'Não foi possível verificar',NULL::numeric,NULL::boolean)
      ) o(ordem,rotulo,valor,deficit)
     WHERE p.instrumento_versao_id=v_rep AND p.tipo='escala';
  END IF;

  UPDATE public.psico_individual_instrumentos_versoes
     SET vigente=false,updated_at=now()
   WHERE codigo IN ('AQI-EMPREGADO','AQI-EMPREGADOR') AND versao<>'2.0';
  UPDATE public.psico_individual_instrumentos_versoes
     SET vigente=true,publicado_em=coalesce(publicado_em,now()),updated_at=now()
   WHERE id IN (v_emp,v_rep);
END $seed$;

-- ==== 20260723235920_fix_psico_individual_report_gates ====
CREATE OR REPLACE FUNCTION public.psico_ind_parecer_completo(p_parecer jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_parecer IS NOT NULL
    AND length(btrim(coalesce(p_parecer->>'sintese_caso',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'interpretacao_convergencia',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'prioridades',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'recomendacoes_organizacionais',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'limitacoes',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'conclusao',''))) >= 20;
$$;

ALTER TABLE public.psico_individual_revisoes DROP CONSTRAINT IF EXISTS psico_ind_parecer_estrutura_chk;
ALTER TABLE public.psico_individual_revisoes
  ADD CONSTRAINT psico_ind_parecer_estrutura_chk
  CHECK (parecer IS NULL OR public.psico_ind_parecer_completo(parecer)) NOT VALID;

CREATE OR REPLACE FUNCTION public.psico_ind_gates_emissao(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_proc record; v_rev record; v_plano jsonb;
  v_erros jsonb := '[]'::jsonb; v_diver integer; v_requer_acao boolean;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' AND NOT public.can_see_internal(auth.uid())
    THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_proc FROM public.psico_individual_processamentos
   WHERE avaliacao_id=p_avaliacao AND imutavel=true
   ORDER BY aprovado_em DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    v_erros:=v_erros||jsonb_build_object('codigo','processamento_pendente','mensagem','Conciliação não aprovada.');
  END IF;

  IF NOT public.psico_ind_formulario_concluido(p_avaliacao,'empregado') THEN
    v_erros:=v_erros||jsonb_build_object('codigo','formulario_empregado_pendente','mensagem','Formulário do empregado não submetido.');
  END IF;
  IF NOT public.psico_ind_formulario_concluido(p_avaliacao,'empregador') THEN
    v_erros:=v_erros||jsonb_build_object('codigo','formulario_empregador_pendente','mensagem','Formulário do empregador não submetido.');
  END IF;

  SELECT count(*) INTO v_diver FROM public.psico_individual_achados a
   WHERE a.avaliacao_id=p_avaliacao
     AND (a.estado_final='divergente' OR a.estado_convergencia='divergente')
     AND coalesce(btrim(a.decisao_tecnica),'')='';
  IF v_diver>0 THEN
    v_erros:=v_erros||jsonb_build_object('codigo','divergencia_nao_tratada','mensagem',v_diver||' achado(s) divergente(s) sem decisão técnica.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.psico_individual_achados
    WHERE avaliacao_id=p_avaliacao AND necessita_acao=true) INTO v_requer_acao;
  BEGIN
    v_plano:=public.psico_ind_plano_gates(p_avaliacao);
    IF NOT coalesce((v_plano->>'pronto_para_aprovacao')::boolean,false) THEN
      v_erros:=v_erros||jsonb_build_object('codigo','plano_pendente','mensagem','Plano de ação incompleto.','detalhes',v_plano);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_erros:=v_erros||jsonb_build_object('codigo','plano_indisponivel','mensagem','Não foi possível validar o plano de ação.');
    v_plano:=jsonb_build_object('erro','validacao_indisponivel');
  END;

  IF v_requer_acao AND (
    NOT EXISTS(SELECT 1 FROM public.psico_ind_plano_itens WHERE avaliacao_id=p_avaliacao)
    OR EXISTS(SELECT 1 FROM public.psico_ind_plano_itens WHERE avaliacao_id=p_avaliacao AND imutavel=false)
  ) THEN
    v_erros:=v_erros||jsonb_build_object('codigo','plano_nao_aprovado','mensagem','As ações necessárias devem estar aprovadas.');
  END IF;

  SELECT * INTO v_rev FROM public.psico_individual_revisoes
   WHERE avaliacao_id=p_avaliacao AND ativa=true ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    v_erros:=v_erros||jsonb_build_object('codigo','revisao_ausente','mensagem','Nenhuma revisão técnica ativa.');
  ELSE
    IF NOT public.psico_ind_parecer_completo(v_rev.parecer) THEN
      v_erros:=v_erros||jsonb_build_object('codigo','parecer_incompleto','mensagem','Os seis campos obrigatórios do parecer devem estar preenchidos.');
    END IF;
    IF v_rev.status<>'aprovada' OR v_rev.imutavel IS NOT TRUE THEN
      v_erros:=v_erros||jsonb_build_object('codigo','revisao_nao_aprovada','mensagem','Revisão técnica ainda não aprovada.');
    END IF;
    IF v_rev.responsavel_profissional_id IS NULL THEN
      v_erros:=v_erros||jsonb_build_object('codigo','responsavel_ausente','mensagem','Responsável técnico não definido.');
    END IF;
    IF v_rev.assinatura_storage_path IS NULL OR v_rev.assinatura_hash_sha256 IS NULL THEN
      v_erros:=v_erros||jsonb_build_object('codigo','assinatura_ausente','mensagem','Assinatura válida não anexada.');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pode_emitir',jsonb_array_length(v_erros)=0,'erros',v_erros,
    'plano_gates',v_plano,'revisao_id',v_rev.id,'processamento_id',v_proc.id
  );
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_gates_emissao(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_gates_emissao(uuid) TO authenticated,service_role;

-- ==== 20260723235930_fix_psico_individual_report_snapshot ====
DO $fix_snap$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_snapshot_relatorio(uuid)'::regprocedure) INTO v_def;
  v_def := replace(v_def,'''data_referencia'', av.data_referencia',
    '''data_referencia'', coalesce(av.data_fim_prevista, av.data_inicio_prevista, av.created_at::date)');
  v_def := replace(v_def,'c.id = av.client_id','c.id = av.cliente_id');
  v_def := regexp_replace(v_def,
    'IF coalesce\(auth\.jwt\(\) ->> ''role'',''''\) <> ''service_role'' THEN',
    'IF coalesce(auth.jwt() ->> ''role'','''') <> ''service_role'' AND NOT public.can_see_internal(auth.uid()) THEN','i');
  EXECUTE v_def;
END $fix_snap$;

DO $fix_prep_lock$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_preparar_relatorio(uuid,text,text)'::regprocedure) INTO v_def;
  IF position('pg_advisory_xact_lock' IN v_def)=0 THEN
    v_def := replace(v_def,
      'v_gates := public.psico_ind_gates_emissao(p_avaliacao);',
      'PERFORM pg_advisory_xact_lock(hashtextextended(p_avaliacao::text, 0));' || chr(10) ||
      '  v_gates := public.psico_ind_gates_emissao(p_avaliacao);');
    EXECUTE v_def;
  END IF;
END $fix_prep_lock$;