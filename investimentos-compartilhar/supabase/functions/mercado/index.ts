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
//   {acao: "proventos", itens: [{ticker, classe}]} dividendos, JCP e rendimentos
//                                                com data com e data de pagamento
//   {acao: "fiis_cvm", forcar?}                  vacância financeira, concentração e tipo de cada FII (CVM)
//   {acao: "indices", forcar?}                   completa CDI, Selic e IPCA em indices_diarios
//   {acao: "apagar_conta", confirmacao: "APAGAR"} apaga a conta e todos os dados
//   {acao: "registro_diario"}                    só o agendamento (x-cron-secret):
//                                                grava a foto do dia de cada usuário
//
// Fontes gratuitas, sem chave: cripto no CoinGecko (já em reais); bolsa
// no Yahoo; macro no Banco Central; fundamentos no Fundamentus.

import { createClient } from "npm:@supabase/supabase-js@2";
import { lerZip, resumoFiis } from "./cvm.ts";

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
  return { dados: data.dados, fresco: idade < validadeMs, em: data.atualizado_em as string };
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
  return (await comCacheInfo(chave, validadeMs, forcar, buscar)).dados;
}

// O mesmo, dizendo se o dado é velho (a fonte falhou e voltou o guardado)
// e quando ele foi guardado.
async function comCacheInfo<T>(chave: string, validadeMs: number, forcar: boolean,
                               buscar: () => Promise<T>): Promise<{ dados: T; velho: boolean; em: string | null }> {
  const c = await doCache(chave, validadeMs);
  if (c && c.fresco && !forcar) return { dados: c.dados as T, velho: false, em: c.em };
  try {
    const novo = await buscar();
    await guarda(chave, novo);
    return { dados: novo, velho: false, em: new Date().toISOString() };
  } catch (e) {
    if (c) return { dados: c.dados as T, velho: true, em: c.em };
    throw e;
  }
}

async function baixa(url: string, latin1 = false): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "*/*" } });
  if (!r.ok) {
    // guarda o status e o começo da resposta (o BCB diz "Value(s) not found" no 404)
    const corpo = await r.text().catch(() => "");
    throw Object.assign(new Error(`${r.status} em ${new URL(url).host}`), { status: r.status, corpo: corpo.slice(0, 200) });
  }
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

// o Yahoo marca a barra na abertura do pregão local (BRL=X vem às 23:00
// UTC do dia anterior): a data sai no fuso da bolsa (gmtoffset, em segundos)
function iso(ts: number, offset = 0) {
  return new Date((ts + offset) * 1000).toISOString().slice(0, 10);
}

// O Yahoo às vezes publica um dia com a escala errada (1,07 em vez de
// 107). Cada ponto é comparado com a mediana dos vizinhos; o salto
// isolado sai, a tendência verdadeira fica.
function semOutliers(p: [string, number][], janela = 11, tol = 0.5) {
  if (p.length < janela) return { precos: p, descartados: 0 };
  const meio = Math.floor(janela / 2);
  const limpos: [string, number][] = [];
  for (let i = 0; i < p.length; i++) {
    // nas pontas a janela desliza (não encolhe): no fim, os últimos 11 dias
    const ini = Math.max(0, Math.min(i - meio, p.length - janela));
    const viz = p.slice(ini, ini + janela).map((x) => x[1]).sort((a, b) => a - b);
    const med = viz[Math.floor(viz.length / 2)];
    if (med && Math.abs(p[i][1] / med - 1) <= tol) { limpos.push(p[i]); continue; }
    // nos últimos dias a mediana ainda não "viu" o movimento: fica se um
    // vizinho confirma o novo patamar (salto de 2+ dias é real; o isolado sai)
    const perto = (j: number) => j >= 0 && j < p.length && Math.abs(p[i][1] / p[j][1] - 1) <= tol;
    if (i >= p.length - meio && (perto(i - 1) || perto(i + 1))) limpos.push(p[i]);
  }
  return { precos: limpos, descartados: p.length - limpos.length };
}

// série na moeda em que o Yahoo publica (AAPL em dólar)
async function serieYahooBruta(ticker: string, classe: string, anos: number) {
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
  const off = Number(meta.gmtoffset) || 0;
  const ts: number[] = res.timestamp ?? [];
  const fech: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];
  const brutos: [string, number][] = [];
  ts.forEach((t, i) => { if (fech[i] != null) brutos.push([iso(t, off), Number(fech[i]!.toPrecision(8))]); });
  const { precos, descartados } = semOutliers(brutos);

  const divs = Object.values(res.events?.dividends ?? {})
    .map((d: any) => [iso(d.date, off), d.amount] as [string, number])
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

// ------------------------------------------------------------------ câmbio
// Tudo sai daqui em reais. O que o Yahoo publica em outra moeda (ação
// americana, cripto em dólar — o Yahoo não tem mais BTC-BRL) é convertido
// pelo câmbio de CADA dia, não pelo de hoje — senão o histórico misturaria
// a variação da moeda com a do ativo.
function parCambio(moeda: string) {
  if (moeda === "GBp") return { par: "GBPBRL=X", fator: 0.01 };   // Londres cota em pence
  return { par: moeda === "USD" ? "BRL=X" : `${moeda.toUpperCase()}BRL=X`, fator: 1 };
}

async function serieYahoo(ticker: string, classe: string, anos: number, forcar = false) {
  const s = await serieYahooBruta(ticker, classe, anos);
  if (!s.moeda || s.moeda === "BRL") return s;
  const { par, fator } = parCambio(s.moeda);
  const fx: any = await comCache(`yahoo:${par}:${anos}y:brl`, 6 * HORA, forcar, () => serieYahooBruta(par, "moeda", anos));
  const cambio = fx.precos as [string, number][];
  if (!cambio.length) throw new Error("câmbio indisponível");
  // câmbio do dia, ou do último dia útil antes dele (cripto negocia no fim de semana)
  const emReais = (lista: [string, number][]) => {
    let j = 0;
    return lista.map(([d, p]) => {
      while (j + 1 < cambio.length && cambio[j + 1][0] <= d) j++;
      return [d, Number((p * fator * cambio[j][1]).toPrecision(10))] as [string, number];
    });
  };
  const precos = emReais(s.precos), dividendos = emReais(s.dividendos);
  const hojeFx = fx.preco || cambio.at(-1)![1];
  const corte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const ano = precos.filter(([d]) => d >= corte).map(([, p]) => p);
  const u200 = precos.slice(-200).map(([, p]) => p);
  return {
    ...s, precos, dividendos, moeda: "BRL", moeda_origem: s.moeda, cambio: hojeFx * fator,
    preco: s.preco != null ? s.preco * fator * hojeFx : precos.at(-1)?.[1] ?? null,
    media_200d: u200.length >= 100 ? u200.reduce((a, b) => a + b, 0) / u200.length : null,
    max_52s: ano.length ? Math.max(...ano) : null,
    min_52s: ano.length ? Math.min(...ano) : null,
  };
}

// ------------------------------------------------------------------ cripto
function simboloCripto(ticker: string) {
  return ticker.includes("-") ? ticker : ticker + "-USD";
}

async function serieCripto(ticker: string, anos: number, forcar: boolean) {
  const s = await serieYahoo(simboloCripto(ticker), "cripto", anos, forcar);
  return { ...s, dividendos: [] };
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

// ------------------------------------------------------------------ índices históricos
// CDI (série 12) e Selic (11) em % ao dia útil; IPCA (433) em % ao mês.
// Ficam na tabela indices_diarios; aqui só se completa o que falta.
const SERIES_INDICES: Record<string, number> = { cdi: 12, selic: 11, ipca: 433 };
const INICIO_INDICES = "2015-01-01";
const brData = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };

// o BCB oscila (502, conexão recusada): tenta de novo antes de desistir.
// 404 "Value(s) not found" é só "nada novo no período": lista vazia, sem retentativa.
async function baixaComRetentativa(url: string, tentativas = 3): Promise<string> {
  let erro: unknown = null;
  for (let k = 0; k < tentativas; k++) {
    try { return await baixa(url); } catch (e: any) {
      if (e?.status === 404 && /not found/i.test(String(e.corpo || ""))) return "[]";
      erro = e; await new Promise((r) => setTimeout(r, 800 * (k + 1) * (k + 1)));
    }
  }
  throw erro;
}
const isoBr = (br: string) => { const [d, m, a] = br.split("/"); return `${a}-${m}-${d}`; };

// IPCA mensal pelo IBGE (SIDRA, tabela 1737, variável 63), se o BCB falhar
async function ipcaIbge(desde: string) {
  const d = JSON.parse(await baixaComRetentativa("https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63/p/all?formato=json"));
  return (d as any[]).slice(1).map((x) => ({ data: `${String(x.D3C).slice(0, 4)}-${String(x.D3C).slice(4, 6)}-01`, valor: Number(x.V) }))
    .filter((r) => r.data >= desde && Number.isFinite(r.valor));
}

async function atualizaIndices() {
  const hoje = new Date().toISOString().slice(0, 10);
  const feito: Record<string, unknown> = {};
  const grava = async (rows: { indice: string; data: string; valor: number }[]) => {
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await admin.from("indices_diarios").upsert(rows.slice(i, i + 1000), { onConflict: "indice,data" });
      if (error) throw error;
    }
  };
  for (const [indice, cod] of Object.entries(SERIES_INDICES)) {
    const { data: ult } = await admin.from("indices_diarios").select("data").eq("indice", indice)
      .order("data", { ascending: false }).limit(1).maybeSingle();
    const { data: pri } = await admin.from("indices_diarios").select("data").eq("indice", indice)
      .order("data", { ascending: true }).limit(1).maybeSingle();
    let n = 0;
    const erros: string[] = [];
    // começo da série faltando (ex.: veio só o cache de 5 anos): completa até o 1º dia que já existe
    if (pri && pri.data > INICIO_INDICES && indice !== "ipca") {
      for (let a = INICIO_INDICES; a < pri.data;) {
        const f = new Date(Math.min(Date.parse(a) + 365 * 86400000, Date.parse(pri.data) - 86400000)).toISOString().slice(0, 10);
        try {
          const linhas = JSON.parse(await baixaComRetentativa(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${cod}/dados?formato=json&dataInicial=${brData(a)}&dataFinal=${brData(f)}`, 2));
          const rows = (Array.isArray(linhas) ? linhas : []).map((x: any) => ({ indice, data: isoBr(String(x.data)), valor: Number(String(x.valor).replace(",", ".")) })).filter((r) => Number.isFinite(r.valor));
          await grava(rows); n += rows.length;
        } catch (e) { erros.push(`início ${a}: ${String((e as any)?.message || e).slice(0, 60)}`); break; }
        a = new Date(Date.parse(f) + 86400000).toISOString().slice(0, 10);
      }
    }
    let de = ult ? new Date(Date.parse(ult.data + "T12:00:00Z") + 86400000).toISOString().slice(0, 10) : INICIO_INDICES;
    // blocos de 1 ano (o BCB limita a 10 anos e fica instável com consultas grandes)
    while (de <= hoje) {
      const fim = new Date(Math.min(Date.parse(de) + 365 * 86400000, Date.parse(hoje))).toISOString().slice(0, 10);
      try {
        const linhas = JSON.parse(await baixaComRetentativa(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${cod}/dados?formato=json&dataInicial=${brData(de)}&dataFinal=${brData(fim)}`));
        const rows = (Array.isArray(linhas) ? linhas : []).map((x: any) => ({ indice, data: isoBr(String(x.data)), valor: Number(String(x.valor).replace(",", ".")) }))
          .filter((r) => Number.isFinite(r.valor));
        await grava(rows); n += rows.length;
      } catch (e) {
        erros.push(`${de}: ${String((e as any)?.message || e).slice(0, 100)}`);
        break;   // não pula buracos: a próxima rodada recomeça daqui
      }
      de = new Date(Date.parse(fim) + 86400000).toISOString().slice(0, 10);
    }
    // reservas: CDI do cache que o gráfico de benchmarks já guardou; IPCA do IBGE
    if (erros.length && indice === "cdi") {
      const { data: c } = await admin.from("mercado_cache").select("dados").like("chave", "bcb:cdi_diario:%").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      const rows = ((c?.dados as [string, number][]) || []).filter(([d]) => !ult || d > ult.data).map(([d, v]) => ({ indice, data: d, valor: v }));
      if (rows.length) { await grava(rows); n += rows.length; erros.push(`usado o cache do CDI (${rows.length} dias)`); }
    }
    if (erros.length && indice === "ipca") {
      try { const rows = (await ipcaIbge(ult ? ult.data : INICIO_INDICES)).map((r) => ({ indice, ...r })); await grava(rows); n += rows.length; erros.push(`usado o IBGE (${rows.length} meses)`); }
      catch (e) { erros.push("IBGE: " + String(e).slice(0, 80)); }
    }
    feito[indice] = erros.length ? { gravados: n, avisos: erros } : n;
  }
  return feito;
}

async function lerIndices(desde: string) {
  const saida: Record<string, [string, number][]> = { cdi: [], selic: [], ipca: [] };
  for (const indice of Object.keys(SERIES_INDICES)) {
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("indices_diarios").select("data,valor").eq("indice", indice)
        .gte("data", indice === "ipca" ? desde.slice(0, 7) + "-01" : desde).order("data").range(de, de + 999);
      for (const r of data || []) saida[indice].push([r.data, Number(r.valor)]);
      if (!data || data.length < 1000) break;
    }
  }
  return saida;
}

// Fator de um aporte de renda fixa entre a data dele e "ate" (exclusiva):
// pós-fixado composto dia a dia com o índice de cada dia útil; prefixado
// por dias úteis/252; IPCA + X pró-rata pelos dias úteis do mês. O
// calendário de dias úteis é o do próprio CDI; depois do último dado
// publicado, vale o último valor (estimativa).
// Sem nenhum dado na tabela, vale a taxa anual de hoje do Banco Central
// (idx.reserva, do macro) — melhor uma estimativa que rendimento zero.
// dias úteis: sem fim de semana e sem feriado bancário nacional (o mesmo
// calendário de assets/js/util.js)
const somaDias = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
function pascoa(ano: number) {     // algoritmo de Meeus/Jones/Butcher
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const cacheFeriados: Record<number, Set<string>> = {};
function feriados(ano: number) {
  if (cacheFeriados[ano]) return cacheFeriados[ano];
  const p = pascoa(ano);
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"].map((d) => `${ano}-${d}`);
  if (ano >= 2024) fixos.push(`${ano}-11-20`);          // Consciência Negra, feriado nacional desde 2024
  const moveis = [somaDias(p, -48), somaDias(p, -47), somaDias(p, -2), somaDias(p, 60)]; // Carnaval, Sexta Santa, Corpus Christi
  return (cacheFeriados[ano] = new Set([...fixos, ...moveis]));
}
function ehUtil(iso: string) {
  const dow = new Date(iso + "T12:00:00Z").getUTCDay();
  return dow !== 0 && dow !== 6 && !feriados(Number(iso.slice(0, 4))).has(iso);
}

const aoDia = (anual: number | null | undefined) => (anual == null ? 0 : (Math.pow(1 + anual / 100, 1 / 252) - 1) * 100);
const aoMes = (anual: number | null | undefined) => (anual == null ? 0 : (Math.pow(1 + anual / 100, 1 / 12) - 1) * 100);

function fatorRF(indexador: string, taxa: number, de: string, ate: string, idx: Record<string, any>) {
  if (!(de < ate)) return 1;
  const cal = idx.cdi;
  const ultimoCal = cal.length ? cal.at(-1)![0] : "0000";
  const diasUteis: string[] = (cal as [string, number][]).filter(([d]) => d >= de && d < ate).map(([d]) => d);
  // depois do último dia publicado: dias úteis do calendário (feriados fora), com o último valor
  for (let d = ultimoCal >= de ? somaDias(ultimoCal, 1) : de; d < ate; d = somaDias(d, 1)) {
    if (ehUtil(d)) diasUteis.push(d);
  }
  let f = 1;
  if (indexador === "cdi" || indexador === "selic") {
    // Selic sem dado no dia: o CDI do dia (ficam a ~0,1 p.p. ao ano)
    const s = idx[indexador].length ? idx[indexador] : idx.cdi, mapa = new Map(s), cdi = new Map(idx.cdi);
    const res = idx.reserva || {};
    const ultimo = s.length ? s.at(-1)![1] : aoDia(indexador === "selic" ? res.selic_meta ?? res.cdi : res.cdi);
    for (const d of diasUteis) f *= 1 + ((mapa.get(d) ?? cdi.get(d) ?? ultimo) / 100) * (taxa / 100);
  } else if (indexador === "prefixado") {
    f = Math.pow(1 + taxa / 100, diasUteis.length / 252);
  } else if (indexador === "ipca") {
    const ipca = new Map((idx.ipca as [string, number][]).map(([d, v]) => [d.slice(0, 7), v])), ultimo = idx.ipca.length ? idx.ipca.at(-1)![1] : aoMes((idx.reserva || {}).ipca_12m);
    // dias úteis do mês INTEIRO: os publicados e, depois do último, os do
    // calendário até o fim do mês — senão o IPCA do mês entraria em poucos dias
    const porMes: Record<string, number> = {};
    for (const [d] of cal) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + 1;
    const fimEst = somaDias(ate.slice(0, 7) + "-28", 4).slice(0, 7) + "-01";   // 1º dia do mês seguinte a "ate"
    for (let d = cal.length ? somaDias(ultimoCal, 1) : de.slice(0, 7) + "-01"; d < fimEst; d = somaDias(d, 1)) {
      if (ehUtil(d)) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + 1;
    }
    for (const d of diasUteis) {
      const m = d.slice(0, 7), du = porMes[m] || 21;
      f *= Math.pow(1 + (ipca.get(m) ?? ultimo) / 100, 1 / du) * Math.pow(1 + taxa / 100, 1 / 252);
    }
  }
  return f;
}

// valor de hoje de cada título: saldo inicial e cada aporte rendendo do seu dia
function valorTitulos(rf: any[], aportes: any[], idx: Record<string, any>, hoje: string) {
  const out: Record<string, number> = {};
  for (const r of rf) {
    const ind = r.tipo, tx = r.taxa != null ? Number(r.taxa) : (ind === "cdi" || ind === "selic" ? 100 : 0);
    const ini = r.data_inicio || String(r.criado_em).slice(0, 10);
    // valor atual informado à mão: vale na data dele; só os aportes depois somam
    const manual = r.valor_atual != null && Number.isFinite(Number(r.valor_atual)) ? String(r.valor_atual_em || hoje) : null;
    let v = manual ? Number(r.valor_atual) : Number(r.valor_aplicado) ? Number(r.valor_aplicado) * fatorRF(ind, tx, ini, hoje, idx) : 0;
    for (const a of aportes) {
      if (a.tipo !== "caixa" || a.historico || a.origem || a.titulo !== r.nome) continue;
      if (manual && a.data <= manual) continue;
      const ia = a.indexador || ind, ta = a.taxa != null ? Number(a.taxa) : tx;
      v += Number(a.valor) * fatorRF(ia, ta, a.data, hoje, idx);
    }
    out[r.nome] = v;
  }
  return out;
}

// ------------------------------------------------------------------ FIIs pela CVM
// Informe trimestral nos dados abertos da CVM: o ano corrente e o anterior
// (no começo do ano, o último trimestre entregue ainda está no anterior).
async function fiisCvm() {
  const ano = new Date().getUTCFullYear();
  const zips = [];
  const erros: string[] = [];
  for (const a of [ano - 1, ano]) {
    try {
      const r = await fetch(`https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_${a}.zip`, { headers: { "User-Agent": UA } });
      if (!r.ok) { erros.push(`${a}: ${r.status}`); continue; }
      zips.push(lerZip(new Uint8Array(await r.arrayBuffer())));
    } catch (e) { erros.push(`${a}: ${String(e).slice(0, 80)}`); }
  }
  if (!zips.length) throw new Error("CVM indisponível: " + erros.join("; "));
  return { gerado: new Date().toISOString(), fonte: "CVM · informe trimestral de FII (dados abertos)", fundos: resumoFiis(zips) };
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
    const c = await comCacheInfo(`coingecko:preco:${lista.join(",")}`, 60 * 1000, false, async () =>
      JSON.parse(await baixa(`https://api.coingecko.com/api/v3/simple/price?ids=${lista.join(",")}` +
        `&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true`)));
    const d: any = c.dados;
    for (const [t, id] of Object.entries(ids)) {
      const x = d[id];
      if (x && x.brl != null) {
        saida[t] = { preco: x.brl, variacao_dia: x.brl_24h_change ?? null,
          quando: x.last_updated_at ? new Date(x.last_updated_at * 1000).toISOString() : null, fonte: "CoinGecko",
          ...(c.velho ? { velho: true, cache_em: c.em } : {}) };
      }
    }
  }
  return saida;
}

// ------------------------------------------------------------------ cotação de agora
// Sempre em reais: fora do BRL, converte pelo câmbio de agora (a variação
// do dia junta a do ativo e a da moeda). A chave ":brl" separa do cache
// antigo, que guardava o preço na moeda de origem.
// Se a fonte falhar e voltar o guardado, sai marcado {velho, cache_em}.
async function cotacaoYahoo(ticker: string, classe: string): Promise<any> {
  const sym = simbolo(ticker, classe);
  const r = await comCacheInfo(`spot:${sym}:brl`, 60 * 1000, false, async () => {
    const d = JSON.parse(await baixa(`https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(sym)}?range=1d&interval=1d`));
    const m = d.chart.result[0].meta;
    const ant = m.chartPreviousClose ?? m.previousClose;
    let preco = m.regularMarketPrice, variacao = ant ? (m.regularMarketPrice / ant - 1) * 100 : null;
    const extra: Record<string, unknown> = {};
    if (m.currency && m.currency !== "BRL") {
      const { par, fator } = parCambio(m.currency);
      const fx = await cotacaoYahoo(par, "moeda");
      // câmbio velho não vira preço "novo" no cache: cai no guardado (marcado velho)
      if (fx.velho || fx.preco == null) throw new Error("câmbio indisponível");
      preco = preco * fator * fx.preco;
      if (variacao != null && fx.variacao_dia != null) variacao = ((1 + variacao / 100) * (1 + fx.variacao_dia / 100) - 1) * 100;
      Object.assign(extra, { moeda_origem: m.currency, cambio: fx.preco * fator });
    }
    return { preco, variacao_dia: variacao, ...extra,
      quando: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null, fonte: "Yahoo Finance" };
  });
  return r.velho ? { ...(r.dados as any), velho: true, cache_em: r.em } : r.dados;
}

async function cotacoes(itens: { ticker: string; classe: string }[]) {
  const cripto = itens.filter((i) => i.classe === "cripto").map((i) => i.ticker.toUpperCase());
  const bolsa = itens.filter((i) => i.classe !== "cripto");
  const saida: Record<string, any> = {};
  try { Object.assign(saida, await cotacoesCripto(cripto)); } catch (_) { /* cai no Yahoo abaixo */ }
  // cripto que o CoinGecko não achou: Yahoo em dólar × câmbio de agora (convertido em cotacaoYahoo)
  for (const t of cripto.filter((t) => !saida[t])) {
    try {
      saida[t] = { ...await cotacaoYahoo(simboloCripto(t), "cripto"), fonte: "Yahoo Finance (USD × câmbio)" };
    } catch (e) { saida[t] = { erro: String(e).slice(0, 120) }; }
  }
  await emLotes(bolsa, 8, async (i) => {
    const t = i.ticker.toUpperCase();
    try { saida[t] = await cotacaoYahoo(t, i.classe); } catch (e) { saida[t] = { erro: String(e).slice(0, 120) }; }
  });
  return saida;
}

// ------------------------------------------------------------------ proventos
// O Fundamentus lista, por ação e por FII, cada provento com a data com, a
// data de pagamento (inclusive os já anunciados e ainda não pagos) e o
// valor. Para ETF e ativo americano só há o Yahoo, que dá a data com.
function dataBr(t: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((t || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function proventosFundamentus(ticker: string, fii: boolean) {
  const url = fii
    ? `https://www.fundamentus.com.br/fii_proventos.php?papel=${ticker}&tipo=2`
    : `https://www.fundamentus.com.br/proventos.php?papel=${ticker}&tipo=2`;
  const html = await baixa(url, true);
  const corte = new Date(Date.now() - 6 * 365 * 86400000).toISOString().slice(0, 10);
  const lista: unknown[] = [];
  for (const c of tabela(html)) {
    let dataCom, pagamento, valor, tipo, fator = 1;
    if (fii) {
      if (c.length < 4) continue;
      [dataCom, tipo, pagamento, valor] = [dataBr(c[0]), c[1], dataBr(c[2]), numBr(c[3])];
    } else {
      if (c.length < 5) continue;       // a 2ª tabela da página é o resumo por ano
      [dataCom, valor, tipo, pagamento, fator] = [dataBr(c[0]), numBr(c[1]), c[2], dataBr(c[3]), numBr(c[4]) || 1];
    }
    if (!dataCom || !valor || dataCom < corte) continue;
    const t = String(tipo || "").toUpperCase();
    lista.push({ data_com: dataCom, pagamento, valor: valor / fator,
      tipo: t.includes("JRS") || t.includes("JUROS") ? "JCP" : t.includes("REND") ? "Rendimento" : t.includes("DIVID") ? "Dividendo" : String(tipo) });
  }
  return { fonte: "Fundamentus", lista };
}

// FII ou ação? A classe que o app manda nem sempre é confiável (um ticker
// visto só num aporte chega como "acao_br"), e a página errada do
// Fundamentus volta vazia. Decide pela lista de FIIs do próprio Fundamentus
// e, se ainda vier vazio, tenta a outra página. O cache guarda o tipo na
// chave, para um pedido errado não esconder os proventos de ninguém.
async function proventosB3(t: string, classe: string) {
  let fii = classe === "fii";
  try {
    const lista: any = await comCache("fundamentus:fiis", 6 * HORA, false, fiis);
    if (lista && lista[t]) fii = true;
  } catch { /* segue com a classe informada */ }
  const busca = (ehFii: boolean) => comCache(`proventos:${ehFii ? "fii" : "acao"}:${t}`, 12 * HORA, false, () => proventosFundamentus(t, ehFii));
  const r: any = await busca(fii);
  if ((r.lista || []).length || !/11$/.test(t)) return r;
  const outra: any = await busca(!fii);
  return (outra.lista || []).length ? outra : r;
}

async function proventos(itens: { ticker: string; classe: string }[]) {
  const saida: Record<string, unknown> = {};
  await emLotes(itens, 6, async (i) => {
    const t = i.ticker.toUpperCase();
    try {
      if (i.classe === "acao_br" || i.classe === "fii") {
        saida[t] = await proventosB3(t, i.classe);
      } else if (i.classe !== "cripto") {
        const s: any = await comCache(`yahoo:${simbolo(t, i.classe)}:5y:brl`, 12 * HORA, false, () => serieYahoo(t, i.classe, 5));
        saida[t] = { fonte: "Yahoo Finance (só data com)", lista: (s.dividendos || []).map(([d, v]: [string, number]) =>
          ({ data_com: d, pagamento: null, valor: v, tipo: "Dividendo" })) };
      }
    } catch (e) { saida[t] = { erro: String(e).slice(0, 120), lista: [] }; }
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

// Quantidade e custo de uma posição, como posicao() do app: base primeiro,
// depois compras e vendas por data (no mesmo dia, compra antes de venda).
// A venda tira a mesma fração da quantidade e do custo (o preço médio não
// muda). Custo só quando se conhece o de todas as cotas; senão null.
type Evento = { data: string; q: number; preco: unknown };
function posicaoServidor(qBase: number, pmBase: number | null, eventos: Evento[]) {
  const ev = [...eventos].sort((a, b) => a.data.localeCompare(b.data) || Number(a.q < 0) - Number(b.q < 0));
  let q = qBase, qt = qBase, custo = 0, qCusto = 0;
  if (pmBase && qBase) { custo = qBase * pmBase; qCusto = qBase; }
  for (const e of ev) {
    q += e.q;
    if (e.q > 0) {
      qt += e.q;
      const p = e.preco == null || e.preco === "" ? NaN : Number(e.preco);
      if (Number.isFinite(p)) { custo += e.q * p; qCusto += e.q; }
    } else if (e.q < 0 && qt > 1e-12) {
      const fr = Math.min(1, -e.q / qt);
      custo -= custo * fr; qCusto -= qCusto * fr; qt += e.q;
    }
  }
  const completo = qCusto >= q - 1e-9;
  return { q, custo: completo && custo ? custo : null };
}

// preço que voltou do cache porque a fonte falhou, guardado há mais de 3 dias
const precoVelho = (c: any) => !!c?.velho && (!c.cache_em || Date.now() - Date.parse(c.cache_em) > 3 * 24 * HORA);

async function registroDiario() {
  try { await atualizaIndices(); } catch { /* o registro segue com o que já tem */ }
  const idx: Record<string, any> = await lerIndices("2015-01-01");
  if (!idx.cdi.length || !idx.ipca.length) { try { idx.reserva = await macro(); } catch { /* sem reserva */ } }
  const { data: usuarios } = await admin.from("ativos").select("user_id");
  const { data: comRf } = await admin.from("renda_fixa").select("user_id");
  const ids = [...new Set([...(usuarios || []), ...(comRf || [])].map((u: any) => u.user_id))];
  const resultado: unknown[] = [];
  for (const uid of ids) {
    try {
      const [{ data: ativos }, { data: aportes }, { data: rf }, { data: ultimo }] = await Promise.all([
        admin.from("ativos").select("*").eq("user_id", uid),
        admin.from("aportes").select("tipo,data,ticker,quantidade,preco,valor,titulo,origem,historico,indexador,taxa").eq("user_id", uid),
        admin.from("renda_fixa").select("*").eq("user_id", uid),
        admin.from("patrimonio_historico").select("agro").eq("user_id", uid).order("data", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const reg: Record<string, Evento[]> = {};
      const importados = new Set<string>();
      for (const a of aportes || []) {
        if (a.tipo !== "ativo" || !a.ticker) continue;
        (reg[a.ticker] = reg[a.ticker] || []).push({ data: a.data || "", q: Number(a.quantidade) || 0, preco: a.preco });
        if (a.origem) importados.add(a.ticker);
      }
      const carteira = (ativos || []).filter((a: any) => a.lista === "carteira" || reg[a.ticker]);
      const precos = await cotacoes(carteira.map((a: any) => ({ ticker: a.ticker, classe: a.classe })));
      const linhas: any[] = [];
      const porPilar: Record<string, number> = {};
      const semPreco: string[] = [];
      let rv = 0, cripto = 0, investido = 0;
      for (const a of carteira) {
        const base = importados.has(a.ticker) ? 0 : Number(a.quantidade) || 0;
        const pm = importados.has(a.ticker) ? null : a.preco_medio != null ? Number(a.preco_medio) : null;
        const { q, custo } = posicaoServidor(base, pm, reg[a.ticker] || []);
        if (!(q > 1e-12)) continue;
        const p = precos[a.ticker]?.preco;
        if (p == null || precoVelho(precos[a.ticker])) { semPreco.push(a.ticker); continue; }
        const valor = q * p;
        linhas.push({ ticker: a.ticker, classe: a.classe, pilar: a.pilar, quantidade: q, preco: p, valor, custo });
        porPilar[a.pilar] = (porPilar[a.pilar] || 0) + valor;
        if (a.classe === "cripto") cripto += valor; else rv += valor;
        if (custo != null) investido += custo;
      }
      const valores = valorTitulos(rf || [], aportes || [], idx, hojeBrasil());
      let rfTotal = 0;
      for (const r of rf || []) {
        const v = valores[r.nome] || 0;
        rfTotal += v; porPilar[r.pilar] = (porPilar[r.pilar] || 0) + v;
      }
      const agro = Number(ultimo?.agro) || 0;
      if (agro) porPilar.agro = (porPilar.agro || 0) + agro;
      const patrimonio = rv + cripto + rfTotal + agro;
      const hoje = hojeBrasil();
      // ativo sem preço (ou com preço velho): a foto sairia menor que a realidade — não grava
      if (semPreco.length) {
        await admin.from("log_sistema").insert({ user_id: uid, origem: "automatico", evento: "registro_diario",
          detalhe: { gravado: false, motivo: "ativo sem preço", sem_preco: semPreco } });
        resultado.push({ uid, gravado: false, sem_preco: semPreco });
        continue;
      }
      // a foto do app (ou importada) do dia vale mais que a automática: nunca sobrescreve
      const { data: existente, error: erroLe } = await admin.from("patrimonio_historico").select("origem")
        .eq("user_id", uid).eq("data", hoje).maybeSingle();
      if (erroLe) throw erroLe;
      if (existente && existente.origem !== "automatico") {
        resultado.push({ uid, gravado: false, motivo: `já há foto do dia (${existente.origem})` });
        continue;
      }
      const linha = { user_id: uid, data: hoje, registrado_em: new Date().toISOString(), origem: "automatico",
        patrimonio, renda_variavel: rv, cripto, renda_fixa: rfTotal, agro, investido: investido || null,
        por_pilar: porPilar, ativos: linhas };
      // atualiza só a automática; sem linha, insere sem sobrescrever (se o app gravar no meio, fica a do app)
      const { error } = existente
        ? await admin.from("patrimonio_historico").update(linha).eq("user_id", uid).eq("data", hoje).eq("origem", "automatico")
        : await admin.from("patrimonio_historico").upsert(linha, { onConflict: "user_id,data", ignoreDuplicates: true });
      if (error) throw error;
      await admin.from("log_sistema").insert({ user_id: uid, origem: "automatico", evento: "registro_diario",
        detalhe: { patrimonio, ativos: linhas.length } });
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
            ? await comCache(`cripto:${simboloCripto(t)}:${anos}y:brl`, HORA, forcar, () => serieCripto(t, anos, forcar))
            : await comCache(`yahoo:${simbolo(t, it.classe)}:${anos}y:brl`, 6 * HORA, forcar,  // ":brl": já em reais
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

    if (corpo.acao === "proventos") {
      const itens = (corpo.itens ?? []).slice(0, 80).map((i: any) => ({
        ticker: String(i.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), classe: String(i.classe || "acao_br") }))
        .filter((i: any) => i.ticker);
      return resposta(await proventos(itens));
    }

    // Exclusão da conta pelo próprio dono (exigência das lojas de apps).
    // Com 2FA ligado, só uma sessão que passou pelo código pode apagar.
    // As tabelas têm "on delete cascade": apagar o usuário leva tudo junto.
    if (corpo.acao === "apagar_conta") {
      if (corpo.confirmacao !== "APAGAR") return resposta({ erro: "confirmação ausente" }, 400);
      let aal = "aal1";
      try { aal = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal || "aal1"; } catch { /* segue aal1 */ }
      const temFator = (quem.user.factors ?? []).some((f: any) => f.status === "verified");
      if (temFator && aal !== "aal2") return resposta({ erro: "confirme o código do autenticador antes" }, 403);
      const { error } = await admin.auth.admin.deleteUser(quem.user.id);
      if (error) throw error;
      return resposta({ ok: true });
    }

    // completa a tabela de índices (no máximo a cada 6 h; a leitura é direta na tabela)
    if (corpo.acao === "indices") {
      const r = await comCache("indices:atualizado", 6 * HORA, forcar, async () => ({ feito: await atualizaIndices(), quando: new Date().toISOString() }));
      return resposta(r);
    }

    // raio-x dos FIIs pela CVM (o informe é trimestral: cache de 7 dias)
    if (corpo.acao === "fiis_cvm") {
      return resposta(await comCache("cvm:fiis", 7 * 24 * HORA, forcar, fiisCvm));
    }

    if (corpo.acao === "benchmarks") {
      const anos = Math.min(Math.max(Number(corpo.anos) || 5, 1), 10);
      const [cdi, ibov] = await Promise.all([
        comCache(`bcb:cdi_diario:${anos}y`, 12 * HORA, forcar, () => cdiDiario(anos))
          .catch(() => []),
        comCache(`yahoo:^BVSP:${anos}y:brl`, 12 * HORA, forcar, () => serieYahoo("^BVSP", "indice", anos))
          .then((s: any) => s.precos).catch(() => []),
      ]);
      return resposta({ cdi, ibov });
    }

    return resposta({ erro: "ação desconhecida" }, 400);
  } catch (e) {
    return resposta({ erro: String(e).slice(0, 200) }, 502);
  }
});
