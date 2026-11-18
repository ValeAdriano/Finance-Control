-- 0004 · Marco 4 · agro por lote, permuta, venda planejada e parâmetros fiscais
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.

-- ------------------------------------------------------------ parâmetros fiscais
-- Alíquotas, faixas e isenções que mudam com a lei. Nunca no código: o
-- cálculo lê daqui pela vigência. Dado público (igual para todos): qualquer
-- usuário logado lê; só o administrador (SQL Editor) grava.
create table if not exists public.parametros_fiscais (
  id              bigint generated always as identity primary key,
  chave           text not null check (chave ~ '^[a-z0-9_]{2,60}$'),
  valor           numeric not null,
  vigencia_inicio date not null,
  vigencia_fim    date,
  fonte           text not null default '' check (length(fonte) <= 300),
  criado_em       timestamptz not null default now(),
  unique (chave, vigencia_inicio),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
alter table public.parametros_fiscais enable row level security;
drop policy if exists "todos leem" on public.parametros_fiscais;
create policy "todos leem" on public.parametros_fiscais for select to authenticated using (true);
revoke all on public.parametros_fiscais from anon;
grant select on public.parametros_fiscais to authenticated;

-- seed documentado (docs/parametros-fiscais.md). Rodar de novo não duplica.
insert into public.parametros_fiscais (chave, valor, vigencia_inicio, fonte) values
  ('funrural_pf_aliquota', 1.5, '2018-01-01', 'Lei 13.606/2018: 1,2% previdência + 0,1% RAT + 0,2% SENAR sobre a receita bruta da comercialização (produtor pessoa física)'),
  ('ir_rural_presuncao_pct', 20, '1990-01-01', 'Lei 8.023/1990, art. 5º: resultado presumido de 20% da receita bruta da atividade rural'),
  ('ir_rural_aliquota_padrao', 27.5, '2015-04-01', 'Alíquota máxima da tabela progressiva do IRPF (Lei 13.149/2015); estimativa conservadora, ajuste em preferencias.agro.ir_aliquota')
on conflict (chave, vigencia_inicio) do nothing;

-- ------------------------------------------------------------ lotes
create table if not exists public.agro_lotes (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users on delete cascade,
  nome                     text not null check (length(nome) between 1 and 80),
  -- avaliação manual: vale mais que a arroba e o custo
  valor_estimado_cabeca    numeric check (valor_estimado_cabeca is null or valor_estimado_cabeca >= 0),
  data_estimativa          date,
  -- frete, comissão e afins já estão no preço de compra: custo zerado não alerta
  custos_inclusos_no_preco boolean not null default false,
  -- venda planejada (alimenta as projeções do Marco 7)
  data_prevista            date,
  cabecas_previstas        integer check (cabecas_previstas is null or cabecas_previstas > 0),
  preco_esperado_cabeca    numeric check (preco_esperado_cabeca is null or preco_esperado_cabeca >= 0),
  destino_planejado        text check (destino_planejado is null or length(destino_planejado) <= 80),
  observacao               text not null default '' check (length(observacao) <= 160),
  criado_em                timestamptz not null default now(),
  unique (user_id, nome)
);
select privado.politicas_padrao('agro_lotes');

alter table public.agro_movimentos add column if not exists lote_id uuid references public.agro_lotes on delete set null;
alter table public.agro_movimentos add column if not exists lote_entrada_id uuid references public.agro_lotes on delete set null;
alter table public.agro_movimentos add column if not exists cabecas_saida integer check (cabecas_saida is null or cabecas_saida > 0);
alter table public.agro_movimentos add column if not exists cabecas_entrada integer check (cabecas_entrada is null or cabecas_entrada > 0);
alter table public.agro_movimentos add column if not exists valor_referencia_saida numeric check (valor_referencia_saida is null or valor_referencia_saida >= 0);
alter table public.agro_movimentos add column if not exists valor_referencia_entrada numeric check (valor_referencia_entrada is null or valor_referencia_entrada >= 0);
alter table public.agro_custos add column if not exists lote_id uuid references public.agro_lotes on delete set null;

-- permuta: o tipo novo entra no check (só amplia a lista; nenhum dado muda)
alter table public.agro_movimentos drop constraint if exists agro_movimentos_tipo_check;
alter table public.agro_movimentos add constraint agro_movimentos_tipo_check check (tipo in
  ('compra','venda','nascimento','morte','entrada','saida','reclassificacao','troca'));
alter table public.agro_movimentos drop constraint if exists agro_movimentos_troca_check;
alter table public.agro_movimentos add constraint agro_movimentos_troca_check check (tipo <> 'troca'
  or (cabecas_saida is not null and cabecas_entrada is not null and valor_referencia_saida is not null and valor_referencia_entrada is not null));

notify pgrst, 'reload schema';
