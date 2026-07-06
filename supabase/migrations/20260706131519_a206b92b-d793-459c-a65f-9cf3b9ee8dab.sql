
-- 1) Ao aprovar a proposta, sincroniza valor_total com a última revisão registrada (qualquer status).
CREATE OR REPLACE FUNCTION public.proposals_preencher_datas_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_last numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovada' AND NEW.data_aprovacao IS NULL THEN
      NEW.data_aprovacao := CURRENT_DATE;
    END IF;
    IF NEW.status IN ('recusada','cancelada') AND NEW.data_recusa IS NULL THEN
      NEW.data_recusa := CURRENT_DATE;
    END IF;
    IF NEW.status = 'enviada' AND NEW.data_envio IS NULL THEN
      NEW.data_envio := CURRENT_DATE;
    END IF;
    IF NEW.status = 'aprovada' THEN
      SELECT valor_novo INTO v_last FROM public.proposal_revisions
        WHERE proposal_id = NEW.id AND valor_novo IS NOT NULL
        ORDER BY revisao DESC LIMIT 1;
      IF v_last IS NOT NULL THEN NEW.valor_total := v_last; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 2) Ao inserir nova revisão em proposta aprovada, propaga valor para proposta/projeto/contrato.
CREATE OR REPLACE FUNCTION public.proposal_revisao_sync_valor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  IF NEW.valor_novo IS NULL THEN RETURN NEW; END IF;
  SELECT status::text INTO v_status FROM public.proposals WHERE id = NEW.proposal_id;
  IF v_status = 'aprovada' THEN
    UPDATE public.proposals SET valor_total = NEW.valor_novo WHERE id = NEW.proposal_id;
    UPDATE public.projetos SET valor_contratado = NEW.valor_novo WHERE proposal_id = NEW.proposal_id;
    UPDATE public.financeiro_contratos SET valor_aprovado = NEW.valor_novo WHERE proposal_id = NEW.proposal_id;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_proposal_revisao_sync_valor ON public.proposal_revisions;
CREATE TRIGGER trg_proposal_revisao_sync_valor
AFTER INSERT OR UPDATE OF valor_novo ON public.proposal_revisions
FOR EACH ROW EXECUTE FUNCTION public.proposal_revisao_sync_valor();

-- 3) Criar projeto — usar última revisão registrada (qualquer status) quando existir.
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

-- 4) Backfill: propostas aprovadas usam última revisão (qualquer status).
WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.proposals p
   SET valor_total = ult.valor_novo
  FROM ult
 WHERE p.id = ult.proposal_id
   AND p.status = 'aprovada'
   AND p.valor_total IS DISTINCT FROM ult.valor_novo;

WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.projetos pj
   SET valor_contratado = ult.valor_novo
  FROM ult, public.proposals p
 WHERE pj.proposal_id = ult.proposal_id
   AND p.id = pj.proposal_id
   AND p.status = 'aprovada'
   AND pj.valor_contratado IS DISTINCT FROM ult.valor_novo;

WITH ult AS (
  SELECT DISTINCT ON (proposal_id) proposal_id, valor_novo
    FROM public.proposal_revisions
   WHERE valor_novo IS NOT NULL
   ORDER BY proposal_id, revisao DESC
)
UPDATE public.financeiro_contratos fc
   SET valor_aprovado = ult.valor_novo
  FROM ult, public.proposals p
 WHERE fc.proposal_id = ult.proposal_id
   AND p.id = fc.proposal_id
   AND p.status = 'aprovada'
   AND fc.valor_aprovado IS DISTINCT FROM ult.valor_novo;
