# Bullz (Finance Control)

Painel pessoal de investimentos e agronegócio.

| pasta | o que é |
|---|---|
| [`bullz-finance-tracker/`](bullz-finance-tracker/README.md) | **o app principal**: Expo/React Native para web (Vercel), Android e iOS. Como rodar, gerar o APK e publicar na Vercel está no README dele. |
| [`investimentos-compartilhar/`](investimentos-compartilhar/README.md) | o site original em HTML/CSS/JS puros, **mantido como backup**. Continua sendo a fonte dos cálculos (`assets/js/`), que o app carrega sem reescrever; o banco (`supabase/`) é o mesmo. |

Mudou uma regra de cálculo? Mude em `investimentos-compartilhar/assets/js/` e rode
`npm test` em `bullz-finance-tracker/` para conferir que o app continua igual.
