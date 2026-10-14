/* ESLint 9 (flat) — base do Expo. Ferramentas e arquivos gerados ficam fora.
 * As regras do React Compiler ficam desligadas: o app não usa o compilador e
 * elas acusam padrões válidos do RN (useRef(new Animated.Value()).current) e o
 * estado de tela que, como no site, vive no módulo entre uma visita e outra. */
const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  { ignores: ["ferramentas/**", "src/ui/icones.gen.ts", "node_modules/**", "dist/**", ".expo/**", "testes/**", "scripts/**",
    // o motor do palco roda dentro da WebView/iframe, em JS de navegador (ES5, var), e os gerados
    "public/**", "src/recap/motor*.js", "src/recap/palco.gen.ts", "src/telas/guias.gen.ts"] },
  {
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/globals": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/immutability": "off",
      "@typescript-eslint/array-type": "off",
      "import/no-named-as-default": "off",
    },
  },
];
