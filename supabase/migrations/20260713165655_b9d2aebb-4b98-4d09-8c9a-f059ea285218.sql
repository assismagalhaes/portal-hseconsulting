
-- Permitir que responsavel_id da visita e profissional_id do evento apontem para
-- profissionais (public.execucao_profissionais) OU usuários (auth.users / profiles).
ALTER TABLE public.os_visitas DROP CONSTRAINT IF EXISTS os_visitas_responsavel_id_fkey;
ALTER TABLE public.os_eventos_agenda DROP CONSTRAINT IF EXISTS os_eventos_agenda_profissional_id_fkey;

-- Permitir que o próprio profissional (usuário) veja seus eventos na agenda técnica.
DROP POLICY IF EXISTS "os_eventos_agenda_own_select" ON public.os_eventos_agenda;
CREATE POLICY "os_eventos_agenda_own_select"
  ON public.os_eventos_agenda FOR SELECT
  USING (
    can_see_internal(auth.uid())
    OR profissional_id = auth.uid()
    OR user_can_access_os(auth.uid(), os_id)
  );
