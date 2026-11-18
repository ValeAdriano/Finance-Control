/* Conta de demonstração e Supabase de mentira para os testes do MCP.
 *
 * `supabaseFalso(db)` imita o pedaço do @supabase/supabase-js que o núcleo
 * usa (nucleo/supa.js): tabelas em memória com select/insert/update/delete/
 * upsert e a Edge Function "mercado" com dados sintéticos e determinísticos.
 * Nada aqui toca a rede. Os dados seguem a forma de src/plataforma/fixture.ts. */
const r2 = (v) => Math.round(v * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const HOJE = iso(new Date());
const dia = (n) => { const d = new Date(HOJE + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const ehUtil = (s) => { const w = new Date(s + "T12:00:00Z").getUTCDay(); return w !== 0 && w !== 6; };
function diasUteis(anos) {
  const out = [];
  for (let n = -Math.round(anos * 365); n <= 0; n++) { const d = dia(n); if (ehUtil(d)) out.push(d); }
  return out;
}

const PAPEIS = [
  { t: "ITSA4", classe: "acao_br", preco: 10.42, drift: 0.12, dy: 8.1, pl: 7.6, pvp: 1.42, roe: 18.6 },
  { t: "BBAS3", classe: "acao_br", preco: 27.85, drift: 0.08, dy: 9.4, pl: 4.3, pvp: 0.78, roe: 19.1 },
  { t: "MXRF11", classe: "fii", preco: 9.68, drift: 0.0, dy: 12.4, seg: "Papéis", pvp: 1.01 },
  { t: "HGLG11", classe: "fii", preco: 158.2, drift: 0.03, dy: 8.6, seg: "Logística", pvp: 0.98 },
  { t: "IVVB11", classe: "etf_br", preco: 389.5, drift: 0.18, dy: 0 },
  { t: "BTC", classe: "cripto", preco: 612000, drift: 0.45, dy: 0 },
];

function universo() {
  const acoes = {}, fiis = {};
  for (let i = 0; i < 40; i++) {
    const t = "PAR" + String.fromCharCode(65 + (i % 26)) + (3 + (i % 2)) + (i >= 26 ? String(i) : "");
    const k = (i * 37 % 100) / 100;
    acoes[t] = { ticker: t, cotacao: r2(5 + k * 60), pl: r2(4 + k * 20), pvp: r2(0.5 + k * 3), dy: r2(k * 12), p_ebit: r2(3 + k * 15),
      ev_ebit: r2(4 + k * 14), ev_ebitda: r2(3 + k * 10), mrg_ebit: r2(5 + k * 30), mrg_liquida: r2(3 + k * 20), roic: r2(4 + k * 20),
      roe: r2(5 + k * 25), liquidez: Math.round(2e6 + k * 9e7), patrimonio: Math.round(1e9 + k * 5e10), div_liq_pl: r2(k * 2), cresc_rec_5a: r2(-5 + k * 25) };
  }
  for (let i = 0; i < 30; i++) {
    const t = "FII" + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i * 7) % 26)) + "11";
    const k = (i * 53 % 100) / 100;
    fiis[t] = { ticker: t, segmento: ["Logística", "Papéis", "Shoppings", "Lajes Corporativas", "Híbrido"][i % 5], cotacao: r2(8 + k * 150),
      ffo_yield: r2(5 + k * 8), dy: r2(6 + k * 8), pvp: r2(0.7 + k * 0.5), valor_mercado: Math.round(2e8 + k * 4e9),
      liquidez: Math.round(3e5 + k * 9e6), qtd_imoveis: Math.round(k * 30), cap_rate: r2(k * 10), vacancia: r2(k * 15) };
  }
  for (const p of PAPEIS) {
    if (p.classe === "acao_br") {
      acoes[p.t] = { ...acoes.PARA3, ticker: p.t, cotacao: p.preco, pl: p.pl, pvp: p.pvp, dy: p.dy, roe: p.roe, roic: r2(p.roe * 0.8),
        liquidez: 9e7, patrimonio: 8e10, div_liq_pl: 0.4, cresc_rec_5a: 9.2, mrg_liquida: 18 };
    } else if (p.classe === "fii") {
      fiis[p.t] = { ticker: p.t, segmento: p.seg, cotacao: p.preco, ffo_yield: p.dy - 0.4, dy: p.dy, pvp: p.pvp, valor_mercado: 2.4e9,
        liquidez: 8e6, qtd_imoveis: p.seg === "Papéis" ? 0 : 18, cap_rate: 8.2, vacancia: p.seg === "Papéis" ? 0 : 3.1 };
    }
  }
  return { fiis, acoes, macro: { selic_meta: 15, cdi: 14.9, ipca_12m: 4.8, juro_real: 9.64, fontes: {} }, gerado: HOJE + "T12:00:00.000Z" };
}

function historico(t, anos) {
  const p = PAPEIS.find((x) => x.t === t) || { t, classe: "acao_br", preco: 20, drift: 0.05, dy: 5 };
  const dias = diasUteis(anos);
  const precos = dias.map((d, i) => {
    const falta = dias.length - 1 - i;
    return [d, r2(p.preco / Math.pow(1 + p.drift / 252, falta) * (1 + Math.sin(i / 9) * 0.01 * (falta ? 1 : 0)))];
  });
  const dividendos = [];
  if (p.dy > 0) {
    const mensal = p.classe === "fii", passo = mensal ? 21 : 63;
    for (let i = precos.length - 1; i > 0; i -= passo) dividendos.unshift([precos[i][0], r2((precos[i][1] * p.dy) / 100 / (mensal ? 12 : 4))]);
  }
  const ano = precos.filter(([d]) => d >= dia(-365)).map(([, v]) => v);
  const u200 = precos.slice(-200).map(([, v]) => v);
  return { simbolo: t, precos, precos_descartados: 0, dividendos, moeda: "BRL", preco: p.preco,
    media_200d: u200.reduce((s, v) => s + v, 0) / u200.length, max_52s: Math.max(...ano), min_52s: Math.min(...ano) };
}

function proventos(itens) {
  const out = {};
  for (const it of itens) {
    const h = historico(it.ticker, 2), mensal = it.classe === "fii";
    out[it.ticker] = { fonte: "fixture", lista: h.dividendos.map(([d, v]) => ({ data_com: d, pagamento: dia(0) > d ? d : d, valor: v, tipo: mensal ? "Rendimento" : "Dividendo" })) };
  }
  return out;
}

function mercado(corpo) {
  if (corpo.acao === "universo") return universo();
  if (corpo.acao === "historicos") return Object.fromEntries(corpo.itens.map((i) => [i.ticker, historico(i.ticker, corpo.anos || 3)]));
  if (corpo.acao === "cotacoes") {
    return Object.fromEntries(corpo.itens.filter((i) => PAPEIS.some((p) => p.t === i.ticker)).map((i) => {
      const p = PAPEIS.find((x) => x.t === i.ticker);
      return [i.ticker, { preco: p.preco, variacao_dia: 0.5, quando: HOJE + "T12:00:00.000Z", fonte: "fixture" }];
    }));
  }
  if (corpo.acao === "proventos") return proventos(corpo.itens);
  if (corpo.acao === "fiis_cvm") return { fonte: "fixture", fundos: {} };
  if (corpo.acao === "indices") return { ok: true };
  if (corpo.acao === "benchmarks") return {};
  throw new Error("ação de mercado fora da fixture: " + corpo.acao);
}

function indicesDiarios() {
  const linhas = [];
  const v = (Math.pow(1 + 14.9 / 100, 1 / 252) - 1) * 100;
  for (const d of diasUteis(3)) {
    linhas.push({ indice: "cdi", data: d, valor: Number(v.toFixed(6)) });
    linhas.push({ indice: "selic", data: d, valor: Number((v * 1.0007).toFixed(6)) });
  }
  for (let m = 36; m >= 1; m--) linhas.push({ indice: "ipca", data: dia(-m * 30).slice(0, 7) + "-01", valor: 0.4 });
  return linhas.sort((a, b) => a.indice.localeCompare(b.indice) || a.data.localeCompare(b.data));
}

/** as tabelas de uma conta com um pouco de tudo */
function baseDemo() {
  let seq = 0;
  const uuid = () => "00000000-0000-4000-8000-" + String(++seq).padStart(12, "0");
  const ativos = [
    { id: 1, ticker: "ITSA4", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 400, preco_medio: 8.9, criado_em: dia(-760) },
    { id: 2, ticker: "BBAS3", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0, preco_medio: null, criado_em: dia(-500) },
    { id: 3, ticker: "MXRF11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: 800, preco_medio: 10.05, criado_em: dia(-700) },
    { id: 4, ticker: "HGLG11", classe: "fii", pilar: "real_estate", lista: "watchlist", quantidade: 0, preco_medio: null, criado_em: dia(-90) },
    { id: 5, ticker: "BTC", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0.021, preco_medio: 355000, criado_em: dia(-450) },
  ];
  const renda_fixa = [
    { id: 11, nome: "CDB Banco Demo 2027", tipo: "cdi", taxa: 110, vencimento: dia(500), valor_aplicado: 15000, pilar: "caixa", criado_em: dia(-540) },
    { id: 12, nome: "LCI Banco Demo", tipo: "cdi", taxa: 94, vencimento: dia(240), valor_aplicado: 0, pilar: "caixa", criado_em: dia(-200) },
  ];
  const aportes = [];
  const lanca = (campos) => aportes.push({ id: uuid(), ticker: null, quantidade: null, preco: null, titulo: null, observacao: "", origem: null,
    historico: false, venda: false, indexador: null, taxa: null, do_provento: null, criado_em: campos.data, ...campos });
  for (let m = 12; m >= 1; m--) {
    lanca({ tipo: "ativo", data: dia(-m * 30), ticker: "ITSA4", quantidade: 20, preco: r2(8.9 + (12 - m) * 0.1), valor: r2(20 * (8.9 + (12 - m) * 0.1)) });
    if (m % 4 === 0) lanca({ tipo: "ativo", data: dia(-m * 30 - 6), ticker: "BBAS3", quantidade: 25, preco: r2(22 + (12 - m) * 0.3), valor: r2(25 * (22 + (12 - m) * 0.3)) });
    if (m % 2 === 0) lanca({ tipo: "caixa", data: dia(-m * 30 - 1), valor: 800, titulo: "LCI Banco Demo" });
  }
  lanca({ tipo: "ativo", data: dia(-45), ticker: "ITSA4", quantidade: -100, preco: 10.1, valor: 1010, venda: true });
  lanca({ tipo: "provento", data: dia(-20), ticker: "ITSA4", valor: 112.4 });
  const ganhos = [
    { id: uuid(), nome: "Salário", categoria: "salario", tipo: "recorrente", valor: 9800, inicio: dia(-800).slice(0, 7) + "-05", fim: null, observacao: "", dia_regra: null, dia_numero: null },
  ];
  const agro_movimentos = [
    { id: uuid(), data: dia(-400), tipo: "compra", categoria: "bezerro", categoria_destino: null, cabecas: 40, peso_medio_kg: 210, preco_arroba: 290, preco_cabeca: null, valor_total: 81200, despesas: 2400, reinvestido: null, fazenda: "Fazenda Demo", lote: "L1", contraparte: "", observacao: "" },
    { id: uuid(), data: dia(-30), tipo: "venda", categoria: "bezerro", categoria_destino: null, cabecas: 10, peso_medio_kg: 410, preco_arroba: 315, preco_cabeca: null, valor_total: 43000, despesas: 900, reinvestido: null, fazenda: "Fazenda Demo", lote: "L1", contraparte: "Frigorífico Demo", observacao: "" },
  ];
  const agro_custos = [{ id: uuid(), data: dia(-300), categoria: "nutricao", descricao: "Sal mineral", valor: 4200, fazenda: "Fazenda Demo", lote: "L1" }];
  const agro_pesagens = [{ id: uuid(), data: dia(-90), categoria: "bezerro", lote: "L1", fazenda: "Fazenda Demo", cabecas: 30, peso_medio_kg: 371, observacao: "" }];
  const patrimonio_historico = diasUteis(0.2).map((d, i) => ({ id: 100 + i, data: d, origem: "app", patrimonio: 60000 + i * 50, renda_variavel: 30000, cripto: 12000,
    renda_fixa: 18000, agro: 0, investido: 50000, por_pilar: {}, ativos: [] }));
  return { ativos, renda_fixa, aportes, preferencias: [{ user_id: "u-demo", alocacao_alvo: { acoes: 40, real_estate: 20, alternativos: 10, caixa: 30 }, premissas: null, regras: null, renda: null, agro: null, plano: null, modulos: null }],
    agro_movimentos, agro_custos, agro_pesagens, patrimonio_historico, ganhos, log_sistema: [], indices_diarios: indicesDiarios() };
}

const CHAVE = { preferencias: "user_id" };

/** `opcoes.somenteLeitura` faz toda gravação falhar como a RLS falharia;
 *  `opcoes.semMercado` derruba a Edge Function. Devolve o módulo que o
 *  núcleo espera ({ createClient }) e o `db`, para o teste espiar. */
function supabaseFalso(db = baseDemo(), opcoes = {}) {
  let seq = 5000;
  const negado = { message: "new row violates row-level security policy", code: "42501" };
  function tabela(nome) {
    const q = { op: "select", filtros: [], ordens: [], faixa: null, limite: null, um: null, linhas: null, campos: null, conflito: null };
    const linhas = () => (db[nome] = db[nome] || []);
    const passa = (l) => q.filtros.every((f) => f(l));
    function executa() {
      const escreve = q.op !== "select";
      if (escreve && opcoes.somenteLeitura && nome !== "log_sistema") return { data: null, error: negado };
      let saida;
      if (q.op === "select") saida = linhas().filter(passa);
      else if (q.op === "insert" || q.op === "upsert") {
        saida = q.linhas.map((l) => {
          const pk = CHAVE[nome] || "id";
          // upsert: pelas colunas de onConflict (como o PostgREST) ou pela chave primária
          const cols = q.conflito ? q.conflito.split(",").map((c) => c.trim()) : [pk];
          const ja = q.op === "upsert" ? linhas().find((x) => cols.every((c) => l[c] !== undefined && x[c] === l[c])) : null;
          if (ja) { Object.assign(ja, l); return ja; }
          const nova = { [pk]: l[pk] ?? "novo-" + (++seq), user_id: "u-demo", criado_em: HOJE, ...l };
          linhas().push(nova);
          return nova;
        });
      } else if (q.op === "update") {
        saida = linhas().filter(passa);
        saida.forEach((l) => Object.assign(l, q.campos));
      } else if (q.op === "delete") {
        saida = linhas().filter(passa);
        db[nome] = linhas().filter((l) => !saida.includes(l));
      }
      for (const [c, asc] of q.ordens.slice().reverse()) saida = saida.slice().sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
      if (q.faixa) saida = saida.slice(q.faixa[0], q.faixa[1] + 1);
      if (q.limite != null) saida = saida.slice(0, q.limite);
      saida = JSON.parse(JSON.stringify(saida));
      if (q.um === "um") return saida.length === 1 ? { data: saida[0], error: null } : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      if (q.um === "talvez") return { data: saida[0] || null, error: null };
      return { data: saida, error: null };
    }
    const api = {
      select() { return api; },
      insert(l) { q.op = "insert"; q.linhas = [].concat(l); return api; },
      upsert(l, o) { q.op = "upsert"; q.linhas = [].concat(l); q.conflito = (o && o.onConflict) || null; return api; },
      update(c) { q.op = "update"; q.campos = c; return api; },
      delete() { q.op = "delete"; return api; },
      eq(c, v) { q.filtros.push((l) => String(l[c]) === String(v)); return api; },
      not() { return api; },
      order(c, o = {}) { q.ordens.push([c, o.ascending !== false]); return api; },
      range(a, b) { q.faixa = [a, b]; return api; },
      limit(n) { q.limite = n; return api; },
      single() { q.um = "um"; return api; },
      maybeSingle() { q.um = "talvez"; return api; },
      then(ok, falha) { return Promise.resolve().then(executa).then(ok, falha); },
    };
    return api;
  }
  const cliente = {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: tabela,
    rpc: async () => ({ data: null, error: null }),
    functions: {
      async invoke(nome, { body }) {
        if (opcoes.semMercado) return { data: null, error: { message: "mercado fora do ar" } };
        try { return { data: mercado(body), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
      },
    },
  };
  return { modulo: { createClient: () => cliente }, cliente, db };
}

module.exports = { baseDemo, supabaseFalso, mercado, dia, HOJE, PAPEIS };
