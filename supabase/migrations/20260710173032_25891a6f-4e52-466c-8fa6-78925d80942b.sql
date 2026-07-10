CREATE TABLE public.client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_groups TO authenticated;
GRANT SELECT ON public.client_groups TO anon;
GRANT ALL ON public.client_groups TO service_role;

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cg_internal_all" ON public.client_groups
  FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

CREATE TRIGGER trg_client_groups_updated
  BEFORE UPDATE ON public.client_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clients ADD COLUMN group_id uuid REFERENCES public.client_groups(id) ON DELETE SET NULL;
CREATE INDEX clients_group_id_idx ON public.clients(group_id);

ALTER TABLE public.cliente_usuarios ADD COLUMN acesso_grupo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.current_client_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT cu.client_id, cu.acesso_grupo, c.group_id
    FROM public.cliente_usuarios cu
    JOIN public.clients c ON c.id = cu.client_id
    WHERE cu.auth_user_id = auth.uid()
      AND cu.status = 'ativo'
    LIMIT 1
  )
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT c2.id)
      FROM me
      LEFT JOIN public.clients c2
        ON (me.acesso_grupo AND me.group_id IS NOT NULL AND c2.group_id = me.group_id)
        OR c2.id = me.client_id
      WHERE me.client_id IS NOT NULL
    ),
    ARRAY[]::uuid[]
  )
$$;

REVOKE ALL ON FUNCTION public.current_client_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_client_ids() TO authenticated;

CREATE POLICY "cg_cliente_select_group" ON public.client_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.group_id = client_groups.id
        AND c.id = ANY(public.current_client_ids())
    )
  );

DROP POLICY IF EXISTS ccom_client_select ON public.cliente_comunicacoes;
CREATE POLICY ccom_client_select ON public.cliente_comunicacoes
  FOR SELECT TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS ccfg_client_self ON public.cliente_configuracoes;
CREATE POLICY ccfg_client_self ON public.cliente_configuracoes
  FOR SELECT TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS clog_client_select ON public.cliente_logs_acesso;
CREATE POLICY clog_client_select ON public.cliente_logs_acesso
  FOR SELECT TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS cn_client_select ON public.cliente_notificacoes;
CREATE POLICY cn_client_select ON public.cliente_notificacoes
  FOR SELECT TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS cn_client_update ON public.cliente_notificacoes;
CREATE POLICY cn_client_update ON public.cliente_notificacoes
  FOR UPDATE TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS cup_client_select ON public.cliente_uploads;
CREATE POLICY cup_client_select ON public.cliente_uploads
  FOR SELECT TO authenticated USING (client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS clients_self_select ON public.clients;
CREATE POLICY clients_self_select ON public.clients
  FOR SELECT TO authenticated USING (id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS documentos_pendentes_cliente_select ON public.documentos_pendentes;
CREATE POLICY documentos_pendentes_cliente_select ON public.documentos_pendentes
  FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS documentos_pendentes_cliente_update ON public.documentos_pendentes;
CREATE POLICY documentos_pendentes_cliente_update ON public.documentos_pendentes
  FOR UPDATE TO authenticated
  USING (visivel_para_cliente = true AND client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS documentos_tecnicos_cliente_select ON public.documentos_tecnicos;
CREATE POLICY documentos_tecnicos_cliente_select ON public.documentos_tecnicos
  FOR SELECT TO authenticated
  USING (
    visivel_para_cliente = true
    AND status = ANY (ARRAY['aprovado'::documento_status, 'emitido'::documento_status, 'entregue'::documento_status])
    AND client_id = ANY(public.current_client_ids())
  );

DROP POLICY IF EXISTS execucao_servicos_cliente_select ON public.execucao_servicos;
CREATE POLICY execucao_servicos_cliente_select ON public.execucao_servicos
  FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS ordens_servico_cliente_select ON public.ordens_servico;
CREATE POLICY ordens_servico_cliente_select ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS proposals_cliente_select ON public.proposals;
CREATE POLICY proposals_cliente_select ON public.proposals
  FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = ANY(public.current_client_ids()));

DROP POLICY IF EXISTS proposal_items_cliente_select ON public.proposal_items;
CREATE POLICY proposal_items_cliente_select ON public.proposal_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_items.proposal_id
        AND p.visivel_para_cliente = true
        AND p.client_id = ANY(public.current_client_ids())
    )
  );

DROP POLICY IF EXISTS cliente_uploads_client_select ON storage.objects;
CREATE POLICY cliente_uploads_client_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cliente-uploads'
    AND ((storage.foldername(name))[1])::uuid = ANY(public.current_client_ids())
  );

ALTER TABLE public.proposals
  ADD COLUMN modo_faturamento text NOT NULL DEFAULT 'unico'
  CHECK (modo_faturamento IN ('unico','por_cnpj'));

ALTER TABLE public.proposal_items
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX proposal_items_client_id_idx ON public.proposal_items(client_id);

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

  FOR v_cnpj_row IN
    SELECT
      COALESCE(pi.client_id, prop.client_id) AS cli_id,
      SUM(COALESCE(pi.valor_total, 0)) AS valor
    FROM public.proposal_items pi
    WHERE pi.proposal_id = _proposal_id
    GROUP BY COALESCE(pi.client_id, prop.client_id)
    HAVING SUM(COALESCE(pi.valor_total, 0)) > 0
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