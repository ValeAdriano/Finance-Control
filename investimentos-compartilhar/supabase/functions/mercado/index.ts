// Edge Function "mercado" — a única parte que sai para a internet.
//
// O navegador não consegue ler Fundamentus, Yahoo e Banco Central
// direto (nenhum deles libera CORS), então esta função busca, limpa e
// devolve JSON pronto. Tudo o que vem de fora fica em cache na tabela
// mercado_cache: a segunda abertura do dia não depende das fontes.
//
// Só atende quem está logado: o token do usuário é conferido no Auth
// antes de qualquer busca.
//
// Ações (POST JSON):
//   {acao: "universo", forcar?}                  tabelões + macro
//   {acao: "historicos", itens: [{ticker, classe}], anos?, forcar?}
//   {acao: "benchmarks", anos?, forcar?}         CDI diário e Ibovespa
//   {acao: "cotacoes", itens: [{ticker, classe}]} preço de agora (cache 1 min)
//   {acao: "registro_diario"}                    só o agendamento (x-cron-secret):
//                                                grava a foto do dia de cada usuário
//
// Fontes gratuitas, sem chave: cripto no CoinGecko (já em reais); bolsa
// no Yahoo; macro no Banco Central; fundamentos no Fundamentus.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const HORA = 3600 * 1000;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ------------------------------------------------------------------ cache
async function doCache(chave: string, validadeMs: number) {
  const { data } = await admin.from("mercado_cache")
    .select("dados, atualizado_em").eq("chave", chave).maybeSingle();
  if (!data) return null;
  const idade = Date.now() - new Date(data.atualizado_em).getTime();
  return { dados: data.dados, fresco: idade < validadeMs };
}

async function guarda(chave: string, dados: unknown) {
  await admin.from("mercado_cache").upsert({
    chave, dados, atualizado_em: new Date().toISOString(),
  });
}

// Busca com cache; se a fonte cair, devolve o último dado guardado
// (velho é melhor que nada — a tela mostra a data).
async function comCache<T>(chave: string, validadeMs: number, forcar: boolean,
                           buscar: () => Promise<T>): Promise<T> {
  const c = await doCache(chave, validadeMs);
  if (c && c.fresco && !forcar) return c.dados as T;
  try {
    const novo = await buscar();
    await guarda(chave, novo);
    return novo;
  } catch (e) {
    if (c) return c.dados as T;
    throw e;
  }
}

async function baixa(url: string, latin1 = false): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "*/*" } });
  if (!r.ok) throw new Error(`${r.status} em ${new URL(url).host}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  return new TextDecoder(latin1 ? "iso-8859-1" : "utf-8").decode(bytes);
}

// ------------------------------------------------------------------ Fundamentus
function numBr(txt: string | undefined): number | null {
  if (txt == null) return null;
  let s = String(txt).replace("%", "").replace("R$", "").trim();
  if (["", "-", "N/A", "nan"].includes(s)) return null;
  s = s.replaceAll(".", "").replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function limpaHtml(f: string) {
  return f.replace(/<[^>]*>/g, "").replaceAll("&nbsp;", " ").trim();
}

function tabela(html: string): string[][] {
  const saida: string[][] = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cel = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => limpaHtml(c[1]));
    if (cel.length) saida.push(cel);
  }
  return saida;
}

async function fiis() {
  const html = await baixa("https://www.fundamentus.com.br/fii_resultado.php", true);
  const out: Record<string, unknown> = {};
  for (const c of tabela(html)) {
    if (c.length < 13) continue;
    const t = c[0].toUpperCase();
    out[t] = {
      ticker: t, segmento: c[1] || "Não informado",
      cotacao: numBr(c[2]), ffo_yield: numBr(c[3]), dy: numBr(c[4]),
      pvp: numBr(c[5]), valor_mercado: numBr(c[6]), liquidez: numBr(c[7]),
      qtd_imoveis: numBr(c[8]), cap_rate: numBr(c[11]), vacancia: numBr(c[12]),
    };
  }
  if (Object.keys(out).length < 50) throw new Error("tabela de FIIs veio vazia");
  return out;
}

async function acoes() {
  const html = await baixa("https://www.fundamentus.com.br/resultado.php", true);
  const out: Record<string, unknown> = {};
  for (const c of tabela(html)) {
    if (c.length < 22) continue;
    const t = c[0].toUpperCase();
    out[t] = {
      ticker: t, cotacao: numBr(c[1]), pl: numBr(c[2]), pvp: numBr(c[3]),
      dy: numBr(c[5]), p_ebit: numBr(c[8]), ev_ebit: numBr(c[10]),
      ev_ebitda: numBr(c[11]), mrg_ebit: numBr(c[13]), mrg_liquida: numBr(c[14]),
      roic: numBr(c[16]), roe: numBr(c[17]), liquidez: numBr(c[18]),
      patrimonio: numBr(c[19]), div_liq_pl: numBr(c[20]), cresc_rec_5a: numBr(c[21]),
    };
  }
  if (Object.keys(out).length < 100) throw new Error("tabela de ações veio vazia");
  return out;
}

// ------------------------------------------------------------------ Banco Central
const SERIES: Record<string, [number, string, string]> = {
  selic_meta: [432, "Selic meta", "meta definida pelo Copom, % ao ano"],
  cdi: [4389, "CDI", "taxa DI anualizada, base 252 dias úteis"],
  ipca_12m: [13522, "IPCA 12 meses", "inflação acumulada nos últimos 12 meses"],
};

async function macro() {
  const out: Record<string, unknown> & { fontes: Record<string, unknown> } = { fontes: {} };
  await Promise.all(Object.entries(SERIES).map(async ([nome, [cod, rotulo, desc]]) => {
    const base = { rotulo, descricao: desc, origem: `Banco Central · série SGS ${cod}`, calculado: false };
    try {
      const d = JSON.parse(await baixa(
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${cod}/dados/ultimos/1?formato=json`));
      out[nome] = Number(String(d.at(-1).valor).replace(",", "."));
      out.fontes[nome] = { ...base, data: d.at(-1).data };
    } catch (e) {
      out[nome] = null;
      out.fontes[nome] = { ...base, data: null, erro: String(e).slice(0, 120) };
    }
  }));
  const cdi = out.cdi as number | null, ipca = out.ipca_12m as number | null;
  out.juro_real = cdi && ipca ? Math.round(((1 + cdi / 100) / (1 + ipca / 100) - 1) * 10000) / 100 : null;
  out.fontes.juro_real = {
    rotulo: "Juro real", descricao: "quanto o CDI rende acima da inflação",
    origem: "calculado aqui, pela fórmula de Fisher: (1 + CDI) ÷ (1 + IPCA) − 1",
    data: (out.fontes.cdi as { data?: string })?.data ?? null, calculado: true,
  };
  if (cdi == null && ipca == null) throw new Error("Banco Central indisponível");
  return out;
}

// ------------------------------------------------------------------ Yahoo
const NA_B3 = new Set(["fii", "acao_br", "etf_br", "fii_tijolo", "fii_papel", "indice_br"]);

function simbolo(ticker: string, classe: string) {
  const t = ticker.toUpperCase();
  return NA_B3.has(classe) && !t.endsWith(".SA") && !t.startsWith("^") ? t + ".SA" : t;
}

function iso(ts: number) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// O Yahoo às vezes publica um dia com a escala errada (1,07 em vez de
// 107). Cada ponto é comparado com a mediana dos vizinhos; o salto
// isolado sai, a tendência verdadeira fica.
function semOutliers(p: [string, number][], janela = 11, tol = 0.5) {
  if (p.length < janela) return { precos: p, descartados: 0 };
  const meio = Math.floor(janela / 2);
  const limpos: [string, number][] = [];
  for (let i = 0; i < p.length; i++) {
    const ini = Math.max(0, i - meio);
    const viz = p.slice(ini, ini + janela).map((x) => x[1]).sort((a, b) => a - b);
    const med = viz[Math.floor(viz.length / 2)];
    if (med && Math.abs(p[i][1] / med - 1) <= tol) limpos.push(p[i]);
  }
  return { precos: limpos, descartados: p.length - limpos.length };
}

async function serieYahoo(ticker: string, classe: string, anos: number) {
  const sym = simbolo(ticker, classe);
  let txt = "";
  for (const host of ["query1", "query2"]) {
    try {
      txt = await baixa(`https://${host}.finance.yahoo.com/v8/finance/chart/` +
        `${encodeURIComponent(sym)}?range=${anos}y&interval=1d&events=div`);
      break;
    } catch (e) {
      if (host === "query2") throw e;
    }
  }
  const res = JSON.parse(txt).chart.result[0];
  const meta = res.meta;
  const ts: number[] = res.timestamp ?? [];
  const fech: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];
  const brutos: [string, number][] = [];
  ts.forEach((t, i) => { if (fech[i] != null) brutos.push([iso(t), Number(fech[i]!.toPrecision(8))]); });
  const { precos, descartados } = semOutliers(brutos);

  const divs = Object.values(res.events?.dividends ?? {})
    .map((d: any) => [iso(d.date), d.amount] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const corte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const ano = precos.filter(([d]) => d >= corte).map(([, p]) => p);
  const u200 = precos.slice(-200).map(([, p]) => p);

  return {
    simbolo: sym, precos, precos_descartados: descartados, dividendos: divs,
    media_200d: u200.length >= 100 ? u200.reduce((a, b) => a + b, 0) / u200.length : null,
    preco: meta.regularMarketPrice ?? precos.at(-1)?.[1] ?? null,
    moeda: meta.currency,
    max_52s: ano.length ? Math.max(...ano) : null,
    min_52s: ano.length ? Math.min(...ano) : null,
  };
}

// ------------------------------------------------------------------ cripto
// O Yahoo não tem mais os pares em real (BTC-BRL dá 404). A cripto vem em
// dólar e é convertida pelo câmbio de CADA dia (BRL=X), não pelo de hoje —
// senão o histórico misturaria a variação da moeda com a da cripto.
function simboloCripto(ticker: string) {
  return ticker.includes("-") ? ticker : ticker + "-USD";
}

async function serieCripto(ticker: string, anos: number, forcar: boolean) {
  const [usd, fx] = await Promise.all([
    serieYahoo(simboloCripto(ticker), "cripto", anos),
    comCache(`yahoo:BRL=X:${anos}y`, 6 * HORA, forcar, () => serieYahoo("BRL=X", "moeda", anos)),
  ]);
  const cambio = (fx as any).precos as [string, number][];
  if (!cambio.length) throw new Error("câmbio indisponível");
  // câmbio do dia, ou do último dia útil antes dele (cripto negocia no fim de semana)
  let j = 0;
  const cotacaoEm = (d: string) => {
    while (j + 1 < cambio.length && cambio[j + 1][0] <= d) j++;
    return cambio[j][1];
  };
  const precos = usd.precos.map(([d, p]) => [d, Number((p * cotacaoEm(d)).toPrecision(10))] as [string, number]);
  const hojeFx = (fx as any).preco || cambio.at(-1)![1];
  const corte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const ano = precos.filter(([d]) => d >= corte).map(([, p]) => p);
  const u200 = precos.slice(-200).map(([, p]) => p);
  return {
    ...usd, precos, dividendos: [], moeda: "BRL", moeda_origem: "USD", cambio: hojeFx,
    preco: usd.preco != null ? usd.preco * hojeFx : precos.at(-1)?.[1] ?? null,
    media_200d: u200.length >= 100 ? u200.reduce((a, b) => a + b, 0) / u200.length : null,
    max_52s: ano.length ? Math.max(...ano) : null,
    min_52s: ano.length ? Math.min(...ano) : null,
  };
}

async function emLotes<T, R>(itens: T[], n: number, f: (x: T) => Promise<R>) {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += n) {
    saida.push(...await Promise.all(itens.slice(i, i + n).map(f)));
  }
  return saida;
}

async function cdiDiario(anos: number) {
  const ini = new Date(Date.now() - anos * 366 * 86400000);
  const dd = (n: number) => String(n).padStart(2, "0");
  const di = `${dd(ini.getDate())}/${dd(ini.getMonth() + 1)}/${ini.getFullYear()}`;
  const d = JSON.parse(await baixa(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${di}`));
  return d.map((x: { data: string; valor: string }) => {
    const [dia, mes, a] = x.data.split("/");
    return [`${a}-${mes}-${dia}`, Number(x.valor.replace(",", "."))];
  });
}

// ------------------------------------------------------------------ CoinGecko
// O CoinGecko identifica moedas por id ("bitcoin"), não pelo código. O
// código é resolvido uma vez pela busca — fica a moeda com esse símbolo
// de maior valor de mercado — e guardado por 30 dias.
function simboloBase(ticker: string) {
  return ticker.split("-")[0].replace(/\d+$/, "").toUpperCase();
}

async function idCoingecko(ticker: string): Promise<string | null> {
  const sym = simboloBase(ticker);
  return comCache(`coingecko:id:${sym}`, 30 * 24 * HORA, false, async () => {
    const d = JSON.parse(await baixa(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`));
    const cands = (d.coins || []).filter((c: any) => String(c.symbol).toUpperCase() === sym)
      .sort((a: any, b: any) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9));
    if (!cands.length) throw new Error(`${sym} não encontrado no CoinGecko`);
    return cands[0].id;
  }).catch(() => null);
}

async function cotacoesCripto(tickers: string[]) {
  const ids: Record<string, string> = {};
  for (const t of tickers) { const id = await idCoingecko(t); if (id) ids[t] = id; }
  const lista = [...new Set(Object.values(ids))].sort();
  const saida: Record<string, unknown> = {};
  if (lista.length) {
    const d: any = await comCache(`coingecko:preco:${lista.join(",")}`, 60 * 1000, false, async () =>
      JSON.parse(await baixa(`https://api.coingecko.com/api/v3/simple/price?ids=${lista.join(",")}` +
        `&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true`)));
    for (const [t, id] of Object.entries(ids)) {
      const x = d[id];
      if (x && x.brl != null) {
        saida[t] = { preco: x.brl, variacao_dia: x.brl_24h_change ?? null,
          quando: x.last_updated_at ? new Date(x.last_updated_at * 1000).toISOString() : null, fonte: "CoinGecko" };
      }
    }
  }
  return saida;
}

// ------------------------------------------------------------------ cotação de agora
async function cotacaoYahoo(ticker: string, classe: string) {
  return comCache(`spot:${simbolo(ticker, classe)}`, 60 * 1000, false, async () => {
    const d = JSON.parse(await baixa(`https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(simbolo(ticker, classe))}?range=1d&interval=1d`));
    const m = d.chart.result[0].meta;
    const ant = m.chartPreviousClose ?? m.previousClose;
    return { preco: m.regularMarketPrice, variacao_dia: ant ? (m.regularMarketPrice / ant - 1) * 100 : null,
      quando: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null, fonte: "Yahoo Finance" };
  });
}

async function cotacoes(itens: { ticker: string; classe: string }[]) {
  const cripto = itens.filter((i) => i.classe === "cripto").map((i) => i.ticker.toUpperCase());
  const bolsa = itens.filter((i) => i.classe !== "cripto");
  const saida: Record<string, any> = {};
  try { Object.assign(saida, await cotacoesCripto(cripto)); } catch (_) { /* cai no Yahoo abaixo */ }
  // cripto que o CoinGecko não achou: Yahoo em dólar × câmbio de agora
  const faltam = cripto.filter((t) => !saida[t]);
  if (faltam.length) {
    try {
      const fx = await cotacaoYahoo("BRL=X", "moeda");
      for (const t of faltam) {
        try {
          const u = await cotacaoYahoo(simboloCripto(t), "cripto");
          saida[t] = { ...u, preco: u.preco * fx.preco, fonte: "Yahoo Finance (USD × câmbio)" };
        } catch (e) { saida[t] = { erro: String(e).slice(0, 120) }; }
      }
    } catch (e) { for (const t of faltam) saida[t] = { erro: "câmbio indisponível" }; }
  }
  await emLotes(bolsa, 8, async (i) => {
    const t = i.ticker.toUpperCase();
    try { saida[t] = await cotacaoYahoo(t, i.classe); } catch (e) { saida[t] = { erro: String(e).slice(0, 120) }; }
  });
  return saida;
}

// ------------------------------------------------------------------ registro diário
// A mesma conta do app, no servidor: posição = quantidade inicial (a não
// ser que o extrato importado já traga a posição inteira) + aportes;
// renda fixa = saldo + aportes manuais; agro = o último valor que o app
// calculou (o rebanho só muda por lançamento, e lançamento é feito no app).
function hojeBrasil() {
  return new Date(Date.now() - 3 * HORA).toISOString().slice(0, 10);
}

async function registroDiario() {
  const { data: usuarios } = await admin.from("ativos").select("user_id");
  const { data: comRf } = await admin.from("renda_fixa").select("user_id");
  const ids = [...new Set([...(usuarios || []), ...(comRf || [])].map((u: any) => u.user_id))];
  const resultado: unknown[] = [];
  for (const uid of ids) {
    try {
      const [{ data: ativos }, { data: aportes }, { data: rf }, { data: ultimo }] = await Promise.all([
        admin.from("ativos").select("*").eq("user_id", uid),
        admin.from("aportes").select("tipo,ticker,quantidade,preco,valor,titulo,origem,historico").eq("user_id", uid),
        admin.from("renda_fixa").select("*").eq("user_id", uid),
        admin.from("patrimonio_historico").select("agro").eq("user_id", uid).order("data", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const reg: Record<string, { q: number; c: number }> = {};
      const importados = new Set<string>();
      for (const a of aportes || []) {
        if (a.tipo !== "ativo" || !a.ticker) continue;
        const r = (reg[a.ticker] = reg[a.ticker] || { q: 0, c: 0 });
        r.q += Number(a.quantidade); r.c += Number(a.quantidade) * Number(a.preco);
        if (a.origem) importados.add(a.ticker);
      }
      const carteira = (ativos || []).filter((a: any) => a.lista === "carteira" || reg[a.ticker]);
      const precos = await cotacoes(carteira.map((a: any) => ({ ticker: a.ticker, classe: a.classe })));
      const linhas: any[] = [];
      const porPilar: Record<string, number> = {};
      let rv = 0, cripto = 0, investido = 0;
      for (const a of carteira) {
        const base = importados.has(a.ticker) ? 0 : Number(a.quantidade) || 0;
        const pm = importados.has(a.ticker) ? null : a.preco_medio != null ? Number(a.preco_medio) : null;
        const r = reg[a.ticker] || { q: 0, c: 0 };
        const q = base + r.q;
        const p = precos[a.ticker]?.preco;
        if (!(q > 1e-12) || p == null) continue;
        const valor = q * p;
        const custo = (base && !pm) ? null : (base * (pm || 0) + r.c);
        linhas.push({ ticker: a.ticker, classe: a.classe, pilar: a.pilar, quantidade: q, preco: p, valor, custo });
        porPilar[a.pilar] = (porPilar[a.pilar] || 0) + valor;
        if (a.classe === "cripto") cripto += valor; else rv += valor;
        if (custo != null) investido += custo;
      }
      const extra: Record<string, number> = {};
      for (const a of aportes || []) if (a.tipo === "caixa" && !a.historico && !a.origem) extra[a.titulo] = (extra[a.titulo] || 0) + Number(a.valor);
      let rfTotal = 0;
      for (const r of rf || []) {
        const v = Number(r.valor_aplicado) + (extra[r.nome] || 0);
        rfTotal += v; porPilar[r.pilar] = (porPilar[r.pilar] || 0) + v;
      }
      const agro = Number(ultimo?.agro) || 0;
      if (agro) porPilar.agro = (porPilar.agro || 0) + agro;
      const patrimonio = rv + cripto + rfTotal + agro;
      const linha = { user_id: uid, data: hojeBrasil(), registrado_em: new Date().toISOString(), origem: "automatico",
        patrimonio, renda_variavel: rv, cripto, renda_fixa: rfTotal, agro, investido, por_pilar: porPilar, ativos: linhas };
      const { error } = await admin.from("patrimonio_historico").upsert(linha, { onConflict: "user_id,data" });
      if (error) throw error;
      const semPreco = carteira.filter((a: any) => precos[a.ticker]?.preco == null).map((a: any) => a.ticker);
      await admin.from("log_sistema").insert({ user_id: uid, origem: "automatico", evento: "registro_diario",
        detalhe: { patrimonio, ativos: linhas.length, sem_preco: semPreco } });
      resultado.push({ uid, patrimonio, ativos: linhas.length });
    } catch (e) {
      await admin.from("log_sistema").insert({ user_id: uid, origem: "automatico", evento: "erro",
        detalhe: { etapa: "registro_diario", erro: String((e as any)?.message || e).slice(0, 300) } });
      resultado.push({ uid, erro: String(e).slice(0, 200) });
    }
  }
  return resultado;
}

// ------------------------------------------------------------------ servidor
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);

  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400); }

  // o agendamento do banco se identifica pelo segredo; o resto, pelo login
  const segredo = Deno.env.get("CRON_SECRET");
  if (corpo.acao === "registro_diario") {
    if (!segredo || req.headers.get("x-cron-secret") !== segredo) return resposta({ erro: "não autorizado" }, 401);
    return resposta({ ok: true, usuarios: await registroDiario() });
  }
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem, error: erroAuth } = await admin.auth.getUser(token);
  if (erroAuth || !quem?.user) return resposta({ erro: "faça login" }, 401);
  const forcar = !!corpo.forcar;

  try {
    if (corpo.acao === "universo") {
      const [f, a, m] = await Promise.all([
        comCache("fundamentus:fiis", 6 * HORA, forcar, fiis),
        comCache("fundamentus:acoes", 6 * HORA, forcar, acoes),
        comCache("bcb:macro", 6 * HORA, forcar, macro),
      ]);
      return resposta({ fiis: f, acoes: a, macro: m, gerado: new Date().toISOString() });
    }

    if (corpo.acao === "historicos") {
      const anos = Math.min(Math.max(Number(corpo.anos) || 3, 1), 10);
      const itens = (corpo.itens ?? []).slice(0, 80) as { ticker: string; classe: string }[];
      const pares = await emLotes(itens, 8, async (it) => {
        const t = String(it.ticker || "").toUpperCase().replace(/[^A-Z0-9.^-]/g, "");
        if (!t) return [t, { erro: "ticker vazio" }] as const;
        try {
          const s = it.classe === "cripto"
            ? await comCache(`cripto:${simboloCripto(t)}:${anos}y`, HORA, forcar, () => serieCripto(t, anos, forcar))
            : await comCache(`yahoo:${simbolo(t, it.classe)}:${anos}y`, 6 * HORA, forcar,
              () => serieYahoo(t, it.classe, anos));
          return [t, s] as const;
        } catch (e) {
          return [t, { erro: String(e).slice(0, 120) }] as const;
        }
      });
      return resposta(Object.fromEntries(pares));
    }

    if (corpo.acao === "cotacoes") {
      const itens = (corpo.itens ?? []).slice(0, 100).map((i: any) => ({
        ticker: String(i.ticker || "").toUpperCase().replace(/[^A-Z0-9.^-]/g, ""), classe: String(i.classe || "acao_br") }))
        .filter((i: any) => i.ticker);
      return resposta(await cotacoes(itens));
    }

    if (corpo.acao === "benchmarks") {
      const anos = Math.min(Math.max(Number(corpo.anos) || 5, 1), 10);
      const [cdi, ibov] = await Promise.all([
        comCache(`bcb:cdi_diario:${anos}y`, 12 * HORA, forcar, () => cdiDiario(anos))
          .catch(() => []),
        comCache(`yahoo:^BVSP:${anos}y`, 12 * HORA, forcar, () => serieYahoo("^BVSP", "indice", anos))
          .then((s: any) => s.precos).catch(() => []),
      ]);
      return resposta({ cdi, ibov });
    }

    return resposta({ erro: "ação desconhecida" }, 400);
  } catch (e) {
    return resposta({ erro: String(e).slice(0, 200) }, 502);
  }
});
