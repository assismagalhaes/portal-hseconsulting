
-- 1. pricing_params: valor hora técnica
ALTER TABLE public.pricing_params
  ADD COLUMN IF NOT EXISTS valor_hora_tecnica numeric(10,2) NOT NULL DEFAULT 35.00;

-- 2. Histórico do valor hora técnica
CREATE TABLE IF NOT EXISTS public.valor_hora_tecnica_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor numeric(10,2) NOT NULL,
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.valor_hora_tecnica_historico TO authenticated;
GRANT ALL ON public.valor_hora_tecnica_historico TO service_role;
ALTER TABLE public.valor_hora_tecnica_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vht_select" ON public.valor_hora_tecnica_historico
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "vht_insert" ON public.valor_hora_tecnica_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 3. simulacao_custos_compartilhados: tipo + horas
ALTER TABLE public.simulacao_custos_compartilhados
  ADD COLUMN IF NOT EXISTS tipo_custo text NOT NULL DEFAULT 'direto',
  ADD COLUMN IF NOT EXISTS horas numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_hora numeric(10,2),
  ADD COLUMN IF NOT EXISTS observacao text;

-- 4. simulacoes_precificacao: regra horas + vht aplicada
ALTER TABLE public.simulacoes_precificacao
  ADD COLUMN IF NOT EXISTS regra_rateio_horas text,
  ADD COLUMN IF NOT EXISTS valor_hora_tecnica_aplicado numeric(10,2),
  ADD COLUMN IF NOT EXISTS motivo text;

-- 5. historico_precificacao: motivo
ALTER TABLE public.historico_precificacao
  ADD COLUMN IF NOT EXISTS motivo text;

-- 6. proposal_revisions: controle de cenários
ALTER TABLE public.proposal_revisions
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS valor_anterior numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_novo numeric(14,2),
  ADD COLUMN IF NOT EXISTS diferenca_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS diferenca_percentual numeric(6,2),
  ADD COLUMN IF NOT EXISTS observacoes_internas text,
  ADD COLUMN IF NOT EXISTS aprovada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovada_por uuid;

-- 7. proposals: revisão atual
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS revisao_atual int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueada_edicao boolean NOT NULL DEFAULT false;

-- 8. Trigger: ao alterar status de uma revisão para 'aprovada', marca anteriores como 'substituida' e bloqueia proposta
CREATE OR REPLACE FUNCTION public.proposal_revisao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    UPDATE public.proposal_revisions
       SET status = 'substituida'
     WHERE proposal_id = NEW.proposal_id
       AND id <> NEW.id
       AND status = 'aprovada';
    UPDATE public.proposals
       SET revisao_atual = NEW.revisao,
           bloqueada_edicao = true
     WHERE id = NEW.proposal_id;
    NEW.aprovada_em := COALESCE(NEW.aprovada_em, now());
    NEW.aprovada_por := COALESCE(NEW.aprovada_por, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposal_revisao_status ON public.proposal_revisions;
CREATE TRIGGER trg_proposal_revisao_status
  BEFORE UPDATE ON public.proposal_revisions
  FOR EACH ROW EXECUTE FUNCTION public.proposal_revisao_status_change();

-- 9. Função helper: registrar nova revisão com motivo e valores
CREATE OR REPLACE FUNCTION public.criar_revisao_proposta(
  _proposal_id uuid, _motivo text, _observacoes text, _valor_novo numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_rev int;
  last_val numeric;
  rev_id uuid;
  dif numeric;
  dif_pct numeric;
BEGIN
  SELECT COALESCE(MAX(revisao),0)+1, COALESCE(MAX(valor_novo), (SELECT valor_total FROM public.proposals WHERE id=_proposal_id))
    INTO next_rev, last_val
    FROM public.proposal_revisions WHERE proposal_id = _proposal_id;

  dif := COALESCE(_valor_novo,0) - COALESCE(last_val,0);
  dif_pct := CASE WHEN COALESCE(last_val,0) > 0 THEN (dif / last_val) * 100 ELSE NULL END;

  INSERT INTO public.proposal_revisions(
    proposal_id, revisao, titulo, descricao, motivo, status,
    valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
    observacoes_internas, user_id
  ) VALUES (
    _proposal_id, next_rev, 'Revisão '||lpad(next_rev::text,2,'0'),
    _motivo, _motivo, 'rascunho',
    last_val, _valor_novo, dif, dif_pct,
    _observacoes, auth.uid()
  ) RETURNING id INTO rev_id;

  UPDATE public.proposals SET revisao_atual = next_rev WHERE id = _proposal_id;
  RETURN rev_id;
END $$;

REVOKE ALL ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric) TO authenticated;
