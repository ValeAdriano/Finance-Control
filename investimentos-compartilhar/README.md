# Finance Control

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
  schema.sql               tabelas, RLS, dono único
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
| `mercado_cache` | cotações públicas; só a Edge Function acessa |

Todas as tabelas do usuário têm `user_id default auth.uid()` e a política
`user_id = auth.uid()`. O gatilho `painel_um_dono_so` em `auth.users`
recusa qualquer cadastro depois do primeiro.

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
