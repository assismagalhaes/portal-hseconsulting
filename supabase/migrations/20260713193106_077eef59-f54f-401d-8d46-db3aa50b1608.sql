
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.os_checklist_sugestoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_checklist_sugestoes TO authenticated;
GRANT ALL ON public.os_checklist_sugestoes TO service_role;

ALTER TABLE public.os_checklist_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suggestions"
  ON public.os_checklist_sugestoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suggestions"
  ON public.os_checklist_sugestoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update suggestions"
  ON public.os_checklist_sugestoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete suggestions"
  ON public.os_checklist_sugestoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_os_checklist_sugestoes_updated_at
  BEFORE UPDATE ON public.os_checklist_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.os_checklist_sugestoes (descricao) VALUES
  ('Agendamento de visita técnica'),
  ('Agendamento do treinamento'),
  ('Emissão da ART'),
  ('Emissão de certificados'),
  ('Emissão de procuração eletrônica'),
  ('Fichas de registro'),
  ('Impressão e entrega dos documentos/certificados'),
  ('Logomarca do cliente'),
  ('Questionário dos riscos psicossociais'),
  ('Realização de visita técnica'),
  ('Recebimento de ASOs'),
  ('Revisão/Validação do Coordenador Técnico')
ON CONFLICT (descricao) DO NOTHING;
