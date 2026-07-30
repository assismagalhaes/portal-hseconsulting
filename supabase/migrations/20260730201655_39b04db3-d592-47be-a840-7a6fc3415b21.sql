-- Preserva cada versão comercial da proposta e consolida alterações de
-- serviços, preços e custos na revisão em edição.

CREATE OR REPLACE FUNCTION public.proposal_revision_snapshot(
  _proposal_id uuid,
  _estado text
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'estado', _estado,
    'capturado_em', now(),
    'proposta', jsonb_build_object(
      'valor_total', p.valor_total,
      'escopo_geral', p.escopo_geral,
      'validade', p.validade,
      'condicoes_pagamento', p.condicoes_pagamento
    ),
    'itens', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'service_id', pi.service_id,
          'numero_item', pi.numero_item,
          'categoria', pi.categoria,
          'nome', pi.nome,
          'descricao_comercial', pi.descricao_comercial,
          'escopo_tecnico', pi.escopo_tecnico,
          'entregaveis', pi.entregaveis,
          'observacoes_escopo', pi.observacoes_escopo,
          'quantidade_tecnica', pi.quantidade_tecnica,
          'quantidade', pi.quantidade,
          'valor_unitario', pi.valor_unitario,
          'valor_total', pi.valor_total,
          'client_id', pi.client_id,
          'rateado', pi.rateado,
          'precificacao', (
            SELECT to_jsonb(pip) - 'created_at' - 'updated_at'
              FROM public.proposal_item_pricing pip
             WHERE pip.proposal_item_id = pi.id
             LIMIT 1
          )
        )
        ORDER BY pi.numero_item, pi.id
      )
      FROM public.proposal_items pi
      WHERE pi.proposal_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.proposals p
  WHERE p.id = _proposal_id
$$;

REVOKE ALL ON FUNCTION public.proposal_revision_snapshot(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proposal_revision_snapshot(uuid,text) TO service_role;

-- Chamado após alterações comerciais. Enquanto a emissão inicial ainda não foi
-- materializada, apenas mantém R01 atualizada. Depois da primeira emissão,
-- abre R02 (ou a próxima) uma única vez e passa a atualizar essa mesma revisão.
CREATE OR REPLACE FUNCTION public.sincronizar_revisao_proposta(
  _proposal_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proposta public.proposals%ROWTYPE;
  v_atual public.proposal_revisions%ROWTYPE;
  v_id uuid;
  v_valor numeric;
  v_anterior numeric;
  v_diferenca numeric;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT * INTO v_proposta
    FROM public.proposals
   WHERE id = _proposal_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSTA_NAO_LOCALIZADA'; END IF;

  SELECT * INTO v_atual
    FROM public.proposal_revisions
   WHERE proposal_id = _proposal_id
   ORDER BY revisao DESC
   LIMIT 1
   FOR UPDATE;

  v_valor := COALESCE(v_proposta.valor_total, 0);
  v_snapshot := public.proposal_revision_snapshot(_proposal_id, 'em_edicao');

  IF v_atual.id IS NULL THEN
    INSERT INTO public.proposal_revisions (
      proposal_id, revisao, titulo, descricao, motivo, tipo, status,
      valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
      snapshot, user_id
    ) VALUES (
      _proposal_id, 1, 'Emissão inicial', 'Criação da proposta',
      'Criação da proposta', 'emissao_inicial', 'rascunho',
      0, v_valor, v_valor, NULL,
      v_snapshot, v_uid
    ) RETURNING id INTO v_id;
    UPDATE public.proposals SET revisao_atual = 1 WHERE id = _proposal_id;
    RETURN v_id;
  END IF;

  IF COALESCE(v_atual.snapshot->>'estado', 'em_edicao') <> 'emitida' THEN
    v_anterior := COALESCE(v_atual.valor_anterior, 0);
    v_diferenca := v_valor - v_anterior;
    UPDATE public.proposal_revisions
       SET valor_novo = v_valor,
           diferenca_valor = v_diferenca,
           diferenca_percentual = CASE WHEN v_anterior <> 0
             THEN round((v_diferenca / v_anterior) * 100, 2) ELSE NULL END,
           snapshot = v_snapshot
     WHERE id = v_atual.id
     RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- Gerar novamente o mesmo PDF não cria uma revisão vazia.
  IF (v_atual.snapshot - 'estado' - 'capturado_em' - 'legado') =
     (v_snapshot - 'estado' - 'capturado_em' - 'legado') THEN
    RETURN v_atual.id;
  END IF;

  v_anterior := COALESCE(v_atual.valor_novo, v_valor);
  v_diferenca := v_valor - v_anterior;
  INSERT INTO public.proposal_revisions (
    proposal_id, revisao, titulo, descricao, motivo, tipo, status,
    valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
    snapshot, user_id
  ) VALUES (
    _proposal_id, v_atual.revisao + 1, 'Revisão em edição',
    'Alterações comerciais em elaboração',
    'Alterações comerciais em elaboração', 'alteracao_servicos', 'rascunho',
    v_anterior, v_valor, v_diferenca,
    CASE WHEN v_anterior <> 0 THEN round((v_diferenca / v_anterior) * 100, 2) ELSE NULL END,
    v_snapshot, v_uid
  ) RETURNING id INTO v_id;

  UPDATE public.proposals
     SET revisao_atual = v_atual.revisao + 1
   WHERE id = _proposal_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.sincronizar_revisao_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_revisao_proposta(uuid) TO authenticated, service_role;

-- Materializa a composição vigente no momento em que o PDF é gerado. A partir
-- daí, a próxima alteração comercial pertence a uma nova revisão.
CREATE OR REPLACE FUNCTION public.fechar_revisao_proposta(
  _proposal_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  PERFORM public.sincronizar_revisao_proposta(_proposal_id);

  UPDATE public.proposal_revisions
     SET snapshot = public.proposal_revision_snapshot(_proposal_id, 'emitida')
   WHERE id = (
     SELECT id
       FROM public.proposal_revisions
      WHERE proposal_id = _proposal_id
      ORDER BY revisao DESC
      LIMIT 1
      FOR UPDATE
   )
   RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.fechar_revisao_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_revisao_proposta(uuid) TO authenticated, service_role;

-- A atualização automática antiga podia alterar retroativamente R01. Ela agora
-- delega para o fluxo que respeita o snapshot fechado.
CREATE OR REPLACE FUNCTION public.proposal_sync_emissao_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- A sincronização completa ocorre pela RPC após o item e sua precificação
  -- estarem persistidos. Este trigger deixa de reescrever o histórico.
  RETURN NEW;
END $$;

-- Formaliza a revisão em edição, em vez de criar outra revisão artificial.
CREATE OR REPLACE FUNCTION public.criar_revisao_proposta(
  _proposal_id uuid,
  _motivo text,
  _observacoes text,
  _valor_novo numeric,
  _tipo text DEFAULT 'outro'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_atual public.proposal_revisions%ROWTYPE;
  v_id uuid;
  v_anterior numeric;
  v_diferenca numeric;
  v_titulo text;
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;
  IF COALESCE(trim(_motivo), '') = '' THEN
    RAISE EXCEPTION 'MOTIVO_OBRIGATORIO';
  END IF;

  PERFORM public.sincronizar_revisao_proposta(_proposal_id);

  SELECT * INTO v_atual
    FROM public.proposal_revisions
   WHERE proposal_id = _proposal_id
   ORDER BY revisao DESC
   LIMIT 1
   FOR UPDATE;

  v_titulo := CASE _tipo
    WHEN 'desconto' THEN 'Desconto comercial'
    WHEN 'alteracao_servicos' THEN 'Alteração de serviços'
    WHEN 'ajuste_tecnico' THEN 'Ajuste técnico'
    WHEN 'renegociacao' THEN 'Renegociação'
    ELSE 'Revisão'
  END;
  v_anterior := COALESCE(v_atual.valor_anterior, 0);

  IF COALESCE(v_atual.snapshot->>'estado', 'em_edicao') = 'emitida' THEN
    v_anterior := COALESCE(v_atual.valor_novo, 0);
    IF COALESCE(_valor_novo, 0) = v_anterior THEN
      RAISE EXCEPTION 'SEM_ALTERACOES_COMERCIAIS';
    END IF;
    v_diferenca := COALESCE(_valor_novo, 0) - v_anterior;
    INSERT INTO public.proposal_revisions (
      proposal_id, revisao, titulo, descricao, motivo, tipo, status,
      valor_anterior, valor_novo, diferenca_valor, diferenca_percentual,
      observacoes_internas, snapshot, user_id
    ) VALUES (
      _proposal_id, v_atual.revisao + 1, v_titulo, trim(_motivo),
      trim(_motivo), COALESCE(NULLIF(trim(_tipo), ''), 'outro'), 'rascunho',
      v_anterior, COALESCE(_valor_novo, 0), v_diferenca,
      CASE WHEN v_anterior <> 0
        THEN round((v_diferenca / v_anterior) * 100, 2) ELSE NULL END,
      NULLIF(trim(_observacoes), ''),
      public.proposal_revision_snapshot(_proposal_id, 'em_edicao'), v_uid
    ) RETURNING id INTO v_id;
    UPDATE public.proposals
       SET revisao_atual = v_atual.revisao + 1
     WHERE id = _proposal_id;
    RETURN v_id;
  END IF;

  v_diferenca := COALESCE(_valor_novo, 0) - v_anterior;

  UPDATE public.proposal_revisions
     SET titulo = v_titulo,
         descricao = trim(_motivo),
         motivo = trim(_motivo),
         observacoes_internas = NULLIF(trim(_observacoes), ''),
         tipo = COALESCE(NULLIF(trim(_tipo), ''), 'outro'),
         valor_novo = COALESCE(_valor_novo, 0),
         diferenca_valor = v_diferenca,
         diferenca_percentual = CASE WHEN v_anterior <> 0
           THEN round((v_diferenca / v_anterior) * 100, 2) ELSE NULL END,
         snapshot = public.proposal_revision_snapshot(_proposal_id, 'em_edicao'),
         user_id = v_uid
   WHERE id = v_atual.id
   RETURNING id INTO v_id;

  UPDATE public.proposals
     SET revisao_atual = v_atual.revisao
   WHERE id = _proposal_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_revisao_proposta(uuid,text,text,numeric,text) TO authenticated, service_role;

-- Preserva as revisões legadas como versões emitidas sem atribuir a elas uma
-- composição histórica que não temos como reconstruir.
UPDATE public.proposal_revisions r
   SET snapshot = COALESCE(r.snapshot, '{}'::jsonb) ||
     jsonb_build_object('estado', 'emitida', 'legado', true)
 WHERE r.snapshot IS NULL
    OR NOT r.snapshot ? 'estado';

-- Somente a revisão vigente recebe a composição atual como base de comparação.
-- Assim, gerar novamente o mesmo PDF não cria uma revisão vazia.
UPDATE public.proposal_revisions r
   SET snapshot = public.proposal_revision_snapshot(r.proposal_id, 'emitida') ||
     jsonb_build_object('legado', true)
 WHERE r.id = (
   SELECT r2.id
     FROM public.proposal_revisions r2
    WHERE r2.proposal_id = r.proposal_id
    ORDER BY r2.revisao DESC
    LIMIT 1
 );