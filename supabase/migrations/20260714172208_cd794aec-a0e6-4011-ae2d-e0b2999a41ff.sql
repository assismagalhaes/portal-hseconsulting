
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE psico_participante_origem AS ENUM ('manual','importacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psico_convite_status AS ENUM ('preparado','ativo','respondido','revogado','expirado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psico_convite_canal AS ENUM ('whatsapp','email','impresso','manual','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psico_import_status AS ENUM ('processando','concluida','concluida_com_avisos','falhou','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psico_import_formato AS ENUM ('csv','xlsx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- COLUNAS EM psico_avaliacoes ----------
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS assunto_convite text,
  ADD COLUMN IF NOT EXISTS mensagem_convite text,
  ADD COLUMN IF NOT EXISTS participantes_configurados_em timestamptz,
  ADD COLUMN IF NOT EXISTS participantes_configurados_por uuid REFERENCES auth.users(id);

-- ---------- NORMALIZAÇÃO ----------
CREATE OR REPLACE FUNCTION public.psico_norm_texto(v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions
AS $$
  SELECT NULLIF(regexp_replace(lower(public.unaccent(coalesce(v,''))), '\s+', ' ', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.psico_norm_email(v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT NULLIF(lower(btrim(coalesce(v,''))), ''); $$;

CREATE OR REPLACE FUNCTION public.psico_norm_fone(v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT NULLIF(regexp_replace(coalesce(v,''), '\D', '', 'g'), ''); $$;

-- ============================================================================
-- psico_participantes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.psico_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  email text,
  telefone text,
  funcao text,
  setor text,
  unidade text,
  nome_normalizado text NOT NULL DEFAULT '',
  email_normalizado text,
  telefone_normalizado text,
  funcao_normalizada text,
  setor_normalizada text,
  unidade_normalizada text,
  origem_cadastro psico_participante_origem NOT NULL DEFAULT 'manual',
  importacao_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  motivo_inativacao text,
  inativado_por uuid REFERENCES auth.users(id),
  inativado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  atualizado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psico_part_nome_nao_vazio CHECK (btrim(nome) <> '')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_participantes TO authenticated;
GRANT ALL ON public.psico_participantes TO service_role;
ALTER TABLE public.psico_participantes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_part_aval_idx ON public.psico_participantes(avaliacao_id);
CREATE INDEX IF NOT EXISTS psico_part_ativo_idx ON public.psico_participantes(avaliacao_id, ativo);
CREATE INDEX IF NOT EXISTS psico_part_nome_idx ON public.psico_participantes(avaliacao_id, nome_normalizado);
CREATE INDEX IF NOT EXISTS psico_part_email_idx ON public.psico_participantes(avaliacao_id, email_normalizado);
CREATE INDEX IF NOT EXISTS psico_part_fone_idx ON public.psico_participantes(avaliacao_id, telefone_normalizado);
CREATE INDEX IF NOT EXISTS psico_part_funcao_idx ON public.psico_participantes(avaliacao_id, funcao_normalizada);
CREATE INDEX IF NOT EXISTS psico_part_setor_idx ON public.psico_participantes(avaliacao_id, setor_normalizada);
CREATE INDEX IF NOT EXISTS psico_part_unidade_idx ON public.psico_participantes(avaliacao_id, unidade_normalizada);

CREATE POLICY "psico_part_select_interno" ON public.psico_participantes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_part_insert_interno" ON public.psico_participantes
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_part_update_interno" ON public.psico_participantes
  FOR UPDATE TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- ============================================================================
-- psico_convites
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.psico_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.psico_participantes(id) ON DELETE RESTRICT,
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_version integer NOT NULL DEFAULT 1,
  status psico_convite_status NOT NULL DEFAULT 'preparado',
  canal_distribuicao psico_convite_canal,
  distribuido_em timestamptz,
  distribuido_por uuid REFERENCES auth.users(id),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  ativado_em timestamptz,
  primeiro_acesso_em timestamptz,
  ultimo_acesso_em timestamptz,
  respondido_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid REFERENCES auth.users(id),
  motivo_revogacao text,
  expirado_em timestamptz,
  expira_em timestamptz,
  metadados jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_convites TO authenticated;
GRANT ALL ON public.psico_convites TO service_role;
ALTER TABLE public.psico_convites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_conv_aval_idx ON public.psico_convites(avaliacao_id);
CREATE INDEX IF NOT EXISTS psico_conv_part_idx ON public.psico_convites(participante_id);
CREATE INDEX IF NOT EXISTS psico_conv_status_idx ON public.psico_convites(status);
CREATE UNIQUE INDEX IF NOT EXISTS psico_conv_part_ativo_uniq
  ON public.psico_convites(participante_id)
  WHERE status IN ('preparado','ativo','respondido');

CREATE POLICY "psico_conv_select_interno" ON public.psico_convites
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_conv_insert_interno" ON public.psico_convites
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_conv_update_interno" ON public.psico_convites
  FOR UPDATE TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- ============================================================================
-- psico_importacoes_participantes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.psico_importacoes_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE RESTRICT,
  nome_arquivo text NOT NULL,
  hash_arquivo text,
  formato psico_import_formato NOT NULL,
  status psico_import_status NOT NULL DEFAULT 'processando',
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_validas integer NOT NULL DEFAULT 0,
  linhas_importadas integer NOT NULL DEFAULT 0,
  linhas_atualizadas integer NOT NULL DEFAULT 0,
  linhas_ignoradas integer NOT NULL DEFAULT 0,
  linhas_com_erro integer NOT NULL DEFAULT 0,
  linhas_com_aviso integer NOT NULL DEFAULT 0,
  estrategia_duplicidade text NOT NULL DEFAULT 'ignorar',
  resumo jsonb,
  iniciado_por uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_importacoes_participantes TO authenticated;
GRANT ALL ON public.psico_importacoes_participantes TO service_role;
ALTER TABLE public.psico_importacoes_participantes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_imp_aval_idx ON public.psico_importacoes_participantes(avaliacao_id);

CREATE POLICY "psico_imp_select_interno" ON public.psico_importacoes_participantes
  FOR SELECT TO authenticated USING (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_imp_insert_interno" ON public.psico_importacoes_participantes
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "psico_imp_update_interno" ON public.psico_importacoes_participantes
  FOR UPDATE TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

ALTER TABLE public.psico_participantes
  DROP CONSTRAINT IF EXISTS psico_part_importacao_fk,
  ADD CONSTRAINT psico_part_importacao_fk
    FOREIGN KEY (importacao_id)
    REFERENCES public.psico_importacoes_participantes(id) ON DELETE SET NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_part_normalizar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome := regexp_replace(btrim(NEW.nome), '\s+', ' ', 'g');
  NEW.email := NULLIF(btrim(coalesce(NEW.email,'')), '');
  NEW.telefone := NULLIF(btrim(coalesce(NEW.telefone,'')), '');
  NEW.funcao := NULLIF(regexp_replace(btrim(coalesce(NEW.funcao,'')), '\s+', ' ', 'g'), '');
  NEW.setor := NULLIF(regexp_replace(btrim(coalesce(NEW.setor,'')), '\s+', ' ', 'g'), '');
  NEW.unidade := NULLIF(regexp_replace(btrim(coalesce(NEW.unidade,'')), '\s+', ' ', 'g'), '');
  NEW.nome_normalizado := coalesce(public.psico_norm_texto(NEW.nome), '');
  NEW.email_normalizado := public.psico_norm_email(NEW.email);
  NEW.telefone_normalizado := public.psico_norm_fone(NEW.telefone);
  NEW.funcao_normalizada := public.psico_norm_texto(NEW.funcao);
  NEW.setor_normalizada := public.psico_norm_texto(NEW.setor);
  NEW.unidade_normalizada := public.psico_norm_texto(NEW.unidade);
  IF TG_OP = 'UPDATE' THEN
    NEW.atualizado_por := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_part_norm ON public.psico_participantes;
CREATE TRIGGER trg_psico_part_norm
  BEFORE INSERT OR UPDATE ON public.psico_participantes
  FOR EACH ROW EXECUTE FUNCTION public.psico_part_normalizar();

DROP TRIGGER IF EXISTS trg_psico_conv_updated_at ON public.psico_convites;
CREATE TRIGGER trg_psico_conv_updated_at
  BEFORE UPDATE ON public.psico_convites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.psico_part_validar_avaliacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE av record; qv record;
BEGIN
  SELECT * INTO av FROM public.psico_avaliacoes WHERE id = NEW.avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada.'; END IF;
  IF av.status = 'cancelada' THEN
    RAISE EXCEPTION 'Não é possível cadastrar participantes em avaliação cancelada.';
  END IF;
  IF av.questionario_versao_id IS NULL OR av.metodologia_versao_id IS NULL THEN
    RAISE EXCEPTION 'Para cadastrar participantes, vincule uma versão publicada do questionário e da metodologia a esta avaliação.';
  END IF;
  SELECT * INTO qv FROM public.psico_questionarios_versoes WHERE id = av.questionario_versao_id;
  IF NOT FOUND OR qv.status NOT IN ('publicada','arquivada') THEN
    RAISE EXCEPTION 'Para cadastrar participantes, vincule uma versão publicada do questionário e da metodologia a esta avaliação.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_part_validar ON public.psico_participantes;
CREATE TRIGGER trg_psico_part_validar
  BEFORE INSERT ON public.psico_participantes
  FOR EACH ROW EXECUTE FUNCTION public.psico_part_validar_avaliacao();

CREATE OR REPLACE FUNCTION public.psico_avaliacao_bloquear_versao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE tem_part boolean;
BEGIN
  IF NEW.questionario_versao_id IS DISTINCT FROM OLD.questionario_versao_id
     OR NEW.metodologia_versao_id IS DISTINCT FROM OLD.metodologia_versao_id THEN
    IF OLD.status <> 'rascunho' THEN
      RAISE EXCEPTION 'Não é possível alterar a versão do questionário após a avaliação sair do rascunho.';
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.psico_participantes
                  WHERE avaliacao_id = NEW.id AND ativo = true) INTO tem_part;
    IF tem_part THEN
      RAISE EXCEPTION 'Não é possível alterar a versão do questionário após o cadastro de participantes. Para utilizar outra versão, crie uma nova avaliação.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.psico_conv_bloquear_respondido_manual()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'respondido' AND OLD.status <> 'respondido' THEN
    IF coalesce(current_setting('request.jwt.claims', true), '')::text = ''
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role') <> 'service_role' THEN
      RAISE EXCEPTION 'Não é permitido marcar convite como respondido manualmente.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_conv_bloquear_resp ON public.psico_convites;
CREATE TRIGGER trg_psico_conv_bloquear_resp
  BEFORE UPDATE ON public.psico_convites
  FOR EACH ROW EXECUTE FUNCTION public.psico_conv_bloquear_respondido_manual();

CREATE OR REPLACE FUNCTION public.psico_part_inativar_revogar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ativo = false AND OLD.ativo = true THEN
    NEW.inativado_em := now();
    NEW.inativado_por := auth.uid();
    UPDATE public.psico_convites
      SET status = 'revogado',
          revogado_em = now(),
          revogado_por = auth.uid(),
          motivo_revogacao = COALESCE(motivo_revogacao, 'Participante inativado')
      WHERE participante_id = NEW.id
        AND status IN ('preparado','ativo');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_part_inativar ON public.psico_participantes;
CREATE TRIGGER trg_psico_part_inativar
  BEFORE UPDATE ON public.psico_participantes
  FOR EACH ROW EXECUTE FUNCTION public.psico_part_inativar_revogar();

CREATE OR REPLACE FUNCTION public.psico_aval_cancelar_revogar_convites()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
    UPDATE public.psico_convites
      SET status = 'revogado', revogado_em = now(), revogado_por = auth.uid(),
          motivo_revogacao = COALESCE(motivo_revogacao, 'Avaliação cancelada')
      WHERE avaliacao_id = NEW.id AND status IN ('preparado','ativo');
    INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados)
    VALUES ('avaliacao', NEW.id, 'convites_revogados_lote', jsonb_build_object('motivo','Avaliação cancelada'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_aval_cancel_revogar ON public.psico_avaliacoes;
CREATE TRIGGER trg_psico_aval_cancel_revogar
  AFTER UPDATE OF status ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.psico_aval_cancelar_revogar_convites();

UPDATE public.psico_avaliacoes
  SET assunto_convite = COALESCE(assunto_convite, 'Questionário de Percepção Psicoorganizacional no Trabalho'),
      mensagem_convite = COALESCE(mensagem_convite,
'Olá, {{primeiro_nome}}.

A HSE Consulting está conduzindo uma Avaliação de Fatores Psicossociais para {{cliente}}.

O questionário tem caráter coletivo e preventivo. A sua identificação será utilizada exclusivamente para controle de participação e permanecerá tecnicamente separada do conteúdo das respostas.

A empresa receberá somente resultados coletivos consolidados, sem acesso às respostas individuais.

Utilize o seu link individual:

{{link}}

Este link é pessoal e não deve ser compartilhado.

Prazo para participação: {{data_fim}}.')
  WHERE assunto_convite IS NULL OR mensagem_convite IS NULL;
