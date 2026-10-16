-- Execute no SQL Editor do Supabase do próprio Maestro.

create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table admins enable row level security;
create policy "admin le a si mesmo" on admins for select using (user_id = auth.uid());
-- Depois de criar seu usuário em Authentication > Users:
-- insert into admins (user_id) values ('<SEU_USER_UUID>');

create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  nome text not null,
  grupo text,
  ordem int not null default 0,
  cor text,
  status text not null default 'ativo' check (status in ('ativo', 'planejado', 'arquivado')),
  nivel text not null default 'atalho' check (nivel in ('completo', 'monitoramento', 'atalho')),
  favorito boolean not null default false,
  url_app text,            -- aberto no visualizador (iframe)
  url_supabase text,       -- https://<ref>.supabase.co
  chave_publica text,      -- somente anon key
  url_dashboard text,      -- opcional; se vazio, é derivado da url_supabase
  email_supabase text,     -- e-mail da conta Supabase que administra o projeto
  criado_em timestamptz not null default now()
);
alter table projetos enable row level security;
create policy "admin gerencia seus projetos" on projetos for all
  using (user_id = auth.uid() and exists (select 1 from admins where user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from admins where user_id = auth.uid()));
