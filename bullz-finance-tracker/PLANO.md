# Plano de migração

## Situação em 2026-10-14

- **F1–F7: desenvolvimento concluído.** Todas as telas, folhas e fluxos do site existem no app e
  foram exercitados no RN Web com o modo fixture (`?fixture=1`, `?fixture=admin`,
  `?fixture=vazia`): sem nenhuma tela em "Em migração". Lint, `tsc` e `npm test` limpos.
- **Gates ainda abertos** (dependem da linha de base da F0, que não foi gerada): diff visual
  contra as capturas do site, roteiros em Playwright/Maestro e snapshots de cálculo com fixtures.
  Também falta rodar no aparelho (iOS/Android) — só o web foi validado em runtime.
- **F8 em andamento**: o app React Native passou a ser o principal e o site HTML virou backup.
  O corte da Vercel está pronto (passo a passo em README › Deploy web: trocar o Root Directory
  para `bullz-finance-tracker`); links antigos `#/rota` redirecionam. O APK local/EAS está
  documentado em README › Gerar o APK. Faltam o teste no aparelho, as lojas e o beta.

Cada fase tem quatro etapas, sempre nesta ordem:

1. **Planejamento**: itens da fase marcados na `PARIDADE.md` e roteiros escolhidos em `ROTEIROS.md`.
2. **Desenvolvimento**: implementação no app, sem mexer na regra de negócio compartilhada.
3. **Testes**: cálculo (Jest), visual (diff de imagem) e fluxos (Playwright/Maestro).
4. **Comparação e gate**: relatório lado a lado; a fase só fecha quando todo item da fase está
   **igual** ou **diferença aceita** por você.

---

## Decisões de arquitetura

| tema | escolha | por quê |
|---|---|---|
| base | Expo (SDK estável mais recente) + TypeScript + EAS Build | um código para iOS, Android e web; builds e lojas sem Xcode/Gradle à mão |
| rotas | expo-router, com os mesmos nomes do site (`inicio`, `ativos`, `agro`, `aportes`, `dividendos`, `irpf`, `salario`, `renda`, `simular`, `projecoes`, `ajustes`, `perfil`, `retrospectiva`, `admin`, `inicio/editar`) | links e navegação iguais |
| regra de negócio | os arquivos do site, carregados por `src/nucleo/` (Metro `watchFolders` → `../investimentos-compartilhar/assets/js`) | zero divergência de cálculo |
| armazenamento local | `localStorage` síncrono sobre react-native-mmkv (no web, o nativo) | `FC.local` e o cache de mercado funcionam sem mudança |
| Supabase | `supa.js` reaproveitado com `@supabase/supabase-js` e sessão em MMKV | mesmas consultas, MFA, sessão de 7 dias |
| estado | Zustand espelhando `FC.estado` (base, prefs, mercado, dados, perfil) | mesma forma de dados que as telas atuais |
| folhas | `Modal` próprio (`src/ui/folha.tsx`): folha de baixo no celular, centrada no desktop, arrastar para fechar | igual ao `ui.folha` |
| gráficos | SVG gerado por `graficos.js` renderizado com `SvgXml`; toque/arrasto refeitos com Gesture Handler | mesmo desenho |
| ícones | o dicionário SVG de `util.js` com `react-native-svg` | mesmos ícones |
| animação | Reanimated com as curvas `--mola` e `--curva`; respeita "reduzir movimento" | mesma sensação |
| retrospectiva e vídeo | `recap/*` e `promo/promo.js` no "palco" (`src/recap/`): WebView no celular, iframe de `public/palco.html` na web (CSP sem script inline); o vídeo exportado volta em pedaços e sai por `expo-sharing` | canvas, áudio e gravação idênticos |
| importação | `importador.js` com `@zip.js/zip.js` e `expo-document-picker` | mesmos layouts de extrato |

### Adaptador do núcleo (`src/nucleo/`)

Carrega, na ordem do `index.html`, só o que não é tela:

```
config.js → util.js → padroes.js → layout.js → supa.js → graficos.js →
modelo/avaliador → agro → rentabilidade → carteira → perfil → recomendacao → renda →
projecao → importador → dividendos → impostos → alertas → salario → retrospectiva
```

Antes disso define `globalThis.window = globalThis` com `FC = {}`, `localStorage` (MMKV),
`window.supabase` e `window.zip`. `util.js` só toca o DOM dentro de funções de tela (`ui.*`,
`FC.$`, `FC.animar`), que o app nunca chama. Exporta `FC` com tipos em `src/nucleo/fc.d.ts`.

---

## F0 · Inventário e linha de base

**Planejamento**
- [x] Inventário de telas, folhas e estados → `PARIDADE.md`
- [x] Roteiros de fluxo → `ROTEIROS.md`
- [x] Conta de teste `teste-rn@example.com` criada (e-mail confirmado, sem 2FA); credenciais em
  `.env.teste` (fora do git). A conta demo continua intacta.

**Desenvolvimento** (ferramentas, sem app ainda)
- [ ] `ferramentas/fixtures/`: snapshot da conta demo (tabelas) e do mercado (universo,
  históricos, índices, cotações) num dia fixo
- [ ] Modo "fixture" para o site: `?fixture=1` faz `FC.mercado.*` e `FC.db.carregaTudo` lerem os
  arquivos em vez da rede, e fixa `Date.now()` (só em teste, não publicado)
- [ ] Playwright: capturas de referência do site para cada linha da matriz (iPhone 15 e
  desktop 1440, claro e escuro, modo privado)

**Testes**
- [ ] As capturas se repetem iguais em duas execuções seguidas (base estável)

**Gate**: matriz completa, roteiros escritos, capturas de referência estáveis.

## F1 · Fundação

**Planejamento**: linhas "Núcleo" e "Tema" da matriz; roteiro R0.

**Desenvolvimento**
- [x] Projeto Expo + TS + ESLint + Prettier + expo-router (`package.json`, `app.json`,
  `tsconfig.json`, `babel.config.js`, `metro.config.js` com `watchFolders`, `.eslintrc.js`,
  `.prettierrc`; rota de diagnóstico em `app/`)
- [x] `src/tema/`: tokens extraídos de `app.css` (`:root`, escuro, contraste alto), raios,
  espaços, curvas; `useTema()` que segue o esquema do sistema
- [x] `src/nucleo/`: shim universal (`shim.js`), ordem canônica (`ordem.js`), adaptador RN
  (`index.ts`) e tipos (`fc.d.ts`); 20 arquivos do site carregam, 82 chaves no `FC`
- [x] `src/ui/icone.tsx` com o dicionário de `util.js` (gerado por `scripts/gera-icones.js` →
  `icones.gen.ts`, 46 ícones) e desenhado com `react-native-svg`

**Testes** (dependência zero: `npm test` → `node --test testes/*.test.js`)
- [x] N1 superfície do `FC` (snapshot `superficie-esperada.json`) e ordem de carga = subconjunto
  não-tela do `index.html`
- [x] N12 perfil/recomendação, N13 layout, N16 formatação pt-BR — iguais ao site pelo adaptador
- [x] T1/T2 tema claro e escuro conferidos var a var contra `app.css`; T4 ícones idênticos a `util.js`
- [ ] Fixtures (F0) + snapshots de `carteira/rentab/impostos/dividendos/projecao/alertas/salario/
  agro/importador` com dados da conta demo — depende das fixtures ainda não commitadas
- [~] Rodar o app de verdade: **web validado** (Metro e `expo export -p web`); device (EAS) pendente

**Gate**: paridade de cálculo sem dados: **OK**. Falta a paridade com fixtures (bloqueada pela F0)
e a validação em runtime nativo.

## F2 · Casca e acesso

**Desenvolvimento**
- [x] Login, criar conta (força, senha vazada), confirmação por e-mail, MFA (TOTP), sair
- [x] Sessão de 7 dias sem uso (mesma regra de `app.js`)
- [x] Casca: menu do topo (web/desktop), barra de baixo pelo `FC.layoutAtual()`, "Mais",
  "Mais opções", sino com contador, modo privado, tema, carregamento com cache em blur
- [x] Cotações a cada minuto e ao voltar para o app (AppState), registro diário
- [x] Toasts, confirmações e folhas

**Testes**: R1 (login), R2 (MFA), capturas da casca.
**Gate**: linhas "Acesso" e "Casca" iguais.

## F3 · Núcleo do dia a dia

- [x] Início: todos os blocos, ordem e ocultos do layout, contagem dos valores
- [x] Investimentos: lista, filtros, detalhe do ativo (4 lentes, notas, proventos), formulários de
  ativo e de renda fixa
- [x] Aportes: compra, venda, renda fixa, provento, repetir aporte, histórico, importação

**Testes**: R3 (cadastrar ativo), R4 (aportar e ver no Início), R5 (importar extrato).
**Gate**: linhas "Início", "Investimentos", "Aportes".

## F4 · Demais abas

- [x] Dividendos, Salário (ganhos, plano, guia do mês, sequência), Agro (lançamentos, custos,
  pesagens, cotação), Imposto de Renda, Renda, Simular, Projeções
- [x] Ajustes: Geral, Módulos, Critérios (metas, objetivos, regras, universo), Dados (backup,
  restaurar, log, apagar), segurança (senha, 2FA, sair dos outros aparelhos)

**Testes**: R6–R9. **Gate**: linhas de cada aba.

## F5 · Perfil, onboarding e personalização

- [x] Questionário (uma pergunta por tela, rascunho, convite e adiamentos), resultado, aplicar
  plano, relatório (PDF com `expo-print`), checklist e card no Início, revisão 12/24 meses
- [x] Editor de layout no Início (arrastar, olho, menu com prévia do celular)
- [x] Guias "Como usar esta tela" e apresentação por passos

**Testes**: R10 (perfil), R11 (layout). **Gate**: linhas "Perfil", "Layout", "Ajuda".

## F6 · Extras

- [x] Retrospectiva do mês/ano e vídeo promocional (WebView com os mesmos arquivos)
- [x] Administração (vídeos, cliques, jornadas, onboarding, logs)
- [x] Telemetria anônima com consentimento (`uso.js`)

Notas: o palco é montado por `scripts/gera-palco.js` (`npm run gera:palco`) com os fontes do site
+ `src/recap/motor*.js`. A Administração reaproveita `FC.admin.analisa/insights` e o vídeo usa
`FC.promo.montaDados`, carregados no núcleo só pela lógica pura.

**Testes**: R12. **Gate**: linhas "Retrospectiva", "Admin".

## F7 · Web (React Native Web) e desktop

- [x] Layout de desktop igual (menu do topo, grade de 2/3 colunas, folhas centradas)
- [x] Foco, teclado, impressão do relatório, manifest e ícones do PWA
- [x] Headers de segurança e CSP do `vercel.json` adaptados ao `expo export -p web`

Notas: `public/index.html` (meta tags do site, fundo antes do JS, regra de impressão com
`data-imprimir="nao"`), `public/manifest.webmanifest` e ícones; guia e banner de instalação
(`src/telas/instalar.tsx`); `vercel.json` próprio do app (CSP sem `cdn.jsdelivr.net`, exceção de
`frame-ancestors 'self'` só para `/palco*`), conferido servindo o `expo export` com esses headers.
O modo fixture só liga em desenvolvimento (ou num build com `EXPO_PUBLIC_FIXTURE`).

**Testes**: diff visual completo da matriz em desktop. **Gate**: todas as linhas "desktop".

## F8 · Lançamento e corte

- [ ] EAS Build, TestFlight e Play (teste interno)
- [ ] Beta com uso real, comparando números com o site por pelo menos duas semanas
- [ ] Corte: Vercel serve o build RN Web, com rollback pronto; site antigo fica no git; app
  Capacitor (`app/`) é aposentado

**Gate**: nenhuma diferença aberta na matriz; seu aceite.

---

## Como a comparação funciona

| camada | ferramenta | contra o quê | quando falha |
|---|---|---|---|
| cálculo | Jest + fixtures | JSON do node do site | bloqueia a fase |
| visual (web) | Playwright + diff de imagem | captura de referência do site | item volta para "pendente" |
| visual (nativo) | Maestro + revisão lado a lado | captura de referência do site | registrado na matriz |
| fluxo | roteiros de `ROTEIROS.md` em Playwright (site e RN Web) e Maestro (nativo) | o mesmo roteiro no site | bloqueia a fase |
| dados | conta demo, mesma base | site lendo a mesma conta | bloqueia a fase |

Testes que gravam usam só a conta demo e desfazem o que criaram.

## Riscos

| risco | mitigação |
|---|---|
| diferenças de sombra, blur e tipografia entre CSS e RN | diff visual com limiar e lista de diferenças aceitas |
| canvas, áudio e gravação de vídeo no nativo | WebView com os arquivos atuais |
| arquivo do modelo tocar DOM ao carregar | isolar a parte de DOM no site, coberto pelos testes existentes |
| corte do site (PWA instalada, SEO, CSP) | por último, com rollback na Vercel |
