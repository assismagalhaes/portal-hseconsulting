ALTER TABLE public.psico_medidas_modelos DISABLE TRIGGER tg_psico_medidas_guard;
UPDATE public.psico_medidas_modelos SET nivel_recomendacao = 'complementar' WHERE codigo = 'RI-03';
ALTER TABLE public.psico_medidas_modelos ENABLE TRIGGER tg_psico_medidas_guard;