
CREATE TABLE IF NOT EXISTS public.internos_logs_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  detalhe text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.internos_logs_acesso TO authenticated;
GRANT ALL ON public.internos_logs_acesso TO service_role;
ALTER TABLE public.internos_logs_acesso ENABLE ROW LEVEL SECURITY;

-- Admin lê tudo
CREATE POLICY "internos_logs_admin_read"
  ON public.internos_logs_acesso FOR SELECT TO authenticated
  USING (public.is_admin());

-- Qualquer usuário autenticado registra o próprio evento
CREATE POLICY "internos_logs_self_insert"
  ON public.internos_logs_acesso FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_internos_logs_user ON public.internos_logs_acesso(user_id, created_at DESC);
