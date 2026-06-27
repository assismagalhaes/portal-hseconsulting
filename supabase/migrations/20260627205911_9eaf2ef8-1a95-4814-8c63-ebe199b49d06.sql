
-- ENUMS
CREATE TYPE public.documento_tipo AS ENUM (
  'PGR','PCMSO','LTCAT','Laudo_Insalubridade','Laudo_Periculosidade',
  'Avaliacao_Ergonomica','Avaliacao_Psicossocial','Parecer_Tecnico',
  'Relatorio_Tecnico','Relatorio_Visita','Relatorio_Medicao',
  'Certificado_Treinamento','Lista_Presenca','OS_SST','PPP','Outros'
);

CREATE TYPE public.documento_status AS ENUM (
  'rascunho','em_elaboracao','em_revisao','aguardando_cliente',
  'aguardando_assinatura','aprovado','emitido','entregue',
  'revisado','cancelado','vencido'
);

CREATE TYPE public.documento_origem_anexo AS ENUM ('os','visita','cliente','upload','evidencia');
CREATE TYPE public.documento_recebido_status AS ENUM ('recebido','parcial','pendente','dispensado');
CREATE TYPE public.documento_pendente_status AS ENUM ('solicitado','recebido','parcial','pendente','dispensado');
CREATE TYPE public.documento_notificacao_tipo AS ENUM ('revisao_atrasada','proximo_vencimento','vencido','aguardando_cliente','pendencia');

-- Sequência de numeração
CREATE SEQUENCE IF NOT EXISTS public.documento_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_numero_documento()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n bigint; BEGIN
  n := nextval('public.documento_numero_seq');
  RETURN 'DOC-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
END $$;

-- ========================================
-- TABELA: documentos_modelos
-- ========================================
CREATE TABLE public.documentos_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.documento_tipo NOT NULL,
  categoria text,
  descricao text,
  texto_padrao text,
  secoes_json jsonb DEFAULT '[]'::jsonb,
  campos_variaveis_json jsonb DEFAULT '[]'::jsonb,
  responsavel_padrao_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  validade_padrao_dias int,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_modelos TO authenticated;
GRANT ALL ON public.documentos_modelos TO service_role;
ALTER TABLE public.documentos_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage modelos" ON public.documentos_modelos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at_modelos BEFORE UPDATE ON public.documentos_modelos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================
-- TABELA: documentos_secoes (do modelo)
-- ========================================
CREATE TABLE public.documentos_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid NOT NULL REFERENCES public.documentos_modelos(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  titulo text NOT NULL,
  conteudo_padrao text,
  obrigatoria boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_secoes TO authenticated;
GRANT ALL ON public.documentos_secoes TO service_role;
ALTER TABLE public.documentos_secoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage secoes" ON public.documentos_secoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- TABELA: documentos_campos_variaveis
-- ========================================
CREATE TABLE public.documentos_campos_variaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  label text NOT NULL,
  origem text NOT NULL,
  campo_origem text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_campos_variaveis TO authenticated;
GRANT ALL ON public.documentos_campos_variaveis TO service_role;
ALTER TABLE public.documentos_campos_variaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read campos" ON public.documentos_campos_variaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage campos" ON public.documentos_campos_variaveis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========================================
-- TABELA: documentos_tecnicos
-- ========================================
CREATE TABLE public.documentos_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT public.gerar_numero_documento(),
  tipo public.documento_tipo NOT NULL,
  titulo text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  revisao int NOT NULL DEFAULT 0,
  status public.documento_status NOT NULL DEFAULT 'rascunho',
  modelo_id uuid REFERENCES public.documentos_modelos(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  responsavel_tecnico_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  responsavel_revisao_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  conteudo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes_internas text,
  arquivo_final_path text,
  visivel_para_cliente boolean NOT NULL DEFAULT false,
  assinatura_registro text,
  assinatura_cargo text,
  assinatura_art text,
  assinatura_path text,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  aprovacao_obs text,
  data_emissao date,
  data_vencimento date,
  data_aprovacao date,
  -- desnormalizações
  cliente_nome text,
  tipo_label text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_tecnicos TO authenticated;
GRANT ALL ON public.documentos_tecnicos TO service_role;
ALTER TABLE public.documentos_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage documentos" ON public.documentos_tecnicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_documentos_tecnicos_status ON public.documentos_tecnicos(status);
CREATE INDEX idx_documentos_tecnicos_cliente ON public.documentos_tecnicos(client_id);
CREATE INDEX idx_documentos_tecnicos_execucao ON public.documentos_tecnicos(execucao_id);
CREATE INDEX idx_documentos_tecnicos_os ON public.documentos_tecnicos(os_id);
CREATE INDEX idx_documentos_tecnicos_vencimento ON public.documentos_tecnicos(data_vencimento);
CREATE TRIGGER set_updated_at_documentos BEFORE UPDATE ON public.documentos_tecnicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================
-- TABELA: documentos_revisoes
-- ========================================
CREATE TABLE public.documentos_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_tecnicos(id) ON DELETE CASCADE,
  numero_revisao int NOT NULL,
  descricao text,
  status public.documento_status,
  conteudo_snapshot jsonb,
  arquivo_path text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_revisoes TO authenticated;
GRANT ALL ON public.documentos_revisoes TO service_role;
ALTER TABLE public.documentos_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage revisoes" ON public.documentos_revisoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_documentos_revisoes_doc ON public.documentos_revisoes(documento_id);

-- ========================================
-- TABELA: documentos_anexos
-- ========================================
CREATE TABLE public.documentos_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_tecnicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  arquivo_path text NOT NULL,
  descricao text,
  origem public.documento_origem_anexo NOT NULL DEFAULT 'upload',
  origem_id uuid,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_anexos TO authenticated;
GRANT ALL ON public.documentos_anexos TO service_role;
ALTER TABLE public.documentos_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage anexos" ON public.documentos_anexos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_documentos_anexos_doc ON public.documentos_anexos(documento_id);

-- ========================================
-- TABELA: documentos_aprovacoes
-- ========================================
CREATE TABLE public.documentos_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_tecnicos(id) ON DELETE CASCADE,
  revisao_id uuid REFERENCES public.documentos_revisoes(id) ON DELETE SET NULL,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz NOT NULL DEFAULT now(),
  observacoes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_aprovacoes TO authenticated;
GRANT ALL ON public.documentos_aprovacoes TO service_role;
ALTER TABLE public.documentos_aprovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage aprovacoes" ON public.documentos_aprovacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- TABELA: documentos_recebidos
-- ========================================
CREATE TABLE public.documentos_recebidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  recebido_por uuid REFERENCES auth.users(id),
  status public.documento_recebido_status NOT NULL DEFAULT 'recebido',
  observacoes text,
  arquivo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_recebidos TO authenticated;
GRANT ALL ON public.documentos_recebidos TO service_role;
ALTER TABLE public.documentos_recebidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage recebidos" ON public.documentos_recebidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at_recebidos BEFORE UPDATE ON public.documentos_recebidos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================
-- TABELA: documentos_pendentes
-- ========================================
CREATE TABLE public.documentos_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  documento_solicitado text NOT NULL,
  responsavel_envio text,
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  prazo date,
  status public.documento_pendente_status NOT NULL DEFAULT 'solicitado',
  observacao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_pendentes TO authenticated;
GRANT ALL ON public.documentos_pendentes TO service_role;
ALTER TABLE public.documentos_pendentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage pendentes" ON public.documentos_pendentes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at_pendentes BEFORE UPDATE ON public.documentos_pendentes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================
-- TABELA: documentos_notificacoes
-- ========================================
CREATE TABLE public.documentos_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid REFERENCES public.documentos_tecnicos(id) ON DELETE CASCADE,
  tipo public.documento_notificacao_tipo NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  user_id_destino uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_notificacoes TO authenticated;
GRANT ALL ON public.documentos_notificacoes TO service_role;
ALTER TABLE public.documentos_notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read own notifs" ON public.documentos_notificacoes FOR SELECT TO authenticated
  USING (user_id_destino = auth.uid() OR user_id_destino IS NULL);
CREATE POLICY "auth update own notifs" ON public.documentos_notificacoes FOR UPDATE TO authenticated
  USING (user_id_destino = auth.uid() OR user_id_destino IS NULL);
CREATE POLICY "auth insert notifs" ON public.documentos_notificacoes FOR INSERT TO authenticated WITH CHECK (true);

-- ========================================
-- TABELA: documentos_permissoes
-- ========================================
CREATE TABLE public.documentos_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  pode_criar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  pode_revisar boolean NOT NULL DEFAULT false,
  pode_aprovar boolean NOT NULL DEFAULT false,
  pode_emitir boolean NOT NULL DEFAULT false,
  pode_cancelar boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_permissoes TO authenticated;
GRANT ALL ON public.documentos_permissoes TO service_role;
ALTER TABLE public.documentos_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read permissoes" ON public.documentos_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage permissoes" ON public.documentos_permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========================================
-- TABELA: documentos_timeline
-- ========================================
CREATE TABLE public.documentos_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_tecnicos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_timeline TO authenticated;
GRANT ALL ON public.documentos_timeline TO service_role;
ALTER TABLE public.documentos_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read timeline" ON public.documentos_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert timeline" ON public.documentos_timeline FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_documentos_timeline_doc ON public.documentos_timeline(documento_id);

-- ========================================
-- TRIGGER: auditoria documentos
-- ========================================
CREATE OR REPLACE FUNCTION public.documentos_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_nome IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(nome_fantasia, razao_social) INTO NEW.cliente_nome
      FROM public.clients WHERE id = NEW.client_id;
    END IF;
    NEW.tipo_label := NEW.tipo::text;
    INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Documento criado', 'Status inicial: ' || NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Mudança de status', OLD.status::text || ' → ' || NEW.status::text, auth.uid());
    IF NEW.status = 'emitido' AND NEW.data_emissao IS NULL THEN
      NEW.data_emissao := CURRENT_DATE;
    END IF;
    IF NEW.status = 'aprovado' AND NEW.data_aprovacao IS NULL THEN
      NEW.data_aprovacao := CURRENT_DATE;
      NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
      NEW.aprovado_por := COALESCE(NEW.aprovado_por, auth.uid());
    END IF;
  END IF;

  IF NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    INSERT INTO public.documentos_timeline(documento_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Vencimento alterado', 'Nova validade: ' || COALESCE(NEW.data_vencimento::text,'—'), auth.uid());
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_documentos_audit
BEFORE INSERT OR UPDATE ON public.documentos_tecnicos
FOR EACH ROW EXECUTE FUNCTION public.documentos_audit();

-- ========================================
-- FUNÇÃO: criar revisão preservando conteúdo
-- ========================================
CREATE OR REPLACE FUNCTION public.criar_revisao_documento(_doc_id uuid, _descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  doc record;
  next_rev int;
  rev_id uuid;
BEGIN
  SELECT * INTO doc FROM public.documentos_tecnicos WHERE id = _doc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  next_rev := COALESCE(doc.revisao,0) + 1;
  INSERT INTO public.documentos_revisoes(documento_id, numero_revisao, descricao, status, conteudo_snapshot, user_id)
  VALUES (_doc_id, next_rev, _descricao, doc.status, doc.conteudo_json, auth.uid())
  RETURNING id INTO rev_id;
  UPDATE public.documentos_tecnicos SET revisao = next_rev, updated_at = now() WHERE id = _doc_id;
  RETURN rev_id;
END $$;

-- ========================================
-- SEED: campos variáveis padrão
-- ========================================
INSERT INTO public.documentos_campos_variaveis (chave, label, origem, campo_origem, descricao) VALUES
  ('razao_social','Razão social','cliente','razao_social','Razão social do cliente'),
  ('nome_fantasia','Nome fantasia','cliente','nome_fantasia','Nome fantasia'),
  ('cnpj','CNPJ','cliente','cnpj','CNPJ ou CPF do cliente'),
  ('endereco','Endereço','cliente','endereco','Endereço completo'),
  ('cidade','Cidade','cliente','cidade','Cidade do cliente'),
  ('estado','Estado','cliente','estado','UF'),
  ('quantidade_funcionarios','Qtd. funcionários','cliente','quantidade_funcionarios','Número de funcionários'),
  ('servico','Serviço','execucao','titulo','Título do serviço em execução'),
  ('numero_proposta','Número da proposta','proposta','numero','Número da proposta vinculada'),
  ('numero_os','Número da OS','os','numero','Número da Ordem de Serviço'),
  ('responsavel_tecnico','Responsável técnico','profissional','nome','Nome do responsável técnico'),
  ('registro_profissional','Registro profissional','profissional','registro','Registro/CREA/MTE'),
  ('cargo_responsavel','Cargo do responsável','profissional','cargo','Cargo do responsável'),
  ('numero_documento','Número do documento','empresa','numero','Número interno do documento'),
  ('data_emissao','Data de emissão','empresa','data_emissao','Data de emissão'),
  ('data_validade','Data de validade','empresa','data_vencimento','Data de validade');

-- ========================================
-- SEED: permissões padrão por perfil
-- ========================================
INSERT INTO public.documentos_permissoes (role, pode_criar, pode_editar, pode_revisar, pode_aprovar, pode_emitir, pode_cancelar) VALUES
  ('admin', true, true, true, true, true, true),
  ('comercial', true, true, false, false, true, false),
  ('tecnico', true, true, true, true, true, false)
ON CONFLICT (role) DO NOTHING;
