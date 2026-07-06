
-- Helper: notificar todos os admins
CREATE OR REPLACE FUNCTION public.notificar_admins(_titulo text, _mensagem text, _link text, _entidade_tipo text, _entidade_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notificacoes(user_id, modulo, tipo, titulo, mensagem, prioridade, status, link, entidade_tipo, entidade_id, origem, metadata)
    VALUES (r.user_id, 'usuarios', 'admin_audit', _titulo, _mensagem, 'alta', 'nova', _link, _entidade_tipo, _entidade_id, 'sistema', '{}'::jsonb);
  END LOOP;
END $$;

-- Trigger: user_roles
CREATE OR REPLACE FUNCTION public.audit_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nome, email INTO v_nome, v_email FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (NEW.user_id, 'role_atribuida', 'Papel: ' || NEW.role::text);
    PERFORM public.notificar_admins(
      'Papel atribuído',
      COALESCE(v_nome, v_email, 'usuário') || ' recebeu o papel ' || NEW.role::text,
      '/usuarios', 'user', NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT nome, email INTO v_nome, v_email FROM public.profiles WHERE id = OLD.user_id;
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (OLD.user_id, 'role_removida', 'Papel: ' || OLD.role::text);
    PERFORM public.notificar_admins(
      'Papel removido',
      COALESCE(v_nome, v_email, 'usuário') || ' perdeu o papel ' || OLD.role::text,
      '/usuarios', 'user', OLD.user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();

-- Trigger: profiles.status
CREATE OR REPLACE FUNCTION public.audit_profile_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (NEW.id, 'status_alterado', COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'));
    PERFORM public.notificar_admins(
      'Status de usuário alterado',
      COALESCE(NEW.nome, NEW.email, 'usuário') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
      '/usuarios', 'user', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_profile_status ON public.profiles;
CREATE TRIGGER trg_audit_profile_status
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_status();

-- Trigger: user_permission_overrides
CREATE OR REPLACE FUNCTION public.audit_permission_overrides()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_email text; v_alvo uuid;
BEGIN
  v_alvo := COALESCE(NEW.user_id, OLD.user_id);
  SELECT nome, email INTO v_nome, v_email FROM public.profiles WHERE id = v_alvo;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (v_alvo, 'permissao_concedida', NEW.tipo::text || COALESCE(' | motivo: '||NEW.motivo,''));
    PERFORM public.notificar_admins(
      'Permissão granular concedida',
      COALESCE(v_nome,v_email,'usuário') || ' recebeu permissão ' || NEW.tipo::text,
      '/usuarios', 'user_permission_override', NEW.id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (v_alvo, CASE WHEN NEW.ativo THEN 'permissao_reativada' ELSE 'permissao_desativada' END, NEW.tipo::text);
    PERFORM public.notificar_admins(
      CASE WHEN NEW.ativo THEN 'Permissão reativada' ELSE 'Permissão desativada' END,
      COALESCE(v_nome,v_email,'usuário') || ' — ' || NEW.tipo::text,
      '/usuarios', 'user_permission_override', NEW.id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.internos_logs_acesso(user_id, acao, detalhe)
    VALUES (v_alvo, 'permissao_revogada', OLD.tipo::text);
    PERFORM public.notificar_admins(
      'Permissão granular revogada',
      COALESCE(v_nome,v_email,'usuário') || ' — ' || OLD.tipo::text,
      '/usuarios', 'user_permission_override', OLD.id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_perm_overrides ON public.user_permission_overrides;
CREATE TRIGGER trg_audit_perm_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_permission_overrides();
