
-- ============ ENUM: marcos de vencimento ============
DO $$ BEGIN
  CREATE TYPE public.cond_pag_marco AS ENUM (
    'aceite_proposta',
    'emissao_nf',
    'inicio_servico',
    'conclusao_servico',
    'entrega_documento',
    'data_fixa',
    'mensal_recorrente',
    'definido_posteriormente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adiciona status "aguardando_evento" ao enum de parcelas financeiras
DO $$ BEGIN
  ALTER TYPE public.fin_status_parcela ADD VALUE IF NOT EXISTS 'aguardando_evento';
EXCEPTION WHEN others THEN NULL; END $$;

-- ============ TABELA: condições de pagamento (modelos) ============
CREATE TABLE IF NOT EXISTS public.condicoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  quantidade_parcelas int NOT NULL DEFAULT 1,
  is_padrao boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  texto_complementar text,
  permite_mensal_recorrente boolean NOT NULL DEFAULT false,
  em_uso boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cond_pag_ativa ON public.condicoes_pagamento(ativa);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cond_pag_unico_padrao ON public.condicoes_pagamento(is_padrao) WHERE is_padrao = true AND ativa = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicoes_pagamento TO authenticated;
GRANT ALL ON public.condicoes_pagamento TO service_role;
ALTER TABLE public.condicoes_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cond pag select autenticado" ON public.condicoes_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cond pag admin manage" ON public.condicoes_pagamento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TABELA: parcelas dos modelos ============
CREATE TABLE IF NOT EXISTS public.condicoes_pagamento_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condicao_id uuid NOT NULL REFERENCES public.condicoes_pagamento(id) ON DELETE CASCADE,
  numero int NOT NULL,
  percentual numeric(6,3) NOT NULL,
  marco public.cond_pag_marco NOT NULL DEFAULT 'aceite_proposta',
  dias_apos_marco int NOT NULL DEFAULT 0,
  dia_mes int,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condicao_id, numero),
  CHECK (percentual > 0),
  CHECK (dias_apos_marco >= 0),
  CHECK (dia_mes IS NULL OR (dia_mes BETWEEN 1 AND 31))
);
CREATE INDEX IF NOT EXISTS idx_cond_pag_parc_cond ON public.condicoes_pagamento_parcelas(condicao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicoes_pagamento_parcelas TO authenticated;
GRANT ALL ON public.condicoes_pagamento_parcelas TO service_role;
ALTER TABLE public.condicoes_pagamento_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cond pag parc select autenticado" ON public.condicoes_pagamento_parcelas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cond pag parc admin manage" ON public.condicoes_pagamento_parcelas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Validação: soma dos percentuais == 100 ============
CREATE OR REPLACE FUNCTION public.cond_pag_validar_soma()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cond uuid;
  v_soma numeric(10,3);
  v_qtd int;
  v_cadastradas int;
BEGIN
  v_cond := COALESCE(NEW.condicao_id, OLD.condicao_id);
  SELECT COALESCE(SUM(percentual),0), COUNT(*) INTO v_soma, v_cadastradas
    FROM public.condicoes_pagamento_parcelas WHERE condicao_id = v_cond;
  IF v_cadastradas = 0 THEN RETURN NEW; END IF;
  IF ROUND(v_soma, 2) <> 100.00 THEN
    RAISE EXCEPTION 'A soma dos percentuais das parcelas deve ser 100%% (atual: %)', v_soma;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cond_pag_valida_soma ON public.condicoes_pagamento_parcelas;
CREATE CONSTRAINT TRIGGER trg_cond_pag_valida_soma
  AFTER INSERT OR UPDATE OR DELETE ON public.condicoes_pagamento_parcelas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_validar_soma();

-- ============ Trigger de updated_at ============
CREATE OR REPLACE FUNCTION public.cond_pag_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cond_pag_upd ON public.condicoes_pagamento;
CREATE TRIGGER trg_cond_pag_upd BEFORE UPDATE ON public.condicoes_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_set_updated_at();

DROP TRIGGER IF EXISTS trg_cond_pag_parc_upd ON public.condicoes_pagamento_parcelas;
CREATE TRIGGER trg_cond_pag_parc_upd BEFORE UPDATE ON public.condicoes_pagamento_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_set_updated_at();

-- ============ TABELA: snapshot da condição na proposta ============
CREATE TABLE IF NOT EXISTS public.proposal_condicao_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  condicao_id uuid REFERENCES public.condicoes_pagamento(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  quantidade_parcelas int NOT NULL DEFAULT 1,
  texto_complementar text,
  personalizada boolean NOT NULL DEFAULT false,
  data_fixa date,
  dia_mes int,
  qtd_mensalidades int,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id)
);
CREATE INDEX IF NOT EXISTS idx_prop_cond_pag_prop ON public.proposal_condicao_pagamento(proposal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_condicao_pagamento TO authenticated;
GRANT ALL ON public.proposal_condicao_pagamento TO service_role;
ALTER TABLE public.proposal_condicao_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prop cond pag auth" ON public.proposal_condicao_pagamento
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_prop_cond_pag_upd ON public.proposal_condicao_pagamento;
CREATE TRIGGER trg_prop_cond_pag_upd BEFORE UPDATE ON public.proposal_condicao_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_set_updated_at();

-- ============ TABELA: parcelas do snapshot ============
CREATE TABLE IF NOT EXISTS public.proposal_condicao_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_condicao_id uuid NOT NULL REFERENCES public.proposal_condicao_pagamento(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  numero int NOT NULL,
  percentual numeric(6,3) NOT NULL,
  valor numeric(14,2),
  marco public.cond_pag_marco NOT NULL DEFAULT 'aceite_proposta',
  dias_apos_marco int NOT NULL DEFAULT 0,
  dia_mes int,
  data_fixa date,
  data_vencimento_prevista date,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_condicao_id, numero),
  CHECK (percentual > 0)
);
CREATE INDEX IF NOT EXISTS idx_prop_cond_parc_prop ON public.proposal_condicao_parcelas(proposal_id);
CREATE INDEX IF NOT EXISTS idx_prop_cond_parc_cond ON public.proposal_condicao_parcelas(proposal_condicao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_condicao_parcelas TO authenticated;
GRANT ALL ON public.proposal_condicao_parcelas TO service_role;
ALTER TABLE public.proposal_condicao_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prop cond parc auth" ON public.proposal_condicao_parcelas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_prop_cond_parc_upd ON public.proposal_condicao_parcelas;
CREATE TRIGGER trg_prop_cond_parc_upd BEFORE UPDATE ON public.proposal_condicao_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_set_updated_at();

-- ============ Configuração: texto padrão de pagamento ============
ALTER TABLE public.financeiro_configuracoes
  ADD COLUMN IF NOT EXISTS texto_padrao_pagamento text
    NOT NULL DEFAULT 'HSE Consulting emitirá nota fiscal de prestação do serviço.
Pagamento via boleto bancário e/ou transferência bancária.';

-- ============ Marcar em_uso quando snapshot referencia o modelo ============
CREATE OR REPLACE FUNCTION public.cond_pag_marcar_em_uso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.condicao_id IS NOT NULL THEN
    UPDATE public.condicoes_pagamento SET em_uso = true WHERE id = NEW.condicao_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cond_pag_em_uso ON public.proposal_condicao_pagamento;
CREATE TRIGGER trg_cond_pag_em_uso
  AFTER INSERT OR UPDATE OF condicao_id ON public.proposal_condicao_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_marcar_em_uso();

-- ============ Bloqueia DELETE em condições em uso ============
CREATE OR REPLACE FUNCTION public.cond_pag_bloqueia_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.proposal_condicao_pagamento WHERE condicao_id = OLD.id) THEN
    RAISE EXCEPTION 'Condição já utilizada em propostas. Inative em vez de excluir.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_cond_pag_delete ON public.condicoes_pagamento;
CREATE TRIGGER trg_cond_pag_delete BEFORE DELETE ON public.condicoes_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.cond_pag_bloqueia_delete();

-- ============ SEED dos 13 modelos ============
DO $$
DECLARE
  v_id uuid;
  v_ord int := 0;
BEGIN
  -- Cria apenas se ainda não há nenhum modelo cadastrado (idempotente na primeira instalação)
  IF EXISTS (SELECT 1 FROM public.condicoes_pagamento) THEN RETURN; END IF;

  -- Helper via bloco inline: cada modelo é inserido e recebemos o id
  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, is_padrao, ordem)
    VALUES ('À vista no aceite', 1, true, 1) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 0, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('À vista em 10 dias', 1, 2) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 10, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('À vista em 20 dias', 1, 3) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 20, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('À vista em 30 dias', 1, 4) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 30, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('À vista em 45 dias', 1, 5) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 45, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('À vista em 60 dias', 1, 6) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem)
    VALUES (v_id, 1, 100, 'aceite_proposta', 60, 1);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('2 parcelas — 50/50', 2, 7) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 50, 'aceite_proposta', 0, 1),
    (v_id, 2, 50, 'aceite_proposta', 30, 2);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('2 parcelas — 30/70', 2, 8) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 30, 'aceite_proposta', 0, 1),
    (v_id, 2, 70, 'conclusao_servico', 0, 2);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('2 parcelas — aceite e entrega', 2, 9) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 50, 'aceite_proposta', 0, 1),
    (v_id, 2, 50, 'entrega_documento', 0, 2);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('3 parcelas — 30/30/40', 3, 10) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 30, 'aceite_proposta', 0, 1),
    (v_id, 2, 30, 'aceite_proposta', 30, 2),
    (v_id, 3, 40, 'aceite_proposta', 60, 3);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('3 parcelas iguais', 3, 11) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 33.33, 'aceite_proposta', 0, 1),
    (v_id, 2, 33.33, 'aceite_proposta', 30, 2),
    (v_id, 3, 33.34, 'aceite_proposta', 60, 3);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem)
    VALUES ('4 parcelas iguais', 4, 12) RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 25, 'aceite_proposta', 0, 1),
    (v_id, 2, 25, 'aceite_proposta', 30, 2),
    (v_id, 3, 25, 'aceite_proposta', 60, 3),
    (v_id, 4, 25, 'aceite_proposta', 90, 4);

  INSERT INTO public.condicoes_pagamento (nome, quantidade_parcelas, ordem, permite_mensal_recorrente, descricao)
    VALUES ('Mensal recorrente', 1, 13, true, 'Quantidade de mensalidades e dia do vencimento definidos na proposta.') RETURNING id INTO v_id;
  INSERT INTO public.condicoes_pagamento_parcelas (condicao_id, numero, percentual, marco, dias_apos_marco, ordem) VALUES
    (v_id, 1, 100, 'mensal_recorrente', 0, 1);
END $$;
