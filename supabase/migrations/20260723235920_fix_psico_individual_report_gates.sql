CREATE OR REPLACE FUNCTION public.psico_ind_parecer_completo(p_parecer jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_parecer IS NOT NULL
    AND length(btrim(coalesce(p_parecer->>'sintese_caso',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'interpretacao_convergencia',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'prioridades',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'recomendacoes_organizacionais',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'limitacoes',''))) >= 20
    AND length(btrim(coalesce(p_parecer->>'conclusao',''))) >= 20;
$$;

ALTER TABLE public.psico_individual_revisoes
  DROP CONSTRAINT IF EXISTS psico_ind_parecer_estrutura_chk;
ALTER TABLE public.psico_individual_revisoes
  ADD CONSTRAINT psico_ind_parecer_estrutura_chk
  CHECK (parecer IS NULL OR public.psico_ind_parecer_completo(parecer)) NOT VALID;

CREATE OR REPLACE FUNCTION public.psico_ind_gates_emissao(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_proc record; v_rev record; v_plano jsonb;
  v_erros jsonb := '[]'::jsonb; v_diver integer; v_requer_acao boolean;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' AND NOT public.can_see_internal(auth.uid())
    THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_proc FROM public.psico_individual_processamentos
   WHERE avaliacao_id=p_avaliacao AND imutavel=true
   ORDER BY aprovado_em DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    v_erros:=v_erros||jsonb_build_object('codigo','processamento_pendente','mensagem','Conciliação não aprovada.');
  END IF;

  IF NOT public.psico_ind_formulario_concluido(p_avaliacao,'empregado') THEN
    v_erros:=v_erros||jsonb_build_object('codigo','formulario_empregado_pendente','mensagem','Formulário do empregado não submetido.');
  END IF;
  IF NOT public.psico_ind_formulario_concluido(p_avaliacao,'empregador') THEN
    v_erros:=v_erros||jsonb_build_object('codigo','formulario_empregador_pendente','mensagem','Formulário do empregador não submetido.');
  END IF;

  SELECT count(*) INTO v_diver FROM public.psico_individual_achados a
   WHERE a.avaliacao_id=p_avaliacao
     AND (a.estado_final='divergente' OR a.estado_convergencia='divergente')
     AND coalesce(btrim(a.decisao_tecnica),'')='';
  IF v_diver>0 THEN
    v_erros:=v_erros||jsonb_build_object('codigo','divergencia_nao_tratada','mensagem',v_diver||' achado(s) divergente(s) sem decisão técnica.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.psico_individual_achados
    WHERE avaliacao_id=p_avaliacao AND necessita_acao=true) INTO v_requer_acao;
  BEGIN
    v_plano:=public.psico_ind_plano_gates(p_avaliacao);
    IF NOT coalesce((v_plano->>'pronto_para_aprovacao')::boolean,false) THEN
      v_erros:=v_erros||jsonb_build_object('codigo','plano_pendente','mensagem','Plano de ação incompleto.','detalhes',v_plano);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_erros:=v_erros||jsonb_build_object('codigo','plano_indisponivel','mensagem','Não foi possível validar o plano de ação.');
    v_plano:=jsonb_build_object('erro','validacao_indisponivel');
  END;

  IF v_requer_acao AND (
    NOT EXISTS(SELECT 1 FROM public.psico_ind_plano_itens WHERE avaliacao_id=p_avaliacao)
    OR EXISTS(SELECT 1 FROM public.psico_ind_plano_itens WHERE avaliacao_id=p_avaliacao AND imutavel=false)
  ) THEN
    v_erros:=v_erros||jsonb_build_object('codigo','plano_nao_aprovado','mensagem','As ações necessárias devem estar aprovadas.');
  END IF;

  SELECT * INTO v_rev FROM public.psico_individual_revisoes
   WHERE avaliacao_id=p_avaliacao AND ativa=true ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    v_erros:=v_erros||jsonb_build_object('codigo','revisao_ausente','mensagem','Nenhuma revisão técnica ativa.');
  ELSE
    IF NOT public.psico_ind_parecer_completo(v_rev.parecer) THEN
      v_erros:=v_erros||jsonb_build_object('codigo','parecer_incompleto','mensagem','Os seis campos obrigatórios do parecer devem estar preenchidos.');
    END IF;
    IF v_rev.status<>'aprovada' OR v_rev.imutavel IS NOT TRUE THEN
      v_erros:=v_erros||jsonb_build_object('codigo','revisao_nao_aprovada','mensagem','Revisão técnica ainda não aprovada.');
    END IF;
    IF v_rev.responsavel_profissional_id IS NULL THEN
      v_erros:=v_erros||jsonb_build_object('codigo','responsavel_ausente','mensagem','Responsável técnico não definido.');
    END IF;
    IF v_rev.assinatura_storage_path IS NULL OR v_rev.assinatura_hash_sha256 IS NULL THEN
      v_erros:=v_erros||jsonb_build_object('codigo','assinatura_ausente','mensagem','Assinatura válida não anexada.');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pode_emitir',jsonb_array_length(v_erros)=0,'erros',v_erros,
    'plano_gates',v_plano,'revisao_id',v_rev.id,'processamento_id',v_proc.id
  );
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_gates_emissao(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_gates_emissao(uuid) TO authenticated,service_role;
