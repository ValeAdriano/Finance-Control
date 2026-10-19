/* Ordem de carga do núcleo — a MESMA do index.html do site, só o que não é
 * tela (cálculo, dados e utilidades). Fonte única: se o index.html mudar, esta
 * lista muda junto (há um teste de paridade que compara as duas).
 *
 * NÃO entram aqui: telas (telas/*), recap/*, promo/*, uso.js e app.js — essas
 * tocam o DOM e são reescritas no app. Exceções, carregadas à parte em
 * src/nucleo/index.ts só pela lógica pura: promo/promo.js (FC.promo) e
 * telas/admin.js (FC.admin). recap/* roda no palco (src/recap). */
module.exports = [
  "config.js",
  "util.js",
  "padroes.js",
  "layout.js",
  "supa.js",
  "graficos.js",
  "modelo/avaliador.js",
  "modelo/agro.js",
  "modelo/rentabilidade.js",
  "modelo/carteira.js",
  "modelo/perfil.js",
  "modelo/recomendacao.js",
  "modelo/renda.js",
  "modelo/projecao.js",
  "modelo/importador.js",
  "modelo/dividendos.js",
  "modelo/caixa-proventos.js",
  "modelo/impostos.js",
  "modelo/alertas.js",
  "modelo/salario.js",
  "modelo/retrospectiva.js",
];
