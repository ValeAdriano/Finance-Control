# Plataforma de Investimentos — Planejamento Completo

2026-09-21 · @Someone

## Visão geral

Plataforma pessoal de gestão de investimentos e finanças, para uso próprio de Adriano (não comercial). Consolida ações, FIIs, criptomoedas (Binance), renda fixa e investimentos em agronegócio, além de controle de gastos, em um único lugar. Sem custo fixo de hospedagem (Vercel + Supabase, free tier), acessível de qualquer dispositivo, com app mobile como evolução futura reaproveitando o mesmo backend.

## Stack e infraestrutura

| Camada         | Tecnologia                                                                         | Observação                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend + API | Next.js (App Router) na [Vercel](https://vercel.com/docs/limits)                   | Plano Hobby, custo zero                                                                                                                       |
| Backend        | [Supabase](https://supabase.com/pricing) (Postgres, Auth, Storage, Edge Functions) | Plano Free                                                                                                                                    |
| Agendamento    | Supabase pg\_cron / Edge Functions                                                 | O [cron da Vercel Hobby só roda 1x/dia](https://vercel.com/docs/cron-jobs/usage-and-pricing), por isso o agendamento de sync fica no Supabase |
| Mobile futuro  | Expo / React Native                                                                | Reaproveita o mesmo backend Supabase                                                                                                          |

Limites do free tier a respeitar: Supabase com 500MB de banco, 1GB de storage, 5GB de egress, projeto pausa após 1 semana sem uso (precisa de keep-alive periódico); Vercel Hobby com timeout de função de 60s e cron limitado a 1x por dia.

## Integrações por fonte de dado

| Fonte                                 | Como integrar                                                                                                                    | Custo  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Binance (cripto)                      | API oficial, chave por usuário com permissão só leitura, configurada dentro do sistema com guia de geração da chave              | Grátis |
| Banco Inter e outros bancos           | Open Finance via conector ["Meu Pluggy"](https://www.pluggy.ai/meu-pluggy) (até 5 conexões ativas, dados atualizados a cada 24h) | Grátis |
| Cotação e fundamentos de ações e FIIs | [brapi.dev](https://brapi.dev/faq/tem-algum-limite) (15.000 requisições por ciclo mensal, cacheadas no banco)                    | Grátis |
| Agronegócio                           | Lançamento manual (aporte + valor apurado na venda)                                                                              | —      |
| Histórico de nota de corretagem       | Importação de PDF, pra cobrir período anterior à conexão Open Finance                                                            | —      |

Acesso direto ao Open Finance como pessoa física não é viável (exige ser instituição participante do Banco Central); por isso o caminho é o conector gratuito da Pluggy.

## Modelo de dados

Tabelas principais no Postgres (Supabase), todas com Row Level Security restringindo por `user_id`:

- `institutions`: bancos/corretoras conectados (Pluggy, Binance)
- `assets`: ativos com metadados por tipo (ação, FII, cripto, renda fixa, agro)
- `holdings`: posição atual por ativo
- `transactions`: compra, venda, dividendo, aporte, resgate
- `price_history`: cotações cacheadas (brapi/Binance), sempre em append, nunca sobrescritas
- `expense_categories` / `expense_entries`: controle de gastos por categoria
- `allocation_targets`: meta de % por categoria de investimento
- `watchlist`: ativos acompanhados sem posição
- `journal_entries`: anotações/tese de investimento por ativo

## Motor de análise de ativos

Score determinístico por fórmulas e pesos (sem chamada de IA), construído a partir de metodologias consolidadas, com pesos configuráveis na interface.

**Ações** — composto de 4 dimensões:

| Dimensão           | Peso default | Metodologia                                                                                                                                                              | O que mede                                                                                                                                            |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualidade x preço  | 30%          | [Magic Formula](https://clubedovalor.com.br/blog/magic-formula/) (Joel Greenblatt)                                                                                       | ROIC + Earnings Yield (EBIT/EV), soma dos rankings                                                                                                    |
| Saúde financeira   | 25%          | [Piotroski F-Score](https://en.wikipedia.org/wiki/Piotroski_F-score)                                                                                                     | 9 critérios binários de solidez contábil, score 0-9                                                                                                   |
| Segurança          | 20%          | [Critérios defensivos de Benjamin Graham](https://einvestingforbeginners.com/defensive-investors-daah/)                                                                  | Liquidez corrente ≥ 2, dívida LP < capital de giro, P/L moderado, P/VP até \~1,5                                                                      |
| Renda/consistência | 25%          | [Método Bazin](https://investidor10.com.br/conteudo/metodo-bazin/) + critérios de [Luiz Barsi Filho](https://traders.com.br/blog/posts/luiz-barsi-estrategia-dividendos) | Dividend yield consistente (piso configurável, dinamizável via spread sobre CDI), 5 anos de histórico de pagamento, setor perene, baixo endividamento |

**FIIs**: dividend yield consistente (12-24 meses), P/VP, taxa de vacância, diversificação de inquilinos, liquidez diária, qualidade da gestão e segmento (tijolo vs papel), seguindo os [critérios padrão usados por analistas de FII no Brasil](https://nexzoe.com/pt-br/financas/renda-variavel/6-criterios-para-analisar-fiis-de-renda-mensal-no-segundo-de).

**Cripto**: rank por market cap, volatilidade histórica, dominância, liquidez em bolsa (não existe um framework fundamentalista consolidado equivalente aos de ações).

**Renda fixa e agro**: rentabilidade contratada vs CDI/IPCA, prazo até o vencimento, risco do emissor.

## Controle de gastos

- Lançamento de entrada e saída por categoria (manual, com extrato via Open Finance como evolução)
- Orçamento por categoria com alerta de estouro
- Lembrete de aporte mensal recorrente
- Cotação USD/BRL pra consolidar a Binance junto com o restante do patrimônio em reais

## Produto e decisão de investimento

- Watchlist de ativos ainda não comprados, usando o mesmo motor de score
- Simulador de venda: mostra IR devido e valor líquido antes de confirmar a operação
- Projeção de patrimônio (1/5/10 anos) a partir dos aportes recorrentes
- Journal de investimento: anotação/tese por ativo
- Meta de alocação (%) configurável por categoria de investimento
- Sugestão de rebalanceamento, mostrando o desvio de cada categoria em relação à meta configurada

## Robustez e confiabilidade

**Segurança**: 2FA no login, tokens de API (Pluggy, Binance) criptografados, RLS em todas as tabelas, rate limiting nas chamadas às APIs externas.

**Sincronização**: sync idempotente (evita duplicar lançamento), reconciliação de saldo vs Pluggy, retry com backoff nas chamadas externas, webhook de expiração de conexão.

**Fiscal**: cálculo de ganho de capital por venda, apuração de DARF quando aplicável, relatório anual pronto pro IRPF (posição 31/12, custo médio, dividendos).

**Patrimônio**: histórico de patrimônio líquido ao longo do tempo, alocação por classe, comparação com CDI/IBOV/IPCA.

**Alertas**: mudança de score, variação brusca de preço, vencimento de renda fixa.

**Operação**: testes automatizados no motor de cálculo, ambientes dev/staging/prod separados, exportação de dados (CSV/JSON), PWA antes do app nativo, Sentry pra monitoramento de erro, CI no GitHub Actions (lint + teste por PR).

## Interface e UX

Minimalista sem esconder funcionalidade: disclosure progressivo. Home com poucos KPIs essenciais (patrimônio total, variação do dia, alocação por classe), e cada funcionalidade (watchlist, journal, simulador, análise detalhada) em tela própria, acessível por navegação enxuta (sidebar ou tabs), nunca a mais de 2 cliques de distância. Tema claro/escuro, layout responsivo para qualquer dispositivo.

## Requisitos e decisões fechadas

- MVP já nasce com integração Open Finance (não só lançamento manual)
- Binance: acesso somente leitura, chave de API configurada por cada usuário dentro do sistema, com guia no onboarding mostrando como gerar a chave (Account → API Management → marcar só "Enable Reading", nunca trading ou saque)
- Motor de score baseado em metodologias nomeadas (Magic Formula, Piotroski, Graham, Bazin, Barsi), não em pesos arbitrários, com ajuste disponível na interface
- Uso mínimo de APIs de IA: nenhuma no cálculo do score, uso opcional apenas pra gerar resumo em texto

## Roadmap de desenvolvimento

Ordem definida: repositório → frontend (com dado mockado) → backend Supabase → integrações → motor de análise → avançado → robustez → deploy.

| Fase                | Escopo                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0. Repositório      | Criar repo GitHub, Next.js + TypeScript, ESLint/Prettier/Husky, CI básico (lint + build), design tokens iniciais                                                                                                                     |
| 1. Frontend (mock)  | Layout base responsivo, dashboard, telas por categoria de ativo, watchlist, controle de gastos, configurações (metas de alocação, conexão de contas), simulador de venda, journal, projeção, rebalanceamento — tudo com dado mockado |
| 2. Backend Supabase | Auth (+2FA), schema completo, RLS, troca dos mocks por dado real                                                                                                                                                                     |
| 3. Integrações      | brapi.dev, Binance, Pluggy (Meu Pluggy), agendamento via pg\_cron                                                                                                                                                                    |
| 4. Motor de análise | Score de ações e FIIs aplicado aos dados reais, pesos configuráveis                                                                                                                                                                  |
| 5. Avançado         | Cálculo de IR no simulador, projeção de patrimônio, importação de nota de corretagem, relatório IRPF                                                                                                                                 |
| 6. Robustez         | Criptografia de tokens, sync idempotente, testes automatizados, ambientes separados, alertas, exportação, PWA                                                                                                                        |
| 7. Deploy           | Produção Vercel + Supabase, Sentry, keep-alive do Supabase                                                                                                                                                                           |
