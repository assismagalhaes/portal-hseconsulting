DO $$
BEGIN
  ALTER TABLE public.psico_medidas_modelos DISABLE TRIGGER USER;
  UPDATE public.psico_medidas_modelos
     SET nivel_recomendacao='essencial'
   WHERE codigo IN ('CH-06','CI-05','RI-06','RI-08')
     AND ativo=true;
  ALTER TABLE public.psico_medidas_modelos ENABLE TRIGGER USER;
END $$;