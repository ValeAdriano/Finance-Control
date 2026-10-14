# Bulls Finance Tracker (React Native)

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

Fase atual: **F0 · Inventário e linha de base**. Ainda não há código do app.
