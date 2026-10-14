/* Pontos de quebra do app.css: ≤1100 vira celular (barra de abas embaixo, menu
 * do topo some), ≤640 é a tela estreita (folha sobe de baixo, grades viram uma
 * coluna, paddings menores). */
import { useWindowDimensions } from "react-native";

export interface Medidas {
  largura: number;
  altura: number;
  /** ≤ 1100: barra de abas embaixo */
  celular: boolean;
  /** ≤ 640: folha de baixo, grade de 1 coluna */
  estreito: boolean;
  /** ≤ 1240: abas do topo mais apertadas */
  medio: boolean;
}

export function useMedidas(): Medidas {
  const { width, height } = useWindowDimensions();
  return { largura: width, altura: height, celular: width <= 1100, estreito: width <= 640, medio: width <= 1240 };
}
