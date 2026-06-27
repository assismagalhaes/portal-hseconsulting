
-- ============ TIPOS ============
DO $$ BEGIN
  CREATE TYPE public.fin_status_contrato AS ENUM (
    'aguardando_faturamento','parcialmente_faturado','faturado',
    'parcialmente_recebido','recebido','em_atraso','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_status_parcela AS ENUM (
    'a_vencer','vencida','recebida','recebida_parcial','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_forma_pagamento AS ENUM (
    'pix','boleto','transferencia','cartao','dinheiro','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_tipo_custo AS ENUM (
    'deslocamento','combustivel','pedagio','alimentacao','hospedagem',
    'terceiros','laboratorio','equipamentos','materiais','impressoes',
    'art','taxas','mao_de_obra','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_alerta_tipo AS ENUM (
    'parcela_vencendo','parcela_vencida','pagamento_parcial',
    'sem_parcelas','custo_acima_previsto','margem_baixa','servico_sem_recebimento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ FUNÇÃO updated_at compartilhada ============
CREATE OR REPLACE FUNCTION public.fin_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ CENTROS DE CUSTO ============
CREATE TABLE public.financeiro_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_centros_custo TO authenticated;
GRANT ALL ON public.financeiro_centros_custo TO service_role;
ALTER TABLE public.financeiro_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin cc auth" ON public.financeiro_centros_custo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fin_cc_upd BEFORE UPDATE ON public.financeiro_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ CONFIGURACOES ============
CREATE TABLE public.financeiro_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelas_padrao jsonb NOT NULL DEFAULT '[{"percentual":50,"dias":0,"descricao":"No aceite"},{"percentual":50,"dias":30,"descricao":"Na entrega"}]'::jsonb,
  dias_alerta_vencimento int NOT NULL DEFAULT 3,
  margem_minima_alerta numeric(6,2) NOT NULL DEFAULT 15.00,
  conta_padrao text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_configuracoes TO authenticated;
GRANT ALL ON public.financeiro_configuracoes TO service_role;
ALTER TABLE public.financeiro_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin cfg auth" ON public.financeiro_configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.financeiro_configuracoes DEFAULT VALUES;
CREATE TRIGGER trg_fin_cfg_upd BEFORE UPDATE ON public.financeiro_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ CONTRATOS ============
CREATE TABLE public.financeiro_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  numero text,
  titulo text,
  valor_aprovado numeric(14,2) NOT NULL DEFAULT 0,
  valor_faturado numeric(14,2) NOT NULL DEFAULT 0,
  valor_recebido numeric(14,2) NOT NULL DEFAULT 0,
  condicao_pagamento text,
  responsavel_comercial uuid REFERENCES auth.users(id),
  data_aprovacao date NOT NULL DEFAULT CURRENT_DATE,
  status public.fin_status_contrato NOT NULL DEFAULT 'aguardando_faturamento',
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id)
);
CREATE INDEX idx_fin_contratos_client ON public.financeiro_contratos(client_id);
CREATE INDEX idx_fin_contratos_status ON public.financeiro_contratos(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_contratos TO authenticated;
GRANT ALL ON public.financeiro_contratos TO service_role;
ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin contratos auth" ON public.financeiro_contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fin_contratos_upd BEFORE UPDATE ON public.financeiro_contratos
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ PARCELAS ============
CREATE TABLE public.financeiro_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.financeiro_contratos(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  numero int NOT NULL,
  descricao text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  valor_recebido numeric(14,2) NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  data_recebimento date,
  forma_pagamento public.fin_forma_pagamento,
  status public.fin_status_parcela NOT NULL DEFAULT 'a_vencer',
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_parcelas_contrato ON public.financeiro_parcelas(contrato_id);
CREATE INDEX idx_fin_parcelas_status ON public.financeiro_parcelas(status);
CREATE INDEX idx_fin_parcelas_venc ON public.financeiro_parcelas(data_vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_parcelas TO authenticated;
GRANT ALL ON public.financeiro_parcelas TO service_role;
ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin parcelas auth" ON public.financeiro_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fin_parcelas_upd BEFORE UPDATE ON public.financeiro_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ RECEBIMENTOS ============
CREATE TABLE public.financeiro_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id uuid NOT NULL REFERENCES public.financeiro_parcelas(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.financeiro_contratos(id) ON DELETE SET NULL,
  valor numeric(14,2) NOT NULL,
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento public.fin_forma_pagamento,
  conta_recebimento text,
  comprovante_url text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_rec_parcela ON public.financeiro_recebimentos(parcela_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_recebimentos TO authenticated;
GRANT ALL ON public.financeiro_recebimentos TO service_role;
ALTER TABLE public.financeiro_recebimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin recebimentos auth" ON public.financeiro_recebimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CUSTOS REALIZADOS ============
CREATE TABLE public.financeiro_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  documento_id uuid REFERENCES public.documentos_tecnicos(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.financeiro_centros_custo(id) ON DELETE SET NULL,
  tipo public.fin_tipo_custo NOT NULL DEFAULT 'outros',
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_id uuid REFERENCES auth.users(id),
  comprovante_url text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_custos_prop ON public.financeiro_custos(proposal_id);
CREATE INDEX idx_fin_custos_exec ON public.financeiro_custos(execucao_id);
CREATE INDEX idx_fin_custos_os ON public.financeiro_custos(os_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_custos TO authenticated;
GRANT ALL ON public.financeiro_custos TO service_role;
ALTER TABLE public.financeiro_custos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin custos auth" ON public.financeiro_custos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fin_custos_upd BEFORE UPDATE ON public.financeiro_custos
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ COMPROVANTES ============
CREATE TABLE public.financeiro_comprovantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id uuid REFERENCES public.financeiro_parcelas(id) ON DELETE CASCADE,
  recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE CASCADE,
  custo_id uuid REFERENCES public.financeiro_custos(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.financeiro_contratos(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_comprovantes TO authenticated;
GRANT ALL ON public.financeiro_comprovantes TO service_role;
ALTER TABLE public.financeiro_comprovantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin compr auth" ON public.financeiro_comprovantes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ALERTAS ============
CREATE TABLE public.financeiro_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.fin_alerta_tipo NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  contrato_id uuid REFERENCES public.financeiro_contratos(id) ON DELETE CASCADE,
  parcela_id uuid REFERENCES public.financeiro_parcelas(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
  custo_id uuid REFERENCES public.financeiro_custos(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  lido boolean NOT NULL DEFAULT false,
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_alertas_lido ON public.financeiro_alertas(lido);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_alertas TO authenticated;
GRANT ALL ON public.financeiro_alertas TO service_role;
ALTER TABLE public.financeiro_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin alertas auth" ON public.financeiro_alertas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ RATEIOS ============
CREATE TABLE public.financeiro_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.financeiro_contratos(id) ON DELETE CASCADE,
  proposal_item_id uuid REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  percentual numeric(6,3) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'proporcional',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rateios TO authenticated;
GRANT ALL ON public.financeiro_rateios TO service_role;
ALTER TABLE public.financeiro_rateios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin rateios auth" ON public.financeiro_rateios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fin_rateios_upd BEFORE UPDATE ON public.financeiro_rateios
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- ============ FUNÇÃO: gerar contrato + parcelas ============
CREATE OR REPLACE FUNCTION public.financeiro_gerar_contrato(_proposal_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prop record;
  cfg record;
  v_contrato_id uuid;
  parc jsonb;
  i int := 1;
  v_valor_total numeric(14,2);
  v_valor_parc numeric(14,2);
  v_perc numeric;
  v_dias int;
  v_desc text;
BEGIN
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO v_contrato_id FROM public.financeiro_contratos WHERE proposal_id = _proposal_id;
  IF v_contrato_id IS NOT NULL THEN RETURN v_contrato_id; END IF;

  v_valor_total := COALESCE(prop.valor_total, 0);

  INSERT INTO public.financeiro_contratos(
    proposal_id, client_id, numero, titulo, valor_aprovado,
    condicao_pagamento, responsavel_comercial, data_aprovacao, created_by
  ) VALUES (
    _proposal_id, prop.client_id, prop.numero, prop.titulo, v_valor_total,
    prop.condicao_pagamento, prop.created_by, CURRENT_DATE, prop.created_by
  ) RETURNING id INTO v_contrato_id;

  SELECT * INTO cfg FROM public.financeiro_configuracoes ORDER BY created_at ASC LIMIT 1;

  IF cfg.parcelas_padrao IS NOT NULL AND jsonb_array_length(cfg.parcelas_padrao) > 0 THEN
    FOR parc IN SELECT * FROM jsonb_array_elements(cfg.parcelas_padrao) LOOP
      v_perc := COALESCE((parc->>'percentual')::numeric, 0);
      v_dias := COALESCE((parc->>'dias')::int, 0);
      v_desc := COALESCE(parc->>'descricao', 'Parcela '||i);
      v_valor_parc := round(v_valor_total * v_perc / 100.0, 2);
      INSERT INTO public.financeiro_parcelas(
        contrato_id, proposal_id, client_id, numero, descricao,
        valor, data_vencimento, status, created_by
      ) VALUES (
        v_contrato_id, _proposal_id, prop.client_id, i, v_desc,
        v_valor_parc, CURRENT_DATE + (v_dias || ' days')::interval, 'a_vencer', prop.created_by
      );
      i := i + 1;
    END LOOP;
  END IF;

  RETURN v_contrato_id;
END $$;

-- ============ FUNÇÃO: registrar recebimento ============
CREATE OR REPLACE FUNCTION public.financeiro_registrar_recebimento(
  _parcela_id uuid, _valor numeric, _data date, _forma public.fin_forma_pagamento,
  _conta text, _comprovante text, _obs text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parc record; v_rec_id uuid; v_total_rec numeric(14,2); v_novo_status public.fin_status_parcela;
BEGIN
  SELECT * INTO parc FROM public.financeiro_parcelas WHERE id = _parcela_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF;

  INSERT INTO public.financeiro_recebimentos(parcela_id, contrato_id, valor, data_recebimento, forma_pagamento, conta_recebimento, comprovante_url, observacoes, created_by)
  VALUES (_parcela_id, parc.contrato_id, _valor, COALESCE(_data, CURRENT_DATE), _forma, _conta, _comprovante, _obs, auth.uid())
  RETURNING id INTO v_rec_id;

  SELECT COALESCE(SUM(valor),0) INTO v_total_rec FROM public.financeiro_recebimentos WHERE parcela_id = _parcela_id;

  IF v_total_rec >= parc.valor THEN v_novo_status := 'recebida';
  ELSIF v_total_rec > 0 THEN v_novo_status := 'recebida_parcial';
  ELSE v_novo_status := parc.status;
  END IF;

  UPDATE public.financeiro_parcelas
    SET valor_recebido = v_total_rec,
        status = v_novo_status,
        data_recebimento = CASE WHEN v_novo_status = 'recebida' THEN COALESCE(_data, CURRENT_DATE) ELSE data_recebimento END,
        forma_pagamento = COALESCE(_forma, forma_pagamento),
        updated_at = now()
    WHERE id = _parcela_id;

  -- atualiza contrato
  UPDATE public.financeiro_contratos c
    SET valor_recebido = (SELECT COALESCE(SUM(valor_recebido),0) FROM public.financeiro_parcelas WHERE contrato_id = c.id),
        status = CASE
          WHEN (SELECT COALESCE(SUM(valor_recebido),0) FROM public.financeiro_parcelas WHERE contrato_id = c.id) >= c.valor_aprovado THEN 'recebido'::public.fin_status_contrato
          WHEN (SELECT COALESCE(SUM(valor_recebido),0) FROM public.financeiro_parcelas WHERE contrato_id = c.id) > 0 THEN 'parcialmente_recebido'::public.fin_status_contrato
          ELSE c.status
        END,
        updated_at = now()
    WHERE c.id = parc.contrato_id;

  RETURN v_rec_id;
END $$;

-- ============ TRIGGER: ao aprovar proposta → gerar contrato ============
CREATE OR REPLACE FUNCTION public.financeiro_on_proposal_aprovada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    PERFORM public.financeiro_gerar_contrato(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fin_on_proposal_aprovada ON public.proposals;
CREATE TRIGGER trg_fin_on_proposal_aprovada
  AFTER UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_on_proposal_aprovada();

-- ============ FUNÇÃO: marcar parcelas vencidas (chamável periodicamente) ============
CREATE OR REPLACE FUNCTION public.financeiro_atualizar_vencidas()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.financeiro_parcelas
    SET status = 'vencida', updated_at = now()
    WHERE status = 'a_vencer' AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.financeiro_gerar_contrato(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.financeiro_registrar_recebimento(uuid, numeric, date, public.fin_forma_pagamento, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.financeiro_atualizar_vencidas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.financeiro_gerar_contrato(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_registrar_recebimento(uuid, numeric, date, public.fin_forma_pagamento, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_atualizar_vencidas() TO authenticated;
