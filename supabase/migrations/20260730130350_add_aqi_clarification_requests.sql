-- AQI 2.2: esclarecimentos assíncronos e separados para achados divergentes.
-- Respostas individuais permanecem restritas; a área técnica recebe somente
-- uma síntese organizacional determinística e sanitizada.

CREATE TABLE public.psico_individual_esclarecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  processamento_id uuid NOT NULL REFERENCES public.psico_individual_processamentos(id) ON DELETE CASCADE,
  achado_id uuid NOT NULL REFERENCES public.psico_individual_achados(id) ON DELETE CASCADE,
  fator_codigo text NOT NULL,
  perigo_codigo text,
  status text NOT NULL DEFAULT 'aguardando_respostas'
    CHECK (status IN ('aguardando_respostas','parcial','concluido','revogado')),
  sintese_sanitizada jsonb,
  solicitado_por uuid NOT NULL REFERENCES auth.users(id),
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX psico_ind_esclarecimentos_avaliacao_idx
  ON public.psico_individual_esclarecimentos(avaliacao_id, solicitado_em DESC);
CREATE INDEX psico_ind_esclarecimentos_achado_idx
  ON public.psico_individual_esclarecimentos(achado_id, solicitado_em DESC);
CREATE UNIQUE INDEX psico_ind_esclarecimentos_ativo_uidx
  ON public.psico_individual_esclarecimentos(achado_id)
  WHERE status IN ('aguardando_respostas','parcial');

ALTER TABLE public.psico_individual_esclarecimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.psico_individual_esclarecimentos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.psico_individual_esclarecimentos TO service_role;

CREATE TABLE public.psico_individual_esclarecimento_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esclarecimento_id uuid NOT NULL REFERENCES public.psico_individual_esclarecimentos(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('empregado','empregador')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','respondido','revogado','expirado')),
  expira_em timestamptz NOT NULL,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (esclarecimento_id, papel)
);

CREATE INDEX psico_ind_escl_conv_esclarecimento_idx
  ON public.psico_individual_esclarecimento_convites(esclarecimento_id);

ALTER TABLE public.psico_individual_esclarecimento_convites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.psico_individual_esclarecimento_convites FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.psico_individual_esclarecimento_convites TO service_role;

CREATE TABLE public.psico_individual_esclarecimento_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esclarecimento_id uuid NOT NULL REFERENCES public.psico_individual_esclarecimentos(id) ON DELETE CASCADE,
  convite_id uuid NOT NULL UNIQUE REFERENCES public.psico_individual_esclarecimento_convites(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('empregado','empregador')),
  respostas jsonb NOT NULL,
  respondido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (esclarecimento_id, papel)
);

ALTER TABLE public.psico_individual_esclarecimento_respostas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.psico_individual_esclarecimento_respostas FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.psico_individual_esclarecimento_respostas TO service_role;

CREATE OR REPLACE FUNCTION public.psico_ind_solicitar_esclarecimento(
  p_achado uuid,
  p_token_hash_empregado text,
  p_token_hash_empregador text,
  p_expira_em timestamptz DEFAULT (now() + interval '14 days')
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achado public.psico_individual_achados%ROWTYPE;
  v_imutavel boolean;
  v_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(p_token_hash_empregado, '') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_token_hash_empregador, '') !~ '^[0-9a-f]{64}$'
     OR p_token_hash_empregado = p_token_hash_empregador THEN
    RAISE EXCEPTION 'token_hash_invalido';
  END IF;
  IF p_expira_em <= now() OR p_expira_em > now() + interval '30 days' THEN
    RAISE EXCEPTION 'expiracao_invalida';
  END IF;

  SELECT a.*
    INTO v_achado
    FROM public.psico_individual_achados a
    JOIN public.psico_individual_processamentos p ON p.id = a.processamento_id
   WHERE a.id = p_achado
   FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'achado_nao_encontrado'; END IF;
  SELECT imutavel INTO v_imutavel
    FROM public.psico_individual_processamentos
   WHERE id = v_achado.processamento_id;
  IF v_imutavel THEN RAISE EXCEPTION 'processamento_imutavel'; END IF;
  IF v_achado.estado_final NOT IN ('divergente','evidencia_insuficiente') THEN
    RAISE EXCEPTION 'esclarecimento_nao_aplicavel';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.psico_individual_esclarecimentos
     WHERE achado_id = p_achado AND status IN ('aguardando_respostas','parcial')
  ) THEN
    RAISE EXCEPTION 'esclarecimento_ativo_existente';
  END IF;

  INSERT INTO public.psico_individual_esclarecimentos(
    avaliacao_id, processamento_id, achado_id, fator_codigo, perigo_codigo, solicitado_por
  ) VALUES (
    v_achado.avaliacao_id, v_achado.processamento_id, v_achado.id,
    v_achado.fator_codigo, v_achado.perigo_codigo, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.psico_individual_esclarecimento_convites(
    esclarecimento_id, papel, token_hash, expira_em
  ) VALUES
    (v_id, 'empregado', p_token_hash_empregado, p_expira_em),
    (v_id, 'empregador', p_token_hash_empregador, p_expira_em);

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, usuario_id, metadados)
  VALUES (
    'avaliacao', v_achado.avaliacao_id, 'esclarecimento_individual_solicitado', auth.uid(),
    jsonb_build_object(
      'resumo', 'Esclarecimento assíncrono solicitado para condição divergente',
      'esclarecimento_id', v_id,
      'achado_id', v_achado.id,
      'fator_codigo', v_achado.fator_codigo,
      'perigo_codigo', v_achado.perigo_codigo
    )
  );

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_solicitar_esclarecimento(uuid,text,text,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_solicitar_esclarecimento(uuid,text,text,timestamptz)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_ind_reemitir_esclarecimento(
  p_esclarecimento uuid,
  p_token_hash_empregado text,
  p_token_hash_empregador text,
  p_expira_em timestamptz DEFAULT (now() + interval '14 days')
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escl public.psico_individual_esclarecimentos%ROWTYPE;
  v_imutavel boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(p_token_hash_empregado, '') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_token_hash_empregador, '') !~ '^[0-9a-f]{64}$'
     OR p_token_hash_empregado = p_token_hash_empregador THEN
    RAISE EXCEPTION 'token_hash_invalido';
  END IF;
  IF p_expira_em <= now() OR p_expira_em > now() + interval '30 days' THEN
    RAISE EXCEPTION 'expiracao_invalida';
  END IF;

  SELECT * INTO v_escl
    FROM public.psico_individual_esclarecimentos
   WHERE id = p_esclarecimento
   FOR UPDATE;
  IF NOT FOUND OR v_escl.status NOT IN ('aguardando_respostas','parcial') THEN
    RAISE EXCEPTION 'esclarecimento_indisponivel';
  END IF;
  SELECT imutavel INTO v_imutavel
    FROM public.psico_individual_processamentos
   WHERE id = v_escl.processamento_id;
  IF v_imutavel THEN RAISE EXCEPTION 'processamento_imutavel'; END IF;

  UPDATE public.psico_individual_esclarecimento_convites
     SET token_hash = CASE papel
           WHEN 'empregado' THEN p_token_hash_empregado
           ELSE p_token_hash_empregador
         END,
         status = 'ativo',
         expira_em = p_expira_em,
         updated_at = now()
   WHERE esclarecimento_id = v_escl.id
     AND status <> 'respondido';

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, usuario_id, metadados)
  VALUES (
    'avaliacao', v_escl.avaliacao_id, 'esclarecimento_individual_links_reemitidos', auth.uid(),
    jsonb_build_object(
      'resumo', 'Links pendentes de esclarecimento foram reemitidos',
      'esclarecimento_id', v_escl.id,
      'achado_id', v_escl.achado_id
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_reemitir_esclarecimento(uuid,text,text,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_reemitir_esclarecimento(uuid,text,text,timestamptz)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_ind_listar_esclarecimentos(p_avaliacao uuid)
RETURNS TABLE (
  id uuid,
  achado_id uuid,
  fator_codigo text,
  perigo_codigo text,
  status text,
  empregado_status text,
  empregador_status text,
  expira_em timestamptz,
  sintese_sanitizada jsonb,
  solicitado_em timestamptz,
  concluido_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.achado_id, e.fator_codigo, e.perigo_codigo, e.status,
         max(c.status) FILTER (WHERE c.papel = 'empregado') AS empregado_status,
         max(c.status) FILTER (WHERE c.papel = 'empregador') AS empregador_status,
         max(c.expira_em) AS expira_em,
         e.sintese_sanitizada, e.solicitado_em, e.concluido_em
    FROM public.psico_individual_esclarecimentos e
    JOIN public.psico_individual_esclarecimento_convites c ON c.esclarecimento_id = e.id
   WHERE e.avaliacao_id = p_avaliacao
     AND (
       public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
     )
   GROUP BY e.id
   ORDER BY e.solicitado_em DESC;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_listar_esclarecimentos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_listar_esclarecimentos(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_ind_finalizar_esclarecimento(
  p_convite uuid,
  p_token_hash text,
  p_respostas jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.psico_individual_esclarecimento_convites%ROWTYPE;
  v_escl public.psico_individual_esclarecimentos%ROWTYPE;
  v_emp jsonb;
  v_erg jsonb;
  v_total integer;
  v_iguais integer;
  v_exemplos integer;
  v_evidencias integer;
  v_resultado text;
  v_fundamentacao text;
  v_sintese jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'token_invalido'; END IF;
  IF jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'respostas_invalidas'; END IF;
  IF coalesce(p_respostas->>'frequencia', '') NOT IN ('nao_ocorre','raramente','as_vezes','frequente','continua')
     OR coalesce(p_respostas->>'controle', '') NOT IN ('eficaz','parcial','ineficaz','inexistente','nao_sei')
     OR coalesce(p_respostas->>'aplicacao', '') NOT IN ('sempre','parcialmente','nao','nao_se_aplica') THEN
    RAISE EXCEPTION 'respostas_invalidas';
  END IF;
  IF length(coalesce(p_respostas->>'exemplo', '')) > 1000
     OR length(coalesce(p_respostas->>'evidencia', '')) > 1000 THEN
    RAISE EXCEPTION 'resposta_excede_limite';
  END IF;

  SELECT * INTO v_conv
    FROM public.psico_individual_esclarecimento_convites
   WHERE id = p_convite
   FOR UPDATE;
  IF NOT FOUND OR v_conv.token_hash <> p_token_hash THEN RAISE EXCEPTION 'convite_invalido'; END IF;
  IF v_conv.status = 'respondido' THEN RETURN jsonb_build_object('status','ja_respondido'); END IF;
  IF v_conv.status <> 'ativo' THEN RAISE EXCEPTION 'convite_indisponivel'; END IF;
  IF v_conv.expira_em < now() THEN
    UPDATE public.psico_individual_esclarecimento_convites SET status='expirado', updated_at=now()
     WHERE id=v_conv.id;
    RAISE EXCEPTION 'convite_expirado';
  END IF;

  SELECT * INTO v_escl FROM public.psico_individual_esclarecimentos
   WHERE id = v_conv.esclarecimento_id FOR UPDATE;
  IF v_escl.status NOT IN ('aguardando_respostas','parcial') THEN
    RAISE EXCEPTION 'solicitacao_indisponivel';
  END IF;

  INSERT INTO public.psico_individual_esclarecimento_respostas(
    esclarecimento_id, convite_id, papel, respostas
  ) VALUES (v_escl.id, v_conv.id, v_conv.papel, p_respostas);
  UPDATE public.psico_individual_esclarecimento_convites
     SET status='respondido', respondido_em=now(), updated_at=now()
   WHERE id=v_conv.id;

  SELECT count(*) INTO v_total
    FROM public.psico_individual_esclarecimento_respostas
   WHERE esclarecimento_id=v_escl.id;
  IF v_total < 2 THEN
    UPDATE public.psico_individual_esclarecimentos SET status='parcial', updated_at=now()
     WHERE id=v_escl.id;
    RETURN jsonb_build_object('status','registrada');
  END IF;

  SELECT respostas INTO v_emp FROM public.psico_individual_esclarecimento_respostas
   WHERE esclarecimento_id=v_escl.id AND papel='empregado';
  SELECT respostas INTO v_erg FROM public.psico_individual_esclarecimento_respostas
   WHERE esclarecimento_id=v_escl.id AND papel='empregador';

  v_iguais :=
    (CASE WHEN v_emp->>'frequencia' = v_erg->>'frequencia' THEN 1 ELSE 0 END) +
    (CASE WHEN v_emp->>'controle' = v_erg->>'controle' THEN 1 ELSE 0 END) +
    (CASE WHEN v_emp->>'aplicacao' = v_erg->>'aplicacao' THEN 1 ELSE 0 END);
  v_exemplos :=
    (CASE WHEN length(btrim(coalesce(v_emp->>'exemplo',''))) >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN length(btrim(coalesce(v_erg->>'exemplo',''))) >= 10 THEN 1 ELSE 0 END);
  v_evidencias :=
    (CASE WHEN length(btrim(coalesce(v_emp->>'evidencia',''))) >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN length(btrim(coalesce(v_erg->>'evidencia',''))) >= 10 THEN 1 ELSE 0 END);
  v_resultado := CASE WHEN v_iguais=3 THEN 'convergente' WHEN v_iguais>=1 THEN 'parcial' ELSE 'divergente' END;
  v_fundamentacao := format(
    'Esclarecimentos concluídos: %s de 3 critérios convergentes; %s de 2 participantes forneceram exemplo e %s de 2 indicaram evidência organizacional. As respostas individuais permanecem protegidas.',
    v_iguais, v_exemplos, v_evidencias
  );
  v_sintese := jsonb_build_object(
    'resultado', v_resultado,
    'criterios_convergentes', v_iguais,
    'criterios_avaliados', 3,
    'convergencia_frequencia', v_emp->>'frequencia' = v_erg->>'frequencia',
    'convergencia_controle', v_emp->>'controle' = v_erg->>'controle',
    'convergencia_aplicacao', v_emp->>'aplicacao' = v_erg->>'aplicacao',
    'exemplos_fornecidos', v_exemplos,
    'evidencias_fornecidas', v_evidencias,
    'fundamentacao', v_fundamentacao
  );

  UPDATE public.psico_individual_esclarecimentos
     SET status='concluido', sintese_sanitizada=v_sintese, concluido_em=now(), updated_at=now()
   WHERE id=v_escl.id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados)
  VALUES (
    'avaliacao', v_escl.avaliacao_id, 'esclarecimento_individual_concluido',
    jsonb_build_object(
      'resumo', 'Esclarecimento assíncrono concluído; somente síntese sanitizada disponibilizada',
      'esclarecimento_id', v_escl.id,
      'achado_id', v_escl.achado_id,
      'resultado', v_resultado
    )
  );
  RETURN jsonb_build_object('status','registrada');
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_finalizar_esclarecimento(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_ind_finalizar_esclarecimento(uuid,text,jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.psico_ind_aprovar_processamento(p_processamento uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT avaliacao_id INTO v_avaliacao
    FROM public.psico_individual_processamentos
   WHERE id = p_processamento AND imutavel = false
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'processamento_nao_encontrado_ou_imutavel'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.psico_individual_achados
     WHERE processamento_id = p_processamento
       AND estado_final IN ('divergente','evidencia_insuficiente')
       AND revisado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'divergencias_sem_validacao_tecnica';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.psico_individual_esclarecimentos
     WHERE processamento_id = p_processamento
       AND status IN ('aguardando_respostas','parcial')
  ) THEN
    RAISE EXCEPTION 'esclarecimentos_pendentes';
  END IF;

  UPDATE public.psico_individual_processamentos
     SET imutavel = true, aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
   WHERE id = p_processamento;

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, usuario_id, metadados)
  VALUES (
    'avaliacao', v_avaliacao, 'conciliacao_individual_aprovada', auth.uid(),
    jsonb_build_object(
      'resumo', 'Conciliação individual aprovada e tornada imutável',
      'processamento_id', p_processamento
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_aprovar_processamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_aprovar_processamento(uuid) TO authenticated;
