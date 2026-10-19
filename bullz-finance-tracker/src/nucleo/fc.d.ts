/* Tipos do `FC` — a superfície do núcleo compartilhado.
 *
 * Tipagem pragmática: os namespaces de cálculo são declarados com nomes
 * reais (para autocompletar) e assinaturas amplas, já que a regra de negócio
 * vive no JS do site, não aqui. Conforme cada tela for migrada, os tipos de
 * entrada/saída de cada função podem ser apertados sem quebrar nada.
 *
 * Um teste de paridade (testes/paridade.test.js, caso N1) garante que o
 * conjunto de chaves reais do FC bate com a superfície registrada em
 * testes/superficie-esperada.json. */

export type Qualquer = any;
type Fn = (...args: Qualquer[]) => Qualquer;
type Ns = Record<string, Fn | Qualquer>;

export interface FC {
  // utilidades (util.js)
  html: Fn; cru: Fn; escapa: Fn; fmt: Ns; datas: Ns;
  icone: Fn; logo: Fn; foguinho: Fn; pilula: Fn; ponto: Fn;
  $: Fn; $$: Fn; ui: Ns; animar: Fn; anel: Fn; local: Ns;
  aplicaTema: Fn; infoTitulo: Fn; dadosDoForm: Fn; lerNum: Fn;
  mescla: Fn; ok: (v: unknown) => boolean; unidade: Fn;

  // padrões e constantes (padroes.js)
  PERFIL: Qualquer; CLASSES: Qualquer; CLASSE_ROTULO: Qualquer; ROTULO_CURTO: Qualquer;
  PILARES: Qualquer; PILAR_NOME: Qualquer; MODULOS: Qualquer; TIPOS_MOV: Qualquer;
  VEREDITO_CURTO: Qualquer; LAYOUT_INICIO: Qualquer;
  PADRAO_ALOCACAO: Qualquer; PADRAO_OBJETIVOS: Qualquer; PADRAO_PLANO: Qualquer;
  PADRAO_PREMISSAS: Qualquer; PADRAO_REGRAS: Qualquer; PADRAO_RENDA: Qualquer; PADRAO_AGRO: Qualquer; PADRAO_PROVENTOS: Qualquer;
  CATEGORIAS_CUSTO: Qualquer; CATEGORIAS_GADO: Qualquer; CATEGORIAS_GANHO: Qualquer;
  PESO_TIPICO: Qualquer; RECAP_MOCK: Qualquer; RECAP_ANO_MOCK: Qualquer;
  objetivos: Fn; modulo: Fn; resolveModulos: Fn; classesLigadas: Fn;
  pilaresLigados: Fn; rotaLigada: Fn; ehFinanceira: Fn;

  // layout (layout.js)
  layout: Ns;

  // modelos de cálculo (modelo/*)
  avaliador: Ns; agro: Ns; rentab: Ns; carteira: Ns; perfil: Ns; recomendacao: Ns;
  renda: Ns; projecao: Ns; importador: Ns; dividendos: Ns; caixaProventos: Ns; desempenho: Ns; impostos: Ns;
  alertas: Ns; salario: Ns; recap: Ns; graham: Fn;

  // supabase/config (config.js, supa.js) — superfície livre
  config: { supabaseUrl: string; supabaseChave: string };

  [extra: string]: Qualquer;
}
