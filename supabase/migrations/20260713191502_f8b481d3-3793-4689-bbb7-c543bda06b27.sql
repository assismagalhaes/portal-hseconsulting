
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS pricing_custos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_horas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_aliquota_imposto numeric(6,4),
  ADD COLUMN IF NOT EXISTS pricing_margem_desejada numeric(6,4),
  ADD COLUMN IF NOT EXISTS pricing_lucro_desejado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_desconto_comercial numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_preco_sugerido numeric(14,2),
  ADD COLUMN IF NOT EXISTS pricing_preco_arredondado numeric(14,2),
  ADD COLUMN IF NOT EXISTS pricing_indicadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_configurada boolean NOT NULL DEFAULT false;
