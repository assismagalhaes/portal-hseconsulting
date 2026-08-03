
-- Hardening PR7: restringir EXECUTE de RPCs SECURITY DEFINER da modalidade individual.
-- snapshot/preparar/concluir/falhar são chamadas apenas por service_role via Edge Function.
REVOKE EXECUTE ON FUNCTION public.psico_ind_snapshot_relatorio(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.psico_ind_preparar_relatorio(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.psico_ind_concluir_relatorio(uuid, text, text, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.psico_ind_falhar_relatorio(uuid, text) FROM PUBLIC, anon, authenticated;

-- gates/contexto/salvar_parecer são chamadas pela Edge Function com o JWT do técnico:
-- mantém authenticated, revoga anon.
REVOKE EXECUTE ON FUNCTION public.psico_ind_gates_emissao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.psico_ind_contexto_para_ia(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.psico_ind_salvar_parecer(uuid, jsonb, text, text) FROM PUBLIC, anon;
