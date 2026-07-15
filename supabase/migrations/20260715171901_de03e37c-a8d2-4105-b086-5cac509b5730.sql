CREATE OR REPLACE FUNCTION public.sync_visita_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_cidade text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT COALESCE(o.titulo, o.numero), o.cidade INTO v_titulo, v_cidade
  FROM public.ordens_servico o WHERE o.id = NEW.os_id;

  v_start := ((NEW.data::timestamp + COALESCE(NEW.hora_inicio,'08:00'::time)) AT TIME ZONE 'America/Sao_Paulo');
  v_end   := ((NEW.data::timestamp + COALESCE(NEW.hora_fim, (COALESCE(NEW.hora_inicio,'08:00'::time) + interval '2 hours'))) AT TIME ZONE 'America/Sao_Paulo');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_eventos_agenda(os_id, visita_id, profissional_id, titulo, tipo, start_at, end_at, cidade)
    VALUES (NEW.os_id, NEW.id, NEW.responsavel_id, COALESCE(NEW.objetivo, v_titulo), 'visita', v_start, v_end, COALESCE(NEW.local, v_cidade));
  ELSE
    UPDATE public.os_eventos_agenda
       SET profissional_id = NEW.responsavel_id,
           titulo = COALESCE(NEW.objetivo, v_titulo),
           start_at = v_start,
           end_at = v_end,
           cidade = COALESCE(NEW.local, v_cidade),
           updated_at = now()
     WHERE visita_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

-- Corrige eventos já criados assumindo que foram gravados como UTC quando deveriam ser America/Sao_Paulo.
-- Só ajusta eventos vinculados a visitas cujos horários gravados batem com o padrão antigo (UTC).
UPDATE public.os_eventos_agenda ea
   SET start_at = ((ov.data::timestamp + COALESCE(ov.hora_inicio,'08:00'::time)) AT TIME ZONE 'America/Sao_Paulo'),
       end_at   = ((ov.data::timestamp + COALESCE(ov.hora_fim, (COALESCE(ov.hora_inicio,'08:00'::time) + interval '2 hours'))) AT TIME ZONE 'America/Sao_Paulo'),
       updated_at = now()
  FROM public.os_visitas ov
 WHERE ea.visita_id = ov.id
   AND ea.start_at = (ov.data::timestamp + COALESCE(ov.hora_inicio,'08:00'::time)) AT TIME ZONE 'UTC';