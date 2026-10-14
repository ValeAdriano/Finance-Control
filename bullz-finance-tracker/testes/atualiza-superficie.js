/* Regrava testes/superficie-esperada.json a partir do núcleo atual.
 * Rode quando a mudança na superfície do FC for intencional e revisada.
 *   node testes/atualiza-superficie.js */
const fs = require("fs");
const path = require("path");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const chaves = Object.keys(FC).sort();
fs.writeFileSync(path.join(__dirname, "superficie-esperada.json"), JSON.stringify(chaves, null, 2) + "\n");
console.log("superficie-esperada.json:", chaves.length, "chaves");
