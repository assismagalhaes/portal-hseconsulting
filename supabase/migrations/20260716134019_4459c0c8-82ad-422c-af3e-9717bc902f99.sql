CREATE TYPE public.projeto_prioridade AS ENUM ('baixa','media','alta','urgente');
ALTER TABLE public.projetos ADD COLUMN prioridade public.projeto_prioridade NOT NULL DEFAULT 'media';