
-- Enum de tipos de override
DO $$ BEGIN
  CREATE TYPE public.permission_override_tipo AS ENUM (
    'ver_financeiro', 'ver_comercial', 'acessar_projeto', 'aprovar_documentos'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo public.permission_override_tipo NOT NULL,
  recurso_id UUID NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  motivo TEXT,
  expira_em TIMESTAMPTZ,
  concedido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_unique
  ON public.user_permission_overrides(user_id, tipo, COALESCE(recurso_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx ON public.user_permission_overrides(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam overrides" ON public.user_permission_overrides;
CREATE POLICY "Admins gerenciam overrides" ON public.user_permission_overrides
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Usuario ve seus overrides" ON public.user_permission_overrides;
CREATE POLICY "Usuario ve seus overrides" ON public.user_permission_overrides
  FOR SELECT USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_upo_updated ON public.user_permission_overrides;
CREATE TRIGGER trg_upo_updated BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper genérico
CREATE OR REPLACE FUNCTION public.user_has_override(_user_id uuid, _tipo public.permission_override_tipo, _recurso_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permission_overrides
     WHERE user_id = _user_id
       AND tipo = _tipo
       AND ativo = true
       AND (expira_em IS NULL OR expira_em > now())
       AND (recurso_id IS NULL OR recurso_id = _recurso_id)
  )
$$;

-- Atualiza can_see_financeiro / can_see_comercial para respeitar override GLOBAL
CREATE OR REPLACE FUNCTION public.can_see_financeiro()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.user_has_override(auth.uid(), 'ver_financeiro', NULL)
$$;

CREATE OR REPLACE FUNCTION public.can_see_comercial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.has_role(auth.uid(), 'comercial')
    OR public.user_has_override(auth.uid(), 'ver_comercial', NULL)
$$;

-- can_see_internal considera override comercial (para CRM/Propostas)
CREATE OR REPLACE FUNCTION public.can_see_internal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin')
      OR public.has_role(_user_id,'comercial')
      OR public.user_has_override(_user_id, 'ver_comercial', NULL)
$$;

-- Acesso a projeto passa a considerar override específico
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_uid uuid, _projeto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid)
    OR public.has_role(_uid, 'financeiro')
    OR public.user_has_override(_uid, 'ver_financeiro', NULL)
    OR public.user_has_override(_uid, 'acessar_projeto', _projeto_id)
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = _projeto_id AND (p.gestor_id = _uid OR p.responsavel_comercial_id = _uid))
    OR EXISTS (SELECT 1 FROM public.projeto_servicos ps WHERE ps.projeto_id = _projeto_id AND ps.responsavel_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       JOIN public.os_equipe oe ON oe.os_id = os.id
       JOIN public.execucao_profissionais ep ON ep.id = oe.profissional_id
       WHERE os.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.projeto_id = _projeto_id AND os.responsavel_tecnico_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.execucao_servico_equipe ese ON ese.execucao_id = es.id
       JOIN public.execucao_profissionais ep ON ep.id = ese.profissional_id
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND es.responsavel_tecnico_id = _uid)
  )
$$;

-- Helper para aprovar documentos
CREATE OR REPLACE FUNCTION public.user_can_approve_document(_uid uuid, _doc_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin')
    OR public.user_has_override(_uid, 'aprovar_documentos', NULL)
    OR (_doc_id IS NOT NULL AND public.user_has_override(_uid, 'aprovar_documentos', _doc_id))
  )
$$;
