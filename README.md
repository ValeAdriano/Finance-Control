# Finance Control

Plataforma pessoal de gestão de investimentos e finanças: ações, FIIs, cripto
(Binance), renda fixa e agronegócio, mais controle de gastos, em um lugar só.
Uso próprio, não comercial.

O planejamento completo — escopo, decisões fechadas e roadmap — está em
[`docs/planejamento.md`](docs/planejamento.md). As diretrizes de
desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md).

## Estado atual

| Fase | Escopo                                                                      | Situação                                                                                                    |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0    | Repositório, Next.js + TypeScript, ESLint/Prettier/Husky, CI, design tokens | ✅                                                                                                          |
| 1    | Frontend completo com dado mockado                                          | ✅                                                                                                          |
| 2    | Supabase: auth, schema, RLS, troca dos mocks                                | ✅ auth com 2FA, schema com RLS, repositório Supabase e seed                                                |
| 3    | Integrações: brapi.dev, Binance, Pluggy, `pg_cron`                          | ✅ chaves cadastradas na interface, brapi/Binance/Pluggy sincronizando, `pg_cron` apontado para a aplicação |
| 4    | Motor de análise sobre dado real                                            | ✅ motor pronto e testado, rodando sobre mock                                                               |
| 5    | IR no simulador, projeção, nota de corretagem, IRPF                         | ◐ simulador de IR e projeção prontos; importação de nota e relatório IRPF pendentes                         |
| 6    | Robustez: criptografia, sync idempotente, testes, alertas, export, PWA      | ◐ testes e idempotência desenhados; resto pendente                                                          |
| 7    | Deploy: Vercel + Supabase, Sentry, keep-alive                               | 🔜                                                                                                          |

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

Não precisa de nenhuma variável de ambiente para rodar hoje: a Fase 1 usa o
repositório mockado (`NEXT_PUBLIC_DATA_SOURCE=mock`).

Para rodar contra o Supabase, preencha o `.env.local` (a partir do
`.env.example`), ponha `NEXT_PUBLIC_DATA_SOURCE=supabase` e popule o banco:

```bash
npm run seed -- --email voce@exemplo.com --password 'senha forte'
```

O seed cria a conta e carrega o mesmo conjunto de dados da Fase 1 — útil para
ver a interface preenchida antes de ligar as integrações.

Para limpar os dados de exemplo e começar com os valores reais:

```bash
npm run reset -- --email voce@exemplo.com          # dry-run: mostra o que sairia
npm run reset -- --email voce@exemplo.com --yes    # executa
```

O reset preserva categoria de gasto, meta de alocação, pesos do score, a conta
e o 2FA — é configuração, não dado. Com `--all`, apaga a configuração também. Detalhes do
backend em [`supabase/README.md`](supabase/README.md).

**Os dois modos são suportados de propósito.** O mock deixa a interface rodar
sem credencial nenhuma — é assim que o CI builda e testa.

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

## Integrações

As chaves ficam na tela de **Configurações**, não em variável de ambiente: são
do usuário, trocam de tempos em tempos e precisam ser revogáveis sem deploy.
Cada uma é cifrada em AES-256-GCM antes de ir para o banco e nunca volta para a
tela — o que aparece depois é uma prévia mascarada e o estado da verificação.

| Fonte     | O que traz                              | Como conectar                                    |
| --------- | --------------------------------------- | ------------------------------------------------ |
| brapi.dev | Cotação e fundamentos de ações e FIIs   | Token colado em Configurações                    |
| Binance   | Saldo e cotação de cripto               | API Key somente leitura, colada em Configurações |
| Pluggy    | Extrato e saldo bancário (Open Finance) | Client ID/Secret + widget de conexão do banco    |

Duas coisas que o desenho garante:

- **A senha do banco nunca passa por aqui.** O widget da Pluggy recebe um token
  de curta duração e fala direto com ela; o que volta para a aplicação é só o
  id da conexão.
- **O sync é idempotente.** Reimportar o mesmo extrato não duplica lançamento —
  a deduplicação é por `external_id`, reforçada por índice único no banco, e
  cada execução registra quantos registros ignorou.

O agendamento roda no `pg_cron` do Supabase e chama `/api/cron/sync` da própria
aplicação, autenticado por segredo compartilhado — ver
[`supabase/README.md`](supabase/README.md).

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

160 testes cobrem o que erra calado: motor de score, IR sobre venda, projeção,
rebalanceamento, consolidação da carteira, formatação pt-BR, criptografia das
credenciais, retry e rate limit das chamadas externas, a assinatura HMAC da
Binance (contra o vetor oficial) e a idempotência do sync.

```bash
npm test
npm run test:coverage
```
