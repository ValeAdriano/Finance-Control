-- 0005 · Marco 5 · renda PJ, despesas, plano fixo + sobra e aporte parcelado
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.

-- ganho PJ: categoria nova (a lista só cresce) e os campos do regime
alter table public.ganhos drop constraint if exists ganhos_categoria_check;
alter table public.ganhos add constraint ganhos_categoria_check check (categoria in
  ('salario','extra','bonus','decimo_terceiro','ferias','aluguel','pro_labore','outros','pj'));
alter table public.ganhos add column if not exists regime text check (regime is null or regime in ('mei','simples','outro'));
alter table public.ganhos add column if not exists imposto_fixo_mensal numeric check (imposto_fixo_mensal is null or imposto_fixo_mensal >= 0);
alter table public.ganhos add column if not exists imposto_pct numeric check (imposto_pct is null or imposto_pct between 0 and 100);
alter table public.ganhos add column if not exists sem_13_ferias_fgts boolean;
-- paga pelos dias trabalhados na competência (início e fim no meio do mês)
alter table public.ganhos add column if not exists proporcional boolean not null default false;
-- o trabalho de um mês cai na conta no mês seguinte
alter table public.ganhos add column if not exists pagamento_mes_seguinte boolean not null default false;

create table if not exists public.despesas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  data       date not null,
  categoria  text not null check (categoria in ('moradia','alimentacao','transporte','saude','educacao','lazer','contas','impostos','outros')),
  descricao  text not null default '' check (length(descricao) <= 160),
  valor      numeric not null check (valor > 0),
  recorrente boolean not null default false,   -- vale todo mês a partir de `data` até `fim`
  fim        date,
  criado_em  timestamptz not null default now(),
  check (fim is null or fim >= data)
);
create index if not exists despesas_user_data_idx on public.despesas (user_id, data);
select privado.politicas_padrao('despesas');

create table if not exists public.parcelamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  descricao    text not null default '' check (length(descricao) <= 160),
  valor_total  numeric not null check (valor_total > 0),
  n_parcelas   integer not null check (n_parcelas between 1 and 120),
  inicio       date not null,                 -- mês da 1ª parcela (o dia não importa)
  destino_tipo text not null check (destino_tipo in ('ativo','titulo_rf','pote')),
  destino_id   text not null check (length(destino_id) between 1 and 80),
  pote_id      uuid references public.potes on delete set null,   -- de onde sai o dinheiro
  criado_em    timestamptz not null default now()
);
select privado.politicas_padrao('parcelamentos');
alter table public.movimentos_internos add column if not exists parcelamento_id uuid references public.parcelamentos on delete set null;

insert into public.parametros_fiscais (chave, valor, vigencia_inicio, vigencia_fim, fonte) values
  ('das_mei_servicos', 80.90, '2025-01-01', '2025-12-31', 'DAS MEI serviços 2025: 5% do salário mínimo de R$ 1.518 (R$ 75,90) + R$ 5,00 de ISS'),
  ('das_mei_servicos', 86.05, '2026-01-01', null, 'DAS MEI serviços 2026: 5% do salário mínimo de R$ 1.621 (R$ 81,05) + R$ 5,00 de ISS'),
  ('simples_aliquota_inicial', 6, '2018-01-01', null, 'LC 123/2006 (redação da LC 155/2016), Anexo III, 1ª faixa: 6% nominal até R$ 180 mil em 12 meses')
on conflict (chave, vigencia_inicio) do nothing;

notify pgrst, 'reload schema';
