/* Metro — além do padrão do Expo, observa a pasta do site para o núcleo
 * compartilhado poder ser exigido por caminho relativo (src/nucleo/index.ts).
 * É o que o PLANO.md chama de `watchFolders → investimentos-compartilhar`. */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const SITE = path.resolve(__dirname, "..", "investimentos-compartilhar");
config.watchFolders = [...(config.watchFolders || []), SITE];

// permite resolver módulos a partir da raiz do app mesmo requerendo arquivos
// fora dela (os .js do site não são um pacote, são exigidos por caminho)
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
];

module.exports = config;
