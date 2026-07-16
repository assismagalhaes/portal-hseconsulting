
-- FASE 9A — Adendo: 3 layouts de importação bruta (Google Forms)

-- 1) Novos campos na tabela de importações
ALTER TABLE public.psico_importacoes_avaliacoes
  ADD COLUMN IF NOT EXISTS layout_detectado text,
  ADD COLUMN IF NOT EXISTS tipo_identificador_origem text,
  ADD COLUMN IF NOT EXISTS coluna_identificador_origem text,
  ADD COLUMN IF NOT EXISTS nome_presente boolean,
  ADD COLUMN IF NOT EXISTS funcao_presente boolean,
  ADD COLUMN IF NOT EXISTS segmentacao_funcao_disponivel boolean,
  ADD COLUMN IF NOT EXISTS delimitador_detectado text,
  ADD COLUMN IF NOT EXISTS codificacao_detectada text,
  ADD COLUMN IF NOT EXISTS codificacao_corrigida boolean;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='psico_importacoes_layout_check'
  ) THEN
    ALTER TABLE public.psico_importacoes_avaliacoes
      ADD CONSTRAINT psico_importacoes_layout_check
      CHECK (layout_detectado IS NULL OR layout_detectado IN
        ('id_respostas','id_nome_funcao_respostas','id_nome_respostas'));
  END IF;
END $$;

-- 2) Novos campos no staging técnico
ALTER TABLE public.psico_importacao_staging_respostas
  ADD COLUMN IF NOT EXISTS layout_detectado text,
  ADD COLUMN IF NOT EXISTS identificador_origem_hash text,
  ADD COLUMN IF NOT EXISTS tipo_identificador text;

-- Garante que nenhum nome/PII possa ser adicionado ao staging por engano
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='psico_importacao_staging_respostas'
                AND column_name IN ('nome','nome_completo','email','telefone','celular','cpf','rg','matricula')) THEN
    RAISE EXCEPTION 'staging_com_pii_proibida';
  END IF;
END $$;

-- 3) RPC para registrar o layout detectado (chamada pela Edge Function de validação)
CREATE OR REPLACE FUNCTION public.psico_importacao_registrar_layout(
  p_importacao_id uuid,
  p_layout jsonb   -- { layout, coluna_identificador, tipo_identificador, coluna_nome, coluna_funcao,
                   --   nome_presente, funcao_presente, segmentacao_funcao_disponivel,
                   --   delimitador, codificacao, codificacao_corrigida }
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._psico_require_admin_tec();
  UPDATE public.psico_importacoes_avaliacoes
     SET layout_detectado = NULLIF(p_layout->>'layout',''),
         tipo_identificador_origem = NULLIF(p_layout->>'tipo_identificador',''),
         coluna_identificador_origem = NULLIF(p_layout->>'coluna_identificador',''),
         nome_presente = COALESCE((p_layout->>'nome_presente')::boolean, false),
         funcao_presente = COALESCE((p_layout->>'funcao_presente')::boolean, false),
         segmentacao_funcao_disponivel = COALESCE((p_layout->>'segmentacao_funcao_disponivel')::boolean, false),
         delimitador_detectado = NULLIF(p_layout->>'delimitador',''),
         codificacao_detectada = NULLIF(p_layout->>'codificacao',''),
         codificacao_corrigida = COALESCE((p_layout->>'codificacao_corrigida')::boolean, false),
         updated_at = now()
   WHERE id = p_importacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.psico_importacao_registrar_layout(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_importacao_registrar_layout(uuid, jsonb) TO authenticated, service_role;

-- 4) Reforçar teste de integridade: agora também valida ausência de identificador bruto no staging
--    (a coluna não existe, então basta manter T1). Nenhuma alteração adicional necessária.
