# Conteúdo: vídeo, capturas e a home

Tudo sai da **conta demo** (`seed/demo/dados.js`), nunca de uma conta real. Mudou uma tela? Regrave as capturas e o vídeo.

## Pré-requisitos (uma vez)

- Playwright com o Chromium: `npm i -D playwright && npx playwright install chromium` (não está nas dependências do app).
- ffmpeg com libx264, libvpx e libwebp (no macOS: `brew install ffmpeg`).

## Atualizar as capturas

```bash
npm run capturas
```

Gera o build web com o modo demo em `.capturas-build/` e grava `public/capturas/<tela>-<desktop|celular>-<claro|escuro>.webp`. A lista de telas, a rota e a seção de cada uma ficam em `scripts/capturas.config.ts`. Falha se aparecer erro de console. Para repetir sem rebuild: `CAPTURAS_SEM_BUILD=1 npm run capturas`; só algumas telas: `CAPTURAS_SO=inicio,potes npm run capturas`.

## Regravar o vídeo do tour

```bash
npm run video:render
```

Capítulos, tempos e legendas ficam **só** em `content/tour.ts`, que o vídeo, o `tour.vtt` e a home leem. O render abre cada tela da conta demo, rola até a seção, grava quadro a quadro com a legenda e o título do capítulo e gera `public/video/tour.mp4`, `tour.webm`, `tour-poster.webp` e `tour.vtt`. Falha se passar de 8 MB. Sem rebuild: `VIDEO_SEM_BUILD=1 npm run video:render`. O teste `testes/tour-m12.test.js` acusa `.vtt` diferente da configuração.

## Editar a copy da home

A copy está em `content/home.pt-BR.ts`, separada do HTML. O `npm run build` roda `scripts/gera-home.mjs`, que monta `dist/index.html` (a home) e move o app para `dist/app.html`. Para ver localmente:

```bash
npm run build
npm run e2e        # sobe o dist/ como a Vercel e confere a home
```

Regras de tom: títulos em frase completa com ponto final; nada que o Bullz não faça hoje (ver D-026 em `docs/decisoes.md`). A imagem de compartilhamento é `public/og-home.png` (1200×630).

## Conta demo num Supabase de desenvolvimento

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_EMAIL=... DEMO_SENHA=... npm run seed:demo
```

Idempotente (upsert pelos ids fixos). Recusa a URL de produção.
