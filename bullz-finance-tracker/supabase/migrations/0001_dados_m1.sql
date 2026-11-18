-- 0001 · Marco 1 · correção dos bugs de dados
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.

-- ganho: o fim do contrato e a data do último pagamento são coisas
-- diferentes (estágio que termina dia 23 e paga a última vez dia 6)
alter table public.ganhos add column if not exists data_fim_contrato date;
alter table public.ganhos add column if not exists data_ultimo_pagamento date;

-- políticas padrão de uma tabela do usuário, iguais às das tabelas antigas:
-- dono, 2FA (restritiva) e o alcance do cliente de IA (restritivas)
create or replace function privado.politicas_padrao(tabela text)
returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', tabela);
  execute format('drop policy if exists "dono" on public.%I', tabela);
  execute format($p$create policy "dono" on public.%I for all to authenticated
                   using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, tabela);
  execute format('drop policy if exists "exige 2fa" on public.%I', tabela);
  execute format($p$create policy "exige 2fa" on public.%I as restrictive for all to authenticated
                   using ((select privado.mfa_ok())) with check ((select privado.mfa_ok()))$p$, tabela);
  execute format('drop policy if exists "mcp le" on public.%I', tabela);
  execute format($p$create policy "mcp le" on public.%I as restrictive for select to authenticated
                   using ((select privado.mcp_ok(false)))$p$, tabela);
  execute format('drop policy if exists "mcp insere" on public.%I', tabela);
  execute format($p$create policy "mcp insere" on public.%I as restrictive for insert to authenticated
                   with check ((select privado.mcp_ok(true)))$p$, tabela);
  execute format('drop policy if exists "mcp altera" on public.%I', tabela);
  execute format($p$create policy "mcp altera" on public.%I as restrictive for update to authenticated
                   using ((select privado.mcp_ok(true))) with check ((select privado.mcp_ok(true)))$p$, tabela);
  execute format('drop policy if exists "mcp apaga" on public.%I', tabela);
  execute format($p$create policy "mcp apaga" on public.%I as restrictive for delete to authenticated
                   using ((select privado.mcp_ok(true)))$p$, tabela);
  execute format('revoke all on public.%I from anon', tabela);
  execute format('grant select, insert, update, delete on public.%I to authenticated', tabela);
end $$;
revoke all on function privado.politicas_padrao(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
