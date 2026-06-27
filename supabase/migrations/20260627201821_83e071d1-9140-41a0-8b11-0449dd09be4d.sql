
CREATE TABLE IF NOT EXISTS public.proposal_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cor_primaria text NOT NULL DEFAULT '#0b1f4d',
  cor_secundaria text NOT NULL DEFAULT '#16a34a',
  cor_neutra text NOT NULL DEFAULT '#f4f6fb',
  slogan text NOT NULL DEFAULT 'Soluções Inteligentes em Saúde e Segurança do Trabalho',
  quem_somos text NOT NULL DEFAULT 'A HSE Consulting é especializada em soluções de Saúde, Segurança do Trabalho e Meio Ambiente, oferecendo serviços técnicos de alta qualidade para empresas de todos os portes em todo o território nacional.',
  missao text NOT NULL DEFAULT 'Promover ambientes de trabalho seguros e saudáveis por meio de consultoria técnica especializada, contribuindo para a sustentabilidade e produtividade de nossos clientes.',
  visao text NOT NULL DEFAULT 'Ser referência nacional em consultoria de SST, reconhecida pela excelência técnica, agilidade e compromisso com resultados.',
  valores text NOT NULL DEFAULT 'Ética • Excelência técnica • Compromisso • Inovação • Respeito às pessoas',
  diferenciais jsonb NOT NULL DEFAULT '["Equipe especializada","Atendimento nacional","Agilidade","Conformidade legal","Atendimento personalizado","Alta qualidade técnica"]'::jsonb,
  texto_aceite text NOT NULL DEFAULT 'Declaramos estar de acordo com os termos, condições, escopo e valores apresentados nesta proposta comercial. Sua aceitação formaliza a contratação dos serviços nas condições aqui descritas.',
  mensagem_contracapa text NOT NULL DEFAULT 'Compromisso com a segurança. Excelência em cada entrega.',
  rodape_versao text NOT NULL DEFAULT 'v1.0',
  telefone text NOT NULL DEFAULT '(00) 0000-0000',
  whatsapp text NOT NULL DEFAULT '(00) 00000-0000',
  email text NOT NULL DEFAULT 'contato@hseconsulting.com.br',
  site text NOT NULL DEFAULT 'www.hseconsulting.com.br',
  endereco text NOT NULL DEFAULT '',
  logo_url text,
  capa_imagem_url text,
  contracapa_imagem_url text,
  font_titulo text NOT NULL DEFAULT 'Sora',
  font_corpo text NOT NULL DEFAULT 'Manrope',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.proposal_template TO authenticated;
GRANT ALL ON public.proposal_template TO service_role;

ALTER TABLE public.proposal_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template select auth" ON public.proposal_template;
CREATE POLICY "template select auth" ON public.proposal_template
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "template write internal" ON public.proposal_template;
CREATE POLICY "template write internal" ON public.proposal_template
  FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

DROP TRIGGER IF EXISTS proposal_template_updated_at ON public.proposal_template;
CREATE TRIGGER proposal_template_updated_at
  BEFORE UPDATE ON public.proposal_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.proposal_template (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.proposal_template);
