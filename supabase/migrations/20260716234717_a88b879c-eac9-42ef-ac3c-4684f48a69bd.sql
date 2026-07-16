
-- 1) Remover policies anon inseguras
DROP POLICY IF EXISTS aceites_anon_update_pendente ON public.proposal_aceites;
DROP POLICY IF EXISTS "Leitura publica proposal_clients via aceite" ON public.proposal_clients;

-- 2) Atualizar get_proposta_para_aceite para incluir coligadas
CREATE OR REPLACE FUNCTION public.get_proposta_para_aceite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aceite record;
  v_prop   record;
  v_cli    record;
  v_items  jsonb;
  v_coligadas jsonb;
BEGIN
  SELECT * INTO v_aceite FROM public.proposal_aceites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_aceite.status = 'pendente'
     AND v_aceite.expires_at IS NOT NULL
     AND v_aceite.expires_at < now() THEN
    UPDATE public.proposal_aceites SET status = 'expirado' WHERE id = v_aceite.id;
    v_aceite.status := 'expirado';
  END IF;

  SELECT id, numero, valor_total, condicoes_pagamento, outras_condicoes,
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', pc.id,
           'papel', pc.papel,
           'ordem', pc.ordem,
           'observacao', pc.observacao,
           'clients', jsonb_build_object(
             'razao_social', c.razao_social,
             'nome_fantasia', c.nome_fantasia,
             'cnpj_cpf', c.cnpj_cpf,
             'cidade', c.cidade,
             'uf', c.uf
           )
         ) ORDER BY pc.ordem), '[]'::jsonb) INTO v_coligadas
    FROM public.proposal_clients pc
    JOIN public.clients c ON c.id = pc.client_id
   WHERE pc.proposal_id = v_prop.id
     AND pc.papel = 'coligada';

  IF v_aceite.visualizado_em IS NULL THEN
    UPDATE public.proposal_aceites SET visualizado_em = now() WHERE id = v_aceite.id;
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
    'itens', v_items,
    'coligadas', v_coligadas
  );
END $function$;

-- 3) RPC pública para registrar aceite (valida token + status pendente + validade)
CREATE OR REPLACE FUNCTION public.registrar_aceite_proposta(
  _token uuid,
  _nome text,
  _email text,
  _cpf text,
  _cargo text,
  _observacoes text,
  _assinatura_base64 text,
  _ip text,
  _user_agent text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_aceite record;
BEGIN
  SELECT * INTO v_aceite FROM public.proposal_aceites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_aceite.status <> 'pendente' THEN
    RETURN jsonb_build_object('error', 'not_pending', 'status', v_aceite.status);
  END IF;
  IF v_aceite.expires_at IS NOT NULL AND v_aceite.expires_at < now() THEN
    UPDATE public.proposal_aceites SET status = 'expirado' WHERE id = v_aceite.id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;
  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RETURN jsonb_build_object('error', 'missing_name');
  END IF;
  IF _email IS NULL OR btrim(_email) = '' THEN
    RETURN jsonb_build_object('error', 'missing_email');
  END IF;

  UPDATE public.proposal_aceites
     SET status = 'aceito',
         aceito_por_nome  = btrim(_nome),
         aceito_por_email = btrim(_email),
         aceito_por_cpf   = NULLIF(btrim(coalesce(_cpf,'')), ''),
         aceito_por_cargo = NULLIF(btrim(coalesce(_cargo,'')), ''),
         observacoes      = NULLIF(btrim(coalesce(_observacoes,'')), ''),
         assinatura_base64 = _assinatura_base64,
         ip = _ip,
         user_agent = _user_agent
   WHERE id = v_aceite.id;

  RETURN jsonb_build_object('ok', true);
END $$;

-- 4) RPC pública para registrar recusa
CREATE OR REPLACE FUNCTION public.registrar_recusa_proposta(
  _token uuid,
  _nome text,
  _email text,
  _motivo text,
  _ip text,
  _user_agent text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_aceite record;
BEGIN
  SELECT * INTO v_aceite FROM public.proposal_aceites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_aceite.status <> 'pendente' THEN
    RETURN jsonb_build_object('error', 'not_pending', 'status', v_aceite.status);
  END IF;
  IF v_aceite.expires_at IS NOT NULL AND v_aceite.expires_at < now() THEN
    UPDATE public.proposal_aceites SET status = 'expirado' WHERE id = v_aceite.id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;
  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RETURN jsonb_build_object('error', 'missing_name');
  END IF;
  IF _motivo IS NULL OR btrim(_motivo) = '' THEN
    RETURN jsonb_build_object('error', 'missing_reason');
  END IF;

  UPDATE public.proposal_aceites
     SET status = 'recusado',
         aceito_por_nome  = btrim(_nome),
         aceito_por_email = NULLIF(btrim(coalesce(_email,'')), ''),
         motivo_recusa    = btrim(_motivo),
         ip = _ip,
         user_agent = _user_agent
   WHERE id = v_aceite.id;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.registrar_aceite_proposta(uuid, text, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_recusa_proposta(uuid, text, text, text, text, text) TO anon, authenticated;
