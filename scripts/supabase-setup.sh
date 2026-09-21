#!/usr/bin/env bash
#
# Liga o projeto local ao projeto Supabase e aplica as migrações.
# Rode DEPOIS de `npx supabase login`.
#
#   ./scripts/supabase-setup.sh <project-ref>
#
# O project-ref é o identificador que aparece na URL do painel:
# https://supabase.com/dashboard/project/<project-ref>

set -euo pipefail

REF="${1:-}"

if [[ -z "$REF" ]]; then
  echo "Uso: ./scripts/supabase-setup.sh <project-ref>" >&2
  echo "Projetos disponíveis nesta conta:" >&2
  npx supabase projects list >&2 || true
  exit 1
fi

echo "==> Verificando login"
npx supabase projects list >/dev/null

echo "==> Conectando ao projeto $REF"
npx supabase link --project-ref "$REF"

echo "==> Aplicando migrações (schema, RLS e pg_cron)"
npx supabase db push

echo "==> Conferindo se a RLS ficou ligada em todas as tabelas"
npx supabase inspect db table-stats 2>/dev/null | head -20 || true

cat <<'MSG'

==> Feito. Falta preencher .env.local com as chaves do projeto:

    NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
    SUPABASE_SERVICE_ROLE_KEY=<service role key>
    TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>

As chaves estão em Project Settings > API Keys no painel.
A service role key NUNCA vai para variável NEXT_PUBLIC_ nem para o browser.
MSG
