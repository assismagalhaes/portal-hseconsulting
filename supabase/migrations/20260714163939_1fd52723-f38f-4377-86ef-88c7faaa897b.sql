
-- ============================================================================
-- FASE 2 — Metodologia, 7 fatores, 35 perguntas, escala, validação e publicação
-- ============================================================================

-- 1) ALTER: novos campos em questionários -----------------------------------
ALTER TABLE public.psico_questionarios_versoes
  ADD COLUMN IF NOT EXISTS vigente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fonte_referencia text,
  ADD COLUMN IF NOT EXISTS nota_metodologica text,
  ADD COLUMN IF NOT EXISTS publicado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS quantidade_perguntas_publicada integer,
  ADD COLUMN IF NOT EXISTS metadados jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS psico_quest_vigente_unica
  ON public.psico_questionarios_versoes ((true)) WHERE vigente = true;

-- 2) ALTER: fatores e perguntas ----------------------------------------------
ALTER TABLE public.psico_fatores
  ADD COLUMN IF NOT EXISTS quantidade_perguntas_prevista integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_fatores_qtd_prev_pos') THEN
    ALTER TABLE public.psico_fatores ADD CONSTRAINT psico_fatores_qtd_prev_pos CHECK (quantidade_perguntas_prevista >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_fatores_ordem_pos') THEN
    ALTER TABLE public.psico_fatores ADD CONSTRAINT psico_fatores_ordem_pos CHECK (ordem > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_fatores_codigo_ne') THEN
    ALTER TABLE public.psico_fatores ADD CONSTRAINT psico_fatores_codigo_ne CHECK (length(trim(codigo)) > 0);
  END IF;
END $$;

ALTER TABLE public.psico_perguntas
  ADD COLUMN IF NOT EXISTS observacao_tecnica text,
  ADD COLUMN IF NOT EXISTS origem_referencia text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_perguntas_numero_1_35') THEN
    ALTER TABLE public.psico_perguntas ADD CONSTRAINT psico_perguntas_numero_1_35 CHECK (numero BETWEEN 1 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_perguntas_ordem_pos') THEN
    ALTER TABLE public.psico_perguntas ADD CONSTRAINT psico_perguntas_ordem_pos CHECK (ordem > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psico_perguntas_quest_ordem_uk') THEN
    ALTER TABLE public.psico_perguntas ADD CONSTRAINT psico_perguntas_quest_ordem_uk UNIQUE (questionario_versao_id, ordem);
  END IF;
END $$;

-- 3) NOVA TABELA: opções de resposta -----------------------------------------
CREATE TABLE IF NOT EXISTS public.psico_opcoes_resposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metodologia_versao_id uuid NOT NULL REFERENCES public.psico_metodologias_versoes(id) ON DELETE CASCADE,
  codigo text NOT NULL CHECK (codigo IN ('nunca','raramente','as_vezes','frequentemente','sempre')),
  rotulo text NOT NULL CHECK (length(trim(rotulo)) > 0),
  ordem integer NOT NULL CHECK (ordem BETWEEN 1 AND 5),
  peso_direta integer NOT NULL CHECK (peso_direta BETWEEN 0 AND 4),
  peso_invertida integer NOT NULL CHECK (peso_invertida BETWEEN 0 AND 4),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metodologia_versao_id, codigo),
  UNIQUE (metodologia_versao_id, ordem)
);

GRANT SELECT ON public.psico_opcoes_resposta TO authenticated;
GRANT ALL ON public.psico_opcoes_resposta TO service_role;
ALTER TABLE public.psico_opcoes_resposta ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='psico_opcoes_resposta' AND policyname='psico_opcoes_read_internal') THEN
    CREATE POLICY psico_opcoes_read_internal ON public.psico_opcoes_resposta
      FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='psico_opcoes_resposta' AND policyname='psico_opcoes_admin_write') THEN
    CREATE POLICY psico_opcoes_admin_write ON public.psico_opcoes_resposta
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_psico_opcoes_upd ON public.psico_opcoes_resposta;
CREATE TRIGGER trg_psico_opcoes_upd BEFORE UPDATE ON public.psico_opcoes_resposta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) SEED: escala de respostas (HSE-PSICO-2.0) -------------------------------
DO $$
DECLARE v_met uuid;
BEGIN
  SELECT id INTO v_met FROM public.psico_metodologias_versoes WHERE codigo='HSE-PSICO-2.0' LIMIT 1;
  IF v_met IS NULL THEN RAISE EXCEPTION 'Metodologia HSE-PSICO-2.0 ausente'; END IF;

  INSERT INTO public.psico_opcoes_resposta (metodologia_versao_id, codigo, rotulo, ordem, peso_direta, peso_invertida)
  VALUES
    (v_met,'nunca','Nunca',1,0,4),
    (v_met,'raramente','Raramente',2,1,3),
    (v_met,'as_vezes','Às vezes',3,2,2),
    (v_met,'frequentemente','Frequentemente',4,3,1),
    (v_met,'sempre','Sempre',5,4,0)
  ON CONFLICT (metodologia_versao_id, codigo) DO UPDATE
    SET rotulo=EXCLUDED.rotulo, ordem=EXCLUDED.ordem,
        peso_direta=EXCLUDED.peso_direta, peso_invertida=EXCLUDED.peso_invertida,
        ativo=true, updated_at=now();
END $$;

-- 5) ATUALIZA metadados institucionais do QPPOT-2.0 --------------------------
UPDATE public.psico_questionarios_versoes SET
  nome = 'Questionário de Percepção Psicoorganizacional no Trabalho',
  subtitulo = 'Instrumento coletivo de percepção sobre fatores psicossociais relacionados às condições e à organização do trabalho.',
  aviso_nao_avaliacao_psicologica = 'Este instrumento não constitui avaliação psicológica, diagnóstico clínico ou avaliação individual da saúde mental do trabalhador.',
  orientacao_periodo_referencia = 'Considere principalmente sua experiência de trabalho nos últimos seis meses. Caso trabalhe na empresa há menos tempo, considere o período desde sua admissão.',
  fonte_referencia = 'Perguntas adaptadas a partir do Management Standards Indicator Tool, desenvolvido pela Health and Safety Executive do Reino Unido.',
  nota_metodologica = 'A tradução, a redação operacional, a atribuição de pesos, as faixas de classificação, os critérios de significância e a interpretação dos resultados constituem metodologia própria da HSE Consulting.',
  quantidade_perguntas_prevista = 35,
  texto_abertura = 'Este questionário tem como objetivo conhecer a percepção dos trabalhadores sobre as condições e a organização do trabalho, identificando pontos positivos e situações que possam necessitar de melhoria.

A avaliação é conduzida pela HSE Consulting e possui caráter coletivo e preventivo. Ela não constitui avaliação psicológica, diagnóstico clínico ou avaliação individual da saúde mental.

A identificação dos participantes será utilizada exclusivamente para controle de participação e permanecerá armazenada separadamente do conteúdo das respostas. A empresa receberá somente resultados coletivos consolidados, sem acesso às respostas individuais.

Considere principalmente sua experiência de trabalho nos últimos seis meses. Caso trabalhe na empresa há menos tempo, considere o período desde sua admissão.

Responda com sinceridade e de acordo com a sua realidade no trabalho. Não existem respostas certas ou erradas.'
WHERE codigo = 'QPPOT-2.0';

-- 6) SEED: 7 fatores oficiais ------------------------------------------------
DO $$
DECLARE v_q uuid;
BEGIN
  SELECT id INTO v_q FROM public.psico_questionarios_versoes WHERE codigo='QPPOT-2.0' LIMIT 1;
  IF v_q IS NULL THEN RAISE EXCEPTION 'Questionário QPPOT-2.0 ausente'; END IF;

  INSERT INTO public.psico_fatores (questionario_versao_id, codigo, nome, descricao, ordem, ativo, quantidade_perguntas_prevista) VALUES
    (v_q,'carga_excessiva','Carga Excessiva de Trabalho','Condições associadas ao volume e à simultaneidade das demandas, ritmo, prazos, pausas, jornada e pressões de tempo relacionadas ao trabalho.',1,true,8),
    (v_q,'falta_autonomia','Falta de Autonomia no Trabalho','Grau de controle e participação do trabalhador sobre pausas, métodos, sequência, ritmo, horário e decisões relacionadas à execução das atividades.',2,true,6),
    (v_q,'conflitos_hierarquicos','Conflitos Hierárquicos','Qualidade do apoio, confiança, escuta, retorno, incentivo e suporte oferecidos pela liderança durante a execução do trabalho.',3,true,5),
    (v_q,'relacoes_interpessoais','Qualidade das Relações Interpessoais no Trabalho','Apoio, respeito, disponibilidade, colaboração e escuta existentes nas relações entre colegas de trabalho.',4,true,4),
    (v_q,'conflitos_interpessoais','Conflitos Interpessoais','Ocorrência de hostilidade, brigas, tratamento injusto, perseguição, desrespeito ou relações tensas no ambiente de trabalho.',5,true,4),
    (v_q,'falta_clareza','Falta de Clareza nas Expectativas e Responsabilidades','Clareza sobre atribuições, responsabilidades, forma de execução, metas, objetivos e contribuição do trabalho para a organização.',6,true,5),
    (v_q,'gestao_mudancas','Ausência de Gestão de Mudanças no Ambiente de Trabalho','Comunicação, consulta, compreensão, preparação e suporte oferecidos aos trabalhadores durante mudanças organizacionais.',7,true,3)
  ON CONFLICT (questionario_versao_id, codigo) DO UPDATE
    SET nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, ordem=EXCLUDED.ordem,
        ativo=true, quantidade_perguntas_prevista=EXCLUDED.quantidade_perguntas_prevista,
        updated_at=now();
END $$;

-- 7) SEED: 35 perguntas ------------------------------------------------------
DO $$
DECLARE
  v_q uuid;
  r record;
  v_fator uuid;
  v_origem text := 'Pergunta adaptada a partir do Management Standards Indicator Tool — HSE UK';
BEGIN
  SELECT id INTO v_q FROM public.psico_questionarios_versoes WHERE codigo='QPPOT-2.0' LIMIT 1;

  FOR r IN
    SELECT * FROM (VALUES
      (1,'falta_clareza','invertida','Eu entendo claramente o que esperam que eu faça no meu trabalho?','Sei quais são minhas tarefas e responsabilidades no dia a dia.'),
      (2,'falta_autonomia','invertida','Eu posso escolher o momento em que faço uma pausa no trabalho?','Posso parar um pouco para descansar quando achar necessário, respeitando a rotina do setor.'),
      (3,'carga_excessiva','direta','Recebo solicitações de pessoas ou áreas diferentes que são difíceis de conciliar?','Recebo pedidos ou prioridades diferentes ao mesmo tempo e tenho dificuldade para atender a todos.'),
      (4,'falta_clareza','invertida','Eu sei como fazer o meu trabalho do jeito certo?','Conheço os passos e sei o que preciso fazer para cumprir minhas tarefas.'),
      (5,'conflitos_interpessoais','direta','Algumas pessoas falam comigo de forma grossa ou agem de maneira dura?','Sou tratado(a) com rispidez, impaciência ou falta de respeito.'),
      (6,'carga_excessiva','direta','Recebo prazos que são impossíveis de cumprir?','Recebo pouco tempo para concluir tarefas que exigem mais trabalho.'),
      (7,'relacoes_interpessoais','invertida','Quando o trabalho fica difícil, posso contar com a ajuda dos meus colegas?','Meus colegas me apoiam ou ajudam quando estou com dificuldades.'),
      (8,'conflitos_hierarquicos','invertida','Recebo retorno e apoio sobre o trabalho que realizo?','Meu chefe ou responsável orienta, acompanha e me apoia quando preciso.'),
      (9,'carga_excessiva','direta','Preciso trabalhar num ritmo muito acelerado ou com muita pressão?','Tenho que fazer tudo muito rápido, sem tempo adequado para parar ou me recuperar.'),
      (10,'falta_autonomia','invertida','As pessoas escutam minha opinião sobre o ritmo em que consigo trabalhar?','Minha opinião é considerada quando conversamos sobre ritmo, volume ou prazo das atividades.'),
      (11,'falta_clareza','invertida','Eu entendo bem quais são as minhas tarefas e responsabilidades no trabalho?','Sei exatamente o que preciso fazer e quais são minhas responsabilidades.'),
      (12,'carga_excessiva','direta','Deixo de fazer algumas tarefas porque estou sobrecarregado(a) de trabalho?','Tenho tantas atividades que não consigo concluir tudo o que deveria.'),
      (13,'falta_clareza','invertida','Eu entendo claramente quais são os objetivos e metas do meu setor?','Sei o que meu setor precisa alcançar e quais resultados são esperados.'),
      (14,'conflitos_interpessoais','direta','Acontecem brigas ou desentendimentos entre os colegas de trabalho?','Existem discussões, desentendimentos ou desrespeito entre colegas.'),
      (15,'falta_autonomia','invertida','Tenho liberdade para escolher a melhor maneira de fazer meu trabalho?','Posso decidir como organizar minhas tarefas ou o modo de realizá-las.'),
      (16,'carga_excessiva','direta','Não consigo fazer pausas suficientes durante o trabalho?','Preciso trabalhar direto e não consigo fazer pausas suficientes.'),
      (17,'falta_clareza','invertida','Eu entendo como o meu trabalho ajuda a empresa a alcançar seus objetivos?','Entendo de que forma minhas atividades contribuem para os resultados da empresa.'),
      (18,'carga_excessiva','direta','Sou pressionado(a) a trabalhar fora do meu horário normal?','Sou solicitado(a) a trabalhar depois do expediente ou fora do horário combinado.'),
      (19,'falta_autonomia','invertida','Tenho liberdade para escolher quais tarefas fazer no meu trabalho?','Posso decidir por onde começar ou qual tarefa realizar primeiro.'),
      (20,'carga_excessiva','direta','Preciso fazer meu trabalho muito rápido?','Tenho pouco tempo e preciso executar as atividades com muita rapidez.'),
      (21,'conflitos_interpessoais','direta','Sinto que estou sendo perseguido(a) ou tratado(a) injustamente no trabalho?','Sinto que alguém me trata injustamente, me prejudica ou me persegue no trabalho.'),
      (22,'carga_excessiva','direta','Tenho pressão de tempo excessiva ou incompatível com as tarefas que preciso realizar?','O tempo disponível é insuficiente ou irrealista para concluir as tarefas com a qualidade esperada.'),
      (23,'conflitos_hierarquicos','invertida','Posso confiar no meu chefe quando tenho algum problema no trabalho?','Se algo der errado, posso procurar meu chefe e acredito que serei ouvido(a) e apoiado(a).'),
      (24,'relacoes_interpessoais','invertida','Meus colegas me ajudam e me apoiam quando preciso?','Posso contar com meus colegas quando tenho dificuldades.'),
      (25,'falta_autonomia','invertida','Minhas sugestões sobre como fazer meu trabalho são levadas em conta?','A empresa ou a liderança considera minhas ideias sobre como melhorar o trabalho.'),
      (26,'gestao_mudancas','invertida','Tenho chance de perguntar ao meu chefe quando mudam algo no meu trabalho?','Posso tirar dúvidas com meu chefe e compreender mudanças que afetam minhas tarefas.'),
      (27,'relacoes_interpessoais','invertida','No meu trabalho, os colegas me tratam com o respeito que eu mereço?','Sou tratado(a) com educação, consideração e respeito pelos colegas.'),
      (28,'gestao_mudancas','invertida','As pessoas são avisadas ou ouvidas antes de mudarem algo no trabalho?','Antes de mudanças relevantes, os trabalhadores são informados, consultados ou ouvidos.'),
      (29,'conflitos_hierarquicos','invertida','Quando algo no trabalho me incomoda ou me irrita, posso conversar com meu chefe?','Sinto-me à vontade para conversar com meu chefe sobre problemas ou situações difíceis.'),
      (30,'falta_autonomia','invertida','Meu horário de trabalho pode ser flexível?','Consigo ajustar meu horário quando necessário e quando a atividade permite.'),
      (31,'relacoes_interpessoais','invertida','Meus colegas estão disponíveis para me escutar quando tenho problemas no trabalho?','Posso conversar com meus colegas quando estou passando por alguma dificuldade no trabalho.'),
      (32,'gestao_mudancas','invertida','Quando ocorrem mudanças no trabalho, entendo claramente como elas funcionarão na prática?','Sei o que mudará, como isso afetará minha rotina e o que devo fazer.'),
      (33,'conflitos_hierarquicos','invertida','Quando realizo trabalhos emocionalmente exigentes, recebo o apoio necessário?','Recebo orientação, acolhimento ou ajuda da chefia quando uma atividade gera forte desgaste emocional.'),
      (34,'conflitos_interpessoais','direta','As minhas relações com as pessoas no trabalho são tensas ou difíceis?','Convivo com relações que geram tensão, conflito, mal-estar ou clima ruim.'),
      (35,'conflitos_hierarquicos','invertida','Meu chefe me incentiva e me motiva no trabalho?','Meu chefe reconhece meu esforço, oferece apoio e me incentiva a realizar um bom trabalho.')
    ) AS t(numero,fator_codigo,sentido,texto,exemplo)
  LOOP
    SELECT id INTO v_fator FROM public.psico_fatores WHERE questionario_versao_id=v_q AND codigo=r.fator_codigo;
    INSERT INTO public.psico_perguntas (
      questionario_versao_id, fator_id, numero, texto, texto_apoio_exemplo,
      sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia
    ) VALUES (
      v_q, v_fator, r.numero::int, r.texto::text, r.exemplo::text,
      r.sentido::public.psico_sentido_pontuacao, true, r.numero::int, true, v_origem
    )
    ON CONFLICT (questionario_versao_id, numero) DO UPDATE
      SET fator_id=EXCLUDED.fator_id, texto=EXCLUDED.texto,
          texto_apoio_exemplo=EXCLUDED.texto_apoio_exemplo,
          sentido_pontuacao=EXCLUDED.sentido_pontuacao,
          ordem=EXCLUDED.ordem, obrigatoria=true, ativa=true,
          origem_referencia=EXCLUDED.origem_referencia, updated_at=now();
  END LOOP;
END $$;

-- 8) RPC: validar questionário -----------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_validar_questionario(_questionario_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q record; m record;
  erros jsonb := '[]'::jsonb;
  avisos jsonb := '[]'::jsonb;
  total_fat int; total_perg int; total_dir int; total_inv int; total_opc int;
  esc_valida boolean := false;
  num_valida boolean := false;
  ord_valida boolean := false;
  cont_valida boolean := true;
  contagem_fatores jsonb := '{}'::jsonb;
  expected jsonb := '{"carga_excessiva":8,"falta_autonomia":6,"conflitos_hierarquicos":5,"relacoes_interpessoais":4,"conflitos_interpessoais":4,"falta_clareza":5,"gestao_mudancas":3}'::jsonb;
  k text; v_atual int; v_esp int;
BEGIN
  SELECT * INTO q FROM public.psico_questionarios_versoes WHERE id=_questionario_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido',false,'erros',jsonb_build_array('Questionário não encontrado'));
  END IF;

  SELECT * INTO m FROM public.psico_metodologias_versoes WHERE id=q.metodologia_versao_id;
  IF NOT FOUND THEN
    erros := erros || jsonb_build_array('Metodologia associada não encontrada');
  END IF;

  -- Escala
  SELECT count(*) INTO total_opc FROM public.psico_opcoes_resposta
   WHERE metodologia_versao_id=q.metodologia_versao_id AND ativo=true;
  IF total_opc <> 5 THEN
    erros := erros || jsonb_build_array('Escala deve possuir 5 opções ativas (atual: '||total_opc||')');
  ELSE
    IF EXISTS (
      SELECT 1 FROM (
        SELECT ARRAY_AGG(peso_direta ORDER BY ordem) pd, ARRAY_AGG(peso_invertida ORDER BY ordem) pi
        FROM public.psico_opcoes_resposta WHERE metodologia_versao_id=q.metodologia_versao_id AND ativo=true
      ) x
      WHERE pd = ARRAY[0,1,2,3,4] AND pi = ARRAY[4,3,2,1,0]
    ) THEN esc_valida := true;
    ELSE erros := erros || jsonb_build_array('Pesos da escala inválidos (esperado 0-1-2-3-4 direta e 4-3-2-1-0 invertida)');
    END IF;
  END IF;

  -- Fatores
  SELECT count(*) INTO total_fat FROM public.psico_fatores WHERE questionario_versao_id=_questionario_id AND ativo=true;
  IF total_fat <> 7 THEN erros := erros || jsonb_build_array('Devem existir exatamente 7 fatores ativos (atual: '||total_fat||')'); END IF;

  -- Perguntas
  SELECT count(*), count(*) FILTER (WHERE sentido_pontuacao='direta'), count(*) FILTER (WHERE sentido_pontuacao='invertida')
    INTO total_perg, total_dir, total_inv
    FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true;

  IF total_perg <> 35 THEN erros := erros || jsonb_build_array('Devem existir exatamente 35 perguntas ativas (atual: '||total_perg||')'); END IF;
  IF total_dir <> 12 THEN erros := erros || jsonb_build_array('Devem existir 12 perguntas diretas (atual: '||total_dir||')'); END IF;
  IF total_inv <> 23 THEN erros := erros || jsonb_build_array('Devem existir 23 perguntas invertidas (atual: '||total_inv||')'); END IF;

  -- Numeração e ordem contínuas 1..35
  IF total_perg = 35 THEN
    IF (SELECT ARRAY_AGG(numero ORDER BY numero) FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true)
       = (SELECT ARRAY_AGG(n) FROM generate_series(1,35) n) THEN num_valida := true;
    ELSE erros := erros || jsonb_build_array('Numeração das perguntas não é contínua de 1 a 35');
    END IF;
    IF (SELECT ARRAY_AGG(ordem ORDER BY ordem) FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true)
       = (SELECT ARRAY_AGG(n) FROM generate_series(1,35) n) THEN ord_valida := true;
    ELSE erros := erros || jsonb_build_array('Ordem das perguntas não é contínua de 1 a 35');
    END IF;
  END IF;

  -- Todas obrigatórias, com fator, texto e exemplo
  IF EXISTS (SELECT 1 FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true AND obrigatoria=false) THEN
    erros := erros || jsonb_build_array('Existem perguntas ativas não marcadas como obrigatórias');
  END IF;
  IF EXISTS (SELECT 1 FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true AND fator_id IS NULL) THEN
    erros := erros || jsonb_build_array('Existem perguntas sem fator associado');
  END IF;
  IF EXISTS (SELECT 1 FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true AND (texto IS NULL OR length(trim(texto))=0)) THEN
    erros := erros || jsonb_build_array('Existem perguntas sem texto');
  END IF;
  IF EXISTS (SELECT 1 FROM public.psico_perguntas WHERE questionario_versao_id=_questionario_id AND ativa=true AND (texto_apoio_exemplo IS NULL OR length(trim(texto_apoio_exemplo))=0)) THEN
    erros := erros || jsonb_build_array('Existem perguntas sem texto de apoio/exemplo');
  END IF;

  -- Contagem por fator
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    v_esp := (expected->>k)::int;
    SELECT COALESCE(count(p.id),0) INTO v_atual
      FROM public.psico_fatores f LEFT JOIN public.psico_perguntas p
        ON p.fator_id=f.id AND p.ativa=true
      WHERE f.questionario_versao_id=_questionario_id AND f.codigo=k;
    contagem_fatores := contagem_fatores || jsonb_build_object(k, jsonb_build_object('atual', v_atual, 'esperado', v_esp));
    IF v_atual <> v_esp THEN
      cont_valida := false;
      erros := erros || jsonb_build_array('Fator '||k||' possui '||v_atual||' perguntas (esperado '||v_esp||')');
    END IF;
  END LOOP;

  -- Faixas metodológicas
  IF m.faixa_irrelevante_max IS NULL OR m.faixa_baixo_max IS NULL OR m.faixa_medio_max IS NULL
     OR m.faixa_alto_max IS NULL OR m.faixa_critico_max IS NULL THEN
    erros := erros || jsonb_build_array('Faixas de classificação da metodologia incompletas');
  END IF;
  IF m.criterio_principal_percentual IS NULL OR m.criterio_agravamento_percentual IS NULL OR m.criterio_critico_percentual IS NULL THEN
    erros := erros || jsonb_build_array('Critérios de significância da metodologia incompletos');
  END IF;

  RETURN jsonb_build_object(
    'valido', jsonb_array_length(erros)=0,
    'total_fatores', total_fat,
    'total_perguntas', total_perg,
    'total_diretas', total_dir,
    'total_invertidas', total_inv,
    'escala_valida', esc_valida,
    'numeracao_valida', num_valida,
    'ordem_valida', ord_valida,
    'contagem_fatores_valida', cont_valida,
    'metodologia_valida', m.id IS NOT NULL,
    'contagem_por_fator', contagem_fatores,
    'erros', erros,
    'avisos', avisos
  );
END $$;

GRANT EXECUTE ON FUNCTION public.psico_validar_questionario(uuid) TO authenticated;

-- 9) RPC: publicar questionário ----------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_publicar_questionario(_questionario_id uuid, _confirmacao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; v jsonb; texto_esperado text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem publicar'; END IF;

  SELECT * INTO q FROM public.psico_questionarios_versoes WHERE id=_questionario_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionário não encontrado'; END IF;
  IF q.status <> 'em_configuracao' THEN
    RAISE EXCEPTION 'Somente versões em configuração podem ser publicadas (atual: %)', q.status;
  END IF;

  texto_esperado := 'PUBLICAR '||q.codigo;
  IF _confirmacao IS DISTINCT FROM texto_esperado THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite: %', texto_esperado;
  END IF;

  v := public.psico_validar_questionario(_questionario_id);
  IF NOT (v->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validação falhou: %', v->'erros';
  END IF;

  -- ativa metodologia (se em configuração)
  UPDATE public.psico_metodologias_versoes
     SET status='ativa', publicado_em=COALESCE(publicado_em, now()), updated_at=now()
   WHERE id=q.metodologia_versao_id AND status='em_configuracao';

  -- retira vigente de outros
  UPDATE public.psico_questionarios_versoes SET vigente=false, updated_at=now() WHERE vigente=true AND id<>_questionario_id;

  UPDATE public.psico_questionarios_versoes
     SET status='publicada', vigente=true, publicado_em=now(), publicado_por=auth.uid(),
         validado_por=auth.uid(), validado_em=now(),
         quantidade_perguntas_publicada=(v->>'total_perguntas')::int, updated_at=now()
   WHERE id=_questionario_id;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, dados_novos)
  VALUES ('questionario', _questionario_id, 'questionario_publicado', v);
  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao)
  VALUES ('metodologia', q.metodologia_versao_id, 'metodologia_ativada');

  RETURN jsonb_build_object('ok', true, 'validacao', v);
END $$;

GRANT EXECUTE ON FUNCTION public.psico_publicar_questionario(uuid, text) TO authenticated;

-- 10) RPC: duplicar questionário para nova versão ----------------------------
CREATE OR REPLACE FUNCTION public.psico_duplicar_questionario(_questionario_id uuid, _novo_codigo text, _nova_versao text, _novo_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; novo_id uuid; f record; novo_fator uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  SELECT * INTO q FROM public.psico_questionarios_versoes WHERE id=_questionario_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionário original não encontrado'; END IF;

  INSERT INTO public.psico_questionarios_versoes (
    metodologia_versao_id, codigo, nome, versao, subtitulo, texto_abertura,
    aviso_nao_avaliacao_psicologica, orientacao_periodo_referencia, status,
    quantidade_perguntas_prevista, fonte_referencia, nota_metodologica, vigente
  ) VALUES (
    q.metodologia_versao_id, _novo_codigo, COALESCE(_novo_nome, q.nome), _nova_versao, q.subtitulo, q.texto_abertura,
    q.aviso_nao_avaliacao_psicologica, q.orientacao_periodo_referencia, 'em_configuracao',
    q.quantidade_perguntas_prevista, q.fonte_referencia, q.nota_metodologica, false
  ) RETURNING id INTO novo_id;

  FOR f IN SELECT * FROM public.psico_fatores WHERE questionario_versao_id=_questionario_id LOOP
    INSERT INTO public.psico_fatores (questionario_versao_id, codigo, nome, descricao, ordem, ativo, quantidade_perguntas_prevista)
    VALUES (novo_id, f.codigo, f.nome, f.descricao, f.ordem, f.ativo, f.quantidade_perguntas_prevista)
    RETURNING id INTO novo_fator;
    INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, texto_apoio_exemplo,
      sentido_pontuacao, obrigatoria, ordem, ativa, observacao_tecnica, origem_referencia)
    SELECT novo_id, novo_fator, numero, texto, texto_apoio_exemplo, sentido_pontuacao, obrigatoria, ordem, ativa, observacao_tecnica, origem_referencia
      FROM public.psico_perguntas WHERE fator_id=f.id;
  END LOOP;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, dados_novos)
  VALUES ('questionario', novo_id, 'questionario_duplicado',
    jsonb_build_object('origem', _questionario_id, 'codigo', _novo_codigo, 'versao', _nova_versao));

  RETURN novo_id;
END $$;

GRANT EXECUTE ON FUNCTION public.psico_duplicar_questionario(uuid, text, text, text) TO authenticated;

-- 11) RPC: vincular versão vigente à avaliação -------------------------------
CREATE OR REPLACE FUNCTION public.psico_vincular_versao_vigente(_avaliacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; qv record;
BEGIN
  SELECT * INTO a FROM public.psico_avaliacoes WHERE id=_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada'; END IF;
  IF a.status <> 'rascunho' THEN RAISE EXCEPTION 'Somente avaliações em rascunho podem receber a versão vigente'; END IF;

  SELECT * INTO qv FROM public.psico_questionarios_versoes WHERE vigente=true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma versão vigente disponível'; END IF;

  UPDATE public.psico_avaliacoes
     SET questionario_versao_id=qv.id, metodologia_versao_id=qv.metodologia_versao_id, updated_at=now()
   WHERE id=_avaliacao_id;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, dados_novos)
  VALUES ('avaliacao', _avaliacao_id, 'avaliacao_versao_vinculada',
    jsonb_build_object('questionario_versao_id', qv.id, 'metodologia_versao_id', qv.metodologia_versao_id));

  RETURN jsonb_build_object('ok', true, 'questionario_versao_id', qv.id);
END $$;

GRANT EXECUTE ON FUNCTION public.psico_vincular_versao_vigente(uuid) TO authenticated;

-- 12) TRIGGER: auto-atribuir versão vigente em novas avaliações --------------
CREATE OR REPLACE FUNCTION public.psico_avaliacao_atribuir_vigente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE qv record;
BEGIN
  IF NEW.questionario_versao_id IS NULL OR NEW.metodologia_versao_id IS NULL THEN
    SELECT id, metodologia_versao_id INTO qv FROM public.psico_questionarios_versoes WHERE vigente=true LIMIT 1;
    IF qv.id IS NOT NULL THEN
      NEW.questionario_versao_id := COALESCE(NEW.questionario_versao_id, qv.id);
      NEW.metodologia_versao_id := COALESCE(NEW.metodologia_versao_id, qv.metodologia_versao_id);
    END IF;
  END IF;
  -- Consistência: questionário deve pertencer à metodologia
  IF NEW.questionario_versao_id IS NOT NULL AND NEW.metodologia_versao_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.psico_questionarios_versoes
                    WHERE id=NEW.questionario_versao_id AND metodologia_versao_id=NEW.metodologia_versao_id) THEN
      RAISE EXCEPTION 'Questionário não pertence à metodologia informada';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_aval_atribuir_vigente ON public.psico_avaliacoes;
CREATE TRIGGER trg_psico_aval_atribuir_vigente BEFORE INSERT ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_avaliacao_atribuir_vigente();

-- 13) TRIGGER: bloquear troca de versão após sair de rascunho ----------------
CREATE OR REPLACE FUNCTION public.psico_avaliacao_bloquear_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status <> 'rascunho' AND (
       NEW.questionario_versao_id IS DISTINCT FROM OLD.questionario_versao_id
    OR NEW.metodologia_versao_id IS DISTINCT FROM OLD.metodologia_versao_id
  ) THEN
    RAISE EXCEPTION 'Não é possível alterar a versão de questionário/metodologia após a avaliação sair de rascunho';
  END IF;
  IF OLD.status = 'cancelada' AND (
       NEW.questionario_versao_id IS DISTINCT FROM OLD.questionario_versao_id
    OR NEW.metodologia_versao_id IS DISTINCT FROM OLD.metodologia_versao_id
  ) THEN
    RAISE EXCEPTION 'Avaliação cancelada não pode ter sua versão alterada';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_aval_bloquear_versao ON public.psico_avaliacoes;
CREATE TRIGGER trg_psico_aval_bloquear_versao BEFORE UPDATE ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_avaliacao_bloquear_versao();

-- 14) TRIGGER: imutabilidade da versão publicada -----------------------------
CREATE OR REPLACE FUNCTION public.psico_bloquear_pub_perg_fat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status public.psico_questionario_status;
BEGIN
  SELECT status INTO v_status FROM public.psico_questionarios_versoes
   WHERE id = COALESCE(NEW.questionario_versao_id, OLD.questionario_versao_id);
  IF v_status IN ('publicada','arquivada') THEN
    RAISE EXCEPTION 'Versão publicada é imutável — duplique para nova versão para alterar';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_psico_fatores_immut ON public.psico_fatores;
CREATE TRIGGER trg_psico_fatores_immut BEFORE UPDATE OR DELETE ON public.psico_fatores
  FOR EACH ROW EXECUTE FUNCTION public.psico_bloquear_pub_perg_fat();

DROP TRIGGER IF EXISTS trg_psico_perguntas_immut ON public.psico_perguntas;
CREATE TRIGGER trg_psico_perguntas_immut BEFORE UPDATE OR DELETE ON public.psico_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.psico_bloquear_pub_perg_fat();

CREATE OR REPLACE FUNCTION public.psico_bloquear_pub_questionario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('publicada','arquivada') THEN
    RAISE EXCEPTION 'Não é permitido excluir versão publicada ou arquivada';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('publicada','arquivada') THEN
    -- permitir apenas: vigente, arquivado_em, status (publicada -> arquivada), metadados, updated_at
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.versao IS DISTINCT FROM OLD.versao
       OR NEW.subtitulo IS DISTINCT FROM OLD.subtitulo
       OR NEW.texto_abertura IS DISTINCT FROM OLD.texto_abertura
       OR NEW.aviso_nao_avaliacao_psicologica IS DISTINCT FROM OLD.aviso_nao_avaliacao_psicologica
       OR NEW.orientacao_periodo_referencia IS DISTINCT FROM OLD.orientacao_periodo_referencia
       OR NEW.fonte_referencia IS DISTINCT FROM OLD.fonte_referencia
       OR NEW.nota_metodologica IS DISTINCT FROM OLD.nota_metodologica
       OR NEW.quantidade_perguntas_prevista IS DISTINCT FROM OLD.quantidade_perguntas_prevista
       OR NEW.quantidade_perguntas_publicada IS DISTINCT FROM OLD.quantidade_perguntas_publicada
       OR NEW.metodologia_versao_id IS DISTINCT FROM OLD.metodologia_versao_id
       OR NEW.publicado_em IS DISTINCT FROM OLD.publicado_em
       OR NEW.publicado_por IS DISTINCT FROM OLD.publicado_por
    THEN
      RAISE EXCEPTION 'Campos metodológicos são imutáveis após publicação';
    END IF;
    IF NEW.status NOT IN ('publicada','arquivada') THEN
      RAISE EXCEPTION 'Versão publicada só pode transitar para arquivada';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_psico_quest_immut ON public.psico_questionarios_versoes;
CREATE TRIGGER trg_psico_quest_immut BEFORE UPDATE OR DELETE ON public.psico_questionarios_versoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_bloquear_pub_questionario();

-- 15) TRIGGER: metodologia ativa é imutável em campos técnicos ---------------
CREATE OR REPLACE FUNCTION public.psico_bloquear_metodologia_ativa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('ativa','arquivada') THEN
    RAISE EXCEPTION 'Metodologia ativa/arquivada não pode ser excluída';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='ativa' THEN
    IF NEW.faixa_irrelevante_max IS DISTINCT FROM OLD.faixa_irrelevante_max
       OR NEW.faixa_baixo_max IS DISTINCT FROM OLD.faixa_baixo_max
       OR NEW.faixa_medio_max IS DISTINCT FROM OLD.faixa_medio_max
       OR NEW.faixa_alto_max IS DISTINCT FROM OLD.faixa_alto_max
       OR NEW.faixa_critico_max IS DISTINCT FROM OLD.faixa_critico_max
       OR NEW.criterio_principal_percentual IS DISTINCT FROM OLD.criterio_principal_percentual
       OR NEW.criterio_agravamento_percentual IS DISTINCT FROM OLD.criterio_agravamento_percentual
       OR NEW.criterio_critico_percentual IS DISTINCT FROM OLD.criterio_critico_percentual
       OR NEW.minimo_respondentes_global IS DISTINCT FROM OLD.minimo_respondentes_global
       OR NEW.minimo_respondentes_segmentacao IS DISTINCT FROM OLD.minimo_respondentes_segmentacao
       OR NEW.unidade_calculo IS DISTINCT FROM OLD.unidade_calculo THEN
      RAISE EXCEPTION 'Campos técnicos da metodologia ativa são imutáveis';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_psico_metod_immut ON public.psico_metodologias_versoes;
CREATE TRIGGER trg_psico_metod_immut BEFORE UPDATE OR DELETE ON public.psico_metodologias_versoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_bloquear_metodologia_ativa();

-- 16) TRIGGER: bloquear opções de resposta de metodologia ativa --------------
CREATE OR REPLACE FUNCTION public.psico_bloquear_opcoes_ativas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status public.psico_metodologia_status;
BEGIN
  SELECT status INTO v_status FROM public.psico_metodologias_versoes
   WHERE id = COALESCE(NEW.metodologia_versao_id, OLD.metodologia_versao_id);
  IF v_status IN ('ativa','arquivada') THEN
    RAISE EXCEPTION 'Opções de resposta de metodologia ativa/arquivada são imutáveis';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_psico_opcoes_immut ON public.psico_opcoes_resposta;
CREATE TRIGGER trg_psico_opcoes_immut BEFORE UPDATE OR DELETE ON public.psico_opcoes_resposta
  FOR EACH ROW EXECUTE FUNCTION public.psico_bloquear_opcoes_ativas();
