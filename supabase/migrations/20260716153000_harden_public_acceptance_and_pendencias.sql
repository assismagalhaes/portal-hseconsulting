-- Public proposal acceptance must be capability-token based, not a direct RLS update.
DROP POLICY IF EXISTS "aceites_anon_update_pendente" ON public.proposal_aceites;
REVOKE UPDATE, SELECT ON public.proposal_aceites FROM anon;

CREATE OR REPLACE FUNCTION public.registrar_proposta_aceite(
  p_token uuid,
  p_status text,
  p_nome text,
  p_email text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_cargo text DEFAULT NULL,
  p_assinatura_base64 text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_motivo_recusa text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aceite public.proposal_aceites;
BEGIN
  IF p_status NOT IN ('aceito', 'recusado') OR coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'DADOS_INVALIDOS';
  END IF;
  SELECT * INTO v_aceite FROM public.proposal_aceites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_aceite.status <> 'pendente' OR (v_aceite.expires_at IS NOT NULL AND v_aceite.expires_at <= now()) THEN
    RAISE EXCEPTION 'ACEITE_INDISPONIVEL';
  END IF;
  UPDATE public.proposal_aceites
  SET status = p_status,
      aceito_por_nome = trim(p_nome),
      aceito_por_email = nullif(trim(coalesce(p_email, '')), ''),
      aceito_por_cpf = nullif(trim(coalesce(p_cpf, '')), ''),
      aceito_por_cargo = nullif(trim(coalesce(p_cargo, '')), ''),
      assinatura_base64 = p_assinatura_base64,
      observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
      motivo_recusa = nullif(trim(coalesce(p_motivo_recusa, '')), ''),
      ip = p_ip,
      user_agent = p_user_agent
  WHERE id = v_aceite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_proposta_aceite(uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_proposta_aceite(uuid, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- Pending project data is internal-only.
DROP POLICY IF EXISTS "internos_gerenciam_pendencias" ON public.projeto_pendencias;
CREATE POLICY "internos_gerenciam_pendencias"
  ON public.projeto_pendencias
  FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));
