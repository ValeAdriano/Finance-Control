-- 0011 · Marco 14 · progresso do onboarding (retomável) e do checklist
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
create table if not exists public.onboarding_estado (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  passo_atual   text not null default 'boas_vindas' check (passo_atual ~ '^[a-z_]{2,30}$'),
  feitos        text[] not null default '{}',
  pulados       text[] not null default '{}',
  dispensados   text[] not null default '{}',
  concluido     boolean not null default false,
  existente     boolean not null default false,   -- conta que já existia: só o checklist das novidades
  atualizado_em timestamptz not null default now()
);
select privado.politicas_padrao('onboarding_estado');
notify pgrst, 'reload schema';
