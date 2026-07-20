-- Reconcile metadata once a raw historical import is committed.
-- The imported responses are the authoritative source for respondent count and,
-- when the operator did not provide dates, for the original collection period.
CREATE OR REPLACE FUNCTION public.psico_reconcile_imported_assessment_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_respondentes integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF NEW.tipo::text <> 'bruta_respondentes'
     OR NEW.status::text <> 'concluida'
     OR NEW.avaliacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer, min(r.data_resposta), max(r.data_resposta)
    INTO v_respondentes, v_data_inicio, v_data_fim
    FROM public.psico_respostas r
   WHERE r.importacao_id = NEW.id
     AND r.avaliacao_id = NEW.avaliacao_id;

  IF v_respondentes > 0 THEN
    UPDATE public.psico_avaliacoes a
       SET quantidade_participantes_prevista = v_respondentes,
           data_inicio_prevista = COALESCE(a.data_inicio_prevista, v_data_inicio),
           data_fim_prevista = COALESCE(a.data_fim_prevista, v_data_fim),
           updated_at = now()
     WHERE a.id = NEW.avaliacao_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_reconcile_imported_assessment_metadata() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_psico_reconcile_imported_assessment_metadata
  ON public.psico_importacoes_avaliacoes;

CREATE TRIGGER trg_psico_reconcile_imported_assessment_metadata
AFTER UPDATE OF status ON public.psico_importacoes_avaliacoes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.psico_reconcile_imported_assessment_metadata();

-- Repair historical raw imports that were completed before the trigger existed.
WITH import_stats AS (
  SELECT
    i.id AS importacao_id,
    i.avaliacao_id,
    count(r.id)::integer AS respondentes,
    min(r.data_resposta) AS data_inicio,
    max(r.data_resposta) AS data_fim
  FROM public.psico_importacoes_avaliacoes i
  JOIN public.psico_respostas r
    ON r.importacao_id = i.id
   AND r.avaliacao_id = i.avaliacao_id
  WHERE i.tipo::text = 'bruta_respondentes'
    AND i.status::text = 'concluida'
    AND i.avaliacao_id IS NOT NULL
  GROUP BY i.id, i.avaliacao_id
)
UPDATE public.psico_avaliacoes a
   SET quantidade_participantes_prevista = s.respondentes,
       data_inicio_prevista = COALESCE(a.data_inicio_prevista, s.data_inicio),
       data_fim_prevista = COALESCE(a.data_fim_prevista, s.data_fim),
       updated_at = now()
  FROM import_stats s
 WHERE a.id = s.avaliacao_id
   AND s.respondentes > 0
   AND (
     a.quantidade_participantes_prevista IS DISTINCT FROM s.respondentes
     OR a.data_inicio_prevista IS NULL
     OR a.data_fim_prevista IS NULL
   );
