
CREATE POLICY "clients_projeto_access_read" ON public.clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.client_id = clients.id
      AND public.user_can_access_projeto(auth.uid(), p.id)
  )
);
