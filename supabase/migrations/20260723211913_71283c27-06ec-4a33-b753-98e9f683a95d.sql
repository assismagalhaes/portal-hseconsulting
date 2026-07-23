
-- Impede alterações/remoções em perguntas e opções de instrumentos AQI marcados como vigentes.
-- INSERTs em instrumentos novos (não vigentes ainda) continuam permitidos, permitindo criar v1.1 antes de publicar.

CREATE OR REPLACE FUNCTION public.psico_ind_bloquear_alteracao_vigente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instr_id uuid;
  v_vigente boolean;
BEGIN
  -- Descobre o instrumento afetado
  IF TG_TABLE_NAME = 'psico_individual_perguntas' THEN
    v_instr_id := COALESCE(NEW.instrumento_versao_id, OLD.instrumento_versao_id);
  ELSIF TG_TABLE_NAME = 'psico_individual_opcoes' THEN
    SELECT p.instrumento_versao_id INTO v_instr_id
      FROM public.psico_individual_perguntas p
     WHERE p.id = COALESCE(NEW.pergunta_id, OLD.pergunta_id);
  END IF;

  IF v_instr_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT vigente INTO v_vigente
    FROM public.psico_individual_instrumentos_versoes
   WHERE id = v_instr_id;

  IF v_vigente IS TRUE THEN
    -- Para INSERT em perguntas/opções de instrumento já vigente: bloquear (evita mudança silenciosa do questionário publicado)
    RAISE EXCEPTION 'Instrumento AQI vigente é imutável. Publique uma nova versão para alterar perguntas/opções.'
      USING ERRCODE = '55006';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_bloquear_alteracao_vigente() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_psico_ind_perg_imutabilidade ON public.psico_individual_perguntas;
CREATE TRIGGER trg_psico_ind_perg_imutabilidade
BEFORE INSERT OR UPDATE OR DELETE ON public.psico_individual_perguntas
FOR EACH ROW EXECUTE FUNCTION public.psico_ind_bloquear_alteracao_vigente();

DROP TRIGGER IF EXISTS trg_psico_ind_opc_imutabilidade ON public.psico_individual_opcoes;
CREATE TRIGGER trg_psico_ind_opc_imutabilidade
BEFORE INSERT OR UPDATE OR DELETE ON public.psico_individual_opcoes
FOR EACH ROW EXECUTE FUNCTION public.psico_ind_bloquear_alteracao_vigente();
