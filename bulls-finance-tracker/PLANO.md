# Plano de migração

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
| folhas | `@gorhom/bottom-sheet` no celular; modal centrado no desktop | igual ao `ui.folha` |
| gráficos | SVG gerado por `graficos.js` renderizado com `SvgXml`; toque/arrasto refeitos com Gesture Handler | mesmo desenho |
| ícones | o dicionário SVG de `util.js` com `react-native-svg` | mesmos ícones |
| animação | Reanimated com as curvas `--mola` e `--curva`; respeita "reduzir movimento" | mesma sensação |
| retrospectiva e vídeo | `recap/*` e `promo/promo.js` numa WebView, compartilhando por `expo-sharing` | canvas, áudio e gravação idênticos |
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
- [ ] Projeto Expo + TS + ESLint + Prettier + expo-router
- [ ] `src/tema/`: tokens extraídos de `app.css` (`:root`, escuro, contraste alto), tipografia do
  sistema, raios, espaços, sombras, curvas
- [ ] `src/nucleo/`: adaptador, shims e tipos
- [ ] `src/ui/icone.tsx` com o dicionário de `util.js`

**Testes**
- [ ] Jest: com as fixtures, comparar JSON do app com o JSON do node do site para
  `FC.carteira.monta`, `FC.rentab.*`, `FC.impostos.*`, `FC.dividendos.analisa`,
  `FC.projecao.*`, `FC.alertas.calcula`, `FC.salario.*`, `FC.agro.analisa`, `FC.perfil.*`,
  `FC.recomendacao.gera`, `FC.layout.resolve`, `FC.importador` (extratos de exemplo)
- [ ] Rodar também `tests/perfil.test.js` e `tests/layout.test.js` contra o núcleo carregado no app

**Gate**: 100% de igualdade nos snapshots de cálculo.

## F2 · Casca e acesso

**Desenvolvimento**
- [ ] Login, criar conta (força, senha vazada), confirmação por e-mail, MFA (TOTP), sair
- [ ] Sessão de 7 dias sem uso (mesma regra de `app.js`)
- [ ] Casca: menu do topo (web/desktop), barra de baixo pelo `FC.layoutAtual()`, "Mais",
  "Mais opções", sino com contador, modo privado, tema, carregamento com cache em blur
- [ ] Cotações a cada minuto e ao voltar para o app (AppState), registro diário
- [ ] Toasts, confirmações e folhas

**Testes**: R1 (login), R2 (MFA), capturas da casca.
**Gate**: linhas "Acesso" e "Casca" iguais.

## F3 · Núcleo do dia a dia

- [ ] Início: todos os blocos, ordem e ocultos do layout, contagem dos valores
- [ ] Investimentos: lista, filtros, detalhe do ativo (4 lentes, notas, proventos), formulários de
  ativo e de renda fixa
- [ ] Aportes: compra, venda, renda fixa, provento, repetir aporte, histórico, importação

**Testes**: R3 (cadastrar ativo), R4 (aportar e ver no Início), R5 (importar extrato).
**Gate**: linhas "Início", "Investimentos", "Aportes".

## F4 · Demais abas

- [ ] Dividendos, Salário (ganhos, plano, guia do mês, sequência), Agro (lançamentos, custos,
  pesagens, cotação), Imposto de Renda, Renda, Simular, Projeções
- [ ] Ajustes: Geral, Módulos, Critérios (metas, objetivos, regras, universo), Dados (backup,
  restaurar, log, apagar), segurança (senha, 2FA, sair dos outros aparelhos)

**Testes**: R6–R9. **Gate**: linhas de cada aba.

## F5 · Perfil, onboarding e personalização

- [ ] Questionário (uma pergunta por tela, rascunho, convite e adiamentos), resultado, aplicar
  plano, relatório (PDF com `expo-print`), checklist e card no Início, revisão 12/24 meses
- [ ] Editor de layout no Início (arrastar, olho, menu com prévia do celular)
- [ ] Guias "Como usar esta tela" e apresentação por passos

**Testes**: R10 (perfil), R11 (layout). **Gate**: linhas "Perfil", "Layout", "Ajuda".

## F6 · Extras

- [ ] Retrospectiva do mês/ano e vídeo promocional (WebView com os mesmos arquivos)
- [ ] Administração (vídeos, cliques, jornadas, onboarding, logs)
- [ ] Telemetria anônima com consentimento (`uso.js`)

**Testes**: R12. **Gate**: linhas "Retrospectiva", "Admin".

## F7 · Web (React Native Web) e desktop

- [ ] Layout de desktop igual (menu do topo, grade de 2/3 colunas, folhas centradas)
- [ ] Foco, teclado, impressão do relatório, manifest e ícones do PWA
- [ ] Headers de segurança e CSP do `vercel.json` adaptados ao `expo export -p web`

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
