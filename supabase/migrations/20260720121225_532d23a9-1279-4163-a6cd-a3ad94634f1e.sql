CREATE OR REPLACE FUNCTION public.psico_cancel_import_when_assessment_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status::text = 'cancelada'
     AND OLD.status::text <> 'cancelada'
     AND NEW.importacao_avaliacao_id IS NOT NULL THEN
    UPDATE public.psico_importacoes_avaliacoes
       SET status = 'cancelada'::public.psico_importacao_status,
           cancelado_em = COALESCE(cancelado_em, now()),
           updated_at = now()
     WHERE id = NEW.importacao_avaliacao_id
       AND avaliacao_id = NEW.id
       AND status IN (
         'concluida'::public.psico_importacao_status,
         'concluida_com_avisos'::public.psico_importacao_status
       );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_cancel_import_when_assessment_cancelled() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_psico_cancel_import_when_assessment_cancelled
  ON public.psico_avaliacoes;

CREATE TRIGGER trg_psico_cancel_import_when_assessment_cancelled
AFTER UPDATE OF status ON public.psico_avaliacoes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.psico_cancel_import_when_assessment_cancelled();

UPDATE public.psico_importacoes_avaliacoes i
   SET status = 'cancelada'::public.psico_importacao_status,
       cancelado_em = COALESCE(i.cancelado_em, now()),
       updated_at = now()
  FROM public.psico_avaliacoes a
 WHERE a.id = i.avaliacao_id
   AND a.importacao_avaliacao_id = i.id
   AND a.status::text = 'cancelada'
   AND i.status IN (
     'concluida'::public.psico_importacao_status,
     'concluida_com_avisos'::public.psico_importacao_status
   );