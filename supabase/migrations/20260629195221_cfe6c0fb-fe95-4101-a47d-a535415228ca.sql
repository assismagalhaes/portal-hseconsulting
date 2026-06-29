CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_normalizado text GENERATED ALWAYS AS (lower(trim(nome))) STORED UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read categories" ON public.service_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert categories" ON public.service_categories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update categories" ON public.service_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete categories" ON public.service_categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed das categorias já existentes no catálogo
INSERT INTO public.service_categories (nome)
SELECT DISTINCT trim(categoria) FROM public.services
 WHERE categoria IS NOT NULL AND trim(categoria) <> ''
ON CONFLICT (nome_normalizado) DO NOTHING;

INSERT INTO public.service_categories (nome)
SELECT DISTINCT trim(categoria) FROM public.proposal_items
 WHERE categoria IS NOT NULL AND trim(categoria) <> ''
ON CONFLICT (nome_normalizado) DO NOTHING;