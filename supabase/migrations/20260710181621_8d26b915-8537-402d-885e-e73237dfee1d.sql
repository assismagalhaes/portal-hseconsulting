
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS rateado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.financeiro_gerar_contrato(_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  prop record;
  cfg record;
  v_contrato_id uuid;
  v_titulo text;
  parc jsonb;
  i int;
  v_valor_total numeric(14,2);
  v_valor_parc numeric(14,2);
  v_perc numeric;
  v_dias int;
  v_desc text;
  v_cnpj_row record;
  v_num_empresas int;
BEGIN
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_contrato_id FROM public.financeiro_contratos
   WHERE proposal_id = _proposal_id LIMIT 1;
  IF v_contrato_id IS NOT NULL THEN RETURN v_contrato_id; END IF;

  SELECT * INTO cfg FROM public.financeiro_configuracoes ORDER BY created_at ASC LIMIT 1;

  IF COALESCE(prop.modo_faturamento, 'unico') = 'unico' THEN
    v_valor_total := COALESCE(prop.valor_total, 0);
    v_titulo := 'Proposta ' || COALESCE(prop.numero, '');

    INSERT INTO public.financeiro_contratos(
      proposal_id, client_id, numero, titulo, valor_aprovado,
      condicao_pagamento, responsavel_comercial, data_aprovacao, created_by
    ) VALUES (
      _proposal_id, prop.client_id, prop.numero, v_titulo, v_valor_total,
      prop.condicoes_pagamento, prop.created_by, CURRENT_DATE, prop.created_by
    ) RETURNING id INTO v_contrato_id;

    IF cfg.parcelas_padrao IS NOT NULL AND jsonb_array_length(cfg.parcelas_padrao) > 0 THEN
      i := 1;
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
  END IF;

  SELECT COUNT(*) INTO v_num_empresas
  FROM public.proposal_clients WHERE proposal_id = _proposal_id;
  IF v_num_empresas = 0 THEN v_num_empresas := 1; END IF;

  FOR v_cnpj_row IN
    WITH itens_diretos AS (
      SELECT COALESCE(pi.client_id, prop.client_id) AS cli_id,
             SUM(COALESCE(pi.valor_total, 0)) AS valor
      FROM public.proposal_items pi
      WHERE pi.proposal_id = _proposal_id
        AND COALESCE(pi.rateado, false) = false
      GROUP BY COALESCE(pi.client_id, prop.client_id)
    ),
    total_rateado AS (
      SELECT COALESCE(SUM(COALESCE(pi.valor_total, 0)), 0) AS valor
      FROM public.proposal_items pi
      WHERE pi.proposal_id = _proposal_id
        AND COALESCE(pi.rateado, false) = true
    ),
    empresas AS (
      SELECT client_id AS cli_id FROM public.proposal_clients WHERE proposal_id = _proposal_id
      UNION
      SELECT prop.client_id
    ),
    rateio AS (
      SELECT e.cli_id, round((SELECT valor FROM total_rateado) / v_num_empresas, 2) AS valor
      FROM empresas e
    )
    SELECT cli_id, SUM(valor) AS valor FROM (
      SELECT cli_id, valor FROM itens_diretos
      UNION ALL
      SELECT cli_id, valor FROM rateio
    ) x
    GROUP BY cli_id
    HAVING SUM(valor) > 0
  LOOP
    v_valor_total := v_cnpj_row.valor;
    v_titulo := 'Proposta ' || COALESCE(prop.numero, '');
    IF v_cnpj_row.cli_id <> prop.client_id THEN
      v_titulo := v_titulo || ' — coligada';
    END IF;

    INSERT INTO public.financeiro_contratos(
      proposal_id, client_id, numero, titulo, valor_aprovado,
      condicao_pagamento, responsavel_comercial, data_aprovacao, created_by
    ) VALUES (
      _proposal_id, v_cnpj_row.cli_id, prop.numero, v_titulo, v_valor_total,
      prop.condicoes_pagamento, prop.created_by, CURRENT_DATE, prop.created_by
    ) RETURNING id INTO v_contrato_id;

    IF cfg.parcelas_padrao IS NOT NULL AND jsonb_array_length(cfg.parcelas_padrao) > 0 THEN
      i := 1;
      FOR parc IN SELECT * FROM jsonb_array_elements(cfg.parcelas_padrao) LOOP
        v_perc := COALESCE((parc->>'percentual')::numeric, 0);
        v_dias := COALESCE((parc->>'dias')::int, 0);
        v_desc := COALESCE(parc->>'descricao', 'Parcela '||i);
        v_valor_parc := round(v_valor_total * v_perc / 100.0, 2);
        INSERT INTO public.financeiro_parcelas(
          contrato_id, proposal_id, client_id, numero, descricao,
          valor, data_vencimento, status, created_by
        ) VALUES (
          v_contrato_id, _proposal_id, v_cnpj_row.cli_id, i, v_desc,
          v_valor_parc, CURRENT_DATE + (v_dias || ' days')::interval, 'a_vencer', prop.created_by
        );
        i := i + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_contrato_id;
END $function$;
