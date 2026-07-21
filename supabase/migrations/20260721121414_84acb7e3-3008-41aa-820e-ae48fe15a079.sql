ALTER TABLE public.psico_plano_acao_itens ADD COLUMN IF NOT EXISTS indicadores_sugeridos text[] NULL;
UPDATE public.psico_plano_acao_itens i
SET indicadores_sugeridos = m.indicadores_sugeridos
FROM public.psico_medidas_modelos m, public.psico_planos_acao p
WHERE i.medida_modelo_id = m.id
  AND i.plano_id = p.id
  AND p.status <> 'aprovado'
  AND i.indicadores_sugeridos IS NULL
  AND m.indicadores_sugeridos IS NOT NULL;