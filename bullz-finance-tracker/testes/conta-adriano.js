/* Fixture com os números que o plano de evolução cita da conta do Adriano
 * (carteira de nov/2026, renda, despesas e o gado). SÓ PARA TESTE dos
 * critérios de aceite (M7, M8): nunca entra no seed demo (M11), que tem um
 * teste que recusa estes valores. Os tickers são os que a fixture de
 * mercado cota (testes/mcp-fixture.js); quantidades fecham os valores. */
const { baseDemo } = require("./mcp-fixture.js");

const VALORES = { rf: 1493, acoes: 1500, fii: 405, cripto: 7112 };

function contaAdriano() {
  const db = baseDemo();
  const u = (n) => "00000000-0000-4000-a000-" + String(n).padStart(12, "0");
  db.ativos = [
    { id: 1, ticker: "ITSA4", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: VALORES.acoes / 10.42, preco_medio: 9.5, criado_em: "2026-06-01" },
    { id: 2, ticker: "MXRF11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: VALORES.fii / 9.68, preco_medio: 9.6, criado_em: "2026-06-01" },
    { id: 3, ticker: "BTC", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: VALORES.cripto / 612000, preco_medio: 500000, criado_em: "2026-06-01" },
  ];
  db.aportes = [];
  db.renda_fixa = [{ id: 11, nome: "CDB Liquidez", tipo: "cdi", taxa: 100, vencimento: null, valor_aplicado: VALORES.rf, valor_atual: VALORES.rf,
    valor_atual_em: new Date().toISOString().slice(0, 10), pilar: "caixa", criado_em: "2026-06-01" }];
  db.ganhos = [
    { id: u(1), nome: "Estágio", categoria: "salario", tipo: "recorrente", valor: 2300, inicio: "2026-03-01", fim: null, data_fim_contrato: "2026-11-23",
      proporcional: true, pagamento_mes_seguinte: true, observacao: "", dia_regra: null, dia_numero: null },
    { id: u(2), nome: "PJ", categoria: "pj", regime: "mei", tipo: "recorrente", valor: 4500, inicio: "2026-11-24", fim: null,
      proporcional: true, pagamento_mes_seguinte: true, observacao: "", dia_regra: null, dia_numero: null },
    { id: u(3), nome: "Vaga de garagem", categoria: "aluguel", tipo: "recorrente", valor: 280, inicio: "2026-03-10", fim: null, observacao: "", dia_regra: null, dia_numero: null },
  ];
  db.despesas = [{ id: u(10), data: "2026-08-01", categoria: "moradia", descricao: "custo de vida", valor: 1500, recorrente: true, fim: null }];
  db.parametros_fiscais = [
    { id: 1, chave: "das_mei_servicos", valor: 86.05, vigencia_inicio: "2026-01-01", vigencia_fim: null, fonte: "fixture" },
    { id: 2, chave: "funrural_pf_aliquota", valor: 1.5, vigencia_inicio: "2018-01-01", vigencia_fim: null, fonte: "fixture" },
    { id: 3, chave: "ir_rural_presuncao_pct", valor: 20, vigencia_inicio: "1990-01-01", vigencia_fim: null, fonte: "fixture" },
    { id: 4, chave: "ir_rural_aliquota_padrao", valor: 27.5, vigencia_inicio: "2015-01-01", vigencia_fim: null, fonte: "fixture" },
  ];
  db.potes = [["reserva_emergencia", "Reserva de emergência"], ["oportunidade", "Oportunidade"], ["oportunidade_agro", "Oportunidade do agro"], ["ir_a_pagar", "IR a pagar"], ["livre", "Livre"]]
    .map(([tipo, nome], i) => ({ id: u(20 + i), user_id: "u-demo", nome, tipo, meta_valor: null, criado_em: "2026-01-01" }));
  db.potes_movimentos = [];
  db.renda_fixa[0].pote_id = u(20);
  db.agro_movimentos = [{ id: u(30), data: "2026-05-10", tipo: "compra", categoria: "boi_magro", categoria_destino: null, cabecas: 6, peso_medio_kg: null,
    preco_arroba: null, preco_cabeca: 2580, valor_total: 15480, despesas: 0, reinvestido: null, fazenda: null, lote: null, contraparte: null, observacao: "", criado_em: "2026-05-10" }];
  db.agro_custos = []; db.agro_pesagens = [];
  db.patrimonio_historico = [];
  db.preferencias = [{ user_id: "u-demo", alocacao_alvo: { caixa: 60, acoes: 25, real_estate: 5, alternativos: 10 },
    premissas: { objetivos: { custo_vida_mensal: 1500, meses_reserva: 6 } }, regras: null, renda: null, agro: { avaliar_pelo_custo: true }, modulos: null,
    plano: { modo: "fixo_mais_sobra", valor_fixo: 2000, destinos: [], destino_proventos: "mesmo_ativo" },
    hierarquia: { modo_alocacao: "hierarquia" } }];
  return db;
}

module.exports = { contaAdriano, VALORES };
