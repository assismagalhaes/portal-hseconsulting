
-- ============ Histórico de condições de pagamento por proposta ============
CREATE TABLE IF NOT EXISTS public.proposal_condicao_pagamento_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  proposal_condicao_id uuid,
  condicao_id uuid,
  revisao int,
  acao text NOT NULL CHECK (acao IN ('aplicada','personalizada','removida')),
  nome text,
  descricao text,
  texto_complementar text,
  quantidade_parcelas int,
  personalizada boolean,
  parcelas jsonb,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cond_hist_prop ON public.proposal_condicao_pagamento_historico(proposal_id, created_at DESC);

GRANT SELECT, INSERT ON public.proposal_condicao_pagamento_historico TO authenticated;
GRANT ALL ON public.proposal_condicao_pagamento_historico TO service_role;
ALTER TABLE public.proposal_condicao_pagamento_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cond hist select internos" ON public.proposal_condicao_pagamento_historico;
CREATE POLICY "cond hist select internos" ON public.proposal_condicao_pagamento_historico
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comercial')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "cond hist insert autenticado" ON public.proposal_condicao_pagamento_historico;
CREATE POLICY "cond hist insert autenticado" ON public.proposal_condicao_pagamento_historico
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============ Trigger: grava histórico do snapshot ============
CREATE OR REPLACE FUNCTION public.registrar_hist_cond_pag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rev int;
  v_parcelas jsonb;
  v_acao text;
  v_prop uuid;
  v_snap uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_prop := OLD.proposal_id;
    v_snap := OLD.id;
    v_acao := 'removida';
  ELSE
    v_prop := NEW.proposal_id;
    v_snap := NEW.id;
    v_acao := CASE WHEN NEW.personalizada THEN 'personalizada' ELSE 'aplicada' END;
  END IF;

  SELECT revisao_atual INTO v_rev FROM public.proposals WHERE id = v_prop;

  IF TG_OP <> 'DELETE' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'numero', numero,
      'percentual', percentual,
      'valor', valor,
      'marco', marco,
      'dias_apos_marco', dias_apos_marco,
      'dia_mes', dia_mes,
      'descricao', descricao
    ) ORDER BY numero), '[]'::jsonb)
    INTO v_parcelas
    FROM public.proposal_condicao_parcelas
    WHERE proposal_condicao_id = v_snap;
  ELSE
    v_parcelas := '[]'::jsonb;
  END IF;

  INSERT INTO public.proposal_condicao_pagamento_historico (
    proposal_id, proposal_condicao_id, condicao_id, revisao, acao,
    nome, descricao, texto_complementar, quantidade_parcelas, personalizada,
    parcelas, changed_by
  ) VALUES (
    v_prop, v_snap,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.condicao_id ELSE NEW.condicao_id END), NULL),
    v_rev,
    v_acao,
    CASE WHEN TG_OP='DELETE' THEN OLD.nome ELSE NEW.nome END,
    CASE WHEN TG_OP='DELETE' THEN OLD.descricao ELSE NEW.descricao END,
    CASE WHEN TG_OP='DELETE' THEN OLD.texto_complementar ELSE NEW.texto_complementar END,
    CASE WHEN TG_OP='DELETE' THEN OLD.quantidade_parcelas ELSE NEW.quantidade_parcelas END,
    CASE WHEN TG_OP='DELETE' THEN OLD.personalizada ELSE NEW.personalizada END,
    v_parcelas,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_cond_pag_hist_ins ON public.proposal_condicao_pagamento;
CREATE TRIGGER trg_cond_pag_hist_ins
  AFTER INSERT ON public.proposal_condicao_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.registrar_hist_cond_pag();

DROP TRIGGER IF EXISTS trg_cond_pag_hist_upd ON public.proposal_condicao_pagamento;
CREATE TRIGGER trg_cond_pag_hist_upd
  AFTER UPDATE OF nome, texto_complementar, personalizada, condicao_id, quantidade_parcelas ON public.proposal_condicao_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.registrar_hist_cond_pag();

DROP TRIGGER IF EXISTS trg_cond_pag_hist_del ON public.proposal_condicao_pagamento;
CREATE TRIGGER trg_cond_pag_hist_del
  BEFORE DELETE ON public.proposal_condicao_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.registrar_hist_cond_pag();
