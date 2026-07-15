-- ===========================================================
-- FASE 7 (1/3): Enums, tabelas, GRANTs, triggers, RLS
-- ===========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.psico_biblioteca_status AS ENUM ('em_configuracao','publicada','arquivada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_medida_nivel AS ENUM ('essencial','complementar','estruturante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_medida_complexidade AS ENUM ('baixa','media','alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_medida_custo AS ENUM ('baixo','medio','alto','variavel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_revisao_status AS ENUM ('rascunho','pronta_para_aprovacao','aprovada','reaberta','substituida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_revisao_modo AS ENUM ('rapida','detalhada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_tratamento_tecnico AS ENUM ('acao_recomendada','monitoramento_preventivo','sem_acao_especifica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_plano_modo AS ENUM ('enxuto','completo','personalizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_plano_status AS ENUM ('rascunho','revisado','aprovado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.psico_abrangencia_tipo AS ENUM ('global','funcao','setor','unidade');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- === Biblioteca versionada
CREATE TABLE IF NOT EXISTS public.psico_bibliotecas_medidas_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  versao TEXT NOT NULL,
  metodologia_versao_id UUID REFERENCES public.psico_metodologias_versoes(id),
  descricao TEXT,
  fonte TEXT,
  status public.psico_biblioteca_status NOT NULL DEFAULT 'em_configuracao',
  vigente BOOLEAN NOT NULL DEFAULT false,
  quantidade_fatores_prevista INTEGER NOT NULL DEFAULT 7,
  quantidade_medidas_prevista INTEGER NOT NULL DEFAULT 51,
  publicado_por UUID,
  publicado_em TIMESTAMPTZ,
  arquivado_em TIMESTAMPTZ,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadados JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_biblio_codigo_versao ON public.psico_bibliotecas_medidas_versoes(codigo, versao);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_biblio_vigente ON public.psico_bibliotecas_medidas_versoes(vigente) WHERE vigente = true;
GRANT SELECT, INSERT, UPDATE ON public.psico_bibliotecas_medidas_versoes TO authenticated;
GRANT ALL ON public.psico_bibliotecas_medidas_versoes TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_fatores_orientacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biblioteca_versao_id UUID NOT NULL REFERENCES public.psico_bibliotecas_medidas_versoes(id) ON DELETE CASCADE,
  fator_codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  definicao_resumida TEXT NOT NULL,
  impactos_possiveis TEXT[] NOT NULL DEFAULT '{}',
  situacoes_associadas TEXT[] NOT NULL DEFAULT '{}',
  objetivo_medidas TEXT NOT NULL,
  perguntas_avaliacao_interna TEXT[] NOT NULL DEFAULT '{}',
  orientacao_priorizacao TEXT,
  observacao_final TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (biblioteca_versao_id, fator_codigo)
);
GRANT SELECT, INSERT, UPDATE ON public.psico_fatores_orientacoes TO authenticated;
GRANT ALL ON public.psico_fatores_orientacoes TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_medidas_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biblioteca_versao_id UUID NOT NULL REFERENCES public.psico_bibliotecas_medidas_versoes(id) ON DELETE CASCADE,
  fator_codigo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  nivel_recomendacao public.psico_medida_nivel NOT NULL,
  grupo_transversal TEXT,
  o_que_significa TEXT NOT NULL,
  orientacoes_praticas TEXT[] NOT NULL DEFAULT '{}',
  exemplos_aplicacao TEXT[] NOT NULL DEFAULT '{}',
  responsaveis_sugeridos TEXT[] NOT NULL DEFAULT '{}',
  evidencias_recomendadas TEXT[] NOT NULL DEFAULT '{}',
  indicadores_sugeridos TEXT[] NOT NULL DEFAULT '{}',
  prazo_sugerido_dias INTEGER,
  complexidade public.psico_medida_complexidade,
  custo_estimado public.psico_medida_custo,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (biblioteca_versao_id, codigo)
);
CREATE INDEX IF NOT EXISTS ix_psico_medidas_biblio_fator ON public.psico_medidas_modelos(biblioteca_versao_id, fator_codigo, ordem);
GRANT SELECT, INSERT, UPDATE ON public.psico_medidas_modelos TO authenticated;
GRANT ALL ON public.psico_medidas_modelos TO service_role;

-- === Revisão técnica
CREATE TABLE IF NOT EXISTS public.psico_revisoes_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  processamento_id UUID NOT NULL REFERENCES public.psico_resultado_processamentos(id),
  biblioteca_versao_id UUID NOT NULL REFERENCES public.psico_bibliotecas_medidas_versoes(id),
  versao INTEGER NOT NULL DEFAULT 1,
  status public.psico_revisao_status NOT NULL DEFAULT 'rascunho',
  modo public.psico_revisao_modo NOT NULL DEFAULT 'rapida',
  responsavel_tecnico_id UUID,
  contexto_organizacional TEXT,
  limitacoes TEXT,
  conclusao_sugerida TEXT,
  conclusao_tecnica TEXT,
  recomendacao_geral TEXT,
  observacoes_internas TEXT,
  amostra_reduzida BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  responsavel_snapshot JSONB,
  criada_por UUID,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_por UUID,
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_revisao_em TIMESTAMPTZ,
  aprovada_por UUID,
  aprovada_em TIMESTAMPTZ,
  reaberta_por UUID,
  reaberta_em TIMESTAMPTZ,
  motivo_reabertura TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_psico_revisao_ativa ON public.psico_revisoes_tecnicas(processamento_id) WHERE ativa = true;
CREATE INDEX IF NOT EXISTS ix_psico_revisao_avaliacao ON public.psico_revisoes_tecnicas(avaliacao_id);
GRANT SELECT, INSERT, UPDATE ON public.psico_revisoes_tecnicas TO authenticated;
GRANT ALL ON public.psico_revisoes_tecnicas TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_revisoes_fatores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL REFERENCES public.psico_revisoes_tecnicas(id) ON DELETE CASCADE,
  resultado_fator_id UUID NOT NULL REFERENCES public.psico_resultados_fatores(id),
  fator_codigo TEXT NOT NULL,
  significativo_calculado BOOLEAN NOT NULL,
  prioridade_calculada TEXT NOT NULL,
  tratamento_tecnico public.psico_tratamento_tecnico NOT NULL,
  observacao_tecnica TEXT,
  justificativa TEXT,
  ordem_relatorio INTEGER NOT NULL,
  revisado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(revisao_id, resultado_fator_id)
);
GRANT SELECT, INSERT, UPDATE ON public.psico_revisoes_fatores TO authenticated;
GRANT ALL ON public.psico_revisoes_fatores TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_planos_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL UNIQUE REFERENCES public.psico_revisoes_tecnicas(id) ON DELETE CASCADE,
  modo public.psico_plano_modo NOT NULL DEFAULT 'enxuto',
  status public.psico_plano_status NOT NULL DEFAULT 'rascunho',
  titulo TEXT NOT NULL DEFAULT 'Plano de Ação Psicossocial',
  descricao TEXT,
  quantidade_itens INTEGER NOT NULL DEFAULT 0,
  gerado_automaticamente BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.psico_planos_acao TO authenticated;
GRANT ALL ON public.psico_planos_acao TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_plano_acao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.psico_planos_acao(id) ON DELETE CASCADE,
  medida_modelo_id UUID REFERENCES public.psico_medidas_modelos(id),
  codigo_origem TEXT,
  titulo TEXT NOT NULL,
  acao_recomendada TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  orientacoes_praticas TEXT[] NOT NULL DEFAULT '{}',
  exemplos_aplicacao TEXT[] NOT NULL DEFAULT '{}',
  nivel_recomendacao TEXT NOT NULL,
  grupo_transversal TEXT,
  prioridade TEXT NOT NULL,
  responsaveis_sugeridos TEXT[] NOT NULL DEFAULT '{}',
  responsavel_definido TEXT,
  prazo_sugerido_dias INTEGER,
  prazo_sugerido_texto TEXT,
  evidencias_recomendadas TEXT[] NOT NULL DEFAULT '{}',
  indicador_sugerido TEXT,
  abrangencia_tipo public.psico_abrangencia_tipo NOT NULL DEFAULT 'global',
  abrangencia_rotulo TEXT NOT NULL DEFAULT 'Resultado geral',
  personalizado BOOLEAN NOT NULL DEFAULT false,
  gerado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  selecionado BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_psico_plano_itens_plano ON public.psico_plano_acao_itens(plano_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_plano_acao_itens TO authenticated;
GRANT ALL ON public.psico_plano_acao_itens TO service_role;

CREATE TABLE IF NOT EXISTS public.psico_plano_item_fatores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_item_id UUID NOT NULL REFERENCES public.psico_plano_acao_itens(id) ON DELETE CASCADE,
  resultado_fator_id UUID NOT NULL REFERENCES public.psico_resultados_fatores(id),
  fator_codigo TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plano_item_id, resultado_fator_id)
);
GRANT SELECT, INSERT, DELETE ON public.psico_plano_item_fatores TO authenticated;
GRANT ALL ON public.psico_plano_item_fatores TO service_role;

-- =============== TRIGGERS updated_at ===============
CREATE OR REPLACE FUNCTION public.psico_touch_updated() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'psico_revisoes_tecnicas' THEN
    NEW.atualizada_em := now();
  ELSE
    BEGIN NEW.atualizado_em := now(); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN CREATE TRIGGER tg_psico_biblio_touch BEFORE UPDATE ON public.psico_bibliotecas_medidas_versoes FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_orient_touch BEFORE UPDATE ON public.psico_fatores_orientacoes FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_medidas_touch BEFORE UPDATE ON public.psico_medidas_modelos FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_revisao_touch BEFORE UPDATE ON public.psico_revisoes_tecnicas FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_rev_fator_touch BEFORE UPDATE ON public.psico_revisoes_fatores FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_plano_touch BEFORE UPDATE ON public.psico_planos_acao FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_plano_item_touch BEFORE UPDATE ON public.psico_plano_acao_itens FOR EACH ROW EXECUTE FUNCTION public.psico_touch_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============== TRIGGERS imutabilidade ===============
CREATE OR REPLACE FUNCTION public.psico_guard_biblioteca_imutavel() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status public.psico_biblioteca_status;
BEGIN
  SELECT status INTO _status FROM public.psico_bibliotecas_medidas_versoes WHERE id = COALESCE(NEW.biblioteca_versao_id, OLD.biblioteca_versao_id);
  IF _status IN ('publicada','arquivada') THEN
    RAISE EXCEPTION 'Biblioteca publicada/arquivada é imutável. Duplique para editar.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_orient_guard BEFORE UPDATE OR DELETE ON public.psico_fatores_orientacoes FOR EACH ROW EXECUTE FUNCTION public.psico_guard_biblioteca_imutavel(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_medidas_guard BEFORE UPDATE OR DELETE ON public.psico_medidas_modelos FOR EACH ROW EXECUTE FUNCTION public.psico_guard_biblioteca_imutavel(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.psico_guard_revisao_fator() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st public.psico_revisao_status;
BEGIN
  IF (NEW.significativo_calculado IS DISTINCT FROM OLD.significativo_calculado)
     OR (NEW.prioridade_calculada IS DISTINCT FROM OLD.prioridade_calculada)
     OR (NEW.fator_codigo IS DISTINCT FROM OLD.fator_codigo)
     OR (NEW.resultado_fator_id IS DISTINCT FROM OLD.resultado_fator_id) THEN
    RAISE EXCEPTION 'Resultado matemático do fator é imutável na revisão técnica.';
  END IF;
  SELECT status INTO _st FROM public.psico_revisoes_tecnicas WHERE id = NEW.revisao_id;
  IF _st IN ('aprovada','substituida') THEN
    RAISE EXCEPTION 'Revisão técnica aprovada é imutável.';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_rev_fator_guard BEFORE UPDATE ON public.psico_revisoes_fatores FOR EACH ROW EXECUTE FUNCTION public.psico_guard_revisao_fator(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.psico_guard_revisao_aprovada() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.status = 'aprovada' AND TG_OP='UPDATE') THEN
    IF NEW.status = OLD.status AND NEW.reaberta_em IS NOT DISTINCT FROM OLD.reaberta_em THEN
      RAISE EXCEPTION 'Revisão aprovada é imutável. Use reabertura via RPC.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_revisao_guard BEFORE UPDATE ON public.psico_revisoes_tecnicas FOR EACH ROW EXECUTE FUNCTION public.psico_guard_revisao_aprovada(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.psico_guard_plano_aprovado() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st public.psico_plano_status;
BEGIN
  SELECT status INTO _st FROM public.psico_planos_acao WHERE id = COALESCE(NEW.plano_id, OLD.plano_id);
  IF _st = 'aprovado' THEN
    RAISE EXCEPTION 'Plano de ação aprovado é imutável.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DO $$ BEGIN CREATE TRIGGER tg_psico_plano_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.psico_plano_acao_itens FOR EACH ROW EXECUTE FUNCTION public.psico_guard_plano_aprovado(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============== RLS ===============
ALTER TABLE public.psico_bibliotecas_medidas_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_fatores_orientacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_medidas_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_revisoes_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_revisoes_fatores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_planos_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_plano_acao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_plano_item_fatores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "internal all biblio" ON public.psico_bibliotecas_medidas_versoes FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all orient" ON public.psico_fatores_orientacoes FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all medidas" ON public.psico_medidas_modelos FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all revisoes" ON public.psico_revisoes_tecnicas FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all rev fatores" ON public.psico_revisoes_fatores FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all planos" ON public.psico_planos_acao FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all plano itens" ON public.psico_plano_acao_itens FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "internal all plano item fatores" ON public.psico_plano_item_fatores FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;