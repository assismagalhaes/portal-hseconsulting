-- Migração neutralizada após a aplicação manual no Lovable ter materializado
-- o mesmo salto como 20260718213351_b7cfa611-b98b-4039-8511-2183747260b3.sql.
--
-- Mantemos este identificador como no-op para preservar o histórico do GitHub.
-- Em bancos novos, a migração 20260718213351 executa 1.0.1 -> 1.0.2; em bancos
-- já atualizados pelo Lovable, nenhuma alteração adicional é necessária.
DO $$
BEGIN
  NULL;
END
$$;
