
-- ============================================================
-- PR 2 — Instrumentos individuais AQI e modalidade da avaliação
-- ============================================================

-- 1) Enriquecimento de psico_individual_perguntas
ALTER TABLE public.psico_individual_perguntas
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS chave_pareamento text,
  ADD COLUMN IF NOT EXISTS regra_condicional jsonb,
  ADD COLUMN IF NOT EXISTS limite_texto integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'publicada',
  ADD COLUMN IF NOT EXISTS periodo_referencia text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='psico_ind_perg_status_chk') THEN
    ALTER TABLE public.psico_individual_perguntas
      ADD CONSTRAINT psico_ind_perg_status_chk CHECK (status IN ('publicada','arquivada'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ind_perg_codigo_uk
  ON public.psico_individual_perguntas(instrumento_versao_id, codigo)
  WHERE codigo IS NOT NULL;

-- 2) Vínculos com instrumentos em psico_avaliacoes
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS instrumento_empregado_versao_id uuid
    REFERENCES public.psico_individual_instrumentos_versoes(id),
  ADD COLUMN IF NOT EXISTS instrumento_empregador_versao_id uuid
    REFERENCES public.psico_individual_instrumentos_versoes(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='psico_aval_modalidade_ind_chk') THEN
    ALTER TABLE public.psico_avaliacoes
      ADD CONSTRAINT psico_aval_modalidade_ind_chk CHECK (
        modalidade <> 'individual_microempresa'
        OR (instrumento_empregado_versao_id IS NOT NULL
            AND instrumento_empregador_versao_id IS NOT NULL)
      );
  END IF;
END $$;

-- 3) Trigger de imutabilidade em perguntas/opções vigentes
CREATE OR REPLACE FUNCTION public.psico_ind_bloquear_edicao_vigente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vigente boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'psico_individual_perguntas' THEN
      SELECT vigente INTO v_vigente FROM public.psico_individual_instrumentos_versoes
        WHERE id = OLD.instrumento_versao_id;
    ELSE
      SELECT iv.vigente INTO v_vigente
        FROM public.psico_individual_opcoes o
        JOIN public.psico_individual_perguntas p ON p.id = OLD.pergunta_id
        JOIN public.psico_individual_instrumentos_versoes iv ON iv.id = p.instrumento_versao_id
        WHERE o.id = OLD.id
        LIMIT 1;
    END IF;
    IF COALESCE(v_vigente, false) THEN
      RAISE EXCEPTION 'Instrumento vigente é imutável: DELETE bloqueado em %.', TG_TABLE_NAME;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'psico_individual_perguntas' THEN
    SELECT vigente INTO v_vigente FROM public.psico_individual_instrumentos_versoes
      WHERE id = NEW.instrumento_versao_id;
    IF COALESCE(v_vigente, false) THEN
      IF NEW.texto IS DISTINCT FROM OLD.texto
         OR NEW.tipo IS DISTINCT FROM OLD.tipo
         OR NEW.papel IS DISTINCT FROM OLD.papel
         OR NEW.fator_codigo IS DISTINCT FROM OLD.fator_codigo
         OR NEW.codigo IS DISTINCT FROM OLD.codigo
         OR NEW.chave_pareamento IS DISTINCT FROM OLD.chave_pareamento
         OR NEW.regra_condicional::text IS DISTINCT FROM OLD.regra_condicional::text
         OR NEW.limite_texto IS DISTINCT FROM OLD.limite_texto
         OR NEW.ordem IS DISTINCT FROM OLD.ordem
         OR NEW.obrigatoria IS DISTINCT FROM OLD.obrigatoria
         OR NEW.instrumento_versao_id IS DISTINCT FROM OLD.instrumento_versao_id
         OR NEW.periodo_referencia IS DISTINCT FROM OLD.periodo_referencia THEN
        RAISE EXCEPTION 'Instrumento vigente é imutável: só status/ativa/updated_at podem mudar em psico_individual_perguntas.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'psico_individual_opcoes' THEN
    SELECT iv.vigente INTO v_vigente
      FROM public.psico_individual_perguntas p
      JOIN public.psico_individual_instrumentos_versoes iv ON iv.id = p.instrumento_versao_id
      WHERE p.id = NEW.pergunta_id;
    IF COALESCE(v_vigente, false) THEN
      IF NEW.rotulo IS DISTINCT FROM OLD.rotulo
         OR NEW.valor_numerico IS DISTINCT FROM OLD.valor_numerico
         OR NEW.significa_exposicao IS DISTINCT FROM OLD.significa_exposicao
         OR NEW.ordem IS DISTINCT FROM OLD.ordem
         OR NEW.pergunta_id IS DISTINCT FROM OLD.pergunta_id THEN
        RAISE EXCEPTION 'Instrumento vigente é imutável: alterações bloqueadas em psico_individual_opcoes.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ind_perg_bloqueio ON public.psico_individual_perguntas;
CREATE TRIGGER trg_ind_perg_bloqueio
  BEFORE UPDATE OR DELETE ON public.psico_individual_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_bloquear_edicao_vigente();

DROP TRIGGER IF EXISTS trg_ind_opc_bloqueio ON public.psico_individual_opcoes;
CREATE TRIGGER trg_ind_opc_bloqueio
  BEFORE UPDATE OR DELETE ON public.psico_individual_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_bloquear_edicao_vigente();

-- 4) Bloqueio de DELETE em instrumento vigente
CREATE OR REPLACE FUNCTION public.psico_ind_bloquear_delete_instrumento()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.vigente THEN
    RAISE EXCEPTION 'Instrumento vigente não pode ser excluído. Marque vigente=false antes.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ind_instr_delete_bloqueio ON public.psico_individual_instrumentos_versoes;
CREATE TRIGGER trg_ind_instr_delete_bloqueio
  BEFORE DELETE ON public.psico_individual_instrumentos_versoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_bloquear_delete_instrumento();

-- 5) Seed idempotente dos dois instrumentos
DO $seed$
DECLARE
  v_emp uuid;
  v_rep uuid;
BEGIN
  SELECT id INTO v_emp FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADO' AND versao='1.0';
  SELECT id INTO v_rep FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADOR' AND versao='1.0';

  IF v_emp IS NOT NULL OR v_rep IS NOT NULL THEN
    RAISE NOTICE 'Instrumentos AQI 1.0 já presentes — seed ignorado.';
    RETURN;
  END IF;

  INSERT INTO public.psico_individual_instrumentos_versoes
    (codigo, versao, nome, vigente, publicado_em, observacoes)
  VALUES
    ('AQI-EMPREGADO', '1.0', 'AQI Empregado — v1.0', true, now(),
     'Instrumento inicial (32 perguntas + 3 livres condicionais, 7 fatores).'),
    ('AQI-EMPREGADOR','1.0', 'AQI Empregador — v1.0', true, now(),
     'Instrumento inicial (27 perguntas + 2 livres condicionais, 7 fatores).');

  SELECT id INTO v_emp FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADO' AND versao='1.0';
  SELECT id INTO v_rep FROM public.psico_individual_instrumentos_versoes
    WHERE codigo='AQI-EMPREGADOR' AND versao='1.0';

  -- Perguntas do EMPREGADO (32 escala + 3 livres)
  INSERT INTO public.psico_individual_perguntas
    (instrumento_versao_id, papel, fator_codigo, ordem, numero, codigo, chave_pareamento, texto, tipo, obrigatoria, limite_texto, regra_condicional, periodo_referencia)
  VALUES
    (v_emp,'empregado','F1', 1,'AQI-E-01','AQI-E-01','PAR-F1-CARGA','O volume de trabalho excede o tempo que tenho para realizá-lo.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F1', 2,'AQI-E-02','AQI-E-02','PAR-F1-RITMO','O ritmo exigido do meu trabalho é intenso demais.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F1', 3,'AQI-E-03','AQI-E-03','PAR-F1-PRAZOS','Os prazos que recebo são realistas e viáveis.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F1', 4,'AQI-E-04','AQI-E-04','PAR-F1-INTERR','Sou interrompido(a) com frequência de forma que atrapalha minhas tarefas.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F1', 5,'AQI-E-05','AQI-E-05','PAR-F1-EMERG','Situações de emergência ou urgência fazem parte da rotina.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F2', 6,'AQI-E-06','AQI-E-06','PAR-F2-DECISAO','Posso decidir a ordem em que executo minhas tarefas.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F2', 7,'AQI-E-07','AQI-E-07','PAR-F2-METODO','Posso escolher os métodos que uso para trabalhar.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F2', 8,'AQI-E-08','AQI-E-08','PAR-F2-PAUSA','Consigo fazer pausas quando preciso.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F2', 9,'AQI-E-09','AQI-E-09','PAR-F2-VOZ','Minha opinião é considerada em decisões que afetam meu trabalho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F2',10,'AQI-E-10','AQI-E-10','PAR-F2-HORARIO','Tenho flexibilidade sobre o horário de trabalho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F3',11,'AQI-E-11','AQI-E-11','PAR-F3-CHEFIA','Recebo apoio da minha liderança quando preciso.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F3',12,'AQI-E-12','AQI-E-12','PAR-F3-COLEGAS','Recebo apoio dos colegas quando preciso.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F3',13,'AQI-E-13','AQI-E-13','PAR-F3-FEEDBACK','Recebo retornos claros sobre meu desempenho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F3',14,'AQI-E-14','AQI-E-14','PAR-F3-CAPACIT','Recebo treinamento adequado para minhas atribuições.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F3',15,'AQI-E-15','AQI-E-15','PAR-F3-ORIENT','Sei a quem recorrer diante de dúvidas ou problemas.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F4',16,'AQI-E-16','AQI-E-16','PAR-F4-CONVIVIO','O convívio no meu setor é respeitoso.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F4',17,'AQI-E-17','AQI-E-17','PAR-F4-CONFLITO','Conflitos entre pessoas são tratados de forma adequada.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F4',18,'AQI-E-18','AQI-E-18','PAR-F4-ASSEDIO','Vivenciei ou presenciei situações de assédio, humilhação ou discriminação.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F4',19,'AQI-E-19','AQI-E-19','PAR-F4-CANAL','Sei como e a quem reportar comportamentos inadequados.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F5',20,'AQI-E-20','AQI-E-20','PAR-F5-RECONH','Sinto que meu trabalho é reconhecido.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F5',21,'AQI-E-21','AQI-E-21','PAR-F5-REMUN','Considero minha remuneração compatível com o esforço exigido.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F5',22,'AQI-E-22','AQI-E-22','PAR-F5-CRESCIM','Vejo oportunidades reais de crescimento na empresa.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F5',23,'AQI-E-23','AQI-E-23','PAR-F5-JUSTA','As promoções e mudanças de função ocorrem de forma justa.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F6',24,'AQI-E-24','AQI-E-24','PAR-F6-REGRAS','As regras internas são claras e conhecidas por todos.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F6',25,'AQI-E-25','AQI-E-25','PAR-F6-TRATAM','As pessoas são tratadas com equidade, independentemente de cargo ou setor.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F6',26,'AQI-E-26','AQI-E-26','PAR-F6-TRANSP','As decisões importantes são comunicadas de forma transparente.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F6',27,'AQI-E-27','AQI-E-27','PAR-F6-CONDUTA','Existe um código de conduta ou política de ética clara.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F7',28,'AQI-E-28','AQI-E-28','PAR-F7-JORNADA','Minha jornada de trabalho permite descanso adequado.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F7',29,'AQI-E-29','AQI-E-29','PAR-F7-DESLOC','O deslocamento até o trabalho compromete minha qualidade de vida.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F7',30,'AQI-E-30','AQI-E-30','PAR-F7-DESLIG','Consigo me desconectar do trabalho no meu tempo livre.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F7',31,'AQI-E-31','AQI-E-31','PAR-F7-SAUDE','O trabalho tem afetado minha saúde física ou mental.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_emp,'empregado','F7',32,'AQI-E-32','AQI-E-32','PAR-F7-FAMILIA','Consigo conciliar trabalho e vida pessoal/familiar.','escala',true,NULL,NULL,'últimos 3 meses'),
    -- Livres condicionais empregado
    (v_emp,'empregado','F4',33,'AQI-E-L1','AQI-E-L1','PAR-F4-ASSEDIO-COMENT','Se marcou qualquer nível de assédio, humilhação ou discriminação, descreva brevemente (sem identificar terceiros).','livre',false,500,'{"depende_de":"AQI-E-18","valor_min":2}'::jsonb,'últimos 3 meses'),
    (v_emp,'empregado','F1',34,'AQI-E-L2','AQI-E-L2','PAR-F1-CARGA-COMENT','Se percebe volume excessivo de trabalho, cite exemplos ou momentos específicos.','livre',false,500,'{"depende_de":"AQI-E-01","valor_min":4}'::jsonb,'últimos 3 meses'),
    (v_emp,'empregado','F7',35,'AQI-E-L3','AQI-E-L3','PAR-F7-SAUDE-COMENT','Se o trabalho tem afetado sua saúde, descreva os principais sinais que percebeu.','livre',false,500,'{"depende_de":"AQI-E-31","valor_min":4}'::jsonb,'últimos 3 meses');

  -- Perguntas do EMPREGADOR (27 escala + 2 livres)
  INSERT INTO public.psico_individual_perguntas
    (instrumento_versao_id, papel, fator_codigo, ordem, numero, codigo, chave_pareamento, texto, tipo, obrigatoria, limite_texto, regra_condicional, periodo_referencia)
  VALUES
    (v_rep,'empregador','F1', 1,'AQI-R-01','AQI-R-01','PAR-F1-CARGA','A empresa monitora e ajusta a distribuição da carga de trabalho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F1', 2,'AQI-R-02','AQI-R-02','PAR-F1-RITMO','Existem mecanismos formais para evitar ritmo excessivo de trabalho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F1', 3,'AQI-R-03','AQI-R-03','PAR-F1-PRAZOS','Os prazos são negociados considerando a capacidade real da equipe.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F1', 4,'AQI-R-04','AQI-R-04','PAR-F1-EMERG','Situações de urgência são exceção e não rotina.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F2', 5,'AQI-R-05','AQI-R-05','PAR-F2-DECISAO','Os empregados têm autonomia para decidir sobre a execução de tarefas.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F2', 6,'AQI-R-06','AQI-R-06','PAR-F2-METODO','Os empregados podem propor melhorias no método de trabalho.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F2', 7,'AQI-R-07','AQI-R-07','PAR-F2-PAUSA','Pausas são previstas e efetivamente respeitadas.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F2', 8,'AQI-R-08','AQI-R-08','PAR-F2-VOZ','Existem canais formais para escutar sugestões e opiniões.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F3', 9,'AQI-R-09','AQI-R-09','PAR-F3-CHEFIA','As lideranças são preparadas para apoiar as equipes.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F3',10,'AQI-R-10','AQI-R-10','PAR-F3-FEEDBACK','É prática regular oferecer retornos de desempenho aos empregados.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F3',11,'AQI-R-11','AQI-R-11','PAR-F3-CAPACIT','Todos recebem treinamento adequado para suas atribuições.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F3',12,'AQI-R-12','AQI-R-12','PAR-F3-ORIENT','Existe orientação clara sobre a quem recorrer em cada situação.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F4',13,'AQI-R-13','AQI-R-13','PAR-F4-CONVIVIO','A convivência interna é acompanhada e tratada com prioridade.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F4',14,'AQI-R-14','AQI-R-14','PAR-F4-CONFLITO','Existe procedimento formal para tratar conflitos interpessoais.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F4',15,'AQI-R-15','AQI-R-15','PAR-F4-ASSEDIO','Existe política formal contra assédio e discriminação.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F4',16,'AQI-R-16','AQI-R-16','PAR-F4-CANAL','Existe canal de denúncia acessível e confidencial.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F5',17,'AQI-R-17','AQI-R-17','PAR-F5-RECONH','A empresa possui práticas formais de reconhecimento.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F5',18,'AQI-R-18','AQI-R-18','PAR-F5-CRESCIM','Existe plano de desenvolvimento ou trilha de carreira.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F5',19,'AQI-R-19','AQI-R-19','PAR-F5-JUSTA','Critérios de promoção e mudanças de função são documentados.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F6',20,'AQI-R-20','AQI-R-20','PAR-F6-REGRAS','As regras internas são divulgadas de forma clara e acessível.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F6',21,'AQI-R-21','AQI-R-21','PAR-F6-TRATAM','Práticas gerenciais garantem tratamento equitativo.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F6',22,'AQI-R-22','AQI-R-22','PAR-F6-TRANSP','Decisões estratégicas são comunicadas com transparência.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F6',23,'AQI-R-23','AQI-R-23','PAR-F6-CONDUTA','Existe código de conduta ou política de ética implementada.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F7',24,'AQI-R-24','AQI-R-24','PAR-F7-JORNADA','A jornada de trabalho é planejada respeitando o descanso.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F7',25,'AQI-R-25','AQI-R-25','PAR-F7-DESLIG','Existe política ou orientação de direito à desconexão.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F7',26,'AQI-R-26','AQI-R-26','PAR-F7-SAUDE','Existem ações internas de promoção da saúde física e mental.','escala',true,NULL,NULL,'últimos 3 meses'),
    (v_rep,'empregador','F7',27,'AQI-R-27','AQI-R-27','PAR-F7-FAMILIA','Existem benefícios ou flexibilizações que apoiam a vida pessoal e familiar.','escala',true,NULL,NULL,'últimos 3 meses'),
    -- Livres condicionais empregador
    (v_rep,'empregador','F4',28,'AQI-R-L1','AQI-R-L1','PAR-F4-ASSEDIO-COMENT','Se ainda não há política formal contra assédio, descreva o que existe hoje e o planejamento para implantá-la.','livre',false,600,'{"depende_de":"AQI-R-15","valor_max":3}'::jsonb,'últimos 3 meses'),
    (v_rep,'empregador','F3',29,'AQI-R-L2','AQI-R-L2','PAR-F3-CAPACIT-COMENT','Se o treinamento oferecido não é amplo, descreva quais lacunas percebe.','livre',false,600,'{"depende_de":"AQI-R-11","valor_max":3}'::jsonb,'últimos 3 meses');

  -- Opções Likert-5 para todas as perguntas tipo escala dos dois instrumentos
  -- Perguntas de orientação NEGATIVA (alto = exposição): AQI-E-01,02,04,05,18,29,31
  INSERT INTO public.psico_individual_opcoes (pergunta_id, ordem, rotulo, valor_numerico, significa_exposicao)
  SELECT p.id, o.ordem, o.rotulo, o.valor,
    CASE
      WHEN p.codigo IN ('AQI-E-01','AQI-E-02','AQI-E-04','AQI-E-05','AQI-E-18','AQI-E-29','AQI-E-31')
        THEN o.valor >= 4
      ELSE o.valor <= 2
    END
  FROM public.psico_individual_perguntas p
  CROSS JOIN (VALUES
    (1,'Nunca',1::numeric),
    (2,'Raramente',2::numeric),
    (3,'Às vezes',3::numeric),
    (4,'Frequentemente',4::numeric),
    (5,'Quase sempre',5::numeric)
  ) o(ordem, rotulo, valor)
  WHERE p.instrumento_versao_id IN (v_emp, v_rep)
    AND p.tipo = 'escala';

END $seed$;
