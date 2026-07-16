
CREATE TABLE public.projeto_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  responsavel text,
  prazo date,
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal','urgente')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida')),
  observacao text,
  resolvida_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projeto_pendencias_projeto ON public.projeto_pendencias(projeto_id);
CREATE INDEX idx_projeto_pendencias_status ON public.projeto_pendencias(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_pendencias TO authenticated;
GRANT ALL ON public.projeto_pendencias TO service_role;

ALTER TABLE public.projeto_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internos_gerenciam_pendencias"
  ON public.projeto_pendencias
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_projeto_pendencias_updated_at
  BEFORE UPDATE ON public.projeto_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
