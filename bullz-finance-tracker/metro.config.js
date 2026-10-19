/* Metro — o padrão do Expo. O núcleo de cálculo (nucleo/) fica dentro do
 * projeto e é exigido por caminho relativo (src/nucleo/index.ts). */
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
