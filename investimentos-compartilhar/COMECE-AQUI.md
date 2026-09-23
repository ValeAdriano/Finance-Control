# Comece aqui

## Abrir

Dê dois cliques no **`index.html`**. Não há servidor para ligar: o
app roda no navegador e guarda tudo no Supabase.

No primeiro acesso aparece **Criar conta**. Essa conta vira a dona do
painel, e depois dela o banco recusa qualquer outro cadastro.

## Usar

| aba | para quê |
|---|---|
| Início | patrimônio, alocação por pilar, evolução e proventos |
| Investimentos | cadastrar ações, FIIs, ETFs, cripto e renda fixa; o score de cada um pelas 4 lentes |
| Agro | rebanho: compras, vendas, nascimentos, mortes, mudança de categoria, custos, pesagens |
| Aportes | compras, vendas, proventos; importar extrato (corretora, C6, PicPay) |
| Renda | empresas de setores perenes pelos seus critérios |
| Simular | montar uma cesta e ver o efeito na alocação |
| Projeções | patrimônio e renda futuros, em moeda de hoje |
| Ajustes | senha, verificação em duas etapas, metas, regras, backup |

**Agro, primeiro passo:** se o gado já existe, lance o estoque inicial
em *Lançamento → Outra entrada* (com o valor, se quiser que entre no
investido). Depois ajuste o preço da arroba em *Cotação*.

## Segurança

- Senha guardada pelo Supabase Auth só como hash bcrypt; tráfego HTTPS.
- Verificação em duas etapas opcional (Ajustes).
- Row Level Security em todas as tabelas: o banco só entrega a linha a
  quem é dono dela. A chave que está em `assets/js/config.js` é a
  publicável, feita para ficar no navegador.
- Dono único: um gatilho no banco recusa um segundo cadastro.

## Publicar na internet (opcional)

A pasta é um site estático. Suba-a para Vercel, Netlify, Cloudflare
Pages ou GitHub Pages e abra de qualquer lugar, inclusive no celular
(dá para "Adicionar à tela de início").
