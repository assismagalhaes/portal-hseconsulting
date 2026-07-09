
CREATE OR REPLACE FUNCTION public.get_proposta_para_aceite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_aceite record;
  v_prop   record;
  v_cli    record;
  v_items  jsonb;
BEGIN
  SELECT * INTO v_aceite FROM public.proposal_aceites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT id, numero, titulo, valor_total, condicoes_pagamento, outras_condicoes,
         validade, data_emissao, revisao_atual, status, client_id
    INTO v_prop
    FROM public.proposals WHERE id = v_aceite.proposal_id;

  SELECT id, razao_social, nome_fantasia, cnpj_cpf, cidade, uf, endereco,
         solicitante, cargo, email
    INTO v_cli
    FROM public.clients WHERE id = v_prop.client_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'numero_item', pi.numero_item,
           'nome', pi.nome,
           'descricao_comercial', pi.descricao_comercial,
           'unidade', pi.unidade,
           'quantidade', pi.quantidade,
           'valor_unitario', pi.valor_unitario,
           'valor_total', pi.valor_total
         ) ORDER BY pi.numero_item), '[]'::jsonb) INTO v_items
    FROM public.proposal_items pi
    WHERE pi.proposal_id = v_prop.id;

  IF v_aceite.visualizado_em IS NULL THEN
    UPDATE public.proposal_aceites
       SET visualizado_em = now()
     WHERE id = v_aceite.id;
  END IF;

  RETURN jsonb_build_object(
    'aceite', jsonb_build_object(
      'id', v_aceite.id,
      'token', v_aceite.token,
      'status', v_aceite.status,
      'aceito_em', v_aceite.aceito_em,
      'recusado_em', v_aceite.recusado_em,
      'expires_at', v_aceite.expires_at,
      'aceito_por_nome', v_aceite.aceito_por_nome,
      'aceito_por_email', v_aceite.aceito_por_email,
      'aceito_por_cpf', v_aceite.aceito_por_cpf,
      'aceito_por_cargo', v_aceite.aceito_por_cargo,
      'observacoes', v_aceite.observacoes,
      'motivo_recusa', v_aceite.motivo_recusa,
      'revisao', v_aceite.revisao
    ),
    'proposta', to_jsonb(v_prop),
    'cliente', to_jsonb(v_cli),
    'itens', v_items
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_proposta_para_aceite(uuid) TO anon, authenticated;
