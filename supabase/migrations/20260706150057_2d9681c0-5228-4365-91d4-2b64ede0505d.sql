ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS senha_provisoria boolean NOT NULL DEFAULT false;