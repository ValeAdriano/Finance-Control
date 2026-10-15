/* Modo fixture — SÓ PARA TESTE. Troca a rede por dados de demonstração
 * sintéticos e determinísticos, para comparar telas e rodar os roteiros sem
 * conta e sem internet (o "modo fixture" da F0 do PLANO.md).
 *
 * Liga com:  web → ?fixture=1 na URL (fica na sessão da aba)
 *            nativo → EXPO_PUBLIC_FIXTURE=1
 * Variantes: ?fixture=admin (conta admin), ?fixture=vazia (conta nova).
 *
 * Nada aqui fala com o Supabase: auth, tabelas e Edge Function são trocados
 * por versões em memória com a mesma forma de dados. */
import { Platform } from "react-native";
import FC from "../nucleo";

function modoPedido(): string | null {
  // no build de produção, só um build feito de propósito para demonstração liga o modo
  if (!__DEV__ && !process.env.EXPO_PUBLIC_FIXTURE) return null;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("fixture");
      if (q) window.sessionStorage.setItem("bullz-fixture", q);
      return q || window.sessionStorage.getItem("bullz-fixture");
    } catch { return null; }
  }
  return process.env.EXPO_PUBLIC_FIXTURE || null;
}

export const MODO_FIXTURE = modoPedido();

// ---------------------------------------------------------------- aleatório com semente
function semente(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r2 = (v: number) => Math.round(v * 100) / 100;

const hoje = () => FC.datas.hoje();
const dia = (d: number) => FC.datas.soma(hoje(), d);

/** dias úteis dos últimos `anos`, do mais antigo para hoje */
function diasUteis(anos: number): string[] {
  const out: string[] = [];
  for (let d = FC.datas.soma(hoje(), -Math.round(anos * 365)); d <= hoje(); d = FC.datas.soma(d, 1)) if (FC.datas.ehUtil(d)) out.push(d);
  return out;
}

/** série de preços com tendência e ruído, terminando em `fim` */
function serie(ticker: string, fim: number, anos: number, drift: number, vol: number): Array<[string, number]> {
  const rnd = semente(ticker + anos);
  const dias = diasUteis(anos);
  const ps: number[] = new Array(dias.length);
  ps[dias.length - 1] = fim;
  for (let i = dias.length - 2; i >= 0; i--) {
    const choque = (rnd() + rnd() + rnd() - 1.5) * vol;
    ps[i] = ps[i + 1] / (1 + drift / 252 + choque);
  }
  return dias.map((d, i) => [d, r2(ps[i])]);
}

// ---------------------------------------------------------------- mercado
interface Papel { t: string; classe: string; preco: number; drift: number; vol: number; dy: number; seg?: string; pl?: number; pvp?: number; roe?: number }
const PAPEIS: Papel[] = [
  { t: "ITSA4", classe: "acao_br", preco: 10.42, drift: 0.12, vol: 0.012, dy: 8.1, pl: 7.6, pvp: 1.42, roe: 18.6 },
  { t: "BBAS3", classe: "acao_br", preco: 27.85, drift: 0.08, vol: 0.016, dy: 9.4, pl: 4.3, pvp: 0.78, roe: 19.1 },
  { t: "TAEE11", classe: "acao_br", preco: 35.10, drift: 0.05, vol: 0.009, dy: 10.2, pl: 9.9, pvp: 1.71, roe: 17.2 },
  { t: "WEGE3", classe: "acao_br", preco: 44.30, drift: 0.10, vol: 0.015, dy: 1.6, pl: 29.4, pvp: 8.6, roe: 30.2 },
  { t: "MXRF11", classe: "fii", preco: 9.68, drift: 0.0, vol: 0.006, dy: 12.4, seg: "Papéis", pvp: 1.01 },
  { t: "HGLG11", classe: "fii", preco: 158.20, drift: 0.03, vol: 0.008, dy: 8.6, seg: "Logística", pvp: 0.98 },
  { t: "BOVA11", classe: "etf_br", preco: 131.70, drift: 0.09, vol: 0.011, dy: 0 },
  { t: "IVVB11", classe: "etf_br", preco: 389.50, drift: 0.18, vol: 0.010, dy: 0 },
  { t: "BTC", classe: "cripto", preco: 612000, drift: 0.45, vol: 0.03, dy: 0 },
  { t: "ETH", classe: "cripto", preco: 21400, drift: 0.2, vol: 0.035, dy: 0 },
];

function universo() {
  const rnd = semente("universo");
  const acoes: Record<string, any> = {}, fiis: Record<string, any> = {};
  // pares sintéticos: dão as medianas do setor ao avaliador
  for (let i = 0; i < 60; i++) {
    const t = "PAR" + String.fromCharCode(65 + (i % 26)) + (3 + (i % 2)) + (i >= 26 ? String(i) : "");
    acoes[t] = { ticker: t, cotacao: r2(5 + rnd() * 60), pl: r2(4 + rnd() * 20), pvp: r2(0.5 + rnd() * 3), dy: r2(rnd() * 12),
      p_ebit: r2(3 + rnd() * 15), ev_ebit: r2(4 + rnd() * 14), ev_ebitda: r2(3 + rnd() * 10), mrg_ebit: r2(5 + rnd() * 30),
      mrg_liquida: r2(3 + rnd() * 20), roic: r2(4 + rnd() * 20), roe: r2(5 + rnd() * 25), liquidez: Math.round(2e6 + rnd() * 9e7),
      patrimonio: Math.round(1e9 + rnd() * 5e10), div_liq_pl: r2(rnd() * 2), cresc_rec_5a: r2(-5 + rnd() * 25) };
  }
  for (let i = 0; i < 40; i++) {
    const t = "FII" + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i * 7) % 26)) + "11";
    fiis[t] = { ticker: t, segmento: ["Logística", "Papéis", "Shoppings", "Lajes Corporativas", "Híbrido"][i % 5], cotacao: r2(8 + rnd() * 150),
      ffo_yield: r2(5 + rnd() * 8), dy: r2(6 + rnd() * 8), pvp: r2(0.7 + rnd() * 0.5), valor_mercado: Math.round(2e8 + rnd() * 4e9),
      liquidez: Math.round(3e5 + rnd() * 9e6), qtd_imoveis: Math.round(rnd() * 30), cap_rate: r2(rnd() * 10), vacancia: r2(rnd() * 15) };
  }
  for (const p of PAPEIS) {
    if (p.classe === "acao_br") {
      acoes[p.t] = { ...acoes["PARA3"], ticker: p.t, cotacao: p.preco, pl: p.pl, pvp: p.pvp, dy: p.dy, roe: p.roe, roic: r2((p.roe || 10) * 0.8),
        liquidez: 9e7, patrimonio: 8e10, div_liq_pl: 0.4, cresc_rec_5a: 9.2, mrg_liquida: 18 };
    } else if (p.classe === "fii") {
      fiis[p.t] = { ticker: p.t, segmento: p.seg, cotacao: p.preco, ffo_yield: p.dy - 0.4, dy: p.dy, pvp: p.pvp, valor_mercado: 2.4e9,
        liquidez: 8e6, qtd_imoveis: p.seg === "Papéis" ? 0 : 18, cap_rate: 8.2, vacancia: p.seg === "Papéis" ? 0 : 3.1 };
    }
  }
  const macro = {
    selic_meta: 15, cdi: 14.9, ipca_12m: 4.8, juro_real: 9.64,
    fontes: {
      selic_meta: { rotulo: "Selic meta", descricao: "meta definida pelo Copom, % ao ano", origem: "fixture", data: FC.datas.br(hoje()), calculado: false },
      cdi: { rotulo: "CDI", descricao: "taxa DI anualizada, base 252 dias úteis", origem: "fixture", data: FC.datas.br(hoje()), calculado: false },
      ipca_12m: { rotulo: "IPCA 12 meses", descricao: "inflação acumulada nos últimos 12 meses", origem: "fixture", data: FC.datas.br(hoje()), calculado: false },
      juro_real: { rotulo: "Juro real", descricao: "quanto o CDI rende acima da inflação", origem: "calculado", data: FC.datas.br(hoje()), calculado: true },
    },
  };
  return { fiis, acoes, macro, gerado: new Date().toISOString() };
}

function historico(t: string, anos: number) {
  const p = PAPEIS.find((x) => x.t === t) || { t, classe: "acao_br", preco: 20, drift: 0.05, vol: 0.012, dy: 5 };
  const precos = serie(t, p.preco, anos, p.drift, p.vol);
  const dividendos: Array<[string, number]> = [];
  if (p.dy > 0) {
    const mensal = p.classe === "fii";
    const passo = mensal ? 21 : 63;
    for (let i = precos.length - 1; i > 0; i -= passo) dividendos.unshift([precos[i][0], r2((precos[i][1] * p.dy) / 100 / (mensal ? 12 : 4))]);
  }
  const corte = FC.datas.soma(hoje(), -365);
  const ano = precos.filter(([d]) => d >= corte).map(([, v]) => v);
  const u200 = precos.slice(-200).map(([, v]) => v);
  return { simbolo: t, precos, precos_descartados: 0, dividendos, moeda: "BRL", preco: p.preco,
    media_200d: u200.reduce((s, v) => s + v, 0) / u200.length, max_52s: Math.max(...ano), min_52s: Math.min(...ano) };
}

function indices() {
  const cdi: Array<[string, number]> = [], selic: Array<[string, number]> = [], ipca: Array<[string, number]> = [];
  const rnd = semente("ipca");
  for (const d of diasUteis(4)) {
    const ano = Number(d.slice(0, 4));
    const anual = ano <= 2023 ? 12.4 : ano === 2024 ? 10.9 : 14.9;
    const v = (Math.pow(1 + anual / 100, 1 / 252) - 1) * 100;
    cdi.push([d, Number(v.toFixed(6))]); selic.push([d, Number((v * 1.0007).toFixed(6))]);
  }
  for (let m = FC.datas.soma(hoje(), -4 * 365).slice(0, 7); m < hoje().slice(0, 7); ) {
    ipca.push([m + "-01", r2(0.2 + rnd() * 0.5)]);
    const [a, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`;
  }
  return { cdi, selic, ipca };
}

function cotacoes(itens: any[]) {
  const out: Record<string, any> = {};
  const rnd = semente("spot" + Math.floor(Date.now() / 60000));
  for (const it of itens) {
    const p = PAPEIS.find((x) => x.t === it.ticker);
    if (!p) continue;
    const v = (rnd() - 0.45) * (p.classe === "cripto" ? 4 : 1.6);
    out[it.ticker] = { preco: r2(p.preco * (1 + v / 300)), variacao_dia: r2(v), quando: new Date().toISOString(),
      fonte: p.classe === "cripto" ? "CoinGecko" : "Yahoo Finance" };
  }
  return out;
}

function proventos(itens: any[]) {
  const out: Record<string, any> = {};
  for (const it of itens) {
    const h = historico(it.ticker, 2);
    if (!h.dividendos.length) { out[it.ticker] = { fonte: "fixture", lista: [] }; continue; }
    const mensal = it.classe === "fii";
    const lista = h.dividendos.map(([d, v]) => ({ data_com: d, pagamento: FC.datas.soma(d, mensal ? 10 : 25), valor: v,
      tipo: mensal ? "Rendimento" : Number(d.slice(5, 7)) % 2 ? "JCP" : "Dividendo" }));
    // um anunciado e ainda não pago
    const ult = lista[lista.length - 1];
    lista.push({ data_com: FC.datas.soma(ult.data_com, mensal ? 30 : 90), pagamento: FC.datas.soma(ult.data_com, mensal ? 40 : 110), valor: ult.valor, tipo: ult.tipo });
    out[it.ticker] = { fonte: "Fundamentus", lista };
  }
  return out;
}

function fiisCvm() {
  return {
    fonte: "fixture (informe trimestral)",
    fundos: {
      HGLG11: { tipo: "tijolo", data_referencia: FC.datas.soma(hoje(), -100), receita_aluguel: 96.2, n_imoveis: 18, maior_imovel: 14.8,
        maior_setor: { nome: "Logística", pct: 71.4 }, n_setores: 3, vacancia_fisica_cvm: 3.1, vacancia_financeira: 2.4, inadimplencia: 0.3 },
      MXRF11: { tipo: "papel", data_referencia: FC.datas.soma(hoje(), -100), receita_aluguel: 1.1, cri: { n: 74, maior: 4.6, top5: 18.2 } },
    },
  };
}

// ---------------------------------------------------------------- base (tabelas)
let seqId = 1000;
const uuid = () => "fx-" + (++seqId).toString(36) + "-" + Math.random().toString(36).slice(2, 8);

function baseDemo(vazia: boolean) {
  const prefs: any = { modulos: null, plano: { modo: "percentual", percentual: 30, valor: null, destinos: [], reinvestir_dividendos: true } };
  if (vazia) return { ativos: [], renda_fixa: [], aportes: [], preferencias: prefs, agro_movimentos: [], agro_custos: [], agro_pesagens: [], patrimonio_historico: [], ganhos: [] };
  const ativos = [
    { id: 1, ticker: "ITSA4", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 400, preco_medio: 8.9, data_base: dia(-760), criado_em: dia(-760) },
    { id: 2, ticker: "BBAS3", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-500) },
    { id: 3, ticker: "TAEE11", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 120, preco_medio: 33.2, data_base: dia(-600), criado_em: dia(-600) },
    { id: 4, ticker: "MXRF11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: 800, preco_medio: 10.05, data_base: dia(-700), criado_em: dia(-700) },
    { id: 5, ticker: "HGLG11", classe: "fii", pilar: "real_estate", lista: "carteira", quantidade: 25, preco_medio: 161.4, data_base: dia(-420), criado_em: dia(-420) },
    { id: 6, ticker: "IVVB11", classe: "etf_br", pilar: "alternativos", lista: "carteira", quantidade: 30, preco_medio: 301.0, data_base: dia(-380), criado_em: dia(-380) },
    { id: 7, ticker: "BTC", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0.021, preco_medio: 355000, data_base: dia(-450), criado_em: dia(-450) },
    { id: 8, ticker: "WEGE3", classe: "acao_br", pilar: "acoes", lista: "watchlist", quantidade: 0, preco_medio: null, data_base: null, criado_em: dia(-90) },
  ];
  const renda_fixa = [
    { id: 11, nome: "CDB Banco Demo 2027", tipo: "cdi", taxa: 110, vencimento: dia(500), valor_aplicado: 15000, pilar: "caixa", data_inicio: dia(-540), criado_em: dia(-540) },
    { id: 12, nome: "Tesouro IPCA+ 2035", tipo: "ipca", taxa: 6.4, vencimento: "2035-05-15", valor_aplicado: 8000, pilar: "caixa", data_inicio: dia(-300), criado_em: dia(-300) },
    { id: 13, nome: "LCI Banco Demo", tipo: "cdi", taxa: 94, vencimento: dia(240), valor_aplicado: 0, pilar: "caixa", data_inicio: dia(-200), criado_em: dia(-200) },
  ];
  const aportes: any[] = [];
  const compra = (d: number, t: string, q: number, p: number) => aportes.push({ id: uuid(), tipo: "ativo", data: dia(d), ticker: t, quantidade: q, preco: p, valor: r2(q * p), titulo: null, observacao: "", origem: null, historico: false, venda: false, criado_em: dia(d) });
  for (let m = 22; m >= 1; m--) {
    const d = -m * 30;
    compra(d, "ITSA4", 20, r2(8.9 + (22 - m) * 0.07));
    compra(d - 2, "MXRF11", 30, r2(10.1 - (22 - m) * 0.02));
    if (m % 3 === 0) compra(d - 5, "HGLG11", 2, r2(150 + m));
    if (m % 4 === 0) compra(d - 6, "BBAS3", 25, r2(22 + (22 - m) * 0.3));
    if (m % 2 === 0) aportes.push({ id: uuid(), tipo: "caixa", data: dia(d - 1), ticker: null, quantidade: null, preco: null, valor: 800, titulo: "LCI Banco Demo", observacao: "", origem: null, historico: false, venda: false, criado_em: dia(d - 1) });
  }
  aportes.push({ id: uuid(), tipo: "ativo", data: dia(-45), ticker: "ITSA4", quantidade: -100, preco: 10.1, valor: 1010, titulo: null, observacao: "", origem: null, historico: false, venda: true, criado_em: dia(-45) });
  aportes.push({ id: uuid(), tipo: "provento", data: dia(-20), ticker: "TAEE11", quantidade: null, preco: null, valor: 112.4, titulo: null, observacao: "", origem: null, historico: false, venda: false, criado_em: dia(-20) });
  const ganhos = [
    { id: uuid(), nome: "Salário", categoria: "salario", tipo: "recorrente", valor: 9800, inicio: dia(-800).slice(0, 7) + "-05", fim: null, observacao: "" },
    { id: uuid(), nome: "13º salário", categoria: "decimo_terceiro", tipo: "avulso", valor: 9800, inicio: dia(-300), fim: null, observacao: "" },
  ];
  const agro_movimentos = [
    { id: uuid(), data: dia(-400), tipo: "compra", categoria: "bezerro", categoria_destino: null, cabecas: 40, peso_medio_kg: 210, preco_arroba: 290, preco_cabeca: null, valor_total: 81200, despesas: 2400, reinvestido: null, fazenda: "Fazenda Demo", lote: "L1", contraparte: "", observacao: "" },
    { id: uuid(), data: dia(-200), tipo: "reclassificacao", categoria: "bezerro", categoria_destino: "garrote", cabecas: 38, peso_medio_kg: null, preco_arroba: null, preco_cabeca: null, valor_total: 0, despesas: 0, reinvestido: null, fazenda: "Fazenda Demo", lote: "L1", contraparte: "", observacao: "" },
    { id: uuid(), data: dia(-180), tipo: "morte", categoria: "bezerro", categoria_destino: null, cabecas: 2, peso_medio_kg: null, preco_arroba: null, preco_cabeca: null, valor_total: 0, despesas: 0, reinvestido: null, fazenda: "Fazenda Demo", lote: "L1", contraparte: "", observacao: "" },
    { id: uuid(), data: dia(-30), tipo: "venda", categoria: "garrote", categoria_destino: null, cabecas: 18, peso_medio_kg: 410, preco_arroba: 315, preco_cabeca: null, valor_total: 86100, despesas: 1900, reinvestido: 40000, fazenda: "Fazenda Demo", lote: "L1", contraparte: "Frigorífico Demo", observacao: "" },
  ];
  const agro_custos = [
    { id: uuid(), data: dia(-300), categoria: "nutricao", descricao: "Sal mineral", valor: 4200, fazenda: "Fazenda Demo", lote: "L1" },
    { id: uuid(), data: dia(-150), categoria: "sanidade", descricao: "Vacinas", valor: 1300, fazenda: "Fazenda Demo", lote: "L1" },
    { id: uuid(), data: dia(-60), categoria: "arrendamento", descricao: "Pasto", valor: 6000, fazenda: "Fazenda Demo", lote: "L1" },
  ];
  const agro_pesagens = [
    { id: uuid(), data: dia(-260), categoria: "bezerro", lote: "L1", fazenda: "Fazenda Demo", cabecas: 38, peso_medio_kg: 262, observacao: "" },
    { id: uuid(), data: dia(-90), categoria: "garrote", lote: "L1", fazenda: "Fazenda Demo", cabecas: 38, peso_medio_kg: 371, observacao: "" },
  ];
  // histórico diário: uma foto por dia útil dos últimos 200 dias
  const patrimonio_historico: any[] = [];
  const rnd = semente("hist");
  let v = 61000;
  for (const d of diasUteis(0.55)) {
    v = v * (1 + 0.0007 + (rnd() - 0.5) * 0.01) + (d.slice(8) === "05" ? 1400 : 0);
    patrimonio_historico.push({ data: d, patrimonio: r2(v), renda_variavel: r2(v * 0.52), cripto: r2(v * 0.11), renda_fixa: r2(v * 0.37), agro: 0, investido: r2(v * 0.9), por_pilar: {}, ativos: [] });
  }
  return { ativos, renda_fixa, aportes, preferencias: prefs, agro_movimentos, agro_custos, agro_pesagens, patrimonio_historico, ganhos };
}

// ---------------------------------------------------------------- uso (admin)
// sessões anônimas inventadas, no formato da tabela uso_eventos
function usoSintetico() {
  let s = 7;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pega = <X,>(xs: X[]) => xs[Math.floor(r() * xs.length)];
  const rotas = ["inicio", "inicio", "inicio", "ativos", "ativos", "aportes", "dividendos", "irpf", "salario", "projecoes", "ajustes", "agro"];
  const cliques: Record<string, string[]> = {
    inicio: ["[rota=ativos]", "[rota=aportes]", "Atualizar cotações", "Ver detalhes"], ativos: ["Novo ativo", "linha de ativo", "Filtro: classe"],
    aportes: ["Novo aporte", "Repetir aporte"], dividendos: ["Calendário", "Mês"], irpf: ["Ano", "Bens e direitos"], salario: ["Plano do mês"],
    projecoes: ["Simular"], ajustes: ["Aparência", "Exportar dados"], agro: ["Nova pesagem"],
  };
  const folhas: Record<string, string> = { ativos: "Novo ativo", aportes: "Novo aporte", agro: "Nova pesagem", salario: "Novo ganho" };
  const out: any[] = [];
  const agora = Date.now();
  for (let k = 0; k < 70; k++) {
    const visitante = "v" + Math.floor(r() * 1e8).toString(16), sessao = "s" + Math.floor(r() * 1e10).toString(16);
    const aparelho = r() < 0.6 ? "celular" : "computador";
    let t = agora - Math.floor(r() * 29 * 864e5) - 3600e3;
    const ev = (tipo: string, rota: string, alvo: string | null, extra: any = {}) => out.push({ quando: new Date(t).toISOString(), visitante, sessao, tipo, rota, alvo, duracao_ms: null, aparelho, detalhe: null, ...extra });
    const n = 2 + Math.floor(r() * 5);
    for (let p = 0; p < n; p++) {
      const rota = p === 0 ? "inicio" : pega(rotas);
      ev("tela", rota, "entrada");
      const nc = Math.floor(r() * 4);
      for (let c = 0; c < nc; c++) { t += 1500 + r() * 9000; ev("clique", rota, pega(cliques[rota] || ["botão"])); }
      if (rota === "aportes" && r() < 0.15) for (let c = 0; c < 3; c++) { t += 300; ev("clique", rota, "Salvar"); }
      if (folhas[rota] && r() < 0.6) {
        t += 2000; ev("folha_abre", rota, folhas[rota], { detalhe: { form: true } });
        const envia = r() < 0.55;
        t += 8000 + r() * 30000;
        if (envia) ev("folha_envia", rota, folhas[rota], { duracao_ms: Math.round(9000 + r() * 30000) });
        ev("folha_fecha", rota, folhas[rota], { detalhe: { enviou: envia } });
      }
      if (r() < 0.05) { t += 500; ev("erro", rota, "TypeError: não foi possível ler a propriedade de indefinido", { detalhe: { local: "app.js" } }); }
      const dur = Math.round(4000 + r() * 70000);
      t += dur; ev("tela", rota, "saida", { duracao_ms: dur });
    }
  }
  return out.sort((a, b) => a.quando.localeCompare(b.quando));
}

// ---------------------------------------------------------------- instalação
export function instalaFixture() {
  if (!MODO_FIXTURE) return;
  console.warn("[bullz] MODO FIXTURE ligado: dados de demonstração, sem rede (" + MODO_FIXTURE + ")");
  const vazia = MODO_FIXTURE === "vazia";
  const admin = MODO_FIXTURE === "admin";
  const db: any = baseDemo(vazia);
  const usuario = { id: "fixture-usuario", email: "demo@bullz.local", user_metadata: { nome: "Demo" }, factors: [] };
  let logado = true;
  const logs: any[] = [];

  Object.assign(FC.auth, {
    sessao: async () => (logado ? { user: usuario } : null),
    entrar: async () => { logado = true; return { user: usuario, session: {} }; },
    cadastrar: async () => { logado = true; return { user: usuario, session: {} }; },
    sair: async () => { logado = false; },
    nivel: async () => ({ currentLevel: "aal1", nextLevel: "aal1" }),
    fatores: async () => ({ all: [], totp: [] }),
    trocarSenha: async () => ({}),
    confereSenha: async () => true,
    sairDosOutros: async () => {},
    usuario,
  });

  const num = (x: any) => (x == null ? null : Number(x));
  const tabela = (t: string) => {
    const nome = t === "patrimonio_historico" ? "patrimonio_historico" : t;
    if (!db[nome]) db[nome] = [];
    return db[nome];
  };
  Object.assign(FC.db, {
    carregaTudo: async () => {
      const c = JSON.parse(JSON.stringify(db));
      return {
        ativos: c.ativos.map((a: any) => ({ ...a, quantidade: num(a.quantidade) || 0, preco_medio: num(a.preco_medio) })),
        rendaFixa: c.renda_fixa,
        aportes: c.aportes.sort((a: any, b: any) => a.data.localeCompare(b.data)),
        prefsBrutas: c.preferencias || {},
        ganhos: c.ganhos,
        historico: c.patrimonio_historico,
        agro: { movs: c.agro_movimentos, custos: c.agro_custos, pesagens: c.agro_pesagens },
      };
    },
    inserir: async (t: string, linha: any) => { const l = { id: t === "ativos" || t === "renda_fixa" ? ++seqId : uuid(), criado_em: new Date().toISOString(), ...linha }; tabela(t).push(l); return l; },
    inserirVarios: async (t: string, linhas: any[]) => linhas.map((linha) => { const l = { id: uuid(), ...linha }; tabela(t).push(l); return l; }),
    atualizar: async (t: string, id: any, campos: any) => { const l = tabela(t).find((x: any) => x.id === id); Object.assign(l, campos); return l; },
    apagar: async (t: string, id: any) => { db[t] = tabela(t).filter((x: any) => x.id !== id); },
    gravaPrefs: async (campos: any) => { db.preferencias = { ...(db.preferencias || {}), ...campos }; return db.preferencias; },
    gravaRegistro: async (linha: any) => { db.patrimonio_historico = db.patrimonio_historico.filter((h: any) => h.data !== linha.data); db.patrimonio_historico.push(linha); return linha; },
    log: async (evento: string, detalhe = {}) => { logs.unshift({ id: uuid(), quando: new Date().toISOString(), origem: "app", evento, detalhe }); },
    logs: async () => logs.slice(0, 60),
    apagaConta: async () => { Object.assign(db, baseDemo(true)); },
  });

  // o perfil sobrevive à recarga da página (sessão do navegador): sem isso o questionário
  // reabre a cada hot reload enquanto se testa outra tela
  const CHAVE_PERFIL = "bullz-fixture-perfil-" + MODO_FIXTURE;
  const lePerfil = () => { try { return JSON.parse(globalThis.sessionStorage?.getItem(CHAVE_PERFIL) || "null"); } catch { return null; } };
  const perfil: any = lePerfil() || { atual: null, rascunho: null, plano: null, historico: [], planos: [], adiamentos: 0 };
  const guarda = <X,>(x: X): X => { try { globalThis.sessionStorage?.setItem(CHAVE_PERFIL, JSON.stringify(perfil)); } catch { /* sem sessão */ } return x; };
  Object.assign(FC.perfilDb, {
    carrega: async () => ({ indisponivel: false, atual: perfil.atual, rascunho: perfil.rascunho, plano: perfil.plano, adiamentos: perfil.adiamentos || 0, modo: "educativo", ativou: !!perfil.atual }),
    salvaRascunho: async (respostas: any, passo: any) => guarda(perfil.rascunho = { respostas, passo, versao_modelo: FC.PERFIL.versao, atualizado_em: new Date().toISOString() }),
    apagaRascunho: async () => { perfil.rascunho = null; guarda(0); },
    conclui: async (p: any) => {
      const c = p.calculo;
      const valido = new Date(); valido.setMonth(valido.getMonth() + 24);
      perfil.atual = { id: uuid(), criado_em: new Date().toISOString(), valido_ate: valido.toISOString().slice(0, 10), versao_modelo: c.versao, origem: p.origem, respostas: p.respostas, tolerancia: c.tolerancia,
        capacidade: c.capacidade, necessidade: p.necessidade, score: c.score, perfil: c.perfil, consistencia: c.consistencia };
      perfil.historico.unshift(perfil.atual);
      return guarda(perfil.atual);
    },
    salvaPlano: async ({ perfilId, plano, modo }: any) => { perfil.plano = { id: uuid(), perfil_id: perfilId, modo, plano, decisao: "pendente", criado_em: new Date().toISOString() }; perfil.planos.unshift(perfil.plano); return guarda(perfil.plano); },
    decide: async (_id: any, decisao: string, antes: any, depois: any) => { Object.assign(perfil.plano, { decisao, metas_antes: antes, metas_depois: depois, decidido_em: new Date().toISOString() }); return guarda(perfil.plano); },
    historico: async () => perfil.historico,
    planos: async () => perfil.planos,
    evento: async (tipo: string) => { if (tipo === "adiado") { perfil.adiamentos = (perfil.adiamentos || 0) + 1; guarda(0); } },
    funil: async () => [],
    exporta: async () => ({ perfis: perfil.historico, planos: perfil.planos, rascunho: perfil.rascunho }),
  });

  FC.sb.rpc = (nome: string) => Promise.resolve({ data: nome === "eh_admin" ? admin : nome === "modo_recomendacao" ? "educativo" : [], error: null });
  if (admin) {
    const eventos = usoSintetico();
    // o mesmo encadeamento que o admin usa: select().gte().order().range()
    const fromOrig = FC.sb.from.bind(FC.sb);
    FC.sb.from = (t: string) => {
      if (t !== "uso_eventos") return fromOrig(t);
      let desde = "";
      const q: any = { select: () => q, order: () => q, gte: (_c: string, v: string) => { desde = v; return q; },
        range: (a: number, b: number) => Promise.resolve({ data: eventos.filter((e) => e.quando >= desde).slice(a, b + 1), error: null }) };
      return q;
    };
    FC.sb.rpc = (nome: string) => Promise.resolve({ data: nome === "eh_admin" ? true : nome === "modo_recomendacao" ? "educativo"
      : nome === "admin_erros_sistema" ? [{ quando: new Date(Date.now() - 864e5).toISOString(), etapa: "cotacoes", erro: "fonte de preço respondeu 503" }] : [], error: null });
    FC.perfilDb.funil = async (dias: number) => ({
      janela_dias: dias, contas_novas: 48, abriram_bloco_1: 39, tempo_mediano_ms: 158000, perfis_concluidos: 31, planos_aplicados: 22, ativadas_7d: 27,
      blocos: [1, 2, 3, 4].map((b) => ({ bloco: b, viram: 39 - (b - 1) * 2, concluiram: 37 - (b - 1) * 2 })),
      adiaram: 6, adiamentos: 9, planos_recusados: 3,
      saude: { perfis: 31, vencidos: 2, baixa_consistencia: 4, conservador: 9, moderado: 15, arrojado: 7 },
      retencao: [0, 1, 2].map((k) => ({ semana: FC.datas.soma(FC.datas.hoje(), -7 * (k + 1)), ativada: k % 2 === 0, contas: 12 - k, d1: 8 - k, d7: 6 - k, d30: 4 })),
    });
  }

  const U = universo();
  Object.assign(FC.mercado, {
    universo: async () => JSON.parse(JSON.stringify(U)),
    historicos: async (itens: any[], anos = 3) => Object.fromEntries(itens.map((i) => [i.ticker, historico(i.ticker, anos)])),
    benchmarks: async () => ({ cdi: [], ibov: serie("^BVSP", 131000, 5, 0.09, 0.011) }),
    proventos: async (itens: any[]) => proventos(itens),
    fiisCvm: async () => fiisCvm(),
    indices: async () => indices(),
    cotacoes: async (itens: any[]) => cotacoes(itens),
    tesouro: async () => tesouro(),
  });
}

function tesouro() {
  const ano = Number(hoje().slice(0, 4));
  const t = (tipo: string, venc: string, taxa: number, pu: number) =>
    ({ tipo, vencimento: venc, taxa_compra: taxa, taxa_venda: r2(taxa + 0.12), pu_compra: pu, pu_venda: r2(pu * 0.995) });
  return { data_base: FC.datas.soma(hoje(), -1), fonte: "fixture", velho: false, em: new Date().toISOString(), titulos: [
    t("Tesouro Selic", `${ano + 3}-03-01`, 0.05, 20065.82),
    t("Tesouro Selic", `${ano + 5}-03-01`, 0.09, 20010.2),
    t("Tesouro Prefixado", `${ano + 1}-01-01`, 13.34, 974),
    t("Tesouro Prefixado", `${ano + 5}-01-01`, 12.62, 608.58),
    t("Tesouro Prefixado com Juros Semestrais", `${ano + 9}-01-01`, 12.75, 920.24),
    t("Tesouro IPCA+", `${ano + 3}-05-15`, 6.72, 4037.5),
    t("Tesouro IPCA+", `${ano + 9}-05-15`, 6.74, 2734.26),
    t("Tesouro IPCA+ com Juros Semestrais", `${ano + 14}-08-15`, 6.64, 4562.68),
    t("Tesouro Renda+ Aposentadoria Extra", `${ano + 23}-12-15`, 6.66, 2187.89),
    t("Tesouro Educa+", `${ano + 4}-12-15`, 6.64, 3479.41),
  ] };
}
