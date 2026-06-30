
CREATE OR REPLACE FUNCTION public.financeiro_gerar_contrato(_proposal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prop record;
  cfg record;
  v_contrato_id uuid;
  parc jsonb;
  i int := 1;
  v_valor_total numeric(14,2);
  v_valor_parc numeric(14,2);
  v_perc numeric;
  v_dias int;
  v_desc text;
  v_titulo text;
BEGIN
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO v_contrato_id FROM public.financeiro_contratos WHERE proposal_id = _proposal_id;
  IF v_contrato_id IS NOT NULL THEN RETURN v_contrato_id; END IF;

  v_valor_total := COALESCE(prop.valor_total, 0);
  v_titulo := 'Proposta ' || COALESCE(prop.numero, '');

  INSERT INTO public.financeiro_contratos(
    proposal_id, client_id, numero, titulo, valor_aprovado,
    condicao_pagamento, responsavel_comercial, data_aprovacao, created_by
  ) VALUES (
    _proposal_id, prop.client_id, prop.numero, v_titulo, v_valor_total,
    prop.condicoes_pagamento, prop.created_by, CURRENT_DATE, prop.created_by
  ) RETURNING id INTO v_contrato_id;

  SELECT * INTO cfg FROM public.financeiro_configuracoes ORDER BY created_at ASC LIMIT 1;

  IF cfg.parcelas_padrao IS NOT NULL AND jsonb_array_length(cfg.parcelas_padrao) > 0 THEN
    FOR parc IN SELECT * FROM jsonb_array_elements(cfg.parcelas_padrao) LOOP
      v_perc := COALESCE((parc->>'percentual')::numeric, 0);
      v_dias := COALESCE((parc->>'dias')::int, 0);
      v_desc := COALESCE(parc->>'descricao', 'Parcela '||i);
      v_valor_parc := round(v_valor_total * v_perc / 100.0, 2);
      INSERT INTO public.financeiro_parcelas(
        contrato_id, proposal_id, client_id, numero, descricao,
        valor, data_vencimento, status, created_by
      ) VALUES (
        v_contrato_id, _proposal_id, prop.client_id, i, v_desc,
        v_valor_parc, CURRENT_DATE + (v_dias || ' days')::interval, 'a_vencer', prop.created_by
      );
      i := i + 1;
    END LOOP;
  END IF;

  RETURN v_contrato_id;
END $function$;
