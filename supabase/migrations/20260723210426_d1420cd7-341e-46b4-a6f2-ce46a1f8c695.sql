
-- 1) Modalidade em psico_avaliacoes
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN modalidade text NOT NULL DEFAULT 'coletiva_hse'
    CHECK (modalidade IN ('coletiva_hse','individual_microempresa'));

-- =====================================================================
-- 2) Tabelas da modalidade individual
-- =====================================================================

-- instrumentos (versões)
CREATE TABLE public.psico_individual_instrumentos_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  versao text NOT NULL,
  nome text NOT NULL,
  vigente boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  publicado_por uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo, versao)
);
GRANT SELECT ON public.psico_individual_instrumentos_versoes TO authenticated;
GRANT ALL ON public.psico_individual_instrumentos_versoes TO service_role;
ALTER TABLE public.psico_individual_instrumentos_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_instr_select_internal" ON public.psico_individual_instrumentos_versoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_instr_updated BEFORE UPDATE ON public.psico_individual_instrumentos_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- perguntas
CREATE TABLE public.psico_individual_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_versao_id uuid NOT NULL REFERENCES public.psico_individual_instrumentos_versoes(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('empregador','empregado','ambos')),
  fator_codigo text NOT NULL,
  ordem integer NOT NULL,
  numero text,
  texto text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('escala','multipla','livre')),
  obrigatoria boolean NOT NULL DEFAULT true,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_perg_instr_idx ON public.psico_individual_perguntas(instrumento_versao_id, papel, ordem);
GRANT SELECT ON public.psico_individual_perguntas TO authenticated;
GRANT ALL ON public.psico_individual_perguntas TO service_role;
ALTER TABLE public.psico_individual_perguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_perg_select_internal" ON public.psico_individual_perguntas
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_perg_updated BEFORE UPDATE ON public.psico_individual_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- opcoes
CREATE TABLE public.psico_individual_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.psico_individual_perguntas(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  rotulo text NOT NULL,
  valor_numerico numeric,
  significa_exposicao boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_opc_perg_idx ON public.psico_individual_opcoes(pergunta_id, ordem);
GRANT SELECT ON public.psico_individual_opcoes TO authenticated;
GRANT ALL ON public.psico_individual_opcoes TO service_role;
ALTER TABLE public.psico_individual_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_opc_select_internal" ON public.psico_individual_opcoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_opc_updated BEFORE UPDATE ON public.psico_individual_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- convites
CREATE TABLE public.psico_individual_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('empregador','empregado')),
  token_hash text NOT NULL UNIQUE,
  token_prefixo text,
  expira_em timestamptz,
  consumido_em timestamptz,
  criado_por uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, papel)
);
CREATE INDEX ind_conv_aval_idx ON public.psico_individual_convites(avaliacao_id);
GRANT SELECT ON public.psico_individual_convites TO authenticated;
GRANT ALL ON public.psico_individual_convites TO service_role;
ALTER TABLE public.psico_individual_convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_conv_select_internal" ON public.psico_individual_convites
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_conv_updated BEFORE UPDATE ON public.psico_individual_convites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- formularios
CREATE TABLE public.psico_individual_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  convite_id uuid NOT NULL REFERENCES public.psico_individual_convites(id) ON DELETE CASCADE,
  instrumento_versao_id uuid NOT NULL REFERENCES public.psico_individual_instrumentos_versoes(id),
  papel text NOT NULL CHECK (papel IN ('empregador','empregado')),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, papel)
);
CREATE INDEX ind_form_aval_idx ON public.psico_individual_formularios(avaliacao_id);
GRANT SELECT ON public.psico_individual_formularios TO authenticated;
GRANT ALL ON public.psico_individual_formularios TO service_role;
ALTER TABLE public.psico_individual_formularios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_form_select_internal" ON public.psico_individual_formularios
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_form_updated BEFORE UPDATE ON public.psico_individual_formularios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- respostas objetivas
CREATE TABLE public.psico_individual_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.psico_individual_formularios(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.psico_individual_perguntas(id),
  opcao_id uuid REFERENCES public.psico_individual_opcoes(id),
  valor_numerico numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formulario_id, pergunta_id)
);
CREATE INDEX ind_resp_form_idx ON public.psico_individual_respostas(formulario_id);
GRANT SELECT ON public.psico_individual_respostas TO authenticated;
GRANT ALL ON public.psico_individual_respostas TO service_role;
ALTER TABLE public.psico_individual_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_resp_select_internal" ON public.psico_individual_respostas
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_resp_updated BEFORE UPDATE ON public.psico_individual_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- respostas livres (acesso restrito via função)
CREATE TABLE public.psico_individual_respostas_livres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.psico_individual_formularios(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.psico_individual_perguntas(id),
  conteudo text NOT NULL,
  sanitizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_resp_livre_form_idx ON public.psico_individual_respostas_livres(formulario_id);
GRANT ALL ON public.psico_individual_respostas_livres TO service_role;
-- Sem GRANT para authenticated/anon: acesso apenas via função dedicada
ALTER TABLE public.psico_individual_respostas_livres ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy para authenticated: nega tudo por padrão
CREATE TRIGGER trg_ind_resp_livre_updated BEFORE UPDATE ON public.psico_individual_respostas_livres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- processamentos
CREATE TABLE public.psico_individual_processamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  versao_regra text NOT NULL,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido','falhou')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_proc_aval_idx ON public.psico_individual_processamentos(avaliacao_id);
GRANT SELECT ON public.psico_individual_processamentos TO authenticated;
GRANT ALL ON public.psico_individual_processamentos TO service_role;
ALTER TABLE public.psico_individual_processamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_proc_select_internal" ON public.psico_individual_processamentos
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_proc_updated BEFORE UPDATE ON public.psico_individual_processamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- achados
CREATE TABLE public.psico_individual_achados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  processamento_id uuid NOT NULL REFERENCES public.psico_individual_processamentos(id) ON DELETE CASCADE,
  fator_codigo text NOT NULL,
  perigo_codigo text,
  descricao_organizacional text,
  frequencia_exposicao text,
  intensidade_exigencia text,
  controle_existente text,
  eficacia_controle text,
  condicao_preliminar text,
  nivel_evidencia text,
  estado_convergencia text CHECK (estado_convergencia IN ('convergente','divergente','apenas_empregador','apenas_empregado','indeterminado')),
  fundamentacao_sanitizada text,
  regra_codigo text,
  regra_versao text,
  revisado_por uuid REFERENCES auth.users(id),
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_ach_aval_idx ON public.psico_individual_achados(avaliacao_id);
CREATE INDEX ind_ach_proc_idx ON public.psico_individual_achados(processamento_id);
GRANT SELECT ON public.psico_individual_achados TO authenticated;
GRANT ALL ON public.psico_individual_achados TO service_role;
ALTER TABLE public.psico_individual_achados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_ach_select_internal" ON public.psico_individual_achados
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_ach_updated BEFORE UPDATE ON public.psico_individual_achados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- revisoes
CREATE TABLE public.psico_individual_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pronta_para_aprovacao','aprovada','reaberta','substituida')),
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users(id),
  observacoes text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ind_rev_aval_idx ON public.psico_individual_revisoes(avaliacao_id);
GRANT SELECT ON public.psico_individual_revisoes TO authenticated;
GRANT ALL ON public.psico_individual_revisoes TO service_role;
ALTER TABLE public.psico_individual_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_rev_select_internal" ON public.psico_individual_revisoes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ind_rev_updated BEFORE UPDATE ON public.psico_individual_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 3) Função protegida para respostas livres
-- =====================================================================
CREATE OR REPLACE FUNCTION public.psico_ind_ler_respostas_livres(_formulario_id uuid)
RETURNS SETOF public.psico_individual_respostas_livres
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.psico_individual_respostas_livres
  WHERE formulario_id = _formulario_id
    AND public.can_see_internal(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) TO service_role;
