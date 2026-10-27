-- Colheita de castanha: pessoas, pesagens e configurações
-- Leitura pública (ranking por link) · escrita só para usuário logado (painel)

create table if not exists public.pessoas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.pesagens (
  id         bigint generated always as identity primary key,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  dia        date not null,
  kg         numeric(7,2) not null check (kg > 0 and kg < 1000),
  ordem      smallint not null default 0,
  criado_em  timestamptz not null default now()
);
create index if not exists pesagens_dia_idx on public.pesagens (dia);
create index if not exists pesagens_pessoa_dia_idx on public.pesagens (pessoa_id, dia);

create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null
);
insert into public.configuracoes (chave, valor) values ('preco_kg', '1.40')
on conflict (chave) do nothing;

-- RLS
alter table public.pessoas       enable row level security;
alter table public.pesagens      enable row level security;
alter table public.configuracoes enable row level security;

drop policy if exists "leitura publica pessoas"  on public.pessoas;
drop policy if exists "leitura publica pesagens" on public.pesagens;
drop policy if exists "admin pessoas"            on public.pessoas;
drop policy if exists "admin pesagens"           on public.pesagens;
drop policy if exists "admin configuracoes"      on public.configuracoes;

create policy "leitura publica pessoas"  on public.pessoas  for select to anon, authenticated using (true);
create policy "leitura publica pesagens" on public.pesagens for select to anon, authenticated using (true);
create policy "admin pessoas"       on public.pessoas       for all to authenticated using (true) with check (true);
create policy "admin pesagens"      on public.pesagens      for all to authenticated using (true) with check (true);
create policy "admin configuracoes" on public.configuracoes for all to authenticated using (true) with check (true);
-- configuracoes (preço) não tem leitura pública de propósito

-- Totais por pessoa e dia (usado pelo ranking e pela análise)
create or replace function public.totais_por_dia(inicio date, fim date)
returns table (pessoa_id uuid, dia date, kg numeric, n integer)
language sql stable security invoker as $$
  select p.pessoa_id, p.dia, sum(p.kg), count(*)::int
  from public.pesagens p
  where p.dia between inicio and fim
  group by p.pessoa_id, p.dia
  order by p.dia, p.pessoa_id
$$;
grant execute on function public.totais_por_dia(date, date) to anon, authenticated;

create or replace function public.ultimo_dia()
returns date language sql stable security invoker as $$
  select max(dia) from public.pesagens where dia <= (now() at time zone 'America/Fortaleza')::date
$$;
grant execute on function public.ultimo_dia() to anon, authenticated;

-- Salva o dia de uma vez: para cada pessoa enviada, substitui as pesagens daquele dia.
-- p_dados = {"<pessoa_id>": [50, 24, 34], "<outra>": []}
create or replace function public.salvar_dia(p_dia date, p_dados jsonb)
returns void language plpgsql security invoker as $$
begin
  delete from public.pesagens
   where dia = p_dia
     and pessoa_id in (select k::uuid from jsonb_object_keys(p_dados) k);

  insert into public.pesagens (pessoa_id, dia, kg, ordem)
  select e.k::uuid, p_dia, v.valor::numeric, (v.ord - 1)::smallint
    from jsonb_each(p_dados) e(k, arr)
    cross join lateral jsonb_array_elements_text(e.arr) with ordinality v(valor, ord);
end $$;
revoke execute on function public.salvar_dia(date, jsonb) from public, anon;
grant execute on function public.salvar_dia(date, jsonb) to authenticated;

-- Só quem está na lista de administradores pode alterar dados (mesmo que alguém crie conta)
create table if not exists public.administradores (email text primary key);
alter table public.administradores enable row level security;
insert into public.administradores (email) values ('julioaguiar05@gmail.com') on conflict do nothing;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.administradores where lower(email) = lower(auth.jwt() ->> 'email'))
$$;
grant execute on function public.eh_admin() to anon, authenticated;

drop policy if exists "admin pessoas" on public.pessoas;
drop policy if exists "admin pesagens" on public.pesagens;
drop policy if exists "admin configuracoes" on public.configuracoes;
create policy "admin pessoas"       on public.pessoas       for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin pesagens"      on public.pesagens      for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin configuracoes" on public.configuracoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Só quem está na lista de administradores pode alterar dados (mesmo que alguém crie conta)
create table if not exists public.administradores (email text primary key);
alter table public.administradores enable row level security;
insert into public.administradores (email) values ('julioaguiar05@gmail.com') on conflict do nothing;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.administradores where lower(email) = lower(auth.jwt() ->> 'email'))
$$;
grant execute on function public.eh_admin() to anon, authenticated;

drop policy if exists "admin pessoas" on public.pessoas;
drop policy if exists "admin pesagens" on public.pesagens;
drop policy if exists "admin configuracoes" on public.configuracoes;
create policy "admin pessoas"       on public.pessoas       for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin pesagens"      on public.pesagens      for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin configuracoes" on public.configuracoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Número de cada pessoa (o mesmo da folha de pesagem), para buscar pelo número
alter table public.pessoas add column if not exists numero integer check (numero > 0);
create unique index if not exists pessoas_numero_key on public.pessoas (numero);
