# Finance Control

> **Backup.** O app principal agora é o [`bullz-finance-tracker/`](../bullz-finance-tracker/README.md)
> (React Native, web e celular). Este site continua funcionando e publicável (`vercel.json`), e os
> arquivos de `assets/js/` seguem sendo a fonte dos cálculos que o app carrega.

Painel pessoal de investimentos e agronegócio. Front-end estático em
HTML/CSS/JS, sem build e sem servidor; o único backend é o **Supabase**
(Auth, Postgres com RLS e uma Edge Function).

> Não é recomendação de investimento. O painel aplica mecanicamente os
> critérios que você define em Ajustes → Regras.

## Arquitetura

```
index.html                 abre direto no navegador
assets/css/app.css         sistema visual (claro/escuro, animações)
assets/js/
  config.js                URL e chave PUBLICÁVEL do Supabase
  util.js                  HTML seguro, formatação pt-BR, folhas, avisos
  padroes.js               regras, universo de renda, premissas, agro (padrões)
  supa.js                  sessão, tabelas, chamadas à Edge Function
  graficos.js              SVG responsivo e animado
  modelo/                  avaliador (4 lentes), carteira, agro, renda,
                           projeção, importador de extratos
  telas/                   uma por aba + login + peças comuns
  app.js                   rotas, navegação, carregamento
supabase/
  schema.sql               tabelas e RLS por usuário
  functions/mercado/       Fundamentus + Yahoo + Banco Central, com cache
legado-python/             a versão Flask anterior (não é usada)
```

Fluxo: login no Supabase Auth → leitura das tabelas (rápida) → a tela
aparece → a Edge Function `mercado` traz cotações (cache de 6 h no banco
e 1 h no navegador) → scores e gráficos são recalculados no navegador.

## Banco

| tabela | o que guarda |
|---|---|
| `ativos` | carteira e watchlist (ticker, classe, pilar, posição inicial) — ações, FIIs, ETFs e cripto |
| `renda_fixa` | títulos, indexador, taxa, saldo |
| `aportes` | compras, vendas, proventos, movimentos de renda fixa |
| `preferencias` | metas, premissas, regras, universo de renda, cotação do agro |
| `agro_movimentos` | compra, venda, nascimento, morte, entrada, saída, mudança de categoria |
| `agro_custos` | nutrição, sanidade, mão de obra, arrendamento, frete… |
| `agro_pesagens` | peso médio por lote e categoria (vira valor e GMD) |
| `patrimonio_historico` | uma foto por dia: total, cada classe e cada ativo (quantidade × preço) |
| `log_sistema` | atualizações de preço, registros diários e erros |
| `perfil_rascunho` | respostas parciais do questionário, para retomar |
| `perfil_investidor` | cada avaliação de perfil (só INSERT/SELECT: histórico imutável) |
| `plano_investimento` | o plano gerado e a decisão (aplicado, recusado, pendente) |
| `onboarding_eventos` | funil do onboarding: só nome do passo e tempo |
| `mercado_cache` | cotações públicas; só a Edge Function acessa |

Todas as tabelas do usuário têm `user_id default auth.uid()` e a política
`user_id = auth.uid()`: cada conta só enxerga as próprias linhas.

## Perfil do investidor e plano

Questionário de ~20 perguntas (uma por tela, em faixas) que mede três eixos
separados e vira um plano. Tudo roda no navegador, sem LLM, e é versionado.

- **Tolerância** (0 a 100): bloco 4, escrito do zero na estrutura de Grable & Lytton.
- **Capacidade** (0 a 100): blocos 1 e 2, com tetos que nenhuma resposta compensa
  (dívida cara ≤ 20, reserva < 3 meses ≤ 30, prazo < 2 anos ≤ 25, saque provável ≤ 40).
- **Necessidade**: o retorno real anual que o objetivo exige, por bisseção. É conta, não pergunta.
- **Perfil** = faixa de `min(tolerância, capacidade)`: 0–34 conservador, 35–64 moderado, 65–100 arrojado.

Plano em cascata: dívida cara → reserva (6 ou 12 meses) → objetivos curtos →
longo prazo; alocação por classe (renda fixa > ações > cripto, faixas em
Ajustes → Critérios → faixas avançadas, chave `perfil`); candidatos que passam
nos filtros do perfil. **Aplicar plano** grava `preferencias.alocacao_alvo`.

| arquivo | papel |
|---|---|
| `padroes.js` → `FC.PERFIL`, `PADRAO_REGRAS.perfil` | perguntas, pontos, tetos, faixas, filtros (versão `perfil-v1`) |
| `modelo/perfil.js` | T, C, N, score, consistência, revisão |
| `modelo/recomendacao.js` | plano, alocação, candidatos, conflitos, plano contra realidade |
| `telas/perfil-*.js` | questionário, resultado e relatório (`#/perfil`) |

**Modo de recomendação.** `educativo` (padrão): classes e filtros, sem verbo de
compra. `completo`: só para contas listadas em `contas_modo_completo` (não
exposta pela API; veja o comentário no schema). Recomendar ativos individuais a
terceiros é atividade de consultor registrado na CVM: mantenha o cadastro
fechado ou o modo educativo, e consulte um advogado de mercado de capitais.

**Banco.** `privado.perfil_confere()` (gatilho) recalcula T, C, score e
consistência a partir das respostas e recusa perfil adulterado. Ela é gerada
das mesmas tabelas de `padroes.js`: mexeu nos pontos? Suba `FC.PERFIL.versao` e rode

```
node scripts/gera-perfil-sql.js --escreve   # atualiza supabase/schema.sql
node tests/perfil.test.js                   # 20 personas + teste de propriedade
node scripts/gera-perfil-sql.js --confere   # schema em dia com padroes.js
PERFIL_PG="-h 127.0.0.1 -p 5432 -U postgres" node tests/perfil-sql.test.js   # banco = navegador
```

O funil do onboarding (só contagens, via `admin_funil_onboarding`) aparece em
Administração → Onboarding.

## Segurança

- **Supabase Auth**: senha só como hash bcrypt; mínimo de 10 caracteres com
  maiúscula, minúscula e número; o app recusa senhas que já vazaram
  (Have I Been Pwned por k-anonimato, só o prefixo do SHA-1 sai do
  aparelho). Trocar a senha pede a senha atual.
- **Cadastro aberto** pela tela "Criar conta": nome, e-mail e senha (as
  mesmas regras de força e de senha vazada). Cada conta nova começa vazia e
  a RLS isola os dados de cada uma.
- **2FA (TOTP) opcional**, até 3 autenticadores (principal + reserva).
  Com ele ligado, a política restritiva `exige 2fa` em todas as tabelas só
  aceita sessões `aal2` — sem o código, a API devolve lista vazia e recusa
  gravação. Remover um autenticador pede um código válido.
- **Sessões**: token de 15 min com rotação do refresh token; "Sair dos
  outros aparelhos" em Ajustes; o app encerra a sessão após 7 dias sem uso.
- **Limites** de tentativas de login e de código no servidor (`rate_limit_verify`).
- **Web**: CSP, HSTS, X-Frame-Options e demais cabeçalhos em `vercel.json`.

## Preços e acompanhamento

Fontes gratuitas, sem chave de API:

| o quê | fonte |
|---|---|
| preço de agora da cripto | CoinGecko (`/simple/price`, já em reais) |
| preço de agora de ações, FIIs e ETFs | Yahoo Finance |
| histórico de preço | Yahoo Finance (cripto em dólar × câmbio de cada dia) |
| fundamentos | Fundamentus |
| juros e inflação | Banco Central (SGS) |

Com o app aberto, os preços são atualizados a cada minuto e cada posição
vale quantidade × preço de agora. Uma foto do patrimônio por dia vai para
`patrimonio_historico`: o app grava ao abrir (no máximo a cada 15 min), e
o `pg_cron` do Supabase chama a Edge Function todo dia às 18h10 de
Brasília (`fc-registro-diario`), mesmo com o app fechado. No servidor, o
agro entra com o último valor calculado pelo app. O gráfico
"Crescimento do patrimônio" (Início) e a "Evolução da posição" (detalhe
do ativo) saem desses registros; o log fica em Ajustes → Log do sistema.

O agendamento se autentica com `CRON_SECRET`, guardado no Vault do banco
e nos segredos da Edge Function.

## Rentabilidade aporte a aporte

- **Índices**: CDI e Selic diários e IPCA mensal do Banco Central ficam em
  `indices_diarios` (a Edge Function completa todo dia; se o BCB cair, usa o
  cache do CDI e o IPCA do IBGE).
- **Renda fixa**: cada aporte rende da própria data pela própria taxa
  (`aportes.indexador`/`taxa`; vazio = a do título). Pós-fixado compõe o CDI
  ou a Selic de cada dia útil × o percentual; prefixado usa dias úteis/252;
  IPCA + X distribui o IPCA do mês pelos dias úteis. Valores brutos, antes de IR.
- **Ações, FIIs e cripto**: um lote por compra; vendas consomem os lotes mais
  antigos (PEPS). A posição inicial usa `ativos.data_base`.
- **Consolidação** (`modelo/rentabilidade.js`): retorno no período por
  Modified Dietz (ganho ÷ capital médio ponderado pelo tempo) e TIR/XIRR ao
  ano a partir de 90 dias; TWR na série diária para comparar com o CDI.
- **Gráfico de crescimento**: reconstruído dia a dia a partir dos lançamentos;
  o histórico anotado à parte aparece separado, tracejado.

## FIIs por tipo

O informe trimestral da CVM (dados abertos) entra pela Edge Function
(`fiis_cvm`, cache de 7 dias; agregação em `functions/mercado/cvm.ts`):
receita de aluguel × juros de títulos, imóveis com vacância, inadimplência e
fatia da receita, setores de inquilinos, CRIs e cotas de FIIs. Daí sai o tipo:
**tijolo** (≥ 50% da receita em aluguel), **papel**, **fundo de fundos** ou
**híbrido** — e cada um tem um perfil de análise em `padroes.js`:

| Tipo | Métricas |
|---|---|
| Tijolo | P/VP, DY, vacância física, vacância financeira (estimada), concentração no maior imóvel, cap rate, liquidez |
| Papel | P/VP, DY, concentração no maior CRI, liquidez |
| Fundo de fundos | P/VP, DY, concentração no maior FII, liquidez |
| Híbrido | P/VP, DY, vacâncias, concentração na maior posição, liquidez |

A vacância financeira é estimada imóvel a imóvel: receita potencial =
receita ÷ (1 − vacância); imóveis quase todos vagos usam o aluguel médio por
m² do fundo.

## Cripto

Classe `cripto`, pilar Alternativos por padrão. O Yahoo não publica mais
os pares em real, então a Edge Function busca `BTC-USD` e converte cada
dia pelo câmbio daquele dia (`BRL=X`) — usar só o câmbio de hoje
misturaria a variação do dólar com a da moeda. Quantidades com até 8
casas. Moedas com código ambíguo no Yahoo podem ser cadastradas pelo
código completo (ex.: `PEPE24478-USD`). A avaliação é só de preço contra
a própria história (média de 200 dias e distância da máxima de 52
semanas), com faixas mais largas que as de ETF.

## Agro: como o valor é calculado

- **Rebanho** = soma dos movimentos por categoria (nunca digitado).
- **Valor** = cabeças × peso vivo × rendimento de carcaça ÷ 15 × preço
  da @. O peso vem da pesagem mais recente; sem ela, do último
  lançamento com peso; sem nada, de um peso típico (a tela avisa).
  Dá para definir @ ou valor por cabeça por categoria.
- **Investido** = compras + despesas da operação + entradas com valor + custos.
- **Resultado** = vendas líquidas + valor do rebanho hoje − investido.
- **GMD** = ganho de peso entre a primeira e a última pesagem do lote.

## Manutenção

Reaplicar o schema (seguro, não apaga dados): cole `supabase/schema.sql`
no SQL Editor do projeto.

Publicar a Edge Function depois de mudar o código:

```bash
SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy mercado \
  --project-ref ahbftafpbailgmjughsq --use-api --no-verify-jwt
```

(`--no-verify-jwt` porque a função confere o usuário por conta própria,
chamando o Auth com o token recebido.)

## As quatro lentes

Cada métrica é vista por quatro lentes, cada uma com nota de 0 a 100:
**histórica** (percentil nos últimos anos do próprio ativo), **regra**
(as faixas que você definiu), **pares** (percentil no segmento) e
**macro** (contra o CDI do dia, líquido de IR quando o rendimento é
isento). A nota da métrica é a média ponderada das lentes que têm dado;
o score do ativo é a média ponderada das métricas. As lentes discordam
de propósito, e a régua de cada indicador mostra todas as referências
na mesma escala, com o melhor sempre à direita.
