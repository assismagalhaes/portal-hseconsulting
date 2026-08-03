DROP POLICY IF EXISTS internos_gerenciam_pendencias ON public.projeto_pendencias;

CREATE POLICY internos_gerenciam_pendencias
ON public.projeto_pendencias
FOR ALL
TO authenticated
USING (public.can_see_internal(auth.uid()))
WITH CHECK (public.can_see_internal(auth.uid()));