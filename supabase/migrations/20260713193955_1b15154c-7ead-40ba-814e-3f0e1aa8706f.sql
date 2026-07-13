
CREATE OR REPLACE FUNCTION public.user_can_access_os(_uid uuid, _os_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid) OR public.has_role(_uid,'financeiro')
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       WHERE os.id = _os_id AND (
         os.responsavel_tecnico_id = _uid
         OR EXISTS (SELECT 1 FROM public.execucao_profissionais ep
                     WHERE ep.id = os.responsavel_tecnico_id
                       AND (ep.auth_user_id = _uid OR ep.user_id = _uid))
         OR public.user_can_access_projeto(_uid, os.projeto_id)
       )
    )
    OR EXISTS (
      SELECT 1 FROM public.os_equipe oe
       WHERE oe.os_id = _os_id AND (
         oe.profissional_id = _uid
         OR EXISTS (SELECT 1 FROM public.execucao_profissionais ep
                     WHERE ep.id = oe.profissional_id
                       AND (ep.auth_user_id = _uid OR ep.user_id = _uid))
       )
    )
    OR EXISTS (
      SELECT 1 FROM public.os_visitas ov
       WHERE ov.os_id = _os_id AND (
         ov.responsavel_id = _uid
         OR EXISTS (SELECT 1 FROM public.execucao_profissionais ep
                     WHERE ep.id = ov.responsavel_id
                       AND (ep.auth_user_id = _uid OR ep.user_id = _uid))
       )
    )
    OR EXISTS (
      SELECT 1 FROM public.os_eventos_agenda ea
       WHERE ea.os_id = _os_id AND ea.profissional_id = _uid
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_uid uuid, _projeto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid)
    OR public.has_role(_uid, 'financeiro')
    OR public.user_has_override(_uid, 'ver_financeiro', NULL)
    OR public.user_has_override(_uid, 'acessar_projeto', _projeto_id)
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = _projeto_id
                AND (p.gestor_id = _uid OR p.responsavel_comercial_id = _uid OR p.responsavel_execucao_id = _uid))
    OR EXISTS (SELECT 1 FROM public.projeto_servicos ps WHERE ps.projeto_id = _projeto_id AND ps.responsavel_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       WHERE os.projeto_id = _projeto_id AND (
         os.responsavel_tecnico_id = _uid
         OR EXISTS (SELECT 1 FROM public.execucao_profissionais ep
                     WHERE ep.id = os.responsavel_tecnico_id
                       AND (ep.auth_user_id = _uid OR ep.user_id = _uid))
       )
    )
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       JOIN public.os_equipe oe ON oe.os_id = os.id
       WHERE os.projeto_id = _projeto_id AND (
         oe.profissional_id = _uid
         OR EXISTS (SELECT 1 FROM public.execucao_profissionais ep
                     WHERE ep.id = oe.profissional_id
                       AND (ep.auth_user_id = _uid OR ep.user_id = _uid))
       )
    )
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND es.responsavel_tecnico_id = _uid
    )
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.execucao_servico_equipe ese ON ese.execucao_id = es.id
       JOIN public.execucao_profissionais ep ON ep.id = ese.profissional_id
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id
         AND (ep.auth_user_id = _uid OR ep.user_id = _uid)
    )
  )
$$;
