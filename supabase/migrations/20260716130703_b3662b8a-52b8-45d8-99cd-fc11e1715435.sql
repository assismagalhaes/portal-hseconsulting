
-- 1) Fix mutable search_path on user-defined functions
ALTER FUNCTION public.cond_pag_set_updated_at() SET search_path = public;
ALTER FUNCTION public.psico_admin_correcao_ativa() SET search_path = public;
ALTER FUNCTION public.psico_hash_snapshot(jsonb) SET search_path = public;
ALTER FUNCTION public.psico_prioridade_max(public.psico_prioridade_fator, public.psico_prioridade_fator) SET search_path = public;
ALTER FUNCTION public.psico_rel_ver_guard_imutavel() SET search_path = public;
ALTER FUNCTION public.psico_sanitize_snapshot(jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 2) Revoke execute on internal email queue helpers from anon/authenticated (service_role only)
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

-- 3) Replace remaining "always true" INSERT policies with authenticated-user checks
DROP POLICY IF EXISTS "projeto_timeline_insert" ON public.projeto_timeline;
CREATE POLICY "projeto_timeline_insert"
  ON public.projeto_timeline FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cond hist insert autenticado" ON public.proposal_condicao_pagamento_historico;
CREATE POLICY "cond hist insert autenticado"
  ON public.proposal_condicao_pagamento_historico FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
