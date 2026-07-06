
-- 1) Ao aprovar uma revisão, sincroniza o valor_total da proposta com o valor_novo da revisão aprovada.
CREATE OR REPLACE FUNCTION public.proposal_revisao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    UPDATE public.proposal_revisions
       SET status = 'substituida'
     WHERE proposal_id = NEW.proposal_id
       AND id <> NEW.id
       AND status = 'aprovada';
    UPDATE public.proposals
       SET revisao_atual = NEW.revisao,
           bloqueada_edicao = true,
           valor_total = COALESCE(NEW.valor_novo, valor_total)
     WHERE id = NEW.proposal_id;
    NEW.aprovada_em := COALESCE(NEW.aprovada_em, now());
    NEW.aprovada_por := COALESCE(NEW.aprovada_por, auth.uid());
  END IF;
  RETURN NEW;
END $function$;

-- 2) Ao criar projeto a partir da proposta, usar o valor da última revisão aprovada (se houver),
--    e também repercutir no contrato financeiro.
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

  -- valor final = última revisão aprovada, senão valor_total da proposta
  SELECT COALESCE(
    (SELECT valor_novo FROM public.proposal_revisions
      WHERE proposal_id = _proposal_id AND status = 'aprovada'
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
    INSERT INTO public.projeto_servicos(projeto_id, proposal_item_id, service_id, nome, categoria,
      valor, quantidade, unidade, validade_meses)
    VALUES (v_projeto_id, item.id, item.service_id,
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

-- 3) Backfill: para propostas com revisão aprovada, sincronizar valor_total, projetos e contratos.
WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE status = 'aprovada' AND valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.proposals p
   SET valor_total = ult.valor_novo
  FROM ult
 WHERE p.id = ult.proposal_id
   AND p.valor_total IS DISTINCT FROM ult.valor_novo;

WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE status = 'aprovada' AND valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.projetos pj
   SET valor_contratado = ult.valor_novo
  FROM ult
 WHERE pj.proposal_id = ult.proposal_id
   AND pj.valor_contratado IS DISTINCT FROM ult.valor_novo;

WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE status = 'aprovada' AND valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.financeiro_contratos fc
   SET valor_aprovado = ult.valor_novo
  FROM ult
 WHERE fc.proposal_id = ult.proposal_id
   AND fc.valor_aprovado IS DISTINCT FROM ult.valor_novo;
