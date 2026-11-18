-- 0009 · Marco 9 · alertas de preço, revisões programadas e notificações in-app
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
create table if not exists public.alertas_preco (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  ticker         text not null check (ticker = upper(ticker) and length(ticker) between 2 and 20),
  condicao       text not null check (condicao in ('acima','abaixo','empate')),
  valor          numeric check (valor is null or valor > 0),   -- empate usa o preço médio da posição
  ligado         boolean not null default true,
  ultimo_disparo timestamptz,
  criado_em      timestamptz not null default now(),
  check (condicao = 'empate' or valor is not null)
);
create index if not exists alertas_preco_user_idx on public.alertas_preco (user_id);
select privado.politicas_padrao('alertas_preco');

create table if not exists public.revisoes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  ticker    text check (ticker is null or (ticker = upper(ticker) and length(ticker) between 2 and 20)),
  tema      text check (tema is null or length(tema) between 1 and 80),
  data      date not null,
  pergunta  text not null check (length(pergunta) between 3 and 300),
  feita     boolean not null default false,
  criado_em timestamptz not null default now(),
  check (ticker is not null or tema is not null)
);
create index if not exists revisoes_user_idx on public.revisoes (user_id, data);
select privado.politicas_padrao('revisoes');

-- o canal que o Bullz já usa: aviso dentro do app (Início → alertas)
create table if not exists public.notificacoes (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  quando    timestamptz not null default now(),
  origem    text not null check (origem in ('alerta_preco','revisao','sistema')),
  titulo    text not null check (length(titulo) <= 160),
  texto     text not null default '' check (length(texto) <= 400),
  lida      boolean not null default false,
  ref       uuid
);
create index if not exists notificacoes_user_idx on public.notificacoes (user_id, quando desc);
select privado.politicas_padrao('notificacoes');

-- Avalia os alertas pela foto diária (patrimonio_historico.ativos traz o preço
-- e o custo de cada ativo), logo depois do registro diário das 18h10. Mesma
-- regra de FC.alertasPreco.dispara: em centavos; empate = preço ≥ custo ÷ quantidade.
-- Dispara no máximo uma vez por dia por alerta.
create or replace function privado.avalia_alertas_preco()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer := 0; r record;
begin
  for r in
    with ultima as (
      select distinct on (h.user_id) h.user_id, h.ativos from public.patrimonio_historico h order by h.user_id, h.data desc
    ), precos as (
      select u.user_id, x ->> 'ticker' as ticker, (x ->> 'preco')::numeric as preco,
             case when (x ->> 'quantidade')::numeric > 0 then (x ->> 'custo')::numeric / (x ->> 'quantidade')::numeric end as pm
        from ultima u, jsonb_array_elements(u.ativos) x
    )
    select a.id, a.user_id, a.ticker, a.condicao, coalesce(a.valor, p.pm) as alvo, p.preco
      from public.alertas_preco a join precos p on p.user_id = a.user_id and p.ticker = a.ticker
     where a.ligado and p.preco > 0 and coalesce(a.valor, p.pm) > 0
       and (a.ultimo_disparo is null or a.ultimo_disparo < now() - interval '20 hours')
       and case when a.condicao = 'abaixo' then round(p.preco * 100) <= round(coalesce(a.valor, p.pm) * 100)
                else round(p.preco * 100) >= round(coalesce(a.valor, p.pm) * 100) end
  loop
    insert into public.notificacoes (user_id, origem, titulo, texto, ref)
    values (r.user_id, 'alerta_preco',
            case r.condicao when 'empate' then r.ticker || ' voltou ao preço médio'
                            when 'acima' then r.ticker || ' passou de R$ ' || to_char(r.alvo, 'FM999G999G990D00')
                            else r.ticker || ' caiu abaixo de R$ ' || to_char(r.alvo, 'FM999G999G990D00') end,
            'Cotação: R$ ' || to_char(r.preco, 'FM999G999G990D00'), r.id);
    update public.alertas_preco set ultimo_disparo = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function privado.avalia_alertas_preco() from public, anon, authenticated;
select cron.unschedule('fc-avalia-alertas') where exists (select 1 from cron.job where jobname = 'fc-avalia-alertas');
select cron.schedule('fc-avalia-alertas', '40 21 * * *', $$select privado.avalia_alertas_preco()$$);

notify pgrst, 'reload schema';
