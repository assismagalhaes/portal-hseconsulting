
CREATE OR REPLACE FUNCTION public.crm_sync_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op_id uuid;
  v_nova_etapa public.crm_etapa;
BEGIN
  v_nova_etapa := CASE NEW.status::text
    WHEN 'enviada' THEN 'proposta_enviada'::public.crm_etapa
    WHEN 'negociacao' THEN 'negociacao'::public.crm_etapa
    WHEN 'aprovada' THEN 'ganho'::public.crm_etapa
    WHEN 'recusada' THEN 'perdido'::public.crm_etapa
    WHEN 'cancelada' THEN 'perdido'::public.crm_etapa
    WHEN 'expirada' THEN 'perdido'::public.crm_etapa
    ELSE NULL
  END;
  IF v_nova_etapa IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_op_id FROM public.crm_oportunidades WHERE proposal_id = NEW.id LIMIT 1;
  IF v_op_id IS NULL THEN
    INSERT INTO public.crm_oportunidades(titulo, client_id, proposal_id, valor_estimado, etapa, responsavel_id, created_by, probabilidade)
    VALUES (
      COALESCE(NEW.titulo, 'Proposta '||COALESCE(NEW.numero,'')),
      NEW.client_id, NEW.id,
      COALESCE(NEW.valor_total, 0),
      v_nova_etapa, NEW.created_by, NEW.created_by,
      CASE v_nova_etapa WHEN 'ganho' THEN 100 WHEN 'perdido' THEN 0 WHEN 'negociacao' THEN 75 WHEN 'proposta_enviada' THEN 60 ELSE 50 END
    );
  ELSE
    UPDATE public.crm_oportunidades
      SET etapa = v_nova_etapa,
          valor_estimado = COALESCE(NEW.valor_total, valor_estimado),
          probabilidade = CASE v_nova_etapa WHEN 'ganho' THEN 100 WHEN 'perdido' THEN 0 ELSE probabilidade END,
          updated_at = now()
      WHERE id = v_op_id AND etapa IS DISTINCT FROM v_nova_etapa;
  END IF;
  RETURN NEW;
END $$;
