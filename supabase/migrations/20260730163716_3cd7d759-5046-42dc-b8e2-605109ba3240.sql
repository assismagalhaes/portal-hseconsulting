create or replace function public.can_see_psico(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_internal(_user_id)
      or public.has_role(_user_id, 'tecnico')
$$;

revoke all on function public.can_see_psico(uuid) from public, anon;
grant execute on function public.can_see_psico(uuid) to authenticated, service_role;

-- Clientes: técnicos passam a enxergar e manter os cadastros
drop policy if exists "clients tecnico access" on public.clients;
create policy "clients tecnico access"
  on public.clients for all to authenticated
  using (public.has_role(auth.uid(), 'tecnico'))
  with check (public.has_role(auth.uid(), 'tecnico'));

-- Módulo psicossocial: acesso equivalente ao dos administradores
do $do$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and (c.relname like 'psico\_%' or c.relname like 'psico%')
  loop
    execute format('drop policy if exists %I on public.%I', 'psico_tecnico_full_access', r.relname);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_see_psico(auth.uid())) with check (public.can_see_psico(auth.uid()))',
      'psico_tecnico_full_access', r.relname);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.relname);
  end loop;
end
$do$;