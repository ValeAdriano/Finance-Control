@AGENTS.md

# Finance Control — diretrizes do projeto

Plataforma pessoal de gestão de investimentos e finanças do Adriano (uso próprio, não comercial).
O planejamento completo — escopo, decisões fechadas e roadmap — está em
`docs/planejamento.md`. **Ele é a fonte da verdade do produto.** Antes de propor
funcionalidade nova, confira se ela já está lá (e em qual fase).

Idioma: **código em inglês, interface e documentação em português (pt-BR)**.

## Stack

| Camada         | Tecnologia                                                        |
| -------------- | ----------------------------------------------------------------- |
| Frontend + API | Next.js 16 (App Router) + TypeScript, deploy na Vercel (Hobby)    |
| Estilo         | Tailwind CSS v4 (tokens em `src/app/globals.css`)                 |
| Backend        | Supabase (Postgres + Auth + Storage + Edge Functions), plano Free |
| Agendamento    | Supabase `pg_cron` (o cron da Vercel Hobby só roda 1x/dia)        |
| Testes         | Vitest (motor de cálculo é o que mais importa testar)             |

Restrições de free tier que o código precisa respeitar: Supabase 500MB de banco,
5GB de egress e pausa após 1 semana ociosa (keep-alive); Vercel Hobby com timeout
de 60s por função. Isso significa: **cachear cotação no banco, nunca chamar API
externa direto do browser, e paginar/limitar tudo que cresce sem fim**
(`price_history` é append-only e precisa de política de retenção).

## Arquitetura

```
src/
  app/                    rotas (App Router). Server Components por padrão.
    (app)/                shell autenticado: sidebar + conteúdo
    api/                  route handlers (proxy para APIs externas)
  components/
    ui/                   primitivos sem regra de negócio (Card, Button, Badge…)
    charts/               wrappers de gráfico (Recharts, client components)
    layout/               Sidebar, Topbar, navegação mobile, tema
    <dominio>/            componentes com regra de negócio, por domínio
  lib/
    repo/                 ⚑ camada de acesso a dado (ver abaixo)
    scoring/              motor de score — funções puras, 100% testáveis
    finance/              IR, projeção, rebalanceamento, câmbio — funções puras
    format.ts             formatação pt-BR (moeda, %, data)
  types/                  tipos de domínio compartilhados
  mocks/                  dados mockados da Fase 1
supabase/
  migrations/             SQL versionado (schema + RLS + pg_cron)
```

### A regra mais importante: `lib/repo`

Nenhuma página ou componente acessa dado diretamente. Tudo passa pela interface
em `src/lib/repo/types.ts`, que tem duas implementações: `repo/mock.ts` e
`repo/supabase.ts`. `NEXT_PUBLIC_DATA_SOURCE` escolhe qual, a cada chamada.

Manter o mock funcionando **não é legado** — é o que deixa a interface rodar
sem credencial nenhuma, o que o CI usa para buildar e testar. Método novo na
interface entra nas duas implementações, ou o modo mock quebra.

Se um componente importa de `@/mocks` direto, está errado.

### Server vs Client

- Página, layout e busca de dado: **Server Component** (padrão, sem `'use client'`).
- `'use client'` só onde há estado, evento ou API de browser — gráfico, formulário,
  toggle de tema, tabela com ordenação. Empurre o `'use client'` para a folha da
  árvore, nunca para o topo da página.
- Segredo (chave Binance, token Pluggy, service role do Supabase) **nunca** sai do
  servidor. Variável exposta ao browser só com prefixo `NEXT_PUBLIC_`, e só as duas
  do Supabase anon.

## Motor de score — regras inegociáveis

O score é **determinístico**: fórmula e peso, sem chamada de IA em nenhum ponto do
cálculo (IA só é permitida, opcionalmente, para gerar resumo em texto).

Cada dimensão implementa uma metodologia nomeada, e o código cita a fonte:
Magic Formula (Greenblatt), Piotroski F-Score, critérios defensivos de Graham,
Bazin/Barsi para dividendos. Ver `src/lib/scoring/`.

Ao mexer no motor:

1. Funções puras — entrada é dado de fundamento, saída é número. Sem I/O, sem `Date.now()`.
2. Todo critério novo entra com teste em `*.test.ts` no mesmo diretório.
3. Peso é configurável pelo usuário; o default vive em `scoring/weights.ts` e é o
   que está documentado no planejamento (30/25/20/25 para ações).
4. Dado faltante nunca vira zero silencioso — devolve `null` e reduz a confiança
   do score (`coverage`), para não penalizar o ativo por buraco de dado.

## Dinheiro e números

- Valor monetário em `number` (reais), arredondado só na formatação — nunca no meio
  do cálculo. Percentual guardado como fração (`0.0525`), não como `5.25`.
- Formatação sempre via `src/lib/format.ts` (`pt-BR`, `BRL`). Não chamar
  `toLocaleString` espalhado pelo código.
- Ativo em dólar (Binance) é convertido para BRL na borda de apresentação, com a
  cotação guardada junto do valor, para o histórico não mudar retroativamente.

## Segurança

- RLS em **todas** as tabelas, filtrando por `user_id`. Nenhuma tabela nova sem policy.
- **Nenhuma query filtra por `user_id` na aplicação.** Quem filtra é a RLS. Filtrar
  também no código daria falsa segurança: se a policy estiver errada, o filtro da
  aplicação esconderia o problema em vez de expô-lo.
- Autorização usa `supabase.auth.getUser()`, nunca `getSession()` — `getSession`
  só lê o cookie, que o cliente pode forjar.
- `SUPABASE_SERVICE_ROLE_KEY` ignora a RLS. Só em trabalho de sistema (seed, sync
  agendado); nunca para responder requisição de usuário. `createAdminClient()`
  existe para isso e não deve aparecer em código de tela.
- Depois de qualquer migração: `npx supabase db advisors --linked`. Ele pega o que
  passa no `db push` mas é buraco de segurança (função sem `search_path` fixo,
  extensão no schema `public`).
- Chave de API de terceiro é criptografada antes de gravar, e a permissão pedida ao
  usuário é sempre a mínima (Binance: somente leitura, nunca trade ou saque).
- Chamada a API externa sempre pelo servidor, com rate limit e retry com backoff.
- Sync precisa ser **idempotente**: reimportar o mesmo extrato não duplica lançamento.

## UI

Minimalista, mas sem esconder funcionalidade — disclosure progressivo. Home com
poucos KPIs (patrimônio, variação do dia, alocação por classe); cada área em tela
própria, nunca a mais de 2 cliques. Tema claro/escuro, responsivo de 360px pra cima.

- Cor só via token do `globals.css` (`--color-*`). Nada de hex solto no componente.
- Verde/vermelho de variação: usar `text-positive` / `text-negative`, e **sempre**
  acompanhar de sinal (+/−) ou seta, porque cor sozinha não é acessível.
- Tabela de ativos é densa por natureza: no mobile ela vira lista de cards.

## Comandos

```bash
npm run dev          # dev server
npm run build        # build de produção (roda no CI)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run test:watch
npm run format       # Prettier
```

Antes de dar uma tarefa por concluída: `npm run typecheck && npm run lint && npm test`.

## Convenções

- Arquivo e pasta em `kebab-case`; componente em `PascalCase`; hook em `useCamelCase`.
- URL de ativo usa `slug`, nunca `symbol`: símbolo de renda fixa e agro tem espaço
  e sinal ("CDB Inter 112% CDI"). A regra está em `src/lib/slug.ts` **e** no
  trigger da migração `..._asset_slug.sql` — mudar uma exige mudar a outra.
- Sem `any`. Se o tipo é desconhecido, `unknown` + validação com `zod` na borda.
- Toda resposta de API externa é validada com `zod` antes de entrar no domínio.
- Commit em português, no imperativo ("adiciona simulador de venda").
- Não commitar `.env.local`, chave, token, ou dump de dado real.
