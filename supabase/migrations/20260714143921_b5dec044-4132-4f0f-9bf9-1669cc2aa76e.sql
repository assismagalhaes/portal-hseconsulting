
-- ============ FASE 1: Módulo Avaliação de Fatores Psicossociais ============

-- Enums
CREATE TYPE public.psico_metodologia_status AS ENUM ('em_configuracao','ativa','arquivada');
CREATE TYPE public.psico_questionario_status AS ENUM ('em_configuracao','publicada','arquivada');
CREATE TYPE public.psico_avaliacao_status AS ENUM ('rascunho','coleta_em_andamento','coleta_encerrada','resultado_pronto','relatorio_emitido','cancelada');
CREATE TYPE public.psico_sentido_pontuacao AS ENUM ('direta','invertida');
CREATE TYPE public.psico_unidade_calculo AS ENUM ('quantidade_respostas');

-- Sequence para código automático
CREATE SEQUENCE IF NOT EXISTS public.psico_avaliacao_numero_seq;

-- ============ Tabela: psico_metodologias_versoes ============
CREATE TABLE public.psico_metodologias_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  versao TEXT NOT NULL,
  descricao TEXT,
  status public.psico_metodologia_status NOT NULL DEFAULT 'em_configuracao',
  unidade_calculo public.psico_unidade_calculo NOT NULL DEFAULT 'quantidade_respostas',
  faixa_irrelevante_max NUMERIC(5,2),
  faixa_baixo_max NUMERIC(5,2),
  faixa_medio_max NUMERIC(5,2),
  faixa_alto_max NUMERIC(5,2),
  faixa_critico_max NUMERIC(5,2),
  criterio_principal_percentual NUMERIC(5,2),
  criterio_principal_operador TEXT,
  criterio_agravamento_percentual NUMERIC(5,2),
  criterio_agravamento_operador TEXT,
  criterio_critico_percentual NUMERIC(5,2),
  criterio_critico_operador TEXT,
  minimo_respondentes_global INTEGER DEFAULT 2,
  minimo_respondentes_segmentacao INTEGER DEFAULT 3,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  publicado_em TIMESTAMPTZ,
  arquivado_em TIMESTAMPTZ,
  atualizado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT psico_metod_faixas_coerentes CHECK (
    (faixa_irrelevante_max IS NULL OR (faixa_irrelevante_max >= 0 AND faixa_irrelevante_max <= 4)) AND
    (faixa_baixo_max IS NULL OR (faixa_baixo_max >= 0 AND faixa_baixo_max <= 4)) AND
    (faixa_medio_max IS NULL OR (faixa_medio_max >= 0 AND faixa_medio_max <= 4)) AND
    (faixa_alto_max IS NULL OR (faixa_alto_max >= 0 AND faixa_alto_max <= 4)) AND
    (faixa_critico_max IS NULL OR (faixa_critico_max >= 0 AND faixa_critico_max <= 4))
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_metodologias_versoes TO authenticated;
GRANT ALL ON public.psico_metodologias_versoes TO service_role;
ALTER TABLE public.psico_metodologias_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_metod_select_interno" ON public.psico_metodologias_versoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_metod_admin_manage" ON public.psico_metodologias_versoes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_psico_metod_updated_at BEFORE UPDATE ON public.psico_metodologias_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Tabela: psico_questionarios_versoes ============
CREATE TABLE public.psico_questionarios_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metodologia_versao_id UUID REFERENCES public.psico_metodologias_versoes(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  versao TEXT NOT NULL,
  subtitulo TEXT,
  texto_abertura TEXT,
  aviso_nao_avaliacao_psicologica TEXT,
  orientacao_periodo_referencia TEXT,
  status public.psico_questionario_status NOT NULL DEFAULT 'em_configuracao',
  quantidade_perguntas_prevista INTEGER NOT NULL DEFAULT 35,
  publicado_em TIMESTAMPTZ,
  arquivado_em TIMESTAMPTZ,
  criado_por UUID REFERENCES auth.users(id),
  atualizado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_questionarios_versoes TO authenticated;
GRANT ALL ON public.psico_questionarios_versoes TO service_role;
ALTER TABLE public.psico_questionarios_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_quest_select_interno" ON public.psico_questionarios_versoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_quest_admin_manage" ON public.psico_questionarios_versoes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_psico_quest_updated_at BEFORE UPDATE ON public.psico_questionarios_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Tabela: psico_fatores ============
CREATE TABLE public.psico_fatores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionario_versao_id UUID NOT NULL REFERENCES public.psico_questionarios_versoes(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (questionario_versao_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_fatores TO authenticated;
GRANT ALL ON public.psico_fatores TO service_role;
ALTER TABLE public.psico_fatores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_fatores_select_interno" ON public.psico_fatores
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_fatores_admin_manage" ON public.psico_fatores
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_psico_fatores_updated_at BEFORE UPDATE ON public.psico_fatores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Tabela: psico_perguntas ============
CREATE TABLE public.psico_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionario_versao_id UUID NOT NULL REFERENCES public.psico_questionarios_versoes(id) ON DELETE CASCADE,
  fator_id UUID REFERENCES public.psico_fatores(id) ON DELETE SET NULL,
  numero INTEGER NOT NULL,
  texto TEXT NOT NULL,
  texto_apoio_exemplo TEXT,
  sentido_pontuacao public.psico_sentido_pontuacao NOT NULL DEFAULT 'direta',
  obrigatoria BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (questionario_versao_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_perguntas TO authenticated;
GRANT ALL ON public.psico_perguntas TO service_role;
ALTER TABLE public.psico_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_perg_select_interno" ON public.psico_perguntas
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_perg_admin_manage" ON public.psico_perguntas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_psico_perg_updated_at BEFORE UPDATE ON public.psico_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Função: gerar código da avaliação ============
CREATE OR REPLACE FUNCTION public.psico_gerar_codigo_avaliacao()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.psico_avaliacao_numero_seq');
  RETURN 'AFP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY') || '-' || lpad(n::text, 6, '0');
END $$;

-- ============ Tabela: psico_avaliacoes ============
CREATE TABLE public.psico_avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE DEFAULT public.psico_gerar_codigo_avaliacao(),
  cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  metodologia_versao_id UUID REFERENCES public.psico_metodologias_versoes(id),
  questionario_versao_id UUID REFERENCES public.psico_questionarios_versoes(id),
  servico_execucao_id UUID REFERENCES public.execucao_servicos(id),
  titulo TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'Geral',
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  quantidade_participantes_prevista INTEGER NOT NULL DEFAULT 1,
  responsavel_hse_id UUID REFERENCES auth.users(id),
  status public.psico_avaliacao_status NOT NULL DEFAULT 'rascunho',
  observacoes_internas TEXT,
  motivo_cancelamento TEXT,
  cancelado_por UUID REFERENCES auth.users(id),
  cancelado_em TIMESTAMPTZ,
  criado_por UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  atualizado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT psico_aval_qtd_min CHECK (quantidade_participantes_prevista >= 1),
  CONSTRAINT psico_aval_datas CHECK (data_fim_prevista IS NULL OR data_inicio_prevista IS NULL OR data_fim_prevista >= data_inicio_prevista)
);

CREATE INDEX psico_aval_cliente_idx ON public.psico_avaliacoes(cliente_id);
CREATE INDEX psico_aval_status_idx ON public.psico_avaliacoes(status);
CREATE INDEX psico_aval_resp_idx ON public.psico_avaliacoes(responsavel_hse_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_avaliacoes TO authenticated;
GRANT ALL ON public.psico_avaliacoes TO service_role;
ALTER TABLE public.psico_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_aval_select_interno" ON public.psico_avaliacoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_aval_insert_interno" ON public.psico_avaliacoes
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_aval_update_interno" ON public.psico_avaliacoes
  FOR UPDATE TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
-- Sem DELETE via aplicação (hard-delete bloqueado)

CREATE TRIGGER trg_psico_aval_updated_at BEFORE UPDATE ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Tabela: psico_auditoria ============
CREATE TABLE public.psico_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  metadados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX psico_aud_entidade_idx ON public.psico_auditoria(entidade, entidade_id);
CREATE INDEX psico_aud_created_idx ON public.psico_auditoria(created_at DESC);

GRANT SELECT, INSERT ON public.psico_auditoria TO authenticated;
GRANT ALL ON public.psico_auditoria TO service_role;
ALTER TABLE public.psico_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_aud_select_interno" ON public.psico_auditoria
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_aud_insert_interno" ON public.psico_auditoria
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
-- Sem UPDATE nem DELETE via aplicação

-- ============ Trigger de auditoria da avaliação ============
CREATE OR REPLACE FUNCTION public.psico_avaliacao_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_acao TEXT; v_resumo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, dados_novos, usuario_id, metadados)
    VALUES ('avaliacao', NEW.id, 'avaliacao_criada',
            jsonb_build_object('codigo', NEW.codigo, 'titulo', NEW.titulo, 'status', NEW.status),
            auth.uid(),
            jsonb_build_object('resumo', 'Avaliação ' || NEW.codigo || ' criada em rascunho'));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
      v_acao := 'avaliacao_cancelada';
      v_resumo := 'Avaliação cancelada. Motivo: ' || COALESCE(NEW.motivo_cancelamento, '—');
      NEW.cancelado_em := COALESCE(NEW.cancelado_em, now());
      NEW.cancelado_por := COALESCE(NEW.cancelado_por, auth.uid());
    ELSE
      v_acao := 'avaliacao_editada';
      v_resumo := 'Avaliação atualizada';
    END IF;
    INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id, metadados)
    VALUES ('avaliacao', NEW.id, v_acao,
            jsonb_build_object('status', OLD.status, 'titulo', OLD.titulo, 'motivo_cancelamento', OLD.motivo_cancelamento),
            jsonb_build_object('status', NEW.status, 'titulo', NEW.titulo, 'motivo_cancelamento', NEW.motivo_cancelamento),
            auth.uid(),
            jsonb_build_object('resumo', v_resumo));
    NEW.atualizado_por := auth.uid();
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_psico_aval_audit
  BEFORE INSERT OR UPDATE ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_avaliacao_audit();

-- ============ Dados iniciais: Metodologia HSE-PSICO-2.0 ============
INSERT INTO public.psico_metodologias_versoes (
  codigo, nome, versao, descricao, status, unidade_calculo,
  faixa_irrelevante_max, faixa_baixo_max, faixa_medio_max, faixa_alto_max, faixa_critico_max,
  criterio_principal_percentual, criterio_principal_operador,
  criterio_agravamento_percentual, criterio_agravamento_operador,
  criterio_critico_percentual, criterio_critico_operador,
  minimo_respondentes_global, minimo_respondentes_segmentacao
) VALUES (
  'HSE-PSICO-2.0',
  'Metodologia HSE Consulting — Avaliação de Fatores Psicossociais',
  '2.0',
  'Metodologia própria da HSE Consulting baseada na consolidação das quantidades de respostas válidas, aplicação de pesos de 0 a 4, classificação por faixas e critérios próprios de significância.',
  'em_configuracao', 'quantidade_respostas',
  0.80, 1.60, 2.40, 3.20, 4.00,
  50, '>', 30, '>=', 10, '>=',
  2, 3
);

-- ============ Dados iniciais: Questionário QPPOT-2.0 ============
INSERT INTO public.psico_questionarios_versoes (
  metodologia_versao_id, codigo, nome, versao, subtitulo, texto_abertura,
  aviso_nao_avaliacao_psicologica, orientacao_periodo_referencia,
  status, quantidade_perguntas_prevista
) VALUES (
  (SELECT id FROM public.psico_metodologias_versoes WHERE codigo = 'HSE-PSICO-2.0'),
  'QPPOT-2.0',
  'Questionário de Percepção Psicoorganizacional no Trabalho',
  '2.0',
  'Instrumento coletivo de percepção sobre fatores psicossociais relacionados às condições e à organização do trabalho.',
  'Este questionário tem como objetivo conhecer a percepção dos trabalhadores sobre as condições e a organização do trabalho, identificando pontos positivos e situações que possam necessitar de melhoria.

A avaliação é conduzida pela HSE Consulting e possui caráter coletivo e preventivo. Ela não constitui avaliação psicológica, diagnóstico clínico ou avaliação individual da saúde mental.

A identificação dos participantes será utilizada exclusivamente para controle de participação e será mantida separada do conteúdo das respostas. A empresa receberá somente resultados coletivos consolidados, sem acesso às respostas individuais.

Responda com sinceridade e de acordo com a sua realidade no trabalho. Não existem respostas certas ou erradas.',
  'Este instrumento não constitui avaliação psicológica, diagnóstico clínico ou avaliação individual da saúde mental do trabalhador.',
  'Considere principalmente sua experiência de trabalho nos últimos seis meses. Caso trabalhe na empresa há menos tempo, considere o período desde sua admissão.',
  'em_configuracao', 35
);
