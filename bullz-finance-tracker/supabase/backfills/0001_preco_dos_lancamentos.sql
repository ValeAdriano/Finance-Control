-- Backfill idempotente (Marco 1): lançamento de compra ou venda sem preço
-- por cota, mas com valor e quantidade, ganha preco = |valor| ÷ |quantidade|.
-- Rodar duas vezes dá o mesmo resultado: só toca linhas com preco nulo.
-- O app já calcula assim (FC.carteira.precoDoLancamento); o backfill só
-- deixa o banco igual ao que a tela mostra.
update public.aportes
   set preco = abs(valor) / abs(quantidade)
 where tipo = 'ativo'
   and preco is null
   and quantidade is not null and quantidade <> 0
   and valor <> 0;
