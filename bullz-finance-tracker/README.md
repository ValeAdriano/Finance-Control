# Bullz Finance Tracker (React Native)

Migração do **Bullz** (`../investimentos-compartilhar/`) para React Native, rodando em
**iOS, Android e web** (React Native Web). O objetivo é ficar **igual** ao sistema atual: mesmas
telas, mesmos números, mesmo banco.

O site atual é a referência viva. Nada aqui é considerado pronto sem comparação lado a lado.

## Documentos

| arquivo | para quê |
|---|---|
| [`PLANO.md`](PLANO.md) | fases, tarefas, critérios de aceite e como cada etapa é comparada |
| [`PARIDADE.md`](PARIDADE.md) | matriz tela × estado × elemento, com o status de cada item |
| [`ROTEIROS.md`](ROTEIROS.md) | fluxos de teste escritos uma vez e rodados no site e no app |

## Ideia central

- **Os cálculos não são reescritos.** O app carrega os mesmos arquivos de
  `../investimentos-compartilhar/assets/js/` (`padroes.js`, `layout.js`, `util.js`, `supa.js` e
  `modelo/*`) por um adaptador. Uma única fonte da verdade.
- **O banco não muda.** Mesmo projeto Supabase, mesmas tabelas, RLS, RPCs e Edge Function.
- **O visual vem dos mesmos tokens** de `assets/css/app.css` (claro/escuro, raios, espaços, curvas).

## Estado

**F1–F7 implementadas** (2026-10-14): todas as telas do site existem no app — casca, acesso e MFA,
Início, Investimentos, Aportes, Dividendos, IR, Salário, Agro, Renda, Simular, Projeções, Ajustes,
Perfil (questionário, resultado, relatório), editor de layout, guias, Retrospectiva, vídeo de
divulgação, Administração e instalação como PWA. Validadas no **web**; faltam os gates de
comparação (diff visual, roteiros) e rodar no aparelho. A **F8** (lojas, corte da Vercel) depende
do seu aceite. Detalhes em [`PLANO.md`](PLANO.md#situação-em-2026-10-14).

## Como rodar

```
npm install
npm run web          # http://localhost:8081
npm run ios          # ou: npm run android
```

**Modo fixture** (só em desenvolvimento): dados de demonstração em memória, sem rede nem login.
Acrescente à URL `?fixture=1` (conta com dados), `?fixture=admin` (com a Administração e uso
sintético) ou `?fixture=vazia` (conta nova). No nativo: `EXPO_PUBLIC_FIXTURE=1 npm run ios`.

## Estrutura

| pasta | o quê |
|---|---|
| `app/` | rotas do expo-router, com os mesmos nomes das rotas do site |
| `src/nucleo/` | adaptador que carrega os arquivos de cálculo do site (shim de navegador + ordem do `index.html`) |
| `src/estado/` | `FC.estado` + zustand (rerender), login, cotações, telemetria |
| `src/casca/` | topo, barra de abas, "Mais", página |
| `src/telas/` | as telas (uma por arquivo, port de `telas/*.js`) |
| `src/ui/` | kit visual, folhas, campos, gráficos (SVG do `graficos.js`), ícones |
| `src/recap/` | o "palco" da retrospectiva e do vídeo (WebView/iframe com `recap/*` e `promo.js`) |
| `src/plataforma/` | armazenamento, adaptações do `FC` por plataforma, modo fixture |
| `public/` | template web (meta tags do PWA), manifest, ícones e o `palco.html` gerado |
| `testes/` | paridade sem dependências (`npm test`) |

## Arquivos gerados

Rode de novo quando o site mudar a fonte correspondente:

| comando | fonte no site | saída |
|---|---|---|
| `npm run gera:icones` | `util.js` (dicionário `P`) | `src/ui/icones.gen.ts` |
| `npm run gera:palco` | `modelo/retrospectiva.js`, `recap/*`, `promo/promo.js` + `src/recap/motor*.js` | `src/recap/palco.gen.ts`, `public/palco.html`, `public/palco.js` |

## Verificações

```
npm test             # paridade com as fontes do site (node --test)
npm run lint
npx tsc --noEmit
```

## Deploy web

`vercel.json` deste diretório: `npx expo export -p web` → `dist/`, SPA, mesmos headers de
segurança do site (CSP sem script inline; o player roda em `/palco.html`, servido de `'self'`).
O corte (apontar a Vercel para cá) é da F8.
