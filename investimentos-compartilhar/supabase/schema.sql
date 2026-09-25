-- ============================================================
--  Finance Control — schema completo no Supabase
--
--  Tudo o que o app guarda mora aqui. Cada linha pertence a um
--  usuário (user_id) e a RLS só deixa cada um ver e mexer no que é
--  seu. A conta é de dono único: depois do primeiro cadastro, o banco
--  recusa qualquer outro (veja painel_um_dono_so).
--
--  Rodar de novo é seguro: nada aqui apaga dado existente.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ carteira
create table if not exists public.ativos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  ticker      text not null check (ticker = upper(ticker) and length(ticker) between 2 and 20),
  classe      text not null check (classe in ('acao_br','etf_br','fii','acao_us','etf_us','cripto')),
  pilar       text not null check (pilar in ('acoes','real_estate','alternativos','caixa')),
  lista       text not null default 'carteira' check (lista in ('carteira','watchlist')),
  -- vale enquanto não houver aportes registrados para o ticker
  quantidade  numeric not null default 0 check (quantidade >= 0),
  preco_medio numeric check (preco_medio is null or preco_medio > 0),
  criado_em   timestamptz not null default now(),
  unique (user_id, ticker)
);

create table if not exists public.renda_fixa (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  nome           text not null check (length(nome) between 1 and 80),
  -- cdi: taxa = % do CDI · ipca: taxa = spread real · prefixado: % a.a.
  tipo           text not null check (tipo in ('cdi','ipca','prefixado')),
  taxa           numeric,
  vencimento     date,
  valor_aplicado numeric not null default 0 check (valor_aplicado >= 0),
  pilar          text not null default 'caixa'
                 check (pilar in ('acoes','real_estate','alternativos','caixa')),
  criado_em      timestamptz not null default now(),
  unique (user_id, nome)
);

-- compras, vendas, proventos e movimentos de renda fixa
create table if not exists public.aportes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  tipo       text not null check (tipo in ('ativo','caixa','provento')),
  data       date not null,
  ticker     text,
  quantidade numeric,          -- negativa numa venda
  preco      numeric,
  valor      numeric not null,
  titulo     text,             -- título de renda fixa (tipo caixa)
  observacao text not null default '' check (length(observacao) <= 160),
  origem     text,             -- chave do lançamento de extrato (anti-duplicação)
  historico  boolean not null default false,
  venda      boolean not null default false,
  criado_em  timestamptz not null default now(),
  unique (user_id, origem)
);
create index if not exists aportes_user_data_idx on public.aportes (user_id, data);

-- preferências: alocação-alvo, premissas, regras, universo de renda, agro
create table if not exists public.preferencias (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  alocacao_alvo jsonb,
  premissas     jsonb,
  regras        jsonb,
  renda         jsonb,
  agro          jsonb,
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------ agronegócio
-- Cada movimento muda o rebanho: compra, nascimento e entrada somam;
-- venda, morte e saída subtraem; reclassificação tira de uma categoria
-- e põe em outra (o bezerro que virou garrote).
create table if not exists public.agro_movimentos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  data              date not null,
  tipo              text not null check (tipo in
                    ('compra','venda','nascimento','morte','entrada','saida','reclassificacao')),
  categoria         text not null check (categoria in
                    ('bezerro','bezerra','garrote','novilha','boi_magro','boi_gordo','vaca','touro','outro')),
  categoria_destino text check (categoria_destino is null or categoria_destino in
                    ('bezerro','bezerra','garrote','novilha','boi_magro','boi_gordo','vaca','touro','outro')),
  cabecas           integer not null check (cabecas > 0),
  peso_medio_kg     numeric check (peso_medio_kg is null or peso_medio_kg > 0),
  preco_arroba      numeric check (preco_arroba is null or preco_arroba >= 0),
  preco_cabeca      numeric check (preco_cabeca is null or preco_cabeca >= 0),
  valor_total       numeric not null default 0 check (valor_total >= 0),
  -- frete, comissão, Funrural etc. da própria operação
  despesas          numeric not null default 0 check (despesas >= 0),
  fazenda           text,
  lote              text,
  contraparte       text,
  observacao        text not null default '' check (length(observacao) <= 240),
  criado_em         timestamptz not null default now(),
  check (tipo <> 'reclassificacao' or categoria_destino is not null)
);
create index if not exists agro_mov_user_data_idx on public.agro_movimentos (user_id, data);

create table if not exists public.agro_custos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  data       date not null,
  categoria  text not null check (categoria in
             ('nutricao','sanidade','mao_de_obra','arrendamento','frete','maquinas','impostos','outros')),
  descricao  text not null default '' check (length(descricao) <= 160),
  valor      numeric not null check (valor > 0),
  fazenda    text,
  lote       text,
  criado_em  timestamptz not null default now()
);
create index if not exists agro_custos_user_data_idx on public.agro_custos (user_id, data);

create table if not exists public.agro_pesagens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  data          date not null,
  categoria     text not null check (categoria in
                ('bezerro','bezerra','garrote','novilha','boi_magro','boi_gordo','vaca','touro','outro')),
  lote          text,
  fazenda       text,
  cabecas       integer not null check (cabecas > 0),
  peso_medio_kg numeric not null check (peso_medio_kg > 0),
  observacao    text not null default '' check (length(observacao) <= 160),
  criado_em     timestamptz not null default now()
);
create index if not exists agro_pes_user_data_idx on public.agro_pesagens (user_id, data);

-- ------------------------------------------------------------ cache de mercado
-- Dado público (cotações). Só a Edge Function, com a chave de serviço,
-- lê e grava: RLS ligada e nenhuma política.
create table if not exists public.mercado_cache (
  chave         text primary key,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- cripto (classe nova) e códigos curtos como OP ou longos como PEPE24478-USD;
-- a quantidade de cripto é fracionada, então numeric sem escala fixa
alter table public.ativos drop constraint if exists ativos_classe_check;
alter table public.ativos add constraint ativos_classe_check
  check (classe in ('acao_br','etf_br','fii','acao_us','etf_us','cripto'));
alter table public.ativos drop constraint if exists ativos_ticker_check;
alter table public.ativos add constraint ativos_ticker_check
  check (ticker = upper(ticker) and length(ticker) between 2 and 20);

-- ------------------------------------------------------------ RLS
do $$
declare t text;
begin
  foreach t in array array['ativos','renda_fixa','aportes','preferencias',
                           'agro_movimentos','agro_custos','agro_pesagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format($p$create policy "dono" on public.%I for all to authenticated
                     using (user_id = (select auth.uid()))
                     with check (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.mercado_cache enable row level security;
revoke all on public.mercado_cache from anon, authenticated;

-- ------------------------------------------------------------ dono único
-- O app é pessoal: o primeiro cadastro vira o dono e o banco recusa
-- qualquer outro, mesmo que alguém descubra a URL e a chave pública.
create or replace function public.painel_um_dono_so()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Este painel já tem dono. Novos cadastros estão fechados.';
  end if;
  return new;
end $$;

-- só o gatilho usa esta função; ninguém a chama pela API
revoke all on function public.painel_um_dono_so() from public, anon, authenticated;

drop trigger if exists painel_um_dono_so on auth.users;
create trigger painel_um_dono_so before insert on auth.users
  for each row execute function public.painel_um_dono_so();

-- a tela de login pergunta isso para saber se mostra "criar conta".
-- Exposta ao anon DE PROPÓSITO: devolve só verdadeiro/falso.
create or replace function public.painel_tem_dono()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from auth.users);
$$;
revoke all on function public.painel_tem_dono() from public;
grant execute on function public.painel_tem_dono() to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
--  ACOMPANHAMENTO: histórico de patrimônio e log do sistema
-- ============================================================

-- Uma foto por dia: o total, cada classe e cada ativo (quantidade ×
-- preço do dia). É daqui que sai o gráfico de crescimento. O app grava
-- ao abrir; o agendamento diário grava mesmo com o app fechado. No mesmo
-- dia, o registro mais recente substitui o anterior.
create table if not exists public.patrimonio_historico (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  data           date not null,
  registrado_em  timestamptz not null default now(),
  origem         text not null default 'app' check (origem in ('app','automatico','importado')),
  patrimonio     numeric not null,
  renda_variavel numeric not null default 0,
  cripto         numeric not null default 0,
  renda_fixa     numeric not null default 0,
  agro           numeric not null default 0,
  investido      numeric,          -- custo conhecido das posições em bolsa e cripto
  por_pilar      jsonb not null default '{}',
  ativos         jsonb not null default '[]',   -- [{ticker, classe, quantidade, preco, valor, custo}]
  unique (user_id, data)
);

-- O que o sistema fez: cada atualização de preços, cada registro diário,
-- cada erro de fonte. Serve para conferir de onde veio um número.
create table if not exists public.log_sistema (
  id       bigint generated always as identity primary key,
  user_id  uuid references auth.users on delete cascade,
  quando   timestamptz not null default now(),
  origem   text not null,                 -- app | automatico
  evento   text not null,                 -- registro_diario | precos | erro
  detalhe  jsonb not null default '{}'
);
create index if not exists log_sistema_user_quando_idx on public.log_sistema (user_id, quando desc);

alter table public.patrimonio_historico enable row level security;
drop policy if exists "dono" on public.patrimonio_historico;
create policy "dono" on public.patrimonio_historico for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.patrimonio_historico from anon;
grant select, insert, update, delete on public.patrimonio_historico to authenticated;

alter table public.log_sistema enable row level security;
drop policy if exists "dono le" on public.log_sistema;
create policy "dono le" on public.log_sistema for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "dono grava" on public.log_sistema;
create policy "dono grava" on public.log_sistema for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke all on public.log_sistema from anon;
grant select, insert on public.log_sistema to authenticated;

-- ------------------------------------------------------------ agendamento
-- Todo dia às 18h10 (Brasília) o banco chama a Edge Function, que grava
-- a foto do dia de cada usuário. O segredo que autentica a chamada fica
-- no Vault, não no texto do job.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- O job em si é criado fora deste arquivo, porque leva um segredo:
--   select vault.create_secret('<CRON_SECRET>', 'fc_cron_secret');
--   select cron.schedule('fc-registro-diario', '10 21 * * *', $$
--     select net.http_post(
--       url := 'https://<ref>.supabase.co/functions/v1/mercado',
--       headers := jsonb_build_object('Content-Type','application/json',
--         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fc_cron_secret')),
--       body := '{"acao":"registro_diario"}'::jsonb, timeout_milliseconds := 120000);
--   $$);
-- e o mesmo valor vai como segredo CRON_SECRET da Edge Function.

-- registros mensais importados (ex.: histórico anotado no Notion)
alter table public.patrimonio_historico drop constraint if exists patrimonio_historico_origem_check;
alter table public.patrimonio_historico add constraint patrimonio_historico_origem_check
  check (origem in ('app','automatico','importado'));

-- ============================================================
--  SALÁRIO E PLANO DE INVESTIMENTO
-- ============================================================
-- Ganhos: os fixos (salário, aluguel…) valem todo mês entre início e
-- fim; os avulsos (bônus, freela, 13º…) valem só no mês da data.
create table if not exists public.ganhos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  nome       text not null check (length(nome) between 1 and 80),
  categoria  text not null default 'salario' check (categoria in
             ('salario','extra','bonus','decimo_terceiro','ferias','aluguel','pro_labore','outros')),
  tipo       text not null check (tipo in ('recorrente','avulso')),
  valor      numeric not null check (valor > 0),      -- líquido, o que cai na conta
  inicio     date not null,                          -- avulso: a data do recebimento
  fim        date,                                   -- recorrente: último mês (vazio = sem fim)
  observacao text not null default '' check (length(observacao) <= 160),
  criado_em  timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists ganhos_user_idx on public.ganhos (user_id, inicio);

alter table public.ganhos enable row level security;
drop policy if exists "dono" on public.ganhos;
create policy "dono" on public.ganhos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.ganhos from anon;
grant select, insert, update, delete on public.ganhos to authenticated;

-- o plano mora nas preferências: {modo, percentual, valor, destinos[], reinvestir_dividendos}
alter table public.preferencias add column if not exists plano jsonb;

-- quando o ganho fixo cai: dia fixo do mês, N-ésimo dia útil ou último dia útil
alter table public.ganhos add column if not exists dia_regra text
  check (dia_regra is null or dia_regra in ('dia_fixo','dia_util','ultimo_dia_util'));
alter table public.ganhos add column if not exists dia_numero integer
  check (dia_numero is null or dia_numero between 1 and 31);
