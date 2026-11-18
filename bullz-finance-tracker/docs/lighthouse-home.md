# Lighthouse da home pública (Marco 13)

Lighthouse 12.1.0, perfil **celular** (emulação padrão: Moto G Power, 4G lento, CPU 4×), Chromium headless, contra o `dist/` servido como a Vercel serve (`testes/e2e/servidor-vercel.mjs`: arquivo primeiro, `cleanUrls`, rewrite para `/app` e a CSP do `vercel.json`). 2026-11-18.

| rodada | Performance | Acessibilidade | Boas práticas | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| 1 | 100 | 100 | 100 | 100 | 1,8 s | 40 ms | 0 |
| 2 | 100 | 100 | 100 | 100 | 1,9 s | 60 ms | 0 |

Metas do plano: Performance ≥ 90, Acessibilidade ≥ 95, SEO ≥ 95. Atingidas.

Primeira rodada antes dos ajustes: Performance 94, SEO 92 (faltava `robots.txt`: o rewrite devolvia o HTML do app) e um aviso de acessibilidade (o `aria-label` dos capítulos não continha o texto visível). Os dois foram corrigidos.

Por que é leve: a home é HTML estático gerado no build (23 KB), sem o bundle do app (4,4 MB), CSS no próprio arquivo, fontes do sistema, dois scripts pequenos (`/home-sessao.js` e `/home.js`), vídeos com `preload="none"` tocados só quando aparecem, imagens com `loading="lazy"` e dimensões fixas (CLS 0).

Para repetir:

```bash
npm run build
node -e 'import("./testes/e2e/servidor-vercel.mjs").then(async m=>{const s=await m.sobe(process.cwd()+"/dist",process.cwd()+"/vercel.json");console.log(s.url)})'
npx lighthouse http://127.0.0.1:<porta>/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo
```
