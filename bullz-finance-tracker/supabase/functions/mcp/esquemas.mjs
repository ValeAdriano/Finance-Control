/* O que cada tabela aceita pelo MCP, espelhando os `check` do
 * supabase/schema.sql. O banco continua sendo quem garante; isto existe para
 * a IA receber um erro legível ("pilar: esperado acoes | real_estate | …")
 * em vez de uma violação de constraint. Mudou um `check` lá? Mude aqui
 * (testes/mcp.test.js compara as listas com o schema).
 *
 * Sem imports: o `z` (zod) vem de quem chama, para o mesmo arquivo servir na
 * Edge Function (Deno) e nos testes (Node). */

export const CLASSES = ["acao_br", "etf_br", "fii", "acao_us", "etf_us", "cripto"];
export const PILARES = ["acoes", "real_estate", "alternativos", "caixa"];
export const LISTAS = ["carteira", "watchlist"];
export const TIPOS_RF = ["cdi", "selic", "ipca", "prefixado"];
export const INDEXADORES = ["cdi", "selic", "ipca", "prefixado"];
export const CATEGORIAS_GANHO = ["salario", "extra", "bonus", "decimo_terceiro", "ferias", "aluguel", "pro_labore", "outros"];
export const TIPOS_GANHO = ["recorrente", "avulso"];
export const REGRAS_DIA = ["dia_fixo", "dia_util", "ultimo_dia_util"];
export const TIPOS_MOV = ["compra", "venda", "nascimento", "morte", "entrada", "saida", "reclassificacao", "troca"];
export const CATEGORIAS_GADO = ["bezerro", "bezerra", "garrote", "novilha", "boi_magro", "boi_gordo", "vaca", "touro", "outro"];
export const CATEGORIAS_CUSTO = ["nutricao", "sanidade", "mao_de_obra", "arrendamento", "frete", "maquinas", "impostos", "outros"];

/** tabelas que `editar_registro` e `apagar_registro` alcançam (e mais nenhuma) */
export const TABELAS = ["aportes", "ativos", "renda_fixa", "ganhos", "agro_movimentos", "agro_custos", "agro_pesagens", "agro_lotes"];

export function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** peças reutilizadas pelos schemas das ferramentas */
export function pecas(z) {
  const data = z.string().refine(dataValida, "data no formato AAAA-MM-DD").describe("data, AAAA-MM-DD");
  const positivo = z.number().positive();
  const naoNegativo = z.number().min(0);
  const ticker = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, "código de 2 a 20 letras e números")
    .describe("código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC");
  const texto = (max) => z.string().trim().max(max);
  return { data, positivo, naoNegativo, ticker, texto };
}

/** campos editáveis de cada tabela (todos opcionais em `editar_registro`) */
export function camposPorTabela(z) {
  const { data, positivo, naoNegativo, ticker, texto } = pecas(z);
  const gado = z.enum(CATEGORIAS_GADO);
  return {
    aportes: {
      data, ticker: ticker.nullable(),
      quantidade: z.number().nullable().describe("negativa numa venda"),
      preco: positivo.nullable(), valor: z.number().describe("negativo numa venda ou num resgate"),
      titulo: texto(80).nullable(), observacao: texto(160),
      indexador: z.enum(INDEXADORES).nullable(), taxa: z.number().nullable(),
    },
    ativos: {
      ticker, classe: z.enum(CLASSES), pilar: z.enum(PILARES), lista: z.enum(LISTAS),
      quantidade: naoNegativo.describe("posição inicial, fora dos lançamentos"),
      preco_medio: positivo.nullable(), data_base: data.nullable(),
    },
    renda_fixa: {
      nome: texto(80).min(1), tipo: z.enum(TIPOS_RF),
      taxa: z.number().nullable().describe("cdi e selic: % do índice · ipca: juro real ao ano · prefixado: % ao ano"),
      vencimento: data.nullable(), valor_aplicado: naoNegativo, pilar: z.enum(PILARES), data_inicio: data.nullable(),
      valor_atual: naoNegativo.nullable().describe("saldo informado à mão, se houver"), valor_atual_em: data.nullable(),
      pote_id: z.string().uuid().nullable().describe("pote do título (listar_potes); nulo = livre"),
    },
    ganhos: {
      nome: texto(80).min(1), categoria: z.enum(CATEGORIAS_GANHO), tipo: z.enum(TIPOS_GANHO),
      valor: positivo.describe("líquido, o que cai na conta"),
      inicio: data.describe("avulso: a data do recebimento"), fim: data.nullable(), observacao: texto(160),
      dia_regra: z.enum(REGRAS_DIA).nullable(), dia_numero: z.number().int().min(1).max(31).nullable(),
      data_fim_contrato: data.nullable(), data_ultimo_pagamento: data.nullable(),
    },
    agro_movimentos: {
      data, tipo: z.enum(TIPOS_MOV), categoria: gado, categoria_destino: gado.nullable(),
      cabecas: z.number().int().positive(), peso_medio_kg: positivo.nullable(),
      preco_arroba: naoNegativo.nullable(), preco_cabeca: naoNegativo.nullable(),
      valor_total: naoNegativo, despesas: naoNegativo, reinvestido: naoNegativo.nullable(),
      fazenda: texto(80).nullable(), lote: texto(80).nullable(), contraparte: texto(80).nullable(), observacao: texto(240),
      lote_id: z.string().uuid().nullable(), lote_entrada_id: z.string().uuid().nullable(),
      cabecas_saida: z.number().int().positive().nullable(), cabecas_entrada: z.number().int().positive().nullable(),
      valor_referencia_saida: naoNegativo.nullable(), valor_referencia_entrada: naoNegativo.nullable(),
    },
    agro_custos: {
      data, categoria: z.enum(CATEGORIAS_CUSTO), descricao: texto(160), valor: positivo,
      fazenda: texto(80).nullable(), lote: texto(80).nullable(), lote_id: z.string().uuid().nullable(),
    },
    agro_lotes: {
      nome: texto(80).min(1), valor_estimado_cabeca: naoNegativo.nullable(), data_estimativa: data.nullable(),
      custos_inclusos_no_preco: z.boolean(), data_prevista: data.nullable(), cabecas_previstas: z.number().int().positive().nullable(),
      preco_esperado_cabeca: naoNegativo.nullable(), destino_planejado: texto(80).nullable(), observacao: texto(160),
    },
    agro_pesagens: {
      data, categoria: gado, lote: texto(80).nullable(), fazenda: texto(80).nullable(),
      cabecas: z.number().int().positive(), peso_medio_kg: positivo, observacao: texto(160),
    },
  };
}
