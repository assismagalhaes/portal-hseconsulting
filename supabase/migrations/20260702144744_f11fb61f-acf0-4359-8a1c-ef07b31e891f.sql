
-- 1) Novo campo tipo
ALTER TABLE public.proposal_revisions
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'outro';

-- 2) Trigger de status da proposta: NÃO cria mais revisão automática, apenas mantém a criação de execuções ao aprovar
CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ao aprovar, dispara criação/atualização de execuções (mantém comportamento anterior)
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    PERFORM public.criar_execucoes_para_proposta(NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- 3) Limpa entradas antigas geradas automaticamente por mudança de status
DELETE FROM public.proposal_revisions
 WHERE titulo = 'Status alterado';

-- 4) Atualiza criar_revisao_proposta para aceitar tipo
CREATE OR REPLACE FUNCTION public.criar_revisao_proposta(
  _proposal_id uuid,
  _motivo text,
  _observacoes text,
  _valor_novo numeric,
  _tipo text DEFAULT 'outro'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_rev int;
  last_val numeric;
  dif numeric;
  dif_pct numeric;
  rev_id uuid;
  titulo_map text;
BEGIN
  SELECT COALESCE(MAX(revisao),0)+1,
         COALESCE(MAX(valor_novo), (SELECT valor_total FROM public.proposals WHERE id=_proposal_id))
    INTO next_rev, last_val
    FROM public.proposal_revisions WHERE proposal_id = _proposal_id;

  dif := COALESCE(_valor_novo,0) - COALESCE(last_val,0);
  dif_pct := CASE WHEN COALESCE(last_val,0) > 0 THEN (dif / last_val) * 100 ELSE 0 END;

  titulo_map := CASE _tipo
    WHEN 'emissao_inicial'    THEN 'Emissão inicial'
    WHEN 'desconto'           THEN 'Desconto comercial'
    WHEN 'alteracao_servicos' THEN 'Alteração de serviços'
    WHEN 'ajuste_tecnico'     THEN 'Ajuste técnico'
    WHEN 'renegociacao'       THEN 'Renegociação'
    ELSE 'Revisão'
  END;

  INSERT INTO public.proposal_revisions(
    proposal_id, revisao, titulo, descricao, motivo, status, tipo,
    valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
    observacoes_internas, user_id
  ) VALUES (
    _proposal_id, next_rev, titulo_map, _motivo, _motivo, 'rascunho', _tipo,
    last_val, _valor_novo, dif, dif_pct,
    _observacoes, auth.uid()
  ) RETURNING id INTO rev_id;

  UPDATE public.proposals SET revisao_atual = next_rev WHERE id = _proposal_id;
  RETURN rev_id;
END $$;

REVOKE ALL ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric,text) TO authenticated;

-- 5) Emissão inicial automática ao criar proposta
CREATE OR REPLACE FUNCTION public.proposal_emissao_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.proposal_revisions(
    proposal_id, revisao, titulo, descricao, motivo, status, tipo,
    valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
    user_id
  ) VALUES (
    NEW.id, 1, 'Emissão inicial', 'Criação da proposta', 'Emissão inicial',
    'rascunho', 'emissao_inicial',
    0, COALESCE(NEW.valor_total,0), COALESCE(NEW.valor_total,0), 0,
    auth.uid()
  );
  UPDATE public.proposals SET revisao_atual = 1 WHERE id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposal_emissao_inicial ON public.proposals;
CREATE TRIGGER trg_proposal_emissao_inicial
  AFTER INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposal_emissao_inicial();
