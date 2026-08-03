
CREATE TABLE IF NOT EXISTS public.proposta_premissas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  categorias TEXT[] NOT NULL DEFAULT '{}',
  sempre_aplicavel BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_premissas TO authenticated;
GRANT ALL ON public.proposta_premissas TO service_role;

ALTER TABLE public.proposta_premissas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internos_leem_premissas" ON public.proposta_premissas;
CREATE POLICY "internos_leem_premissas" ON public.proposta_premissas
  FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "internos_gerenciam_premissas" ON public.proposta_premissas;
CREATE POLICY "internos_gerenciam_premissas" ON public.proposta_premissas
  FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

CREATE TRIGGER trg_proposta_premissas_updated
  BEFORE UPDATE ON public.proposta_premissas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS premissas_ids UUID[] NOT NULL DEFAULT '{}';

INSERT INTO public.proposta_premissas (titulo, texto, sempre_aplicavel, ordem) VALUES
  ('Disponibilização do documento', 'Disponibilização de via física e/ou digital do documento, quando aplicável.', true, 1),
  ('Escopo restrito ao contratado', 'A contratação não engloba treinamentos, campanhas ou outros objetos não descritos no escopo.', true, 2),
  ('Visita in loco', 'Visita in loco e registro fotográfico, quando aplicável.', false, 3),
  ('Uso dos registros fotográficos', 'Registros fotográficos serão utilizados exclusivamente para elaboração do documento.', false, 4),
  ('Equipamentos calibrados', 'Equipamentos de medição com certificados de calibração válidos, quando aplicável.', false, 5)
ON CONFLICT DO NOTHING;
