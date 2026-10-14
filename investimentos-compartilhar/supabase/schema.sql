-- ============================================================
--  Finance Control — schema completo no Supabase
--
--  Tudo o que o app guarda mora aqui. Cada linha pertence a um
--  usuário (user_id) e a RLS só deixa cada um ver e mexer no que é
--  seu. O cadastro é aberto: qualquer pessoa cria a própria conta e
--  só enxerga os próprios dados.
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
  -- venda: quanto do líquido fica no agro para as próximas compras (o resto
  -- é saque); null = tudo saque
  reinvestido       numeric check (reinvestido is null or reinvestido >= 0),
  fazenda           text,
  lote              text,
  contraparte       text,
  observacao        text not null default '' check (length(observacao) <= 240),
  criado_em         timestamptz not null default now(),
  check (tipo <> 'reclassificacao' or categoria_destino is not null)
);
alter table public.agro_movimentos add column if not exists reinvestido numeric check (reinvestido is null or reinvestido >= 0);
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

-- ------------------------------------------------------------ cadastro aberto
-- Começou como painel de dono único (gatilho que recusava o 2º cadastro).
-- Agora cada pessoa cria a própria conta; a RLS acima separa os dados.
drop trigger if exists painel_um_dono_so on auth.users;
drop function if exists public.painel_um_dono_so();
drop function if exists public.painel_tem_dono();

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
create extension if not exists pg_net with schema extensions;
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
-- módulos opcionais ligados em Ajustes (agro, cripto, exterior, renda, simular)
alter table public.preferencias add column if not exists modulos jsonb;

-- quando o ganho fixo cai: dia fixo do mês, N-ésimo dia útil ou último dia útil
alter table public.ganhos add column if not exists dia_regra text
  check (dia_regra is null or dia_regra in ('dia_fixo','dia_util','ultimo_dia_util'));
alter table public.ganhos add column if not exists dia_numero integer
  check (dia_numero is null or dia_numero between 1 and 31);

-- ============================================================
--  2FA EXIGIDO PELO BANCO
--  Com um autenticador verificado, só uma sessão que passou pelo código
--  (aal2) enxerga ou grava qualquer linha. Sem 2FA ligado, vale a senha.
--  Políticas RESTRITIVAS: somam-se à política "dono" (as duas precisam
--  aceitar a linha).
-- ============================================================
-- fica num schema que a API REST não expõe: só as políticas a usam
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
create or replace function privado.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function privado.mfa_ok() from public, anon;
grant execute on function privado.mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['ativos','renda_fixa','aportes','preferencias','agro_movimentos','agro_custos',
                           'agro_pesagens','patrimonio_historico','log_sistema','ganhos'] loop
    execute format('drop policy if exists "exige 2fa" on public.%I', t);
    execute format($p$create policy "exige 2fa" on public.%I as restrictive for all to authenticated
                     using ((select privado.mfa_ok()))
                     with check ((select privado.mfa_ok()))$p$, t);
  end loop;
end $$;

drop function if exists public.painel_mfa_ok();

-- ------------------------------------------------------------ rentabilidade por aporte
-- Índices históricos do Banco Central, um valor por dia útil (CDI e Selic,
-- % ao dia) ou por mês (IPCA, % no mês, guardado no dia 1º). Dado público:
-- qualquer usuário logado lê; só a Edge Function escreve.
create table if not exists public.indices_diarios (
  indice text not null check (indice in ('cdi','selic','ipca')),
  data   date not null,
  valor  numeric not null,
  primary key (indice, data)
);
alter table public.indices_diarios enable row level security;
drop policy if exists "leitura" on public.indices_diarios;
create policy "leitura" on public.indices_diarios for select to authenticated using (true);
revoke insert, update, delete on public.indices_diarios from anon, authenticated;

-- cada título pode ser pós (CDI/Selic), pré ou híbrido (IPCA + X)
alter table public.renda_fixa drop constraint if exists renda_fixa_tipo_check;
alter table public.renda_fixa add constraint renda_fixa_tipo_check check (tipo in ('cdi','selic','ipca','prefixado'));
-- data a partir da qual o saldo inicial rende (vazio = data do cadastro)
alter table public.renda_fixa add column if not exists data_inicio date;
-- cada aporte de renda fixa pode ter a própria taxa; vazio = a do título
alter table public.aportes add column if not exists indexador text check (indexador in ('cdi','selic','ipca','prefixado'));
alter table public.aportes add column if not exists taxa numeric;
-- data da posição inicial de um ativo (vazio = data do cadastro)
alter table public.ativos add column if not exists data_base date;
-- valor atual informado à mão (o extrato do banco) e a data dele; a
-- diferença para o calculado conta como rendimento. Vazio = calculado
alter table public.renda_fixa add column if not exists valor_atual numeric check (valor_atual is null or valor_atual >= 0);
alter table public.renda_fixa add column if not exists valor_atual_em date;

-- ============================================================
--  PAINEL DO ADMINISTRADOR
--  Quem é admin fica numa tabela que a API não expõe (nem para ler):
--  só a função privado.eh_admin() a consulta. Para dar acesso:
--    insert into public.admins (user_id) select id from auth.users where email = '...';
--  Admin com 2FA ligado só enxerga o painel numa sessão aal2.
-- ============================================================
create table if not exists public.admins (
  user_id   uuid primary key references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function privado.eh_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid()) and privado.mfa_ok();
$$;
revoke all on function privado.eh_admin() from public, anon;
grant execute on function privado.eh_admin() to authenticated;

-- o app pergunta se mostra o painel; quem garante é a RLS
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_admin();
$$;
revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- ------------------------------------------------------------ uso do app (LGPD)
-- Eventos de navegação ANÔNIMOS: sem user_id, sem e-mail, sem valores.
-- "visitante" é um código aleatório do aparelho, sem ligação com a conta;
-- "sessao", um código por visita. Telas, cliques e folhas só são
-- gravados com o consentimento do usuário; erros técnicos (sem dado
-- pessoal) por legítimo interesse, para manter o app funcionando.
-- Tudo some depois de 180 dias.
create table if not exists public.uso_eventos (
  id         bigint generated always as identity primary key,
  quando     timestamptz not null default now()
             check (quando > now() - interval '2 days' and quando < now() + interval '10 minutes'),
  visitante  text not null check (visitante ~ '^[a-z0-9]{12,32}$'),
  sessao     text not null check (sessao ~ '^[a-z0-9]{12,32}$'),
  tipo       text not null check (tipo in ('tela','clique','folha_abre','folha_envia','folha_fecha','erro')),
  rota       text check (length(rota) <= 40),
  alvo       text check (length(alvo) <= 120),
  duracao_ms integer check (duracao_ms between 0 and 86400000),
  aparelho   text check (aparelho in ('celular','tablet','computador')),
  detalhe    jsonb not null default '{}' check (pg_column_size(detalhe) <= 2000)
);
create index if not exists uso_eventos_quando_idx on public.uso_eventos (quando desc);
create index if not exists uso_eventos_sessao_idx on public.uso_eventos (sessao, quando);
alter table public.uso_eventos enable row level security;
drop policy if exists "qualquer usuario grava" on public.uso_eventos;
create policy "qualquer usuario grava" on public.uso_eventos for insert to authenticated with check (true);
drop policy if exists "admin le" on public.uso_eventos;
create policy "admin le" on public.uso_eventos for select to authenticated using ((select privado.eh_admin()));
drop policy if exists "admin apaga" on public.uso_eventos;
create policy "admin apaga" on public.uso_eventos for delete to authenticated using ((select privado.eh_admin()));
revoke all on public.uso_eventos from anon;
grant insert, select, delete on public.uso_eventos to authenticated;

-- erros do sistema (fontes de preço, registro diário) para o admin, sem
-- dizer de quem: nada de user_id nem dos valores da carteira
create or replace function public.admin_erros_sistema(dias integer default 30)
returns table (quando timestamptz, origem text, etapa text, erro text)
language sql stable security definer set search_path = '' as $$
  select l.quando, l.origem, coalesce(l.detalhe ->> 'etapa', l.evento),
         left(regexp_replace(coalesce(l.detalhe ->> 'erro', l.detalhe ->> 'mensagem', ''), '[0-9a-f]{8}-[0-9a-f-]{27}', '<id>', 'g'), 300)
  from public.log_sistema l
  where privado.eh_admin() and l.evento = 'erro' and l.quando > now() - make_interval(days => least(greatest(dias, 1), 180))
  order by l.quando desc limit 2000;
$$;
revoke all on function public.admin_erros_sistema(integer) from public, anon;
grant execute on function public.admin_erros_sistema(integer) to authenticated;

-- retenção: 180 dias
select cron.unschedule('fc-limpa-uso') where exists (select 1 from cron.job where jobname = 'fc-limpa-uso');
select cron.schedule('fc-limpa-uso', '30 7 * * *', $$delete from public.uso_eventos where quando < now() - interval '180 days'$$);

-- ============================================================
--  PERFIL DO INVESTIDOR E ONBOARDING
--  Quatro tabelas no mesmo padrão: user_id = auth.uid(), RLS do dono e
--  política restritiva de 2FA. O histórico de perfil é só de inserção:
--  cada avaliação fica registrada como foi feita. Renda e patrimônio
--  entram em FAIXAS, nunca em valores exatos.
-- ============================================================

-- respostas parciais, para retomar de onde parou; some ao concluir
create table if not exists public.perfil_rascunho (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  versao_modelo text not null,
  respostas     jsonb not null default '{}',
  passo         integer not null default 0 check (passo between 0 and 100),
  atualizado_em timestamptz not null default now()
);

-- cada avaliação concluída (imutável pela API: sem update nem delete)
create table if not exists public.perfil_investidor (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  versao_modelo text not null,
  origem        text not null check (origem in ('cadastro','migracao','revisao','comportamento')),
  respostas     jsonb not null,
  tolerancia    smallint not null check (tolerancia between 0 and 100),
  capacidade    smallint not null check (capacidade between 0 and 100),
  necessidade   numeric(6,4),
  score         smallint not null check (score between 0 and 100),
  perfil        text not null check (perfil in ('conservador','moderado','arrojado')),
  consistencia  text not null check (consistencia in ('alta','baixa')),
  valido_ate    date not null default (current_date + interval '24 months'),
  criado_em     timestamptz not null default now()
);
create index if not exists perfil_investidor_user_idx on public.perfil_investidor (user_id, criado_em desc);

-- o banco recalcula tolerância, capacidade, score e consistência a partir
-- das respostas: um perfil adulterado pela API é recusado
-- >>> perfil_confere (gerado por scripts/gera-perfil-sql.js; não edite à mão)
-- versão do modelo: perfil-v1
create or replace function privado.perfil_confere()
returns trigger language plpgsql security definer set search_path = '' as $f$
declare
  r        jsonb := new.respostas;
  cap_tab  jsonb := '{"idade":{"max":15,"neutro":6,"pts":{"ate_30":15,"31_40":13,"41_50":10,"51_60":6,"61_mais":3}},"estab":{"max":20,"neutro":8,"pts":{"estavel":20,"clt":15,"variavel":8,"sem_renda":0,"nd":8}},"dependentes":{"max":10,"neutro":4,"pts":{"0":10,"1":7,"2":4,"3_mais":2}},"moradia":{"max":5,"neutro":2,"pts":{"propria":5,"familia":4,"aluguel":2}},"patrimonio":{"max":20,"neutro":8,"pts":{"nada":0,"ate_10k":4,"10_50k":8,"50_200k":12,"200k_1m":17,"1m_mais":20,"nd":8}},"reserva":{"max":5,"neutro":2,"pts":{"nenhuma":0,"menos_3":1,"3_6":3,"6_12":4,"12_mais":5,"nd":1}}}'::jsonb;
  tol_tab  jsonb := '{"t_queda":{"vende":0,"parte":1,"mantem":2,"aporta":3},"t_certo":{"certo":0,"quase_certo":1,"quase_risco":2,"risco":3},"amigo":{"cauteloso":0,"prudente":1,"equilibrado":2,"ousado":3},"t_perda":{"5":1,"10":2,"20":3,"30":4,"zero":0},"t_clima":{"angustia":0,"preocupa":1,"neutro":2,"oportunidade":3},"t_carteiras":{"a":0,"mais_a":1,"mais_b":2,"b":3},"t_foco":{"preservar":0,"mais_preservar":1,"equilibrar":2,"crescer":3}}'::jsonb;
  renda_v  jsonb := '{"ate_3k":2000,"3_5k":4000,"5_8k":6500,"8_15k":11500,"15_30k":22500,"30k_mais":40000}'::jsonb;
  sobra_v  jsonb := '{"nada":0,"ate_500":250,"500_1500":1000,"1500_3000":2250,"3000_6000":4500,"6000_mais":8000}'::jsonb;
  chave    text;
  pts      integer := 0;
  tol_pts  integer := 0;
  tol      integer;
  cap      integer;
  rv       numeric;
  sv       numeric;
  num      numeric;
  den      numeric;
  agro     numeric;
  ta       integer;
  tb       integer;
  cons     text := 'alta';
  par      text[];
  perfil   text;
  score    integer;
begin
  if new.versao_modelo <> 'perfil-v1' then
    raise exception 'versao_modelo_desconhecida' using errcode = '22023';
  end if;
  if jsonb_typeof(r) <> 'object' then
    raise exception 'respostas_invalidas' using errcode = '22023';
  end if;
  foreach chave in array array['idade', 'estab', 'renda', 'sobra', 'reserva', 'divida', 'objetivo', 'prazo', 'tempo', 't_queda', 't_certo', 'amigo', 't_perda', 't_clima', 't_carteiras', 't_foco'] loop
    if r ->> chave is null then
      raise exception 'resposta_faltando: %', chave using errcode = '22023';
    end if;
  end loop;

  -- tolerância
  for chave in select jsonb_object_keys(tol_tab) loop
    tol_pts := tol_pts + coalesce((tol_tab -> chave ->> (r ->> chave))::integer, 0);
  end loop;
  tol := round(tol_pts::numeric / 22 * 100);

  -- capacidade
  foreach chave in array array['idade', 'estab', 'dependentes', 'moradia', 'patrimonio', 'reserva'] loop
    pts := pts + coalesce((cap_tab -> chave -> 'pts' ->> (r ->> chave))::integer,
                          (cap_tab -> chave ->> 'neutro')::integer);
  end loop;
  rv := (renda_v ->> (r ->> 'renda'))::numeric;
  sv := (sobra_v ->> (r ->> 'sobra'))::numeric;
  if rv is not null and sv is not null and rv > 0 then
    num := 25 * sv * 100;
    den := rv * 30;
    if sv * 100 >= den then pts := pts + 25;
    else pts := pts + floor((2 * num + den) / (2 * den))::integer;
    end if;
  else
    pts := pts + 10;
  end if;
  agro := (r ->> 'agro_pct')::numeric;
  if agro is not null and agro > 50 then pts := pts - 15; end if;
  cap := greatest(0, least(100, pts));
  if r ->> 'divida' = 'sim' then cap := least(cap, 20); end if;
  if (r ->> 'reserva') is null or (r ->> 'reserva') in ('nenhuma', 'menos_3', 'nd') then cap := least(cap, 30); end if;
  if (r ->> 'prazo') in ('menos_2') then cap := least(cap, 25); end if;
  if r ->> 'saque' = 'provavel' then cap := least(cap, 40); end if;

  -- consistência: perguntas espelho
  foreach par slice 1 in array array[array['t_queda','t_clima'], array['t_certo','t_carteiras']] loop
    ta := (tol_tab -> par[1] ->> (r ->> par[1]))::integer;
    tb := (tol_tab -> par[2] ->> (r ->> par[2]))::integer;
    if ta is not null and tb is not null and abs(ta - tb) >= 2 then cons := 'baixa'; end if;
  end loop;

  score := least(tol, cap);
  perfil := case when score <= 34 then 'conservador' when score <= 64 then 'moderado' when score <= 100 then 'arrojado' else 'arrojado' end;

  if new.tolerancia <> tol or new.capacidade <> cap or new.score <> score
     or new.perfil <> perfil or new.consistencia <> cons then
    raise exception 'perfil_adulterado' using errcode = '22023';
  end if;
  new.valido_ate := (current_date + interval '24 months')::date;
  return new;
end $f$;
-- <<< perfil_confere

drop trigger if exists perfil_confere on public.perfil_investidor;
create trigger perfil_confere before insert on public.perfil_investidor
  for each row execute function privado.perfil_confere();

-- o perfil vigente de cada conta (respeita a RLS de quem consulta)
create or replace view public.perfil_atual with (security_invoker = true) as
  select distinct on (user_id) * from public.perfil_investidor
  order by user_id, criado_em desc;

-- o plano gerado e a decisão da pessoa
create table if not exists public.plano_investimento (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  perfil_id     uuid not null references public.perfil_investidor on delete cascade,
  versao_modelo text not null,
  modo          text not null default 'educativo' check (modo in ('completo','educativo')),
  plano         jsonb not null,            -- passos, alocação, candidatos com a regra de cada um
  decisao       text not null default 'pendente' check (decisao in ('pendente','aplicado','recusado')),
  metas_antes   jsonb,
  metas_depois  jsonb,
  criado_em     timestamptz not null default now(),
  decidido_em   timestamptz
);
create index if not exists plano_investimento_user_idx on public.plano_investimento (user_id, criado_em desc);

-- funil: só o nome do passo e o tempo, nunca dado financeiro
create table if not exists public.onboarding_eventos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  evento     text not null check (evento in ('passo_visto','respondido','bloco_concluido','adiado',
             'perfil_concluido','plano_aplicado','plano_recusado','ativacao','revisao_aberta')),
  passo      text check (passo is null or passo ~ '^[a-z0-9_]{1,40}$'),
  duracao_ms integer check (duracao_ms is null or duracao_ms between 0 and 86400000),
  criado_em  timestamptz not null default now()
);
create index if not exists onboarding_eventos_user_idx on public.onboarding_eventos (user_id, criado_em);
create index if not exists onboarding_eventos_evento_idx on public.onboarding_eventos (evento, criado_em);

do $$
declare t text;
begin
  foreach t in array array['perfil_rascunho','perfil_investidor','plano_investimento','onboarding_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "exige 2fa" on public.%I', t);
    execute format($p$create policy "exige 2fa" on public.%I as restrictive for all to authenticated
                     using ((select privado.mfa_ok())) with check ((select privado.mfa_ok()))$p$, t);
  end loop;
end $$;

-- rascunho: o dono faz tudo
drop policy if exists "dono" on public.perfil_rascunho;
create policy "dono" on public.perfil_rascunho for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.perfil_rascunho to authenticated;

-- histórico: só INSERT e SELECT
drop policy if exists "le o proprio" on public.perfil_investidor;
create policy "le o proprio" on public.perfil_investidor for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "insere o proprio" on public.perfil_investidor;
create policy "insere o proprio" on public.perfil_investidor for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.perfil_investidor from authenticated;
grant select, insert on public.perfil_investidor to authenticated;
grant select on public.perfil_atual to authenticated;
revoke all on public.perfil_atual from anon;

-- plano: o dono lê e insere; só a decisão pode mudar
drop policy if exists "le o proprio" on public.plano_investimento;
create policy "le o proprio" on public.plano_investimento for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "insere o proprio" on public.plano_investimento;
create policy "insere o proprio" on public.plano_investimento for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "decide o proprio" on public.plano_investimento;
create policy "decide o proprio" on public.plano_investimento for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.plano_investimento from authenticated;
grant select, insert on public.plano_investimento to authenticated;
grant update (decisao, metas_antes, metas_depois, decidido_em) on public.plano_investimento to authenticated;

-- eventos: só INSERT e SELECT
drop policy if exists "le o proprio" on public.onboarding_eventos;
create policy "le o proprio" on public.onboarding_eventos for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "insere o proprio" on public.onboarding_eventos;
create policy "insere o proprio" on public.onboarding_eventos for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.onboarding_eventos from authenticated;
grant select, insert on public.onboarding_eventos to authenticated;

-- ------------------------------------------------------------ modo de recomendação
-- completo: plano e ativos candidatos com nome. educativo: classes e filtros,
-- sem "compre X". Quem decide é o administrador (a conta nunca escolhe o
-- próprio modo): a tabela não é exposta pela API. Padrão: educativo.
create table if not exists public.contas_modo_completo (
  user_id   uuid primary key references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.contas_modo_completo enable row level security;
revoke all on public.contas_modo_completo from anon, authenticated;
--   liberar:  insert into public.contas_modo_completo (user_id) select id from auth.users where email = '...';

create or replace function public.modo_recomendacao()
returns text language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.contas_modo_completo c where c.user_id = auth.uid())
              then 'completo' else 'educativo' end;
$$;
revoke all on function public.modo_recomendacao() from public, anon;
grant execute on function public.modo_recomendacao() to authenticated;

-- ------------------------------------------------------------ funil agregado (só contagens)
create or replace function public.admin_funil_onboarding(dias integer default 90)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  desde timestamptz := now() - make_interval(days => least(greatest(dias, 7), 365));
  saida jsonb;
begin
  if not privado.eh_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  with novas as (
    select id, created_at from auth.users where created_at >= desde
  ), perfis as (
    select distinct on (user_id) user_id, perfil, consistencia, valido_ate, criado_em from public.perfil_investidor order by user_id, criado_em
  ), atuais as (
    select * from public.perfil_atual
  ), ativadas as (
    select n.id from novas n join perfis p on p.user_id = n.id and p.criado_em <= n.created_at + interval '7 days'
    where exists (select 1 from public.ativos a where a.user_id = n.id and a.criado_em <= n.created_at + interval '7 days')
       or exists (select 1 from public.aportes a where a.user_id = n.id and a.criado_em <= n.created_at + interval '7 days')
       or exists (select 1 from public.renda_fixa a where a.user_id = n.id and a.criado_em <= n.created_at + interval '7 days')
       or exists (select 1 from public.plano_investimento pl where pl.user_id = n.id and pl.decisao = 'aplicado' and pl.criado_em <= n.created_at + interval '7 days')
  ), blocos as (
    select b, (select count(distinct user_id) from public.onboarding_eventos where evento = 'passo_visto' and passo = 'bloco_' || b and criado_em >= desde) as viram,
              (select count(distinct user_id) from public.onboarding_eventos where evento = 'bloco_concluido' and passo = 'bloco_' || b and criado_em >= desde) as concluiram
    from generate_series(1, 4) b
  ), ativ as (
    select user_id, (quando at time zone 'America/Sao_Paulo')::date as dia from public.log_sistema where origem = 'app' and user_id is not null group by 1, 2
  ), coortes as (
    select date_trunc('week', n.created_at)::date as semana, n.id, n.created_at::date as dia0, (n.id in (select id from ativadas)) as ativada
    from novas n where n.created_at >= now() - interval '56 days'
  )
  select jsonb_build_object(
    'janela_dias', dias,
    'contas_novas', (select count(*) from novas),
    'abriram_bloco_1', (select count(distinct e.user_id) from public.onboarding_eventos e join novas n on n.id = e.user_id where e.evento = 'passo_visto' and e.passo = 'bloco_1'),
    'blocos', (select jsonb_agg(jsonb_build_object('bloco', b, 'viram', viram, 'concluiram', concluiram) order by b) from blocos),
    'tempo_mediano_ms', (select percentile_cont(0.5) within group (order by duracao_ms) from public.onboarding_eventos where evento = 'perfil_concluido' and criado_em >= desde and duracao_ms is not null),
    'perfis_concluidos', (select count(distinct user_id) from public.onboarding_eventos where evento = 'perfil_concluido' and criado_em >= desde),
    'planos_aplicados', (select count(distinct user_id) from public.onboarding_eventos where evento = 'plano_aplicado' and criado_em >= desde),
    'planos_recusados', (select count(distinct user_id) from public.onboarding_eventos where evento = 'plano_recusado' and criado_em >= desde),
    'ativadas_7d', (select count(*) from ativadas),
    'adiaram', (select count(distinct user_id) from public.onboarding_eventos where evento = 'adiado' and criado_em >= desde),
    'adiamentos', (select count(*) from public.onboarding_eventos where evento = 'adiado' and criado_em >= desde),
    'saude', jsonb_build_object(
      'perfis', (select count(*) from atuais),
      'vencidos', (select count(*) from atuais where valido_ate < current_date),
      'baixa_consistencia', (select count(*) from atuais where consistencia = 'baixa'),
      'conservador', (select count(*) from atuais where perfil = 'conservador'),
      'moderado', (select count(*) from atuais where perfil = 'moderado'),
      'arrojado', (select count(*) from atuais where perfil = 'arrojado')),
    'retencao', (select coalesce(jsonb_agg(x order by x ->> 'semana'), '[]'::jsonb) from (
      select jsonb_build_object('semana', semana, 'ativada', ativada, 'contas', count(*),
        'd1', count(*) filter (where exists (select 1 from ativ a where a.user_id = c.id and a.dia = c.dia0 + 1)),
        'd7', count(*) filter (where exists (select 1 from ativ a where a.user_id = c.id and a.dia between c.dia0 + 7 and c.dia0 + 13)),
        'd30', count(*) filter (where exists (select 1 from ativ a where a.user_id = c.id and a.dia between c.dia0 + 30 and c.dia0 + 36))) as x
      from coortes c group by semana, ativada) t)
  ) into saida;
  return saida;
end $$;
revoke all on function public.admin_funil_onboarding(integer) from public, anon;
grant execute on function public.admin_funil_onboarding(integer) to authenticated;

-- ============================================================
--  LAYOUT PERSONALIZÁVEL
--  Ordem das abas (topo e barra do celular) e dos blocos do Início:
--  {nav:{ordem:[…]}, inicio:{ordem:[…], ocultos:[…]}}. Vazio = padrão.
-- ============================================================
alter table public.preferencias add column if not exists layout jsonb;
notify pgrst, 'reload schema';
