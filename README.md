# Finance Control

Plataforma pessoal de gestão de investimentos e finanças: ações, FIIs, cripto
(Binance), renda fixa e agronegócio, mais controle de gastos, em um lugar só.
Uso próprio, não comercial.

O planejamento completo — escopo, decisões fechadas e roadmap — está em
[`docs/planejamento.md`](docs/planejamento.md). As diretrizes de
desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md).

## Estado atual

| Fase | Escopo                                                                      | Situação                                                                                                                         |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Repositório, Next.js + TypeScript, ESLint/Prettier/Husky, CI, design tokens | ✅                                                                                                                               |
| 1    | Frontend completo com dado mockado                                          | ✅                                                                                                                               |
| 2    | Supabase: auth, schema, RLS, troca dos mocks                                | ◐ projeto criado, migrações aplicadas (13 tabelas com RLS, linter limpo); falta o auth e a implementação Supabase do repositório |
| 3    | Integrações: brapi.dev, Binance, Pluggy, `pg_cron`                          | 🔜 agendamento escrito, falta o conector                                                                                         |
| 4    | Motor de análise sobre dado real                                            | ✅ motor pronto e testado, rodando sobre mock                                                                                    |
| 5    | IR no simulador, projeção, nota de corretagem, IRPF                         | ◐ simulador de IR e projeção prontos; importação de nota e relatório IRPF pendentes                                              |
| 6    | Robustez: criptografia, sync idempotente, testes, alertas, export, PWA      | ◐ testes e idempotência desenhados; resto pendente                                                                               |
| 7    | Deploy: Vercel + Supabase, Sentry, keep-alive                               | 🔜                                                                                                                               |

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

Não precisa de nenhuma variável de ambiente para rodar hoje: a Fase 1 usa o
repositório mockado (`NEXT_PUBLIC_DATA_SOURCE=mock`).

O backend já existe: o projeto Supabase está criado e as migrações aplicadas —
ver [`supabase/README.md`](supabase/README.md). Quem clonar o repositório copia
o `.env.example` para `.env.local` e pega as chaves em
Project Settings > API Keys no painel.

```bash
npm run typecheck && npm run lint && npm test   # o que o CI roda
```

## Como o projeto está organizado

```
src/
  app/(app)/        telas (Server Components por padrão)
  components/       ui/ (primitivos) · charts/ · layout/ · <domínio>/
  lib/
    repo/           camada de acesso a dado — mock hoje, Supabase na Fase 2
    scoring/        motor de score: funções puras, uma por metodologia
    finance/        IR, projeção, rebalanceamento, carteira, gastos
  mocks/            dados da Fase 1
supabase/migrations/  schema, RLS e pg_cron
```

**Nenhuma tela acessa dado direto.** Tudo passa por `src/lib/repo`, o que faz a
troca de mock por Supabase ser uma linha em `repo/index.ts` em vez de uma
reescrita de tela.

## Motor de análise

O score é determinístico — fórmula e peso, **sem nenhuma chamada de IA no
cálculo**. Cada dimensão implementa uma metodologia nomeada:

| Classe     | Como é avaliado                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Ações      | Magic Formula (Greenblatt) 30% · Piotroski F-Score 25% · critérios defensivos de Graham 20% · Bazin/Barsi 25% |
| FIIs       | DY consistente de 12 a 24 meses, P/VP, vacância, concentração de inquilinos, liquidez e taxa de administração |
| Cripto     | Porte de mercado, liquidez e volatilidade — risco relativo, não valor intrínseco                              |
| Renda fixa | Taxa equivalente vs CDI e IPCA, prazo, rating do emissor e cobertura do FGC                                   |

Os pesos são ajustáveis em Configurações, com o ranking recalculando ao vivo.

Duas decisões que valem registrar:

- **Dado faltante nunca vira zero.** Um indicador sem dado sai da média e baixa
  a _cobertura_ do score, que aparece junto da nota. Score 82 com 40% de
  cobertura não vale o mesmo que 82 com cobertura cheia — e a interface diz isso.
- **A Magic Formula é comparativa.** Com menos de 5 ativos o ranking vira ruído
  (o pior de três ótimos tiraria zero), então abaixo desse limite o critério cai
  para escala absoluta, e a tela indica qual dos dois foi aplicado.

## Testes

83 testes cobrem o que erra calado: motor de score, IR sobre venda, projeção,
rebalanceamento, consolidação da carteira, formatação pt-BR e a coerência dos
próprios mocks.

```bash
npm test
npm run test:coverage
```
