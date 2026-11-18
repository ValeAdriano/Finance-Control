-- 0006 · Marco 6 · hierarquia de alocação RF > Ações > Cripto
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
-- {modo_alocacao: metas_fixas|hierarquia, faixas: {rf:{min,max,piso}, acoes:{min,max}, cripto:{min,max}}, meses_reserva_pj}
alter table public.preferencias add column if not exists hierarquia jsonb;
notify pgrst, 'reload schema';
