-- =============================================================================
-- Slug do ativo para a URL
--
-- O símbolo não serve como identificador de rota: "CDB Inter 112% CDI" viraria
-- uma URL escapada e ilegível, e não casaria de volta na busca. A mesma regra
-- está em `src/lib/slug.ts` — mudar uma exige mudar a outra.
-- =============================================================================

alter table assets add column slug text;

update assets
set slug = trim(both '-' from lower(regexp_replace(symbol, '[^a-zA-Z0-9]+', '-', 'g')));

alter table assets alter column slug set not null;

create unique index assets_user_slug_unique on assets (user_id, slug);

-- Mantém o slug em dia quando o símbolo muda, sem depender da aplicação.
create or replace function public.set_asset_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = trim(both '-' from lower(regexp_replace(new.symbol, '[^a-zA-Z0-9]+', '-', 'g')));
  end if;
  return new;
end;
$$;

create trigger assets_slug before insert or update of symbol on assets
  for each row execute function public.set_asset_slug();
