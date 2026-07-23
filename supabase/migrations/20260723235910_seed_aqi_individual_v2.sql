-- AQI 2.0: instrumento qualitativo individual para microempresa.
-- Não é aplicação estatística do questionário HSE. Os sete fatores são usados
-- como referencial organizacional, com conciliação entre exposição e controles.

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

  SELECT id INTO v_emp FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADO' AND versao='2.0';
  SELECT id INTO v_rep FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADOR' AND versao='2.0';

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

  -- A publicação só ocorre depois de todas as perguntas e opções existirem.
  UPDATE public.psico_individual_instrumentos_versoes
     SET vigente=false,updated_at=now()
   WHERE codigo IN ('AQI-EMPREGADO','AQI-EMPREGADOR') AND versao<>'2.0';
  UPDATE public.psico_individual_instrumentos_versoes
     SET vigente=true,publicado_em=coalesce(publicado_em,now()),updated_at=now()
   WHERE id IN (v_emp,v_rep);
END $seed$;
