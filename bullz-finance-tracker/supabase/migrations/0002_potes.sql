-- 0002 · Marco 2 · potes com finalidade
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.

create table if not exists public.potes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  nome       text not null check (length(nome) between 1 and 60),
  tipo       text not null check (tipo in ('reserva_emergencia','oportunidade','oportunidade_agro','ir_a_pagar','livre')),
  meta_valor numeric check (meta_valor is null or meta_valor >= 0),
  criado_em  timestamptz not null default now(),
  unique (user_id, nome)
);
create index if not exists potes_user_idx on public.potes (user_id);

-- dinheiro que entra, sai ou muda de pote. Transferência entre potes = duas
-- linhas de sinal contrário com o mesmo transferencia_id (somam zero).
create table if not exists public.potes_movimentos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  pote_id          uuid not null references public.potes on delete cascade,
  data             date not null,
  valor            numeric not null check (valor <> 0),
  descricao        text not null default '' check (length(descricao) <= 160),
  transferencia_id uuid,
  criado_em        timestamptz not null default now()
);
create index if not exists potes_mov_user_idx on public.potes_movimentos (user_id, data);

-- o título de renda fixa mora num pote (nulo = livre)
alter table public.renda_fixa add column if not exists pote_id uuid references public.potes on delete set null;

select privado.politicas_padrao('potes');
select privado.politicas_padrao('potes_movimentos');

-- seed idempotente: um pote de cada tipo para quem já tem conta
insert into public.potes (user_id, nome, tipo)
select u.id, t.nome, t.tipo
  from auth.users u
 cross join (values ('Reserva de emergência','reserva_emergencia'), ('Oportunidade','oportunidade'),
                    ('Oportunidade do agro','oportunidade_agro'), ('IR a pagar','ir_a_pagar'), ('Livre','livre')) as t(nome, tipo)
 where not exists (select 1 from public.potes p where p.user_id = u.id and p.tipo = t.tipo);

-- títulos marcados como reserva nas preferências (premissas.titulos[id].reserva)
-- vão para o pote de reserva; o resto fica no livre (pote_id nulo)
update public.renda_fixa r
   set pote_id = (select p.id from public.potes p where p.user_id = r.user_id and p.tipo = 'reserva_emergencia' order by p.criado_em limit 1)
 where r.pote_id is null
   and exists (select 1 from public.preferencias pr
                where pr.user_id = r.user_id
                  and coalesce((pr.premissas -> 'titulos' -> r.id::text ->> 'reserva')::boolean, false));

notify pgrst, 'reload schema';
