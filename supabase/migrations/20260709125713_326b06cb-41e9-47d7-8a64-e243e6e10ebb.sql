
-- =========================================================
-- 1. Tabela proposal_aceites
-- =========================================================
CREATE TABLE public.proposal_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  revisao integer,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceito','recusado','expirado','cancelado')),

  -- Dados do signatário
  aceito_por_nome text,
  aceito_por_email text,
  aceito_por_cpf text,
  aceito_por_cargo text,
  assinatura_base64 text,
  observacoes text,
  motivo_recusa text,

  -- Auditoria
  ip text,
  user_agent text,
  hash_documento text,

  -- Datas
  enviado_em timestamptz DEFAULT now(),
  visualizado_em timestamptz,
  aceito_em timestamptz,
  recusado_em timestamptz,
  expires_at timestamptz,

  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GRANTs (anon precisa ler/atualizar via token — o token é o segredo)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_aceites TO authenticated;
GRANT SELECT, UPDATE ON public.proposal_aceites TO anon;
GRANT ALL ON public.proposal_aceites TO service_role;

-- 3. RLS
ALTER TABLE public.proposal_aceites ENABLE ROW LEVEL SECURITY;

-- Internos: acesso completo
CREATE POLICY "aceites_internos_all"
  ON public.proposal_aceites
  FOR ALL
  TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- Público (anon): pode ler qualquer registro (o token na URL é o "segredo")
CREATE POLICY "aceites_anon_select"
  ON public.proposal_aceites
  FOR SELECT
  TO anon
  USING (true);

-- Público (anon): só pode atualizar quando ainda estiver pendente,
-- e apenas mudando para aceito/recusado ou registrando visualização
CREATE POLICY "aceites_anon_update_pendente"
  ON public.proposal_aceites
  FOR UPDATE
  TO anon
  USING (status = 'pendente')
  WITH CHECK (status IN ('pendente','aceito','recusado'));

-- 4. Índices
CREATE INDEX idx_proposal_aceites_proposal ON public.proposal_aceites(proposal_id);
CREATE INDEX idx_proposal_aceites_token    ON public.proposal_aceites(token);
CREATE INDEX idx_proposal_aceites_status   ON public.proposal_aceites(status);

-- 5. Trigger updated_at
CREATE TRIGGER trg_proposal_aceites_updated_at
  BEFORE UPDATE ON public.proposal_aceites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Trigger: efeitos ao aceitar / recusar
CREATE OR REPLACE FUNCTION public.proposal_aceite_registrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_should_aceitar boolean := false;
  v_should_recusar boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_aceitar := (NEW.status = 'aceito');
    v_should_recusar := (NEW.status = 'recusado');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_aceitar := (NEW.status = 'aceito'   AND OLD.status IS DISTINCT FROM 'aceito');
    v_should_recusar := (NEW.status = 'recusado' AND OLD.status IS DISTINCT FROM 'recusado');
  END IF;

  IF v_should_aceitar THEN
    NEW.aceito_em := COALESCE(NEW.aceito_em, now());
    UPDATE public.proposals
       SET status = 'aprovada',
           data_aprovacao = COALESCE(data_aprovacao, CURRENT_DATE)
     WHERE id = NEW.proposal_id
       AND status NOT IN ('aprovada','cancelada');
  END IF;

  IF v_should_recusar THEN
    NEW.recusado_em := COALESCE(NEW.recusado_em, now());
    UPDATE public.proposals
       SET status = 'recusada',
           data_recusa = COALESCE(data_recusa, CURRENT_DATE)
     WHERE id = NEW.proposal_id
       AND status NOT IN ('aprovada','cancelada','recusada');
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_proposal_aceite_registrar_bi
  BEFORE INSERT ON public.proposal_aceites
  FOR EACH ROW EXECUTE FUNCTION public.proposal_aceite_registrar();

CREATE TRIGGER trg_proposal_aceite_registrar_bu
  BEFORE UPDATE ON public.proposal_aceites
  FOR EACH ROW EXECUTE FUNCTION public.proposal_aceite_registrar();
