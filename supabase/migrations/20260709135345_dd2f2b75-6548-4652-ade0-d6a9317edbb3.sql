
CREATE OR REPLACE FUNCTION public.notificar_aceite_proposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_prop record;
  v_cli_nome text;
  v_titulo text;
  v_msg text;
  v_link text;
  v_should_notify boolean := false;
  v_is_aceito boolean := false;
  r record;
  v_destinatarios uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_notify := (NEW.status IN ('aceito','recusado'));
    v_is_aceito := (NEW.status = 'aceito');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := (NEW.status IN ('aceito','recusado') AND OLD.status IS DISTINCT FROM NEW.status);
    v_is_aceito := (NEW.status = 'aceito');
  END IF;

  IF NOT v_should_notify THEN RETURN NEW; END IF;

  SELECT p.id, p.numero, p.valor_total, p.created_by, p.client_id,
         COALESCE(c.nome_fantasia, c.razao_social) AS cliente_nome
    INTO v_prop
    FROM public.proposals p
    LEFT JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = NEW.proposal_id;

  v_cli_nome := COALESCE(v_prop.cliente_nome, 'Cliente');
  v_link := '/propostas/' || v_prop.id;

  IF v_is_aceito THEN
    v_titulo := '✅ Proposta ' || COALESCE(v_prop.numero,'') || ' aceita';
    v_msg := v_cli_nome
      || ' aceitou a proposta'
      || COALESCE(' (R$ ' || to_char(v_prop.valor_total, 'FM999G999G990D00') || ')', '')
      || COALESCE(' — assinada por ' || NEW.aceito_por_nome, '') || '.';
  ELSE
    v_titulo := '❌ Proposta ' || COALESCE(v_prop.numero,'') || ' recusada';
    v_msg := v_cli_nome || ' recusou a proposta.'
      || COALESCE(' Motivo: ' || NEW.motivo_recusa, '');
  END IF;

  -- destinatários: admins + responsável comercial da proposta
  SELECT array_agg(DISTINCT user_id) INTO v_destinatarios
    FROM (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
      UNION
      SELECT v_prop.created_by WHERE v_prop.created_by IS NOT NULL
    ) u WHERE user_id IS NOT NULL;

  IF v_destinatarios IS NULL THEN RETURN NEW; END IF;

  FOREACH r.user_id IN ARRAY v_destinatarios LOOP
    INSERT INTO public.notificacoes(
      user_id, modulo, tipo, titulo, mensagem, prioridade, status,
      link, entidade_tipo, entidade_id, origem, metadata
    ) VALUES (
      r.user_id, 'propostas',
      CASE WHEN v_is_aceito THEN 'proposta_aceita' ELSE 'proposta_recusada' END,
      v_titulo, v_msg,
      CASE WHEN v_is_aceito THEN 'alta' ELSE 'alta' END,
      'nao_lida',
      v_link, 'proposal', v_prop.id, 'aceite_cliente',
      jsonb_build_object(
        'aceite_id', NEW.id,
        'aceito_por_nome', NEW.aceito_por_nome,
        'aceito_por_email', NEW.aceito_por_email,
        'valor_total', v_prop.valor_total,
        'client_id', v_prop.client_id
      )
    );
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_aceite_proposta_ai ON public.proposal_aceites;
DROP TRIGGER IF EXISTS trg_notificar_aceite_proposta_au ON public.proposal_aceites;

CREATE TRIGGER trg_notificar_aceite_proposta_ai
  AFTER INSERT ON public.proposal_aceites
  FOR EACH ROW EXECUTE FUNCTION public.notificar_aceite_proposta();

CREATE TRIGGER trg_notificar_aceite_proposta_au
  AFTER UPDATE ON public.proposal_aceites
  FOR EACH ROW EXECUTE FUNCTION public.notificar_aceite_proposta();
