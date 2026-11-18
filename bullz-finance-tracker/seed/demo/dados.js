/* Conta demo do Bullz: dados FICTÍCIOS que exercitam todas as funcionalidades
 * (Marco 11). Usada por:
 *   - scripts/seed-demo.js  (npm run seed:demo) → grava num Supabase de dev;
 *   - o modo ?fixture=demo do app (src/plataforma/fixture.ts) → capturas de
 *     tela e vídeo, sem rede.
 *
 * Regras: valores redondos, nomes genéricos onde não é ativo de mercado,
 * nenhum dado real (testes/demo-m11.test.js recusa os números da conta real).
 * Datas relativas a `hoje`, para a conta nunca envelhecer. Ids fixos: rodar
 * o seed de novo atualiza as mesmas linhas, não duplica. */

const ID = (n) => "d0000000-0000-4000-8000-" + String(n).padStart(12, "0");

function datas(hoje) {
  const base = new Date(hoje + "T12:00:00Z");
  const dia = (n) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const mes = (n) => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1)); return d.toISOString().slice(0, 7); };
  return { dia, mes };
}

/** todas as tabelas da conta demo; `uid` é o dono das linhas */
function montaDemo({ hoje = new Date().toISOString().slice(0, 10), uid = "demo" } = {}) {
  const { dia, mes } = datas(hoje);
  const d = (m, dd) => `${mes(m)}-${String(dd).padStart(2, "0")}`;
  const dono = (l) => l.map((x) => ({ user_id: uid, ...x }));

  // ------------------------------------------------------------ carteira
  const ativos = [
    { id: 1, ticker: "ITSA4", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 2, ticker: "TAEE11", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 3, ticker: "MXRF11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 4, ticker: "HGLG11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 5, ticker: "BTC", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 6, ticker: "ETH", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 7, ticker: "WEGE3", classe: "acao_br", pilar: "acoes", lista: "watchlist", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-90) },
  ];
  const potes = [
    { id: ID(101), nome: "Reserva de emergência", tipo: "reserva_emergencia", meta_valor: null, criado_em: dia(-400) },
    { id: ID(102), nome: "Oportunidade", tipo: "oportunidade", meta_valor: 10000, criado_em: dia(-400) },
    { id: ID(103), nome: "Oportunidade do agro", tipo: "oportunidade_agro", meta_valor: null, criado_em: dia(-400) },
    { id: ID(104), nome: "IR a pagar", tipo: "ir_a_pagar", meta_valor: null, criado_em: dia(-400) },
    { id: ID(105), nome: "Livre", tipo: "livre", meta_valor: null, criado_em: dia(-400) },
  ];
  const renda_fixa = [
    { id: 11, nome: "CDB Liquidez Diária", tipo: "cdi", taxa: 100, vencimento: null, valor_aplicado: 20000, pilar: "caixa", data_inicio: dia(-400), criado_em: dia(-400), pote_id: ID(101) },
    { id: 12, nome: "Tesouro Selic 2029", tipo: "selic", taxa: 100, vencimento: "2029-03-01", valor_aplicado: 8000, pilar: "caixa", data_inicio: dia(-300), criado_em: dia(-300), pote_id: ID(102) },
    { id: 13, nome: "LCI Banco Exemplo", tipo: "cdi", taxa: 90, vencimento: dia(365), valor_aplicado: 5000, pilar: "caixa", data_inicio: dia(-200), criado_em: dia(-200), pote_id: null },
  ];

  let n = 200;
  const aportes = [];
  const lanca = (campos) => aportes.push({ id: ID(++n), ticker: null, quantidade: null, preco: null, titulo: null, observacao: "", origem: null,
    historico: false, venda: false, indexador: null, taxa: null, criado_em: campos.data, movimento_interno_id: null, plano_mensal_id: null, destino_idx: null, ...campos });
  const compra = (data, ticker, q, preco) => lanca({ tipo: "ativo", data, ticker, quantidade: q, preco, valor: Math.round(q * preco * 100) / 100 });
  // compras antigas (formam as posições)
  compra(dia(-480), "ITSA4", 600, 9);
  compra(dia(-470), "TAEE11", 100, 32);
  compra(dia(-460), "MXRF11", 600, 10);
  compra(dia(-450), "HGLG11", 20, 150);
  compra(dia(-440), "BTC", 0.03, 400000);
  compra(dia(-430), "ETH", 0.5, 25000);          // no prejuízo: alerta de empate
  // proventos recebidos
  for (let m = -6; m <= -1; m++) {
    lanca({ tipo: "provento", data: d(m, 15), ticker: "MXRF11", valor: 60 });
    if (m % 3 === 0) lanca({ tipo: "provento", data: d(m, 20), ticker: "TAEE11", valor: 90 });
  }
  // os três meses fechados e o atual: aportes conforme o plano de cada mês
  const MESES = [-3, -2, -1, 0];
  for (const m of MESES) {
    if (m === 0 && Number(hoje.slice(8, 10)) < 6) continue;
    lanca({ tipo: "caixa", data: d(m, 5), titulo: "CDB Liquidez Diária", valor: 2000 });
    compra(d(m, 6), "ITSA4", 100, 10);
    if (m !== -2) compra(d(m, 6), "MXRF11", 50, 10);
    compra(d(m, 7), "BTC", 0.0005, 600000);
  }

  // ------------------------------------------------------------ movimento interno (cripto → RF)
  const movimentos_internos = [{ id: ID(301), data: d(-2, 18), origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.005, origem_preco: 600000,
    destino_tipo: "titulo_rf", destino_id: "Tesouro Selic 2029", destino_quantidade: null, destino_preco: null, custos: { taxa: 20 }, observacao: "realocação de exemplo", criado_em: d(-2, 18) }];
  lanca({ tipo: "ativo", data: d(-2, 18), ticker: "BTC", quantidade: -0.005, preco: 600000, valor: -3000, venda: true, observacao: "movimento interno → Tesouro Selic 2029", movimento_interno_id: ID(301) });
  lanca({ tipo: "caixa", data: d(-2, 18), titulo: "Tesouro Selic 2029", valor: 2980, observacao: "movimento interno ← BTC", movimento_interno_id: ID(301) });

  // ------------------------------------------------------------ potes: IR separado da venda do gado
  const potes_movimentos = [
    { id: ID(401), pote_id: ID(103), data: d(-1, 12), valor: 9850, descricao: "venda do gado", transferencia_id: null, movimento_interno_id: ID(302) },
    { id: ID(402), pote_id: ID(103), data: d(-1, 12), valor: -550, descricao: "IR estimado da venda do gado", transferencia_id: ID(403), movimento_interno_id: null },
    { id: ID(404), pote_id: ID(104), data: d(-1, 12), valor: 550, descricao: "IR estimado da venda do gado", transferencia_id: ID(403), movimento_interno_id: null },
  ];
  movimentos_internos.push({ id: ID(302), data: d(-1, 12), origem_tipo: "agro_lote", origem_id: "Lote Primavera", origem_quantidade: 2, origem_preco: 5000,
    destino_tipo: "pote", destino_id: ID(103), destino_quantidade: null, destino_preco: null, custos: { impostos: 150 }, observacao: "venda do gado → Oportunidade do agro", criado_em: d(-1, 12) });

  // ------------------------------------------------------------ agro: lote, troca e venda planejada
  const agro_lotes = [
    { id: ID(501), nome: "Lote Primavera", valor_estimado_cabeca: 3800, data_estimativa: dia(-10), custos_inclusos_no_preco: true, data_prevista: null, cabecas_previstas: null,
      preco_esperado_cabeca: null, destino_planejado: null, observacao: "", criado_em: dia(-300) },
    { id: ID(502), nome: "Lote da troca", valor_estimado_cabeca: null, data_estimativa: null, custos_inclusos_no_preco: false, data_prevista: d(3, 15), cabecas_previstas: 8,
      preco_esperado_cabeca: 4000, destino_planejado: "oportunidade_agro", observacao: "", criado_em: dia(-120) },
  ];
  const mov = (campos) => ({ categoria_destino: null, peso_medio_kg: null, preco_arroba: null, preco_cabeca: null, valor_total: 0, despesas: 0, reinvestido: null,
    fazenda: "Fazenda Exemplo", lote: null, contraparte: null, observacao: "", lote_entrada_id: null, cabecas_saida: null, cabecas_entrada: null,
    valor_referencia_saida: null, valor_referencia_entrada: null, movimento_interno_id: null, ...campos });
  const agro_movimentos = [
    mov({ id: ID(511), data: dia(-300), tipo: "compra", categoria: "bezerro", cabecas: 10, preco_cabeca: 3000, valor_total: 30000, lote_id: ID(501), criado_em: dia(-300) }),
    mov({ id: ID(512), data: dia(-120), tipo: "troca", categoria: "garrote", categoria_destino: "bezerro", cabecas: 5, cabecas_saida: 5, cabecas_entrada: 8,
      valor_referencia_saida: 20000, valor_referencia_entrada: 20000, lote_id: ID(501), lote_entrada_id: ID(502), criado_em: dia(-120) }),
    mov({ id: ID(513), data: d(-1, 12), tipo: "venda", categoria: "boi_gordo", cabecas: 2, preco_cabeca: 5000, valor_total: 10000, despesas: 150, lote_id: ID(501),
      movimento_interno_id: ID(302), contraparte: "Comprador Exemplo", criado_em: d(-1, 12) }),
  ];
  const agro_custos = [{ id: ID(521), data: dia(-60), categoria: "nutricao", descricao: "Sal mineral", valor: 1200, fazenda: "Fazenda Exemplo", lote: null, lote_id: ID(502), criado_em: dia(-60) }];

  // ------------------------------------------------------------ renda e despesas
  const ganhos = [
    { id: ID(601), nome: "Consultoria PJ", categoria: "pj", regime: "mei", tipo: "recorrente", valor: 10000, inicio: dia(-500).slice(0, 7) + "-05", fim: null,
      sem_13_ferias_fgts: true, proporcional: false, pagamento_mes_seguinte: false, observacao: "", dia_regra: "dia_util", dia_numero: 5 },
    { id: ID(602), nome: "Aluguel do apartamento", categoria: "aluguel", tipo: "recorrente", valor: 1500, inicio: dia(-500).slice(0, 7) + "-10", fim: null,
      proporcional: false, pagamento_mes_seguinte: false, observacao: "", dia_regra: "dia_fixo", dia_numero: 10 },
  ];
  const despesas = [
    { id: ID(701), data: d(-4, 1), categoria: "moradia", descricao: "Aluguel e condomínio", valor: 3000, recorrente: true, fim: null },
    { id: ID(702), data: d(-4, 1), categoria: "alimentacao", descricao: "Mercado", valor: 1500, recorrente: true, fim: null },
    ...[-3, -2, -1].map((m, i) => ({ id: ID(710 + i), data: d(m, 20), categoria: "contas", descricao: "Contas do mês", valor: 500, recorrente: false, fim: null })),
  ];

  // ------------------------------------------------------------ planos mensais: 3 fechados e 1 ativo
  const destinosCat = (meta) => [
    { tipo: "titulo_rf", alvo: "CDB Liquidez Diária", pct: 40, valor: meta * 0.4 },
    { tipo: "ativo", alvo: "ITSA4", pct: 20, valor: meta * 0.2 },
    { tipo: "ativo", alvo: "MXRF11", pct: 10, valor: meta * 0.1 },
    { tipo: "categoria", alvo: "cripto", pct: 6, valor: meta * 0.06 },
    { tipo: "categoria", alvo: "rf", pct: 24, valor: meta * 0.24 },
  ];
  const planos_mensais = MESES.map((m, i) => {
    const meta = 5000;
    const fechado = m < 0;
    const exec = [2000, 1000, m === -2 ? 0 : 500, 300, 0];
    const destinos = destinosCat(meta);
    return {
      id: ID(801 + i), mes: mes(m), status: fechado ? "fechado" : "ativo", origem: "gerado",
      renda_prevista: [{ ganho_id: ID(601), nome: "Consultoria PJ", valor: 10000, origem: "Consultoria PJ" }, { ganho_id: ID(602), nome: "Aluguel do apartamento", valor: 1500, origem: "Aluguel do apartamento" }],
      impostos_previstos: 80, despesas_previstas: 5000, modo: "fixo_mais_sobra", valor_fixo: 3000, sobra_prevista: 3420, meta_total: meta, destinos,
      regras_snapshot: { faixas: { rf: { min: 45, max: 70, piso: 40 }, acoes: { min: 22, max: 38 }, cripto: { min: 5, max: 17 } }, modo_alocacao: "hierarquia", aceitar_violacao: false, violacoes: [] },
      contexto: { mes_anterior: m === -1 ? ["no mês retrasado, ficou R$ 500,00 sem aportar em MXRF11"] : [], eventos: [], divisao: "plano do Salário" },
      ...(fechado ? {
        renda_real: 11500, impostos_reais: 80, despesas_reais: 5000, sobra_real: 3420,
        aportado_total: exec.reduce((s, v, k) => s + Math.min(v, destinos[k].valor), 0),
        execucao: destinos.map((x, k) => ({ idx: k, tipo: x.tipo, alvo: x.alvo, rotulo: x.tipo === "categoria" ? (x.alvo === "rf" ? "renda fixa" : x.alvo) : x.alvo,
          previsto: x.valor, aportado: exec[k], desvio: exec[k] - x.valor, cumprido: Math.min(exec[k], x.valor), aportes: [] })),
        fora_do_plano: [], fechado_em: d(m + 1, 1) + "T06:05:00Z",
      } : { renda_real: null, impostos_reais: null, despesas_reais: null, sobra_real: null, aportado_total: null, execucao: null, fora_do_plano: null, fechado_em: null }),
      observacao: "", criado_em: d(m, 1) + "T09:00:00Z", ativado_em: d(m, 1) + "T09:05:00Z",
    };
  });

  // ------------------------------------------------------------ alertas, revisões e eventos
  const alertas_preco = [
    { id: ID(901), ticker: "ETH", condicao: "empate", valor: null, ligado: true, ultimo_disparo: null, criado_em: dia(-30) },
    { id: ID(902), ticker: "BTC", condicao: "abaixo", valor: 500000, ligado: true, ultimo_disparo: null, criado_em: dia(-30) },
  ];
  const revisoes = [
    { id: ID(911), ticker: "ETH", tema: null, data: dia(0), pergunta: "A tese do ETH ainda vale com o preço abaixo do médio?", feita: false, criado_em: dia(-60) },
    { id: ID(912), ticker: null, tema: "Reserva de emergência", data: dia(45), pergunta: "Subir a reserva para 12 meses de custo de vida?", feita: false, criado_em: dia(-10) },
  ];
  const eventos_futuros = [{ id: ID(921), data: d(2, 10), tipo: "aporte_extra", parametros: { valor: 5000 }, descricao: "bônus de projeto", criado_em: dia(-5) }];

  // ------------------------------------------------------------ preferências
  const preferencias = [{
    user_id: uid,
    alocacao_alvo: { caixa: 55, acoes: 20, real_estate: 10, alternativos: 10, agro: 5 },
    premissas: { objetivos: { custo_vida_mensal: 5000, meses_reserva: 6 }, aporte_mensal_obsoleta: true },
    regras: null, renda: null, layout: null, modulos: null,
    agro: { avaliar_pelo_custo: true, usa_peso: false, ir_modo: "presuncao" },
    plano: { modo: "fixo_mais_sobra", valor_fixo: 3000, percentual: 30, valor: 0, destino_proventos: "mesmo_ativo", reinvestir_dividendos: true,
      destinos: [{ tipo: "renda_fixa", alvo: "CDB Liquidez Diária", pct: 40 }, { tipo: "pilar", alvo: "caixa", pct: 24 }, { tipo: "ativo", alvo: "ITSA4", pct: 20 },
        { tipo: "ativo", alvo: "MXRF11", pct: 10 }, { tipo: "pilar", alvo: "alternativos", pct: 6 }] },
    proventos: null,
    hierarquia: { modo_alocacao: "hierarquia", faixas: { rf: { min: 45, max: 70, piso: 40 }, acoes: { min: 22, max: 38 }, cripto: { min: 5, max: 17 } }, meses_reserva_pj: 12 },
  }];

  return {
    ativos: dono(ativos), renda_fixa: dono(renda_fixa), aportes: dono(aportes), potes: dono(potes), potes_movimentos: dono(potes_movimentos),
    movimentos_internos: dono(movimentos_internos), agro_lotes: dono(agro_lotes), agro_movimentos: dono(agro_movimentos), agro_custos: dono(agro_custos),
    agro_pesagens: [], ganhos: dono(ganhos), despesas: dono(despesas), planos_mensais: dono(planos_mensais), alertas_preco: dono(alertas_preco),
    revisoes: dono(revisoes), eventos_futuros: dono(eventos_futuros), preferencias, patrimonio_historico: [],
  };
}

/** a ordem de gravação (as chaves estrangeiras primeiro) */
const ORDEM = ["preferencias", "ativos", "potes", "renda_fixa", "movimentos_internos", "agro_lotes", "aportes", "potes_movimentos", "agro_movimentos",
  "agro_custos", "ganhos", "despesas", "planos_mensais", "alertas_preco", "revisoes", "eventos_futuros"];

/** grava a demo num cliente do Supabase (upsert pelo id: idempotente) */
async function semeia(cliente, uid, hoje) {
  const dados = montaDemo({ hoje, uid });
  const contagem = {};
  for (const t of ORDEM) {
    const linhas = dados[t];
    if (!linhas || !linhas.length) continue;
    const chave = t === "preferencias" ? "user_id" : t === "ativos" ? "user_id,ticker" : t === "renda_fixa" ? "user_id,nome" : "id";
    const sem = t === "ativos" || t === "renda_fixa" ? linhas.map(({ id, ...r }) => r) : linhas;
    const { error } = await cliente.from(t).upsert(sem, { onConflict: chave });
    if (error) throw new Error(`${t}: ${error.message}`);
    contagem[t] = linhas.length;
  }
  return contagem;
}

module.exports = { montaDemo, semeia, ORDEM, ID };
