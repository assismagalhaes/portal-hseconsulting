
ALTER TABLE public.projeto_servicos
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_servicos_client ON public.projeto_servicos(client_id);

-- Backfill via proposal_items
UPDATE public.projeto_servicos ps
   SET client_id = COALESCE(pi.client_id, p.client_id)
  FROM public.proposal_items pi, public.projetos p
 WHERE ps.proposal_item_id = pi.id
   AND p.id = ps.projeto_id
   AND ps.client_id IS NULL;

-- Fallback: linhas sem proposal_item vinculado
UPDATE public.projeto_servicos ps
   SET client_id = p.client_id
  FROM public.projetos p
 WHERE ps.projeto_id = p.id
   AND ps.client_id IS NULL;

CREATE OR REPLACE FUNCTION public.criar_projeto_da_proposta(_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE prop record; item record;
        v_projeto_id uuid; v_os_id uuid; v_contrato_id uuid;
        v_numero text; v_os_numero text; v_validade int;
        v_valor_final numeric(14,2);
BEGIN
  SELECT id INTO v_projeto_id FROM public.projetos WHERE proposal_id = _proposal_id;
  IF v_projeto_id IS NOT NULL THEN RETURN v_projeto_id; END IF;
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(
    (SELECT valor_novo FROM public.proposal_revisions
      WHERE proposal_id = _proposal_id AND valor_novo IS NOT NULL
      ORDER BY revisao DESC LIMIT 1),
    prop.valor_total, 0
  ) INTO v_valor_final;

  v_numero := public.gerar_numero_projeto();
  SELECT id INTO v_contrato_id FROM public.financeiro_contratos WHERE proposal_id = _proposal_id LIMIT 1;

  INSERT INTO public.projetos(numero, titulo, proposal_id, client_id, financeiro_contrato_id,
    status, responsavel_comercial_id, valor_contratado, data_inicio, created_by)
  VALUES (v_numero, 'Projeto ' || COALESCE(prop.numero,''),
    _proposal_id, prop.client_id, v_contrato_id,
    'planejamento', prop.created_by, v_valor_final,
    CURRENT_DATE, prop.created_by) RETURNING id INTO v_projeto_id;

  IF v_contrato_id IS NOT NULL THEN
    UPDATE public.financeiro_contratos SET projeto_id = v_projeto_id WHERE id = v_contrato_id;
  END IF;

  FOR item IN SELECT pi.*, s.validade_padrao_meses FROM public.proposal_items pi
              LEFT JOIN public.services s ON s.id = pi.service_id
              WHERE pi.proposal_id = _proposal_id LOOP
    v_validade := item.validade_padrao_meses;
    INSERT INTO public.projeto_servicos(projeto_id, proposal_item_id, service_id, client_id, nome, categoria,
      valor, quantidade, unidade, validade_meses)
    VALUES (v_projeto_id, item.id, item.service_id,
      COALESCE(item.client_id, prop.client_id),
      COALESCE(item.nome,'Serviço'), item.categoria,
      COALESCE(item.valor_total, item.valor_unitario * COALESCE(item.quantidade,1), 0),
      COALESCE(item.quantidade,1), item.unidade, v_validade);
  END LOOP;

  v_os_numero := public.gerar_numero_os();
  INSERT INTO public.ordens_servico(numero, titulo, projeto_id, client_id, status, prioridade, objetivo, created_by)
  VALUES (v_os_numero, 'OS ' || v_numero, v_projeto_id, prop.client_id, 'aberta', 'media',
    'Execução dos serviços contratados conforme proposta ' || COALESCE(prop.numero,''),
    prop.created_by) RETURNING id INTO v_os_id;

  INSERT INTO public.projeto_timeline(projeto_id, evento, detalhe, user_id)
  VALUES (v_projeto_id, 'Projeto criado', 'Originado da proposta ' || COALESCE(prop.numero,''), auth.uid());
  RETURN v_projeto_id;
END $function$;
