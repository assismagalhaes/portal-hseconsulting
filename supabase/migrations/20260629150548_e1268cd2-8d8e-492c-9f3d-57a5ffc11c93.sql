
-- Novos campos cadastrais em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS situacao_cadastral text,
  ADD COLUMN IF NOT EXISTS data_abertura date,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS cnaes_secundarios jsonb,
  ADD COLUMN IF NOT EXISTS natureza_juridica text,
  ADD COLUMN IF NOT EXISTS porte text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS ultima_consulta_cnpj timestamptz,
  ADD COLUMN IF NOT EXISTS fonte_consulta_cnpj text,
  ADD COLUMN IF NOT EXISTS ultima_consulta_user uuid;

-- Log interno de consultas à API de CNPJ
CREATE TABLE IF NOT EXISTS public.cnpj_consultas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  fonte text NOT NULL DEFAULT 'brasilapi',
  resultado text NOT NULL,         -- sucesso | nao_encontrado | invalido | api_indisponivel | erro
  http_status int,
  mensagem text,
  user_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cnpj_consultas_log TO authenticated;
GRANT ALL ON public.cnpj_consultas_log TO service_role;

ALTER TABLE public.cnpj_consultas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comercial/admin podem ver logs de CNPJ"
  ON public.cnpj_consultas_log FOR SELECT
  TO authenticated
  USING (public.can_see_internal(auth.uid()));

CREATE POLICY "Usuários autenticados podem registrar consulta"
  ON public.cnpj_consultas_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cnpj_consultas_log_cnpj ON public.cnpj_consultas_log(cnpj);
CREATE INDEX IF NOT EXISTS idx_cnpj_consultas_log_created_at ON public.cnpj_consultas_log(created_at DESC);
