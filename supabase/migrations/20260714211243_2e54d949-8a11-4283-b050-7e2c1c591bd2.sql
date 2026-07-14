CREATE OR REPLACE FUNCTION public.psico_atualizar_participante(
  _participante_id uuid,
  _nome text,
  _email text,
  _telefone text,
  _funcao text,
  _setor text,
  _unidade text,
  _justificativa text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  p record;
  av_status text;
  v_respondido boolean;
  v_admin boolean;
  v_nome text; v_email text; v_tel text; v_func text; v_set text; v_uni text;
  v_nome_n text; v_email_n text; v_tel_n text; v_func_n text; v_set_n text; v_uni_n text;
  v_dup_id uuid;
  v_campos text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para editar participantes.';
  END IF;
  v_admin := public.has_role(v_uid, 'admin');

  SELECT * INTO p FROM public.psico_participantes WHERE id = _participante_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participante não encontrado.'; END IF;

  SELECT status::text INTO av_status FROM public.psico_avaliacoes WHERE id = p.avaliacao_id;
  IF av_status = 'cancelada' THEN RAISE EXCEPTION 'Avaliação cancelada: edição bloqueada.'; END IF;
  IF NOT p.ativo THEN RAISE EXCEPTION 'Participante inativo não pode ser editado por este fluxo.'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.psico_convites c
    WHERE c.participante_id = p.id AND (c.status = 'respondido' OR c.respondido_em IS NOT NULL)
  ) INTO v_respondido;

  v_nome := regexp_replace(btrim(coalesce(_nome, p.nome)), '\s+', ' ', 'g');
  v_email := NULLIF(btrim(coalesce(_email, '')), '');
  v_tel := NULLIF(btrim(coalesce(_telefone, '')), '');
  v_func := NULLIF(regexp_replace(btrim(coalesce(_funcao,'')), '\s+', ' ', 'g'), '');
  v_set := NULLIF(regexp_replace(btrim(coalesce(_setor,'')), '\s+', ' ', 'g'), '');
  v_uni := NULLIF(regexp_replace(btrim(coalesce(_unidade,'')), '\s+', ' ', 'g'), '');

  IF v_nome IS NULL OR length(v_nome) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
  IF v_tel IS NOT NULL AND length(regexp_replace(v_tel,'\D','','g')) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone inválido.';
  END IF;

  v_nome_n := coalesce(public.psico_norm_texto(v_nome),'');
  v_email_n := public.psico_norm_email(v_email);
  v_tel_n := public.psico_norm_fone(v_tel);
  v_func_n := public.psico_norm_texto(v_func);
  v_set_n := public.psico_norm_texto(v_set);
  v_uni_n := public.psico_norm_texto(v_uni);

  IF v_respondido THEN
    IF v_func_n IS DISTINCT FROM p.funcao_normalizada
       OR v_set_n IS DISTINCT FROM p.setor_normalizada
       OR v_uni_n IS DISTINCT FROM p.unidade_normalizada THEN
      RAISE EXCEPTION 'Este participante já concluiu o questionário. Função, setor e unidade não podem ser alterados.';
    END IF;
    IF v_nome_n IS DISTINCT FROM p.nome_normalizado
       OR v_email_n IS DISTINCT FROM p.email_normalizado
       OR v_tel_n IS DISTINCT FROM p.telefone_normalizado THEN
      IF NOT v_admin THEN
        RAISE EXCEPTION 'Correção após resposta é restrita a administradores.';
      END IF;
      IF _justificativa IS NULL OR length(btrim(_justificativa)) < 10 THEN
        RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres).';
      END IF;
    END IF;
  END IF;

  IF v_email_n IS NOT NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND email_normalizado = v_email_n LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com o mesmo e-mail normalizado nesta avaliação.';
    END IF;
  END IF;
  IF v_tel_n IS NOT NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND telefone_normalizado = v_tel_n LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com o mesmo telefone normalizado nesta avaliação.';
    END IF;
  END IF;
  IF v_email_n IS NULL AND v_tel_n IS NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND nome_normalizado = v_nome_n
       AND coalesce(funcao_normalizada,'') = coalesce(v_func_n,'')
       AND coalesce(setor_normalizada,'') = coalesce(v_set_n,'')
       AND coalesce(unidade_normalizada,'') = coalesce(v_uni_n,'')
     LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com nome e segmentação idênticos nesta avaliação.';
    END IF;
  END IF;

  IF v_nome_n IS DISTINCT FROM p.nome_normalizado THEN v_campos := v_campos || 'nome'::text; END IF;
  IF v_email_n IS DISTINCT FROM p.email_normalizado THEN v_campos := v_campos || 'email'::text; END IF;
  IF v_tel_n IS DISTINCT FROM p.telefone_normalizado THEN v_campos := v_campos || 'telefone'::text; END IF;
  IF v_func_n IS DISTINCT FROM p.funcao_normalizada THEN v_campos := v_campos || 'funcao'::text; END IF;
  IF v_set_n IS DISTINCT FROM p.setor_normalizada THEN v_campos := v_campos || 'setor'::text; END IF;
  IF v_uni_n IS DISTINCT FROM p.unidade_normalizada THEN v_campos := v_campos || 'unidade'::text; END IF;

  PERFORM set_config('psico.allow_update', 'on', true);

  UPDATE public.psico_participantes
     SET nome = v_nome,
         email = v_email,
         telefone = v_tel,
         funcao = v_func,
         setor = v_set,
         unidade = v_uni,
         atualizado_por = v_uid,
         updated_at = now()
   WHERE id = p.id;

  PERFORM set_config('psico.allow_update', 'off', true);

  IF array_length(v_campos,1) IS NOT NULL THEN
    INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, usuario_id, metadados)
    VALUES ('participante', p.id, 'participante_editado', v_uid,
      jsonb_build_object(
        'avaliacao_id', p.avaliacao_id,
        'campos_alterados', to_jsonb(v_campos),
        'alteracao_pos_resposta', v_respondido,
        'justificativa_informada', (_justificativa IS NOT NULL AND length(btrim(_justificativa)) >= 10)
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'campos_alterados', to_jsonb(v_campos));
END $$;