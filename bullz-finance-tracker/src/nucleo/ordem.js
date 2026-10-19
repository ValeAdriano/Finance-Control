/* Ordem de carga do núcleo (nucleo/): cálculo, dados e utilidades, na ordem
 * em que um arquivo depende do outro. É a mesma dos requires literais de
 * src/nucleo/index.ts (há um teste de paridade que compara as duas).
 *
 * Exceções, carregadas à parte em src/nucleo/index.ts só pela lógica pura:
 * promo/promo.js (FC.promo) e telas/admin.js (FC.admin). recap/* roda no
 * palco (src/recap). */
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
