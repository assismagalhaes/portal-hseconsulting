-- Expõe ao fluxo psicossocial somente o estado necessário da assinatura.
-- O caminho privado, hash e nome original do arquivo continuam restritos.
CREATE OR REPLACE FUNCTION public.psico_listar_responsaveis_assinatura()
RETURNS TABLE(
  id uuid,
  nome text,
  cargo text,
  origem text,
  assinatura_disponivel boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.id,
         ep.nome,
         ep.cargo,
         'profissional'::text AS origem,
         (ep.assinatura_modo = 'imagem'
          AND ep.assinatura_ativa
          AND ep.assinatura_storage_path IS NOT NULL
          AND ep.assinatura_hash_sha256 IS NOT NULL) AS assinatura_disponivel
    FROM public.execucao_profissionais ep
   WHERE public.can_see_psico((SELECT auth.uid()))
     AND ep.situacao = 'ativo'
  UNION ALL
  SELECT p.id,
         COALESCE(NULLIF(BTRIM(p.nome), ''), p.email) AS nome,
         p.cargo,
         'perfil'::text AS origem,
         (p.assinatura_modo = 'imagem'
          AND p.assinatura_ativa
          AND p.assinatura_storage_path IS NOT NULL
          AND p.assinatura_hash_sha256 IS NOT NULL) AS assinatura_disponivel
    FROM public.profiles p
   WHERE public.can_see_psico((SELECT auth.uid()))
     AND EXISTS (
       SELECT 1
         FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role IN ('admin', 'tecnico', 'comercial')
     )
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.psico_listar_responsaveis_assinatura()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_listar_responsaveis_assinatura()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;