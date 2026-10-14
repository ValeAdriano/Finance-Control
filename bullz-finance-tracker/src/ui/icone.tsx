/* Ícone — o mesmo desenho do FC.icone do site, agora com react-native-svg.
 *
 * O site faz:
 *   <svg width viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
 *     {P[nome]}
 *   </svg>
 *
 * Aqui montamos exatamente esse SVG (os corpos vêm de icones.gen.ts, gerado de
 * util.js) e desenhamos com SvgXml. `cor` entra no lugar de `currentColor` para
 * herdar a cor do texto do tema; o padrão usa o token de tinta atual. */
import React from "react";
import { SvgXml } from "react-native-svg";
import { ICONES, type NomeIcone } from "./icones.gen";
import { useTema } from "../tema";

export type { NomeIcone };

export interface IconeProps {
  nome: NomeIcone;
  tam?: number;
  cor?: string;
}

export function Icone({ nome, tam = 20, cor }: IconeProps) {
  const tema = useTema();
  const traco = cor ?? tema.cores.ink;
  const corpo = ICONES[nome] ?? "";
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${traco}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
    corpo +
    `</svg>`;
  return <SvgXml xml={xml} width={tam} height={tam} />;
}

export default Icone;
