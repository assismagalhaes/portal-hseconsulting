CREATE OR REPLACE FUNCTION public.notificar_admins(_titulo text, _mensagem text, _link text DEFAULT NULL, _entidade_tipo text DEFAULT NULL, _entidade_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notificacoes(user_id, modulo, tipo, titulo, mensagem, prioridade, status, link, entidade_tipo, entidade_id, origem, metadata)
    VALUES (r.user_id, 'usuarios', 'admin_audit', _titulo, _mensagem, 'alta', 'nao_lida', _link, _entidade_tipo, _entidade_id, 'sistema', '{}'::jsonb);
  END LOOP;
END
$$;