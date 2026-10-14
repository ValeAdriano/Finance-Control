/* O Hermes (motor JS do Android/iOS) não compila `import()` com caminho
 * variável. O @zip.js/zip.js tem um, só para carregar codecs externos por URL
 * (opção `codecURI`), que o app não usa: os codecs que o importador precisa
 * já vêm no pacote. Este plugin troca esse `import(x)` por uma promessa
 * rejeitada com uma mensagem clara, e só nos arquivos do zip.js. */
module.exports = function ({ types: t }) {
  return {
    name: "sem-import-dinamico-zipjs",
    visitor: {
      CallExpression(path, state) {
        const arquivo = (state.filename || "").replace(/\\/g, "/");
        if (!arquivo.includes("/node_modules/@zip.js/zip.js/")) return;
        if (path.node.callee.type !== "Import") return;
        const arg = path.node.arguments[0];
        if (arg && arg.type === "StringLiteral") return;
        path.replaceWith(
          t.callExpression(t.memberExpression(t.identifier("Promise"), t.identifier("reject")), [
            t.newExpression(t.identifier("Error"), [t.stringLiteral("zip.js: codecs externos (codecURI) não são suportados no app")]),
          ]),
        );
      },
    },
  };
};
