
CREATE OR REPLACE FUNCTION public.crm_converter_lead(_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  v_client_id uuid;
BEGIN
  SELECT * INTO l FROM public.crm_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF l.cliente_id IS NOT NULL THEN RETURN l.cliente_id; END IF;

  IF l.cnpj_cpf IS NOT NULL AND length(trim(l.cnpj_cpf)) > 0 THEN
    SELECT id INTO v_client_id FROM public.clients WHERE cnpj_cpf = l.cnpj_cpf LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients(razao_social, nome_fantasia, cnpj_cpf, solicitante, cargo,
      email, telefone, whatsapp, cidade, uf, observacoes)
    VALUES (l.empresa, l.empresa, l.cnpj_cpf, l.contato_nome, l.contato_cargo,
      l.email, l.telefone, l.whatsapp, l.cidade, l.estado,
      CASE WHEN l.segmento IS NOT NULL THEN 'Segmento: '||l.segmento ELSE NULL END)
    RETURNING id INTO v_client_id;
  END IF;

  UPDATE public.crm_leads SET cliente_id = v_client_id, status = 'convertido', convertido_em = now() WHERE id = _lead_id;
  UPDATE public.crm_oportunidades SET client_id = v_client_id WHERE lead_id = _lead_id AND client_id IS NULL;

  INSERT INTO public.crm_historico(lead_id, client_id, tipo, titulo, user_id)
  VALUES (_lead_id, v_client_id, 'lead_convertido', 'Lead convertido em cliente', auth.uid());

  RETURN v_client_id;
END $$;
