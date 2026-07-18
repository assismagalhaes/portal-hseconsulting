-- Migração neutralizada: este arquivo foi criado pelo sincronismo do Lovable
-- com o mesmo salto de versão da migração canônica
-- 20260718213000_bump_psico_report_template_version.sql.
--
-- Mantemos o identificador como no-op para não divergir do histórico remoto.
-- Em bancos novos, a migração canônica seguinte executará 1.0.0 -> 1.0.1;
-- em bancos onde este identificador já foi aplicado, nada precisa ser desfeito.
DO $$
BEGIN
  NULL;
END
$$;
