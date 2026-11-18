/* As telas que `npm run capturas` grava em public/capturas/ (Marco 11).
 * `alvo`: texto na tela até onde rolar antes da captura (sem ele, o topo).
 * Cada tela sai em desktop e celular, tema claro e escuro, em WebP. */
export interface Tela { nome: string; rota: string; alvo?: string; descricao: string }

const telas: Tela[] = [
  { nome: "inicio", rota: "/inicio", descricao: "home do app" },
  { nome: "plano-mensal", rota: "/salario", alvo: "Plano de cada mês", descricao: "plano do mês: meta × executado" },
  { nome: "salarios-linha-do-tempo", rota: "/salario", alvo: "Seu plano", descricao: "linha do tempo de salários e planos" },
  { nome: "hierarquia", rota: "/salario", alvo: "A ordem certa", descricao: "alocação e hierarquia RF › Ações › Cripto" },
  { nome: "projecao", rota: "/projecoes", alvo: "Mês a mês", descricao: "projeção mês a mês com cenários" },
  { nome: "agro-lotes", rota: "/agro", alvo: "Por lote", descricao: "agro por lote, troca e venda planejada" },
  { nome: "potes", rota: "/potes", descricao: "potes com finalidade" },
  { nome: "alertas", rota: "/alertas", descricao: "alertas de preço e revisões" },
  { nome: "posicoes", rota: "/ativos", descricao: "posições" },
];

export const tamanhos = [
  { nome: "desktop", largura: 1440, altura: 900 },
  { nome: "celular", largura: 390, altura: 844 },
];
export const temas = ["claro", "escuro"] as const;
export default telas;
