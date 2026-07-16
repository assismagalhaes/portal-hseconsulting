
-- ============================================================================
-- FASE 9 — BLOCO 1: FUNDAÇÃO
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.psico_origem_coleta AS ENUM ('portal','importacao_bruta','importacao_agregada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_importacao_tipo AS ENUM ('bruta_respondentes','agregada_perguntas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_importacao_formato AS ENUM ('csv','xlsx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_importacao_status AS ENUM (
    'arquivo_recebido','mapeamento','validando','pronto_para_importar',
    'importando','concluida','concluida_com_avisos','falhou','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_importacao_severidade AS ENUM ('erro','aviso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_resposta_origem AS ENUM ('portal','importacao_bruta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ALTER psico_avaliacoes
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS origem_coleta public.psico_origem_coleta NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS importacao_avaliacao_id uuid,
  ADD COLUMN IF NOT EXISTS importado_em timestamptz,
  ADD COLUMN IF NOT EXISTS importado_por uuid,
  ADD COLUMN IF NOT EXISTS participacao_calculavel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS segmentacao_disponivel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacao_origem text;

-- 3. ALTER psico_respostas
ALTER TABLE public.psico_respostas
  ADD COLUMN IF NOT EXISTS origem_registro public.psico_resposta_origem NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS importacao_id uuid;

-- ============================================================================
-- 4. TABELAS
-- ============================================================================

-- 4.1 psico_importacoes_avaliacoes
CREATE TABLE IF NOT EXISTS public.psico_importacoes_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid REFERENCES public.psico_avaliacoes(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  tipo public.psico_importacao_tipo NOT NULL,
  formato public.psico_importacao_formato NOT NULL,
  status public.psico_importacao_status NOT NULL DEFAULT 'arquivo_recebido',
  nome_arquivo text NOT NULL,
  hash_arquivo_sha256 text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  questionario_versao_id uuid REFERENCES public.psico_questionarios_versoes(id),
  metodologia_versao_id uuid REFERENCES public.psico_metodologias_versoes(id),
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_validas integer NOT NULL DEFAULT 0,
  linhas_invalidas integer NOT NULL DEFAULT 0,
  linhas_ignoradas integer NOT NULL DEFAULT 0,
  respondentes_importados integer NOT NULL DEFAULT 0,
  total_itens_importados integer NOT NULL DEFAULT 0,
  data_resposta_minima date,
  data_resposta_maxima date,
  mapeamento_colunas jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo_validacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  arquivo_temporario_path text,
  arquivo_excluido_em timestamptz,
  idempotency_key text NOT NULL,
  iniciado_por uuid NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  cancelado_em timestamptz,
  erro_codigo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psico_imp_aval_avaliacao ON public.psico_importacoes_avaliacoes(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_psico_imp_aval_cliente ON public.psico_importacoes_avaliacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_psico_imp_aval_status ON public.psico_importacoes_avaliacoes(status);
CREATE INDEX IF NOT EXISTS idx_psico_imp_aval_hash ON public.psico_importacoes_avaliacoes(hash_arquivo_sha256);

-- Unique parcial: impede reimportar mesmo arquivo (mesmo cliente+tipo+questionário) em importação concluída
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_imp_aval_hash_concluida
  ON public.psico_importacoes_avaliacoes(cliente_id, tipo, questionario_versao_id, hash_arquivo_sha256)
  WHERE status IN ('concluida','concluida_com_avisos');

-- Idempotency key único
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_imp_aval_idempotency
  ON public.psico_importacoes_avaliacoes(idempotency_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_importacoes_avaliacoes TO authenticated;
GRANT ALL ON public.psico_importacoes_avaliacoes TO service_role;
ALTER TABLE public.psico_importacoes_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_imp_aval_admin_tec_all"
  ON public.psico_importacoes_avaliacoes FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  );

-- 4.2 psico_importacoes_erros
CREATE TABLE IF NOT EXISTS public.psico_importacoes_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.psico_importacoes_avaliacoes(id) ON DELETE CASCADE,
  numero_linha integer,
  codigo text NOT NULL,
  campo text,
  severidade public.psico_importacao_severidade NOT NULL DEFAULT 'erro',
  mensagem text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psico_imp_erros_importacao ON public.psico_importacoes_erros(importacao_id);
CREATE INDEX IF NOT EXISTS idx_psico_imp_erros_severidade ON public.psico_importacoes_erros(severidade);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_importacoes_erros TO authenticated;
GRANT ALL ON public.psico_importacoes_erros TO service_role;
ALTER TABLE public.psico_importacoes_erros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_imp_erros_admin_tec_all"
  ON public.psico_importacoes_erros FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  );

-- 4.3 psico_importacao_staging_respostas (staging técnico — sem PII, service role only)
CREATE TABLE IF NOT EXISTS public.psico_importacao_staging_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.psico_importacoes_avaliacoes(id) ON DELETE CASCADE,
  row_key text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  data_resposta date,
  funcao text,
  setor text,
  unidade text,
  funcao_normalizada text,
  setor_normalizado text,
  unidade_normalizada text,
  respostas_normalizadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psico_stg_imp ON public.psico_importacao_staging_respostas(importacao_id);

-- Staging: SOMENTE service_role. Sem grant a authenticated/anon.
GRANT ALL ON public.psico_importacao_staging_respostas TO service_role;
ALTER TABLE public.psico_importacao_staging_respostas ENABLE ROW LEVEL SECURITY;

-- Policy que nega usuários autenticados (default sem grant já bloqueia, mas RLS reforça)
CREATE POLICY "psico_stg_service_only"
  ON public.psico_importacao_staging_respostas FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4.4 psico_dados_agregados_perguntas
CREATE TABLE IF NOT EXISTS public.psico_dados_agregados_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.psico_importacoes_avaliacoes(id) ON DELETE RESTRICT,
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  questionario_versao_id uuid NOT NULL REFERENCES public.psico_questionarios_versoes(id),
  metodologia_versao_id uuid NOT NULL REFERENCES public.psico_metodologias_versoes(id),
  pergunta_id uuid NOT NULL REFERENCES public.psico_perguntas(id),
  numero integer NOT NULL,
  quantidade_nunca integer NOT NULL DEFAULT 0 CHECK (quantidade_nunca >= 0),
  quantidade_raramente integer NOT NULL DEFAULT 0 CHECK (quantidade_raramente >= 0),
  quantidade_as_vezes integer NOT NULL DEFAULT 0 CHECK (quantidade_as_vezes >= 0),
  quantidade_frequentemente integer NOT NULL DEFAULT 0 CHECK (quantidade_frequentemente >= 0),
  quantidade_sempre integer NOT NULL DEFAULT 0 CHECK (quantidade_sempre >= 0),
  total_respostas integer NOT NULL CHECK (total_respostas >= 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_psico_agg_total CHECK (
    total_respostas = quantidade_nunca + quantidade_raramente + quantidade_as_vezes
                    + quantidade_frequentemente + quantidade_sempre
  ),
  CONSTRAINT ux_psico_agg_aval_perg UNIQUE (avaliacao_id, pergunta_id)
);

CREATE INDEX IF NOT EXISTS idx_psico_agg_avaliacao ON public.psico_dados_agregados_perguntas(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_psico_agg_importacao ON public.psico_dados_agregados_perguntas(importacao_id);

GRANT SELECT ON public.psico_dados_agregados_perguntas TO authenticated;
GRANT ALL ON public.psico_dados_agregados_perguntas TO service_role;
ALTER TABLE public.psico_dados_agregados_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_agg_admin_tec_select"
  ON public.psico_dados_agregados_perguntas FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
  );
-- Escrita: apenas service_role (via RPCs seguras). Sem policy de insert/update/delete para authenticated.

-- ============================================================================
-- 5. TRIGGERS updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psico_imp_aval_touch ON public.psico_importacoes_avaliacoes;
CREATE TRIGGER trg_psico_imp_aval_touch
  BEFORE UPDATE ON public.psico_importacoes_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated_at();

-- ============================================================================
-- 6. RLS DO BUCKET psico-importacoes (storage.objects)
-- ============================================================================
DROP POLICY IF EXISTS "psico_imp_bucket_admin_tec_all" ON storage.objects;
CREATE POLICY "psico_imp_bucket_admin_tec_all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'psico-importacoes'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'tecnico'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'psico-importacoes'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'tecnico'::app_role)
    )
  );

-- ============================================================================
-- 7. SEED — QPPOT-1.0-LEGADO
-- ============================================================================
DO $seed$
DECLARE
  v_quest_id uuid;
  v_metod_id uuid;
  v_fator_id uuid;
  v_hist_note text := 'Redação materialmente diferente do QPPOT-2.0 — validar contra planilha operacional histórica antes de publicar.';
BEGIN
  -- Metodologia HSE-PSICO-2.0 (reutilizada)
  SELECT id INTO v_metod_id FROM public.psico_metodologias_versoes WHERE codigo = 'HSE-PSICO-2.0' LIMIT 1;
  IF v_metod_id IS NULL THEN
    RAISE EXCEPTION 'Metodologia HSE-PSICO-2.0 não encontrada';
  END IF;

  -- Não criar duas vezes
  IF EXISTS (SELECT 1 FROM public.psico_questionarios_versoes WHERE codigo = 'QPPOT-1.0-LEGADO') THEN
    RETURN;
  END IF;

  INSERT INTO public.psico_questionarios_versoes (
    codigo, nome, versao, metodologia_versao_id, status,
    quantidade_perguntas_prevista, vigente, fonte_referencia, nota_metodologica
  ) VALUES (
    'QPPOT-1.0-LEGADO',
    'Questionário de Percepção Psicoorganizacional no Trabalho — Versão Legada',
    '1.0-LEGADO',
    v_metod_id,
    'em_configuracao',
    35,
    false,
    'Google Forms histórico da HSE Consulting',
    'Versão legada preservada exclusivamente para importação de avaliações históricas. Não deve ser usada em novas coletas pelo portal.'
  ) RETURNING id INTO v_quest_id;

  -- Clonar fatores do QPPOT-2.0
  INSERT INTO public.psico_fatores (questionario_versao_id, codigo, nome, descricao, ordem, ativo, quantidade_perguntas_prevista)
  SELECT v_quest_id, f.codigo, f.nome, f.descricao, f.ordem, f.ativo, f.quantidade_perguntas_prevista
  FROM public.psico_fatores f
  JOIN public.psico_questionarios_versoes q ON q.id = f.questionario_versao_id
  WHERE q.codigo = 'QPPOT-2.0';

  -- Helper para obter fator por código
  -- Inserir 35 perguntas com textos históricos do Google Forms
  PERFORM 1;

  -- 1
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_clareza';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 1, 'Eu entendo claramente o que esperam que eu faça no meu trabalho?', 'invertida', true, 1, true, 'Google Forms histórico');

  -- 2
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 2, 'Eu posso escolher o momento em que faço uma pausa no trabalho?', 'invertida', true, 2, true, 'Google Forms histórico');

  -- 3 (MATERIALMENTE DIFERENTE)
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia, observacao_tecnica)
  VALUES (v_quest_id, v_fator_id, 3, 'É difícil dar conta do que meus colegas e chefes pedem no trabalho?', 'direta', true, 3, true, 'Google Forms histórico', v_hist_note);

  -- 4
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_clareza';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 4, 'Eu sei como fazer o meu trabalho do jeito certo?', 'invertida', true, 4, true, 'Google Forms histórico');

  -- 5
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 5, 'Algumas pessoas falam comigo de forma grossa ou agem de maneira dura?', 'direta', true, 5, true, 'Google Forms histórico');

  -- 6
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 6, 'Recebo prazos que são impossíveis de cumprir?', 'direta', true, 6, true, 'Google Forms histórico');

  -- 7
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='relacoes_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 7, 'Quando o trabalho fica difícil, posso contar com a ajuda dos meus colegas?', 'invertida', true, 7, true, 'Google Forms histórico');

  -- 8 (MATERIALMENTE DIFERENTE)
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_hierarquicos';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia, observacao_tecnica)
  VALUES (v_quest_id, v_fator_id, 8, 'Recebo informações e suporte que me ajudam no trabalho que eu faço.', 'invertida', true, 8, true, 'Google Forms histórico', v_hist_note);

  -- 9
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 9, 'Preciso trabalhar num ritmo muito acelerado ou com muita pressão?', 'direta', true, 9, true, 'Google Forms histórico');

  -- 10
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 10, 'As pessoas escutam minha opinião sobre o ritmo que consigo trabalhar?', 'invertida', true, 10, true, 'Google Forms histórico');

  -- 11
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_clareza';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 11, 'Eu entendo bem quais são as minhas tarefas e responsabilidades no trabalho?', 'invertida', true, 11, true, 'Google Forms histórico');

  -- 12
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 12, 'Deixo de fazer algumas tarefas porque estou sobrecarregado(a) de trabalho?', 'direta', true, 12, true, 'Google Forms histórico');

  -- 13
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_clareza';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 13, 'Eu entendo claramente quais são os objetivos e metas do meu setor?', 'invertida', true, 13, true, 'Google Forms histórico');

  -- 14
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 14, 'Acontecem brigas ou desentendimentos entre os colegas de trabalho?', 'direta', true, 14, true, 'Google Forms histórico');

  -- 15
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 15, 'Tenho liberdade para escolher a melhor maneira de fazer meu trabalho?', 'invertida', true, 15, true, 'Google Forms histórico');

  -- 16
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 16, 'Não consigo fazer pausas suficientes durante o trabalho?', 'direta', true, 16, true, 'Google Forms histórico');

  -- 17
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_clareza';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 17, 'Eu entendo como o meu trabalho ajuda a empresa a alcançar seus objetivos?', 'invertida', true, 17, true, 'Google Forms histórico');

  -- 18
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 18, 'Sou pressionado(a) a trabalhar fora do meu horário normal?', 'direta', true, 18, true, 'Google Forms histórico');

  -- 19
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 19, 'Tenho liberdade para escolher quais tarefas fazer no meu trabalho?', 'invertida', true, 19, true, 'Google Forms histórico');

  -- 20
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 20, 'Preciso fazer meu trabalho muito rápido?', 'direta', true, 20, true, 'Google Forms histórico');

  -- 21
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 21, 'Sinto que estou sendo perseguido(a) ou tratado(a) injustamente no trabalho?', 'direta', true, 21, true, 'Google Forms histórico');

  -- 22 (MATERIALMENTE DIFERENTE)
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='carga_excessiva';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia, observacao_tecnica)
  VALUES (v_quest_id, v_fator_id, 22, 'É impossível fazer as pausas durante o trabalho?', 'direta', true, 22, true, 'Google Forms histórico', v_hist_note);

  -- 23
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_hierarquicos';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 23, 'Posso confiar no meu chefe quando tenho algum problema no trabalho?', 'invertida', true, 23, true, 'Google Forms histórico');

  -- 24
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='relacoes_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 24, 'Meus colegas me ajudam e me apoiam quando preciso?', 'invertida', true, 24, true, 'Google Forms histórico');

  -- 25
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 25, 'Minhas sugestões sobre como fazer meu trabalho são levadas em conta?', 'invertida', true, 25, true, 'Google Forms histórico');

  -- 26
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='gestao_mudancas';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 26, 'Tenho chance de perguntar ao meu chefe quando mudam algo no meu trabalho?', 'invertida', true, 26, true, 'Google Forms histórico');

  -- 27
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='relacoes_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 27, 'No meu trabalho, os colegas me tratam com o respeito que eu mereço?', 'invertida', true, 27, true, 'Google Forms histórico');

  -- 28
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='gestao_mudancas';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 28, 'As pessoas são avisadas ou ouvidas antes de mudarem algo no trabalho?', 'invertida', true, 28, true, 'Google Forms histórico');

  -- 29
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_hierarquicos';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 29, 'Quando algo no trabalho me incomoda ou me irrita, posso conversar com meu chefe?', 'invertida', true, 29, true, 'Google Forms histórico');

  -- 30
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='falta_autonomia';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 30, 'Meu horário de trabalho pode ser flexível?', 'invertida', true, 30, true, 'Google Forms histórico');

  -- 31
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='relacoes_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 31, 'Meus colegas estão disponíveis para me escutar quando tenho problemas no trabalho?', 'invertida', true, 31, true, 'Google Forms histórico');

  -- 32 (MATERIALMENTE DIFERENTE)
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='gestao_mudancas';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia, observacao_tecnica)
  VALUES (v_quest_id, v_fator_id, 32, 'Mesmo quando há mudanças, continuo fazendo meu trabalho com dedicação e cuidado?', 'invertida', true, 32, true, 'Google Forms histórico', v_hist_note);

  -- 33 (MATERIALMENTE DIFERENTE)
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_hierarquicos';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia, observacao_tecnica)
  VALUES (v_quest_id, v_fator_id, 33, 'Tenho lidado com trabalhos que exigem muito do meu emocional?', 'direta', true, 33, true, 'Google Forms histórico', v_hist_note);

  -- 34
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_interpessoais';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 34, 'As minhas relações com as pessoas no trabalho são tensas ou difíceis?', 'direta', true, 34, true, 'Google Forms histórico');

  -- 35
  SELECT id INTO v_fator_id FROM public.psico_fatores WHERE questionario_versao_id=v_quest_id AND codigo='conflitos_hierarquicos';
  INSERT INTO public.psico_perguntas (questionario_versao_id, fator_id, numero, texto, sentido_pontuacao, obrigatoria, ordem, ativa, origem_referencia)
  VALUES (v_quest_id, v_fator_id, 35, 'Meu chefe me incentiva e me motiva no trabalho?', 'invertida', true, 35, true, 'Google Forms histórico');
END
$seed$;
