/* O tour do Bullz (Marco 12): capítulos, tempos e legendas num lugar só.
 * Quem lê: o render do vídeo (scripts/video-tour.mjs), o arquivo .vtt e a
 * home pública (marcadores clicáveis, Marco 13). Mudou um tempo ou uma
 * frase? Rode `npm run video:render` e o vídeo acompanha. */
export interface Capitulo {
  inicio: number;        // segundos
  titulo: string;
  legenda: string;
  rota: string;          // tela do app com a conta demo
  alvo?: string;         // seção até onde rolar (texto do título)
}

export const capitulos: Capitulo[] = [
  { inicio: 0, titulo: "Tudo num lugar", legenda: "Renda fixa, ações, cripto e o gado, somados num número só.", rota: "/inicio" },
  { inicio: 5, titulo: "O plano do mês", legenda: "O plano sai pronto: quanto investir, onde, e o que já foi feito.", rota: "/salario", alvo: "Plano de cada mês" },
  { inicio: 11, titulo: "A ordem certa", legenda: "Renda fixa, depois ações, depois cripto. O Bullz avisa quando a ordem quebra.", rota: "/salario", alvo: "A ordem certa" },
  { inicio: 17, titulo: "Para onde vai", legenda: "Mês a mês, em três cenários: histórico, só proventos e estresse.", rota: "/projecoes", alvo: "Mês a mês" },
  { inicio: 23, titulo: "O campo também conta", legenda: "Cada lote do gado com custo, troca e venda planejada.", rota: "/agro", alvo: "Por lote" },
  { inicio: 29, titulo: "Trocar sem bagunçar", legenda: "Potes com finalidade. Trocar um ativo por outro não vira aporte.", rota: "/potes" },
  { inicio: 35, titulo: "Avisa na hora", legenda: "Alerta quando o preço volta ao seu preço médio, e revisões na data marcada.", rota: "/alertas" },
];

export const duracao = 41;   // segundos (o último capítulo vai até aqui)

export const arquivos = {
  mp4: "/video/tour.mp4",
  webm: "/video/tour.webm",
  poster: "/video/tour-poster.webp",
  vtt: "/video/tour.vtt",
};
