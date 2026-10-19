# Bullz (Finance Control)

Painel pessoal de investimentos e agronegócio.

O app é o [`bullz-finance-tracker/`](bullz-finance-tracker/README.md): Expo/React Native para web
(Vercel), Android e iOS. Como rodar, gerar o APK e publicar na Vercel está no README dele.

| pasta (dentro de `bullz-finance-tracker/`) | o que é |
|---|---|
| `nucleo/` | o núcleo de cálculo (carteira, rentabilidade, dividendos, caixa de proventos, IR, agro…), vindo do site original |
| `supabase/` | o banco: `schema.sql` e as Edge Functions |
| `src/` | as telas e a plataforma do app |

Mudou uma regra de cálculo? Mude em `bullz-finance-tracker/nucleo/` e rode `npm test` lá.

O site original em HTML/CSS/JS puros (`investimentos-compartilhar/`) foi removido em 2026-10-19;
continua no histórico do git.
