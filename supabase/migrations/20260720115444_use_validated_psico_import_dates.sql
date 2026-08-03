-- Use validation metadata as the authoritative source for imported collection dates.
-- This replaces the previous fallback based on psico_respostas, where an unparsed
-- timestamp could have been persisted as CURRENT_DATE by the legacy commit path.
CREATE OR REPLACE FUNCTION public.psico_reconcile_imported_assessment_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_respondentes integer;
BEGIN
  IF NEW.tipo::text <> 'bruta_respondentes'
     OR NEW.status::text <> 'concluida'
     OR NEW.avaliacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
    INTO v_respondentes
    FROM public.psico_respostas r
   WHERE r.importacao_id = NEW.id
     AND r.avaliacao_id = NEW.avaliacao_id;

  IF v_respondentes > 0 THEN
    UPDATE public.psico_avaliacoes a
       SET quantidade_participantes_prevista = v_respondentes,
           data_inicio_prevista = COALESCE(a.data_inicio_prevista, NEW.data_resposta_minima),
           data_fim_prevista = COALESCE(a.data_fim_prevista, NEW.data_resposta_maxima),
           updated_at = now()
     WHERE a.id = NEW.avaliacao_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_reconcile_imported_assessment_metadata() FROM PUBLIC;

-- Reconcile only from the dates recorded by the validation step.
WITH import_stats AS (
  SELECT
    i.avaliacao_id,
    count(r.id)::integer AS respondentes,
    i.data_resposta_minima AS data_inicio,
    i.data_resposta_maxima AS data_fim
  FROM public.psico_importacoes_avaliacoes i
  JOIN public.psico_respostas r
    ON r.importacao_id = i.id
   AND r.avaliacao_id = i.avaliacao_id
  WHERE i.tipo::text = 'bruta_respondentes'
    AND i.status::text = 'concluida'
    AND i.avaliacao_id IS NOT NULL
  GROUP BY i.id, i.avaliacao_id, i.data_resposta_minima, i.data_resposta_maxima
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
     OR (a.data_inicio_prevista IS NULL AND s.data_inicio IS NOT NULL)
     OR (a.data_fim_prevista IS NULL AND s.data_fim IS NOT NULL)
   );
