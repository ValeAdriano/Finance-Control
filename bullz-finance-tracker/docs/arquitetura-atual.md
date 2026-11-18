# Arquitetura atual (mapeamento do Marco 0, 2026-11-18)

Retrato do repositório antes do plano de evolução. Caminhos relativos a `bullz-finance-tracker/`.

## Stack

| camada | o que é | onde |
|---|---|---|
| app | Expo SDK 57 + React Native Web, rotas expo-router | `app/` (rotas), `src/telas/` (telas), `src/ui/` (kit) |
| regra de negócio | scripts de navegador que montam `window.FC`, carregados na ordem de `src/nucleo/ordem.js` | `nucleo/` |
| banco | Supabase Postgres com RLS por `user_id`, um único `schema.sql` idempotente | `supabase/schema.sql` |
| servidor | Edge Functions `mercado` (cotações, índices, registro diário), `acesso` (login com limite), `mcp` (servidor MCP) | `supabase/functions/` |
| deploy web | Vercel, `npx expo export -p web` → `dist/`, SPA com rewrite para `/` | `vercel.json` |
| testes | `node --test testes/*.test.js` com o núcleo num `vm` e um Supabase em memória | `testes/` |

**Não é Next.js** (o plano de evolução cita Next.js como referência). Não há Server Components; a home pública do M13 é uma rota do expo-router.

## Verificação

```bash
npm run lint        # eslint .
npm run typecheck   # tsc --noEmit (criado no M0)
npm test            # node --test testes/*.test.js
npm run build       # expo export -p web (criado no M0)
npm run verifica    # as quatro em sequência
```

Linha de base em 2026-11-18: lint limpo, tsc limpo, 105 testes passando, build ok.

## Deploy e migrations

- **Vercel**: o projeto aponta para `bullz-finance-tracker/` e publica a cada push na `main`.
- **Banco**: não há pipeline. O `schema.sql` é colado no SQL Editor do Supabase à mão (é idempotente).
- **Edge Functions**: publicadas à mão com `npx supabase functions deploy <nome>`. O push não publica nada no Supabase.
- Consequência: o app novo vai ao ar antes das tabelas novas existirem. Ver `docs/decisoes.md` (D-003).

## Tabelas (`supabase/schema.sql`)

| tabela | conteúdo |
|---|---|
| `ativos` | carteira e watchlist: ticker, classe, pilar, posição inicial (`quantidade`, `preco_medio`, `data_base`) |
| `renda_fixa` | títulos: tipo (cdi, ipca, prefixado, selic), taxa, vencimento, `valor_aplicado`, pilar |
| `aportes` | lançamentos: `tipo` ∈ {ativo, caixa, provento}, quantidade negativa na venda, `origem` de extrato |
| `preferencias` | jsonb: `alocacao_alvo`, `premissas`, `regras`, `renda`, `agro`, `plano`, `modulos`, `proventos`, `layout` |
| `agro_movimentos` | compra, venda, nascimento, morte, entrada, saída, reclassificação; `lote` é texto livre |
| `agro_custos`, `agro_pesagens` | custos da operação e pesagens |
| `ganhos` | salário, aluguel, bônus: recorrente (início/fim) ou avulso |
| `patrimonio_historico` | uma foto por dia |
| `indices_diarios` | CDI, Selic e IPCA do Banco Central (público, escrito pela Edge Function) |
| `log_sistema` | log de app, cron e MCP |
| `perfil_*`, `plano_investimento`, `onboarding_eventos` | questionário de perfil, plano gerado e funil |
| `mcp_acessos` | clientes de IA autorizados e se podem gravar |
| `mercado_cache`, `admins`, `uso_eventos`, `contas_modo_completo`, `privado.tentativas_acesso` | infraestrutura |

Toda tabela do usuário tem as políticas `dono`, `exige 2fa` (restritiva) e, se o MCP alcança, `mcp le/insere/altera/apaga`.

## Cálculos centrais

| cálculo | arquivo · função |
|---|---|
| leitura das tabelas | `nucleo/supa.js` · `FC.db.carregaTudo` |
| do banco ao retrato (app e MCP) | `nucleo/modelo/base.js` · `FC.base.carrega`, `montaPrefs` |
| preço médio e custo da posição | `nucleo/modelo/carteira.js` · `posicao`, `consolidadoPorTicker` |
| resumo (investido, atual, resultado) e alocação por pilar | `nucleo/modelo/carteira.js` · `monta`, `alocacao` |
| rentabilidade (Modified Dietz, XIRR, PEPS por lote) | `nucleo/modelo/rentabilidade.js` · `dietz`, `xirr`, `resumoFluxos`, `avaliaAtivo`, `avaliaTitulo`, `carteira` |
| desempenho contra referências (TWR, dia) | `nucleo/modelo/desempenho.js`, `rentabilidade.js` · `serieDiaria`, `twr` |
| nota do ativo (4 lentes) | `nucleo/modelo/avaliador.js` |
| perfil e plano de alocação | `nucleo/modelo/perfil.js`, `recomendacao.js` |
| plano de aporte e renda do mês | `nucleo/modelo/salario.js` · `planoDoMes`, `rendaDoMes`, `investidoNoMes`, `paraProjecao` |
| projeção de longo prazo | `nucleo/modelo/projecao.js` |
| caixa de proventos | `nucleo/modelo/caixa-proventos.js` |
| agro (rebanho, valor, caixa, resultado) | `nucleo/modelo/agro.js` · `analisa`, `caixa`, `valorDaOperacao` |
| IR (títulos, ganho de capital simples) | `nucleo/modelo/impostos.js` |
| alertas da carteira | `nucleo/modelo/alertas.js` |
| retrospectiva e vídeo | `nucleo/modelo/retrospectiva.js`, `nucleo/promo/promo.js`, `nucleo/recap/*` |

## Ferramentas MCP (`supabase/functions/mcp/ferramentas.mjs`)

Leitura: `resumo_patrimonio`, `listar_posicoes`, `detalhar_ativo`, `listar_lancamentos`, `listar_renda_fixa`, `rentabilidade`, `dividendos`, `agro_resumo`, `agro_lancamentos`, `salario_e_plano`, `historico_patrimonio`, `preferencias`.

Escrita: `registrar_lancamento`, `salvar_ativo`, `salvar_titulo`, `salvar_ganho`, `registrar_agro`, `atualizar_metas`, `editar_registro`, `apagar_registro`.

Esquemas aceitos por tabela: `esquemas.mjs`. Núcleo empacotado: `nucleo.gen.mjs` (`npm run gera:mcp`, conferido pelo `npm test`).

## Vídeo, onboarding e tela antes do login

- **Vídeo**: canvas próprio (`nucleo/promo/promo.js` + `nucleo/recap/render.js`/`audio.js`), tocado no "palco" (`public/palco.html` + `public/palco.js`, gerados por `npm run gera:palco`). Exporta por MediaRecorder. Tela: `src/telas/promo.tsx`. Não usa Remotion.
- **Onboarding**: `src/telas/onboarding.tsx`, passos de apresentação; o "já vi" fica nos metadados do usuário. Funil em `onboarding_eventos`.
- **Antes do login**: `app/_layout.tsx` mostra `src/telas/login.tsx` sem sessão; `app/index.tsx` redireciona para `/inicio`. Não há home pública.
- **Modo fixture**: `?fixture=1` (`src/plataforma/fixture.ts`) troca a rede por uma conta de demonstração. Base para as capturas do M11.
