/* Importação de extratos (CSV, XLSX ou ZIP, com ou sem senha).
 *
 * Detecta o layout pelo cabeçalho:
 *   - B3 (Área do Investidor): extrato de Negociação (compras e vendas) e
 *     de Movimentação (proventos, desdobros e bonificações), em XLSX ou CSV;
 *   - Binance: extrato de transações (Transaction History), histórico de
 *     trades spot e histórico do Convert;
 *   - C6, nota de corretora genérica e PicPay.
 * Nada é importado duas vezes: cada lançamento vira uma origem única, e
 * a tabela recusa repetidas (unique user_id + origem). */
(function () {
  const FC = window.FC;
  const ZIPJS = "https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js";

  function num(txt) {
    if (txt == null) return null;
    let s = String(txt).trim().replace(/[−–]/g, "-").replace(/R\$/g, "").replace(/[\s ]/g, "");
    const neg = s.startsWith("-") || s.startsWith("(");
    s = s.replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");   // "1.000" = mil
    const v = Number(s);
    return Number.isFinite(v) ? (neg ? -v : v) : null;
  }

  // número no padrão americano (Binance): ponto decimal, vírgula de milhar.
  // Vírgula sozinha é a decimal (é como o leitor de XLSX entrega os números).
  function numPonto(txt) {
    if (txt == null) return null;
    let s = String(txt).trim().replace(/[−–]/g, "-").replace(/\s/g, "");
    if (!s || s === "-") return null;
    if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
    else if (s.includes(",")) s = s.replace(",", ".");
    const m = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s);
    if (!m) return null;
    const v = Number(m[0]);
    return Number.isFinite(v) ? v : null;
  }

  // dia do Excel (1 = 01/01/1900, com o falso 29/02/1900) → AAAA-MM-DD
  function serialExcel(n) {
    if (!(n > 25568 && n < 60000)) return null;
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  }

  function data(txt) {
    const t = String(txt || "").trim();
    let m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(t);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{5}([.,]\d+)?$/.test(t)) return serialExcel(Number(t.replace(",", ".")));
    return null;
  }

  // a Binance usa "2024-03-01 12:00:00" ou, nos extratos novos, "24-03-01 12:00:00"
  function dataHora(txt) {
    const t = String(txt || "").trim();
    let m = /^(\d{2}|\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
    if (m) {
      const ano = m[1].length === 2 ? "20" + m[1] : m[1];
      return { dia: `${ano}-${m[2]}-${m[3]}`, quando: `${ano}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}` };
    }
    if (/^\d{5}([.,]\d+)?$/.test(t)) {
      const n = Number(t.replace(",", "."));
      const d = serialExcel(n);
      if (!d) return null;
      const iso = new Date(Math.round((n - 25569) * 86400000)).toISOString();
      return { dia: d, quando: iso.slice(0, 10) + " " + iso.slice(11, 19) };
    }
    const dia = data(t);
    return dia ? { dia, quando: dia + " 00:00:00" } : null;
  }

  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const limpaTexto = (t) => semAcento(t).toLowerCase().replace(/\s+/g, " ").trim();

  // ---------------------------------------------------------------- leitura
  function decodifica(bruto) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bruto).replace(/^﻿/, ""); }
    catch (e) { return new TextDecoder("iso-8859-1").decode(bruto); }
  }

  async function abreZip(buf, senha) {
    await FC.carregaScript(ZIPJS);
    const leitor = new window.zip.ZipReader(new window.zip.Uint8ArrayReader(buf), senha ? { password: senha } : {});
    const entradas = await leitor.getEntries();
    const le = async (e) => {
      if (e.encrypted && !senha) throw new Error("o arquivo está protegido — informe a senha do ZIP");
      try {
        return await e.getData(new window.zip.Uint8ArrayWriter(), senha ? { password: senha } : {});
      } catch (err) {
        if (/password/i.test(String(err))) throw new Error("senha incorreta para este arquivo");
        throw err;
      }
    };
    return { leitor, entradas, le };
  }

  /** O arquivo vira uma lista de tabelas: { nome, linhas (objetos), texto? }.
   *  CSV dá uma tabela; XLSX dá uma por aba; ZIP abre o CSV ou o XLSX de dentro. */
  async function tabelasDoArquivo(arquivo, senha) {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return [tabelaCsv(decodifica(buf), arquivo.name)];
    const { leitor, entradas, le } = await abreZip(buf, senha);
    try {
      // o próprio arquivo é um XLSX (um ZIP com xl/workbook.xml)
      if (entradas.some((e) => e.filename === "xl/workbook.xml")) return await tabelasXlsx(entradas, le);
      const csvs = entradas.filter((x) => /\.(csv|txt)$/i.test(x.filename));
      const xlsxs = entradas.filter((x) => /\.xlsx$/i.test(x.filename));
      if (!csvs.length && !xlsxs.length) throw new Error("o ZIP não contém nenhum CSV ou XLSX");
      const saida = [];
      for (const e of csvs) saida.push(tabelaCsv(decodifica(await le(e)), e.filename));
      for (const e of xlsxs) {
        const interno = await abreZip(await le(e), null);
        try { saida.push(...await tabelasXlsx(interno.entradas, interno.le)); } finally { await interno.leitor.close(); }
      }
      return saida;
    } finally {
      await leitor.close();
    }
  }

  function tabelaCsv(texto, nome) {
    const t = pulaPreambulo(texto);
    return { nome: nome || "CSV", linhas: csv(t) };
  }

  // ---------------------------------------------------------------- XLSX
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const xmlTexto = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c) =>
    c[0] === "#" ? String.fromCodePoint(c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10)) : ENT[c] ?? m);
  // texto de um <si> ou <is>: junta os <t> (vários quando há formatação no meio)
  const textoRico = (xml) => {
    let s = "";
    for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) s += m[1] ? xmlTexto(m[1]) : "";
    return s;
  };
  const colIdx = (ref) => {
    const letras = /^[A-Z]+/.exec(ref || "");
    if (!letras) return -1;
    let n = 0;
    for (const c of letras[0]) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  };
  // número da planilha como texto que num() e numPonto() leem igual:
  // vírgula decimal, sem milhar, sem notação científica
  const numeroComoTexto = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    let s = String(n);
    if (/e/i.test(s)) s = n.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  };

  /** XML das strings compartilhadas e de uma aba → matriz de textos */
  function matrizXlsx(sheetXml, sharedXml) {
    const comp = [];
    if (sharedXml) for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) comp.push(m[1] ? textoRico(m[1]) : "");
    const linhas = [];
    for (const r of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const linha = [];
      let prox = 0;
      for (const c of (r[1] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], corpo = c[2] || "";
        const ref = /\br="([A-Z]+)\d*"/.exec(attrs);
        const i = ref ? colIdx(ref[1]) : prox;
        prox = i + 1;
        const tipo = (/\bt="(\w+)"/.exec(attrs) || [])[1] || "n";
        const v = /<v>([\s\S]*?)<\/v>/.exec(corpo);
        let val = "";
        if (tipo === "s") val = v ? comp[Number(v[1])] ?? "" : "";
        else if (tipo === "inlineStr") val = textoRico(corpo);
        else if (tipo === "str" || tipo === "e") val = v ? xmlTexto(v[1]) : "";
        else if (tipo === "b") val = v ? (v[1] === "1" ? "TRUE" : "FALSE") : "";
        else val = v ? numeroComoTexto(xmlTexto(v[1])) : "";
        linha[i] = val;
      }
      for (let k = 0; k < linha.length; k++) if (linha[k] == null) linha[k] = "";
      linhas.push(linha);
    }
    return linhas;
  }

  async function tabelasXlsx(entradas, le) {
    const porNome = Object.fromEntries(entradas.map((e) => [e.filename, e]));
    const txt = async (nome) => (porNome[nome] ? decodifica(await le(porNome[nome])) : null);
    const shared = await txt("xl/sharedStrings.xml");
    // ordem e nome das abas: workbook.xml + rels; sem eles, sheet1, sheet2…
    const wb = (await txt("xl/workbook.xml")) || "";
    const rels = (await txt("xl/_rels/workbook.xml.rels")) || "";
    const alvo = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(m[0]), t = /\bTarget="([^"]+)"/.exec(m[0]);
      if (id && t) alvo[id[1]] = t[1].replace(/^\/?(xl\/)?/, "xl/");
    }
    let abas = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
      nome: xmlTexto((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || ""),
      arquivo: alvo[(/\br:id="([^"]+)"/.exec(m[0]) || [])[1]],
    })).filter((a) => a.arquivo && porNome[a.arquivo]);
    if (!abas.length) {
      abas = entradas.map((e) => e.filename).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
        .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]))
        .map((n) => ({ nome: n.replace(/^.*\//, ""), arquivo: n }));
    }
    const saida = [];
    for (const a of abas) saida.push({ nome: a.nome, linhas: objetos(matrizXlsx(await txt(a.arquivo), shared), true) });
    return saida;
  }

  function separador(amostra) {
    const conta = (c) => (amostra.match(new RegExp("\\" + c, "g")) || []).length;
    const cands = [";", ",", "\t"].map((c) => [c, conta(c)]).sort((a, b) => b[1] - a[1]);
    return cands[0][1] ? cands[0][0] : ",";
  }

  // CSV com aspas, quebra de linha dentro de campo e separador detectado
  function csvMatriz(texto) {
    const sep = separador(texto.slice(0, 4000).split("\n").slice(0, 5).join("\n"));
    const linhas = [];
    let campo = "", linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        if (linha.some((x) => x.trim())) linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some((x) => x.trim())) linhas.push(linha);
    return linhas;
  }

  /** matriz → objetos pelo cabeçalho. `procura`: o cabeçalho é a primeira
   *  linha com 3+ células de texto (planilhas podem ter título em cima). */
  function objetos(linhas, procura) {
    linhas = linhas.filter((l) => l.some((x) => String(x || "").trim()));
    if (!linhas.length) return [];
    let h = 0;
    if (procura) {
      const i = linhas.slice(0, 30).findIndex((l) => l.filter((x) => /[a-z]/i.test(String(x || ""))).length >= 3);
      if (i > 0) h = i;
    }
    const cab = linhas[h].map((c) => String(c || "").trim());
    return linhas.slice(h + 1).map((l) => Object.fromEntries(cab.map((c, i) => [c, String(l[i] ?? "").trim()])));
  }

  const csv = (texto) => objetos(csvMatriz(texto));

  function coluna(cabs, ...cands) {
    const limpa = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const mapa = Object.fromEntries(cabs.map((c) => [limpa(c), c]));
    for (const c of cands) if (mapa[limpa(c)]) return mapa[limpa(c)];
    for (const c of cands) {
      const a = limpa(c);
      for (const [k, orig] of Object.entries(mapa)) if (a && k.includes(a)) return orig;
    }
    return null;
  }
  // só o nome exato (sem acento, caixa e pontuação): evita "Preço" casar com "Preço médio"
  function colunaExata(cabs, ...cands) {
    const limpa = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const mapa = Object.fromEntries(cabs.map((c) => [limpa(c), c]));
    for (const c of cands) if (mapa[limpa(c)]) return mapa[limpa(c)];
    return null;
  }

  const origem = (inst, ...partes) => inst + ":" + FC.hash([inst, ...partes].join("|")).slice(0, 14);

  function contador() {
    const vistos = {};
    return (...partes) => { const k = partes.join("|"); vistos[k] = (vistos[k] || 0) + 1; return vistos[k]; };
  }

  // "Transferência - Liquidação (12), Leilão de Fração (1)"
  function resumoIgnorados(mapa) {
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(", ");
  }

  // ---------------------------------------------------------------- B3
  // código de negociação de ação, FII, ETF, unit ou BDR; o "F" do
  // fracionário (PETR4F) é o mesmo papel
  const RE_PAPEL = /^[A-Z]{4}\d{1,2}$/;
  function papelB3(txt) {
    let t = String(txt || "").trim().toUpperCase().split(/\s+-\s+|\s+/)[0].replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]{4}\d{1,2}F$/.test(t)) t = t.slice(0, -1);
    return RE_PAPEL.test(t) ? t : null;
  }

  /** Área do Investidor › Extratos › Negociação: Data do Negócio, Tipo de
   *  Movimentação (Compra/Venda), Mercado, Prazo/Vencimento, Instituição,
   *  Código de Negociação, Quantidade, Preço, Valor. */
  function leB3Negociacao(linhas) {
    if (!linhas.length) return null;
    const cols = Object.keys(linhas[0]);
    const cD = colunaExata(cols, "data do negocio", "data do negócio");
    const cK = colunaExata(cols, "codigo de negociacao", "código de negociação");
    const cT = colunaExata(cols, "tipo de movimentacao", "tipo de movimentação", "movimentacao");
    const cQ = colunaExata(cols, "quantidade");
    const cP = colunaExata(cols, "preco", "preço");
    const cV = colunaExata(cols, "valor");
    const cM = colunaExata(cols, "mercado");
    if (!(cD && cK && cT && cQ && (cP || cV))) return null;
    const vez = contador();
    const itens = [], ignorados = {};
    for (const r of linhas) {
      const d = data(r[cD]);
      if (!d) continue;   // linha de total, rodapé
      const mercado = limpaTexto(cM ? r[cM] : "");
      const mov = limpaTexto(r[cT]);
      const ticker = papelB3(r[cK]);
      if (/opc|termo|futuro/.test(mercado) || !ticker) { ignorados[(cM && r[cM]) || r[cK] || "?"] = (ignorados[(cM && r[cM]) || r[cK] || "?"] || 0) + 1; continue; }
      const q = Math.abs(num(r[cQ]) || 0);
      let preco = cP ? Math.abs(num(r[cP]) || 0) : 0;
      const total = cV ? Math.abs(num(r[cV]) || 0) : 0;
      if (!preco && total && q) preco = total / q;
      if (!(q && preco)) continue;
      const venda = mov.startsWith("venda");
      if (!venda && !mov.startsWith("compra")) { ignorados[r[cT] || "?"] = (ignorados[r[cT] || "?"] || 0) + 1; continue; }
      const n = vez(d, ticker, venda, q, preco);
      itens.push({ tipo: "ativo", ticker, quantidade: q, preco, data: d, venda,
        observacao: ("B3 · " + (venda ? "venda" : "compra") + (mercado.includes("fracion") ? " (fracionário)" : "")).slice(0, 120),
        origem: origem("b3neg", d, ticker, venda ? -q : q, preco, n) });
    }
    const avisos = [];
    if (Object.keys(ignorados).length) avisos.push("Ignorados (opções, termo, futuro ou código fora do padrão): " + resumoIgnorados(ignorados) + ".");
    return { formato: "B3 · Negociação", itens, avisos };
  }

  // tipos da Movimentação que viram lançamento
  const B3_PROVENTOS = ["dividendo", "juros sobre capital proprio", "rendimento", "reembolso"];
  const B3_SEM_CUSTO = ["desdobro", "bonificacao em ativos"];

  /** Área do Investidor › Extratos › Movimentação: Entrada/Saída
   *  (Credito/Debito), Data, Movimentação, Produto ("PETR4 - PETROBRAS"),
   *  Instituição, Quantidade, Preço unitário, Valor da Operação. Aqui saem
   *  só proventos, desdobros e bonificações: compra e venda vêm do extrato
   *  de Negociação (a "Transferência - Liquidação" duplicaria cada uma). */
  function leB3Movimentacao(linhas) {
    if (!linhas.length) return null;
    const cols = Object.keys(linhas[0]);
    const cES = colunaExata(cols, "entrada/saida", "entrada/saída");
    const cD = colunaExata(cols, "data");
    const cM = colunaExata(cols, "movimentacao", "movimentação");
    const cPr = colunaExata(cols, "produto");
    const cQ = colunaExata(cols, "quantidade");
    const cP = colunaExata(cols, "preco unitario", "preço unitário");
    const cV = colunaExata(cols, "valor da operacao", "valor da operação");
    if (!(cES && cD && cM && cPr)) return null;
    const vez = contador();
    const itens = [], ignorados = {};
    let liquidacoes = 0;
    const ignora = (k) => { ignorados[k] = (ignorados[k] || 0) + 1; };
    for (const r of linhas) {
      const d = data(r[cD]);
      if (!d) continue;
      const credito = /^(credito|entrada)/.test(limpaTexto(r[cES]));
      const movOrig = String(r[cM] || "").trim();
      const mov = limpaTexto(movOrig);
      const ticker = papelB3(r[cPr]);
      if (mov.startsWith("transferencia - liquidacao")) { liquidacoes++; continue; }
      const provento = B3_PROVENTOS.some((p) => mov === p || mov.startsWith(p + " ")) && !mov.includes("transferido");
      const semCusto = B3_SEM_CUSTO.some((p) => mov === p || mov.startsWith(p));
      if (!credito || !ticker || !(provento || semCusto)) { ignora(movOrig || "?"); continue; }
      const q = cQ ? Math.abs(num(r[cQ]) || 0) : 0;
      const pu = cP ? Math.abs(num(r[cP]) || 0) : 0;
      if (provento) {
        let v = cV ? Math.abs(num(r[cV]) || 0) : 0;
        if (!v && q && pu) v = q * pu;
        if (!(v > 0)) { ignora(movOrig); continue; }
        const n = vez("p", d, ticker, mov, v);
        itens.push({ tipo: "provento", ticker, valor: Math.round(v * 100) / 100, data: d,
          observacao: ("B3 · " + mov).slice(0, 120), origem: origem("b3prov", d, ticker, mov, v, n) });
      } else {
        if (!(q > 0)) { ignora(movOrig); continue; }
        const n = vez("e", d, ticker, mov, q);
        // a B3 não informa o custo do desdobro (zero) nem, quase sempre, o da bonificação
        itens.push({ tipo: "ativo", ticker, quantidade: q, preco: pu, data: d, venda: false,
          observacao: ("B3 · " + mov + (pu ? "" : " (sem custo)")).slice(0, 120), origem: origem("b3evt", d, ticker, mov, q, n) });
      }
    }
    const avisos = [];
    if (liquidacoes) avisos.push(`${liquidacoes} liquidação(ões) de compra/venda ficaram de fora: importe o extrato de Negociação da B3 para elas.`);
    if (Object.keys(ignorados).length) avisos.push("Outros movimentos ignorados: " + resumoIgnorados(ignorados) + ".");
    if (itens.some((i) => i.tipo === "ativo" && !i.preco)) avisos.push("Bonificações sem custo informado entraram com custo zero: ajuste pelo valor do aviso aos acionistas, se quiser.");
    return { formato: "B3 · Movimentação", itens, avisos };
  }

  // ---------------------------------------------------------------- Binance
  // moedas que não viram ativo (dinheiro): só servem de preço
  const FIAT = new Set(["BRL", "USD", "EUR", "GBP", "TRY", "ARS", "AUD", "CAD", "CHF", "JPY", "MXN", "COP", "PLN", "RON", "UAH", "RUB", "NGN", "ZAR", "KZT", "IDR", "CZK"]);
  // dólar digital: sem preço próprio, vale o do USDT
  const ESTAVEL = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USDP", "DAI", "USD"]);
  const QUOTES = ["FDUSD", "USDT", "USDC", "BUSD", "TUSD", "USDP", "DAI", "BRL", "EUR", "TRY", "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "TRX", "USD"];
  const moedaOk = (c) => /^[A-Z0-9]{2,20}$/.test(c);

  /** preço em reais de uma moeda num dia: BRL vale 1; cripto pede ao
   *  resolvePreco (série do Yahoo já em reais); estável cai no USDT */
  function precoBrl(coin, dia, resolve) {
    if (coin === "BRL") return 1;
    if (!resolve) return null;
    const p = coin === "USD" ? null : resolve(coin, dia, "cripto");
    if (p) return p;
    return ESTAVEL.has(coin) ? resolve("USDT", dia, "cripto") : null;
  }

  /** Uma operação (pernas: moeda → variação líquida) vira lançamentos de cripto.
   *  Uma moeda entrou: ela custou a soma, em reais, do que saiu (taxa incluída).
   *  Uma entrou e uma saiu: as duas valem o mesmo. No resto, cada perna vale
   *  o preço do dia. Moeda fiduciária (BRL…) só dá o preço, não vira ativo. */
  function lancaOperacao(pernas, quando, rotulo, chave, ctx) {
    const dia = quando.slice(0, 10);
    const lista = Object.entries(pernas).filter(([c, q]) => Math.abs(q) > 1e-12 && moedaOk(c));
    if (!lista.some(([c]) => !FIAT.has(c))) return;
    const val = (c, q) => { const p = precoBrl(c, dia, ctx.resolve); return p ? Math.abs(q) * p : null; };
    const P = lista.filter(([, q]) => q > 0), N = lista.filter(([, q]) => q < 0);
    let vP = null;
    if (P.length === 1) {
      // o real é o preço exato; senão, vale o que saiu (ou, sem preço, o que entrou)
      if (N.length === 1) vP = P[0][0] === "BRL" ? Math.abs(P[0][1]) : val(N[0][0], N[0][1]) ?? val(P[0][0], P[0][1]);
      else {
        const vs = N.map(([c, q]) => val(c, q));
        vP = N.length && vs.every((v) => v != null) ? vs.reduce((a, b) => a + b, 0) : val(P[0][0], P[0][1]);
      }
    }
    for (const [coin, q] of lista) {
      if (FIAT.has(coin)) continue;
      let valor;
      if (q > 0 && P.length === 1) valor = vP;
      else if (q < 0 && N.length === 1 && P.length === 1) valor = vP;
      else valor = val(coin, q);
      if (!(valor > 0)) { ctx.semPreco[coin] = (ctx.semPreco[coin] || 0) + 1; continue; }
      const n = ctx.vez(chave, quando, coin, q);
      ctx.itens.push({ tipo: "ativo", classe: "cripto", ticker: coin, quantidade: Math.abs(q), preco: valor / Math.abs(q), data: dia,
        venda: q < 0, observacao: ("Binance · " + rotulo).slice(0, 120), origem: origem(chave, quando, coin, q, n) });
    }
  }

  // rendimentos: entram com custo zero (como uma bonificação)
  const RE_RENDA = /interest|reward|distribution|airdrop|rebate|commission|cashback|kickback|mining|cash voucher|megadrop|launchpool earnings|bonus|referral/;
  const RE_NAO_RENDA = /subscription|redemption|purchase|subscribe|transfer/;
  const TROCA = new Set(["buy", "sell", "fee", "transaction related", "transaction buy", "transaction spend", "transaction fee",
    "transaction sold", "transaction revenue", "binance convert", "large otc trading", "small assets exchange bnb", "bnb fee deduction",
    "auto-invest transaction", "stablecoins auto-conversion", "buy crypto", "buy crypto with card", "p2p trading", "etf subscription", "etf redemption"]);
  const CONTA_SPOT = /^(spot|funding|earn|savings|pool|)$/;

  /** Carteira › Histórico de transações › Exportar: User_ID, UTC_Time,
   *  Account, Operation, Coin, Change, Remark. Uma troca vem em várias
   *  linhas no mesmo segundo (Transaction Buy / Spend / Fee). */
  function leBinanceExtrato(linhas, resolve) {
    if (!linhas.length) return null;
    const cols = Object.keys(linhas[0]);
    const cT = colunaExata(cols, "utc_time", "utc time"), cO = colunaExata(cols, "operation");
    const cC = colunaExata(cols, "coin"), cX = colunaExata(cols, "change"), cA = colunaExata(cols, "account");
    if (!(cT && cO && cC && cX)) return null;
    const ctx = { itens: [], semPreco: {}, vez: contador(), resolve };
    const ignorados = {}, grupos = new Map();
    let rendas = 0;
    for (const r of linhas) {
      const dh = dataHora(r[cT]);
      const op = limpaTexto(r[cO]);
      const coin = String(r[cC] || "").trim().toUpperCase();
      const q = numPonto(r[cX]);
      if (!dh || !op || !coin || !q) continue;
      const conta = limpaTexto(cA ? r[cA] : "");
      if (!CONTA_SPOT.test(conta)) { ignorados[r[cA]] = (ignorados[r[cA]] || 0) + 1; continue; }
      if (TROCA.has(op)) {
        const g = grupos.get(dh.quando) || { pernas: {}, ops: new Set() };
        g.pernas[coin] = (g.pernas[coin] || 0) + q;
        g.ops.add(String(r[cO]).trim());
        grupos.set(dh.quando, g);
      } else if (q > 0 && RE_RENDA.test(op) && !RE_NAO_RENDA.test(op) && moedaOk(coin) && !FIAT.has(coin)) {
        // LDBTC etc. são o recibo do Simple Earn, não a moeda
        const tk = conta === "earn" && /^LD[A-Z0-9]{2,}$/.test(coin) ? coin.slice(2) : coin;
        const n = ctx.vez("renda", dh.quando, tk, q);
        rendas++;
        ctx.itens.push({ tipo: "ativo", classe: "cripto", ticker: tk, quantidade: q, preco: 0, data: dh.dia, venda: false,
          observacao: ("Binance · " + String(r[cO]).trim().toLowerCase() + " (sem custo)").slice(0, 120),
          origem: origem("binance-renda", dh.quando, tk, q, op, n) });
      } else {
        const k = String(r[cO]).trim();
        ignorados[k] = (ignorados[k] || 0) + 1;
      }
    }
    // a taxa às vezes cai no segundo seguinte: junta grupo só de taxa ao anterior
    const ordem = [...grupos.keys()].sort();
    for (let i = 1; i < ordem.length; i++) {
      const g = grupos.get(ordem[i]);
      if (![...g.ops].every((o) => /fee/i.test(o))) continue;
      const ant = grupos.get(ordem[i - 1]);
      if (!ant || (Date.parse(ordem[i].replace(" ", "T") + "Z") - Date.parse(ordem[i - 1].replace(" ", "T") + "Z")) > 1000) continue;
      for (const [c, q] of Object.entries(g.pernas)) ant.pernas[c] = (ant.pernas[c] || 0) + q;
      grupos.delete(ordem[i]);
    }
    for (const [quando, g] of grupos) lancaOperacao(g.pernas, quando, [...g.ops].join(" + ").toLowerCase(), "binance", ctx);
    const avisos = [];
    if (rendas) avisos.push(`${rendas} rendimento(s) (staking, juros, airdrops) entraram como cripto recebida com custo zero.`);
    if (Object.keys(ignorados).length) avisos.push("Ignorados (depósitos, saques, transferências, Earn, futuros e margem): " + resumoIgnorados(ignorados) + ".");
    if (Object.keys(ctx.semPreco).length) avisos.push("Sem preço do dia, ficaram de fora: " + resumoIgnorados(ctx.semPreco) + ".");
    return { formato: "Binance · Histórico de transações", itens: ctx.itens, avisos };
  }

  // "0.00100000BTC" → separa o número da moeda, sabendo qual moeda esperar
  function valorMoeda(txt, esperadas) {
    const s = String(txt || "").replace(/\s/g, "").toUpperCase();
    for (const m of esperadas) if (m && s.endsWith(m) && /\d$/.test(s.slice(0, -m.length))) return { q: numPonto(s.slice(0, -m.length)), coin: m };
    const r = /^([-+]?[\d.,]+(?:E[-+]?\d+)?)([A-Z][A-Z0-9]*)$/.exec(s);
    return r ? { q: numPonto(r[1]), coin: r[2] } : { q: numPonto(s), coin: null };
  }
  function partePar(par) {
    const p = String(par || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    for (const q of QUOTES) if (p.endsWith(q) && p.length > q.length) return { base: p.slice(0, -q.length), quote: q };
    return { base: p, quote: null };
  }

  /** Ordens › Spot › Histórico de trades › Exportar.
   *  Novo: Date(UTC), Pair, Side, Price, Executed, Amount, Fee.
   *  Antigo: Date(UTC), Market, Type, Price, Amount, Total, Fee, Fee Coin. */
  function leBinanceTrades(linhas, resolve) {
    if (!linhas.length) return null;
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "date(utc)", "date(utc+0)", "date"), cPar = colunaExata(cols, "pair", "market");
    const cS = colunaExata(cols, "side", "type"), cE = colunaExata(cols, "executed");
    const cAm = colunaExata(cols, "amount"), cTot = colunaExata(cols, "total");
    const cF = colunaExata(cols, "fee"), cFC = colunaExata(cols, "fee coin");
    if (!(cD && cPar && cS && cAm && (cE || cTot))) return null;
    const ctx = { itens: [], semPreco: {}, vez: contador(), resolve };
    for (const r of linhas) {
      const dh = dataHora(r[cD]);
      const lado = limpaTexto(r[cS]);
      if (!dh || !/^(buy|sell)$/.test(lado)) continue;
      let { base, quote } = partePar(r[cPar]);
      let qBase, qQuote;
      if (cE) {
        const am = valorMoeda(r[cAm], quote ? [quote] : []);
        if (am.coin && !quote) { quote = am.coin; base = String(r[cPar]).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(new RegExp(quote + "$"), ""); }
        const ex = valorMoeda(r[cE], [base]);
        qBase = ex.q; qQuote = am.q;
      } else {
        qBase = numPonto(r[cAm]); qQuote = numPonto(r[cTot]);
      }
      if (!(base && quote && qBase && qQuote)) continue;
      const pernas = { [base]: lado === "buy" ? qBase : -qBase, [quote]: lado === "buy" ? -qQuote : qQuote };
      if (cF) {
        const f = cFC ? { q: numPonto(r[cF]), coin: String(r[cFC] || "").trim().toUpperCase() } : valorMoeda(r[cF], [base, quote, "BNB"]);
        if (f.q && f.coin && moedaOk(f.coin)) pernas[f.coin] = (pernas[f.coin] || 0) - Math.abs(f.q);
      }
      lancaOperacao(pernas, dh.quando, (lado === "buy" ? "compra " : "venda ") + base + "/" + quote, "binance-trade", ctx);
    }
    const avisos = [];
    if (Object.keys(ctx.semPreco).length) avisos.push("Sem preço do dia, ficaram de fora: " + resumoIgnorados(ctx.semPreco) + ".");
    return { formato: "Binance · Histórico de trades", itens: ctx.itens, avisos };
  }

  /** Convert › Histórico: Date, (Wallet), Pair, Type, Sell ("100 USDT"),
   *  Buy ("0.001 BTC"), Price, Inverse Price, Date Updated, Status. */
  function leBinanceConvert(linhas, resolve) {
    if (!linhas.length) return null;
    const cols = Object.keys(linhas[0]);
    const cD = colunaExata(cols, "date"), cSell = colunaExata(cols, "sell"), cBuy = colunaExata(cols, "buy");
    const cSt = colunaExata(cols, "status");
    if (!(cD && cSell && cBuy)) return null;
    const ctx = { itens: [], semPreco: {}, vez: contador(), resolve };
    for (const r of linhas) {
      if (cSt && r[cSt] && !/success|conclu/i.test(r[cSt])) continue;
      const dh = dataHora(r[cD]);
      const s = valorMoeda(r[cSell], []), b = valorMoeda(r[cBuy], []);
      if (!dh || !(s.q && s.coin && b.q && b.coin)) continue;
      lancaOperacao({ [s.coin]: -Math.abs(s.q), [b.coin]: Math.abs(b.q) }, dh.quando, `convert ${s.coin} → ${b.coin}`, "binance-convert", ctx);
    }
    const avisos = [];
    if (Object.keys(ctx.semPreco).length) avisos.push("Sem preço do dia, ficaram de fora: " + resumoIgnorados(ctx.semPreco) + ".");
    return { formato: "Binance · Convert", itens: ctx.itens, avisos };
  }

  // ---------------------------------------------------------------- PicPay
  function lePicpay(linhas, tituloCaixa) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data"), cT = coluna(cols, "tipo"), cO = coluna(cols, "origem / destino", "origem", "destino", "descricao");
    const cV = coluna(cols, "valor"), cH = coluna(cols, "hora");
    if (!(cD && cT && cV)) return [];
    const vez = contador();
    const saida = [];
    for (const r of linhas) {
      const tipo = (r[cT] || "").toLowerCase();
      const desc = r[cO] || "";
      if (!/cofrinho/i.test(desc)) continue;
      const d = data(r[cD]), v = num(r[cV]);
      if (!d || v == null) continue;
      const guardou = tipo.includes("guardad");
      const hora = cH ? r[cH] || "" : "";
      const n = vez(d, v, desc, tipo, hora);
      saida.push({ tipo: "caixa", titulo: tituloCaixa, valor: guardou ? Math.abs(v) : -Math.abs(v), data: d,
        observacao: `PicPay · ${desc.replace(/^(No|Do) cofrinho\s*/i, "").trim()}${guardou ? "" : " (resgate)"}`.slice(0, 120),
        origem: origem("picpay", d, v, desc, tipo, hora, n) });
    }
    return saida;
  }

  // ---------------------------------------------------------------- corretora
  const COMPRA = ["compra", "c", "credito", "aquisicao"];
  const VENDA = ["venda", "v", "debito", "alienacao"];
  // a palavra inteira (ou "compra à vista" etc.): "cancelamento" e
  // "credito jcp" não são compra
  const eMov = (mov, lista) => lista.some((x) => mov === x || (x.length > 1 && x !== "credito" && x !== "debito" && mov.startsWith(x + " ")));
  function leCorretora(linhas) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data do negocio", "data negocio", "data", "data da operacao");
    const cK = coluna(cols, "codigo de negociacao", "codigo", "ticker", "ativo", "papel");
    const cQ = coluna(cols, "quantidade", "qtd", "qtde");
    const cP = coluna(cols, "preco", "preco unitario", "valor unitario", "preco medio");
    const cT = coluna(cols, "tipo de movimentacao", "tipo", "operacao", "c/v", "compra/venda", "entrada/saida");
    const cV = coluna(cols, "valor da operacao", "valor total", "valor");
    if (!(cD && cK && cQ)) return [];
    const vez = contador();
    const saida = [];
    for (const r of linhas) {
      const d = data(r[cD]);
      const bruto = (r[cK] || "").trim().toUpperCase();
      let ticker = bruto ? bruto.split(/\s+/)[0].replace(/[^A-Z0-9]/g, "") : "";
      if (/^[A-Z]{4}\d{1,2}F$/.test(ticker)) ticker = ticker.slice(0, -1);   // fracionário
      let q = num(r[cQ]);
      if (!(d && ticker && q)) continue;
      let preco = cP ? num(r[cP]) : null;
      const total = cV ? num(r[cV]) : null;
      if (!preco && total && q) preco = Math.abs(total) / Math.abs(q);
      if (!preco) continue;
      const mov = cT ? (r[cT] || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "compra";
      if (eMov(mov, VENDA)) q = -Math.abs(q);
      else if (mov && !eMov(mov, COMPRA)) continue;
      const n = vez(d, ticker, q, preco);
      saida.push({ tipo: "ativo", ticker, quantidade: Math.abs(q), preco: Math.abs(preco), data: d, venda: q < 0,
        observacao: ("importado · " + (mov || "compra")).slice(0, 120), origem: origem("corretora", d, ticker, q, preco, n) });
    }
    return saida;
  }

  // ---------------------------------------------------------------- C6
  // O extrato do C6 traz o valor pago mas não a quantidade: ela sai do
  // valor ÷ preço de fechamento do dia, arredondado (só há cotas inteiras).
  const RE_TICKER = /-\s*([A-Z]{4}\d{1,2})F?(?![A-Z0-9])/;
  function leC6(linhas, resolvePreco) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data lancamento", "data lançamento", "data");
    const cT = coluna(cols, "titulo", "título"), cS = coluna(cols, "descricao", "descrição");
    const cE = coluna(cols, "entrada(r$)", "entrada"), cX = coluna(cols, "saida(r$)", "saída(r$)", "saida", "saída");
    if (!(cD && cT && cE && cX)) return [];
    const compras = [], estornos = [], saida = [];
    const vez = contador();
    for (const r of linhas) {
      const tit = (r[cT] || "").trim().toUpperCase();
      const desc = r[cS] || "";
      const d = data(r[cD]);
      if (!d) continue;
      // as colunas já dizem o sentido: sinal no texto não inverte nada
      const ent = Math.abs(num(r[cE]) || 0), sai = Math.abs(num(r[cX]) || 0);
      const m = RE_TICKER.exec(desc);
      if (tit === "COMPRA DE ATIVO B3" && m && sai) compras.push({ data: d, ticker: m[1], valor: sai });
      else if (tit === "ESTORNO COMPRA ATIVO" && m && ent) estornos.push({ data: d, ticker: m[1], valor: ent });
      else if (tit === "CREDITO OPERACAO B3" && ent > 1) estornos.push({ data: d, ticker: null, valor: ent });
      else if (["EMISSAO DE CDB", "APLICACAO DE CDB", "APLICAÇÃO DE CDB"].includes(tit) && sai) {
        saida.push({ tipo: "caixa", titulo: "CDB (C6)", valor: sai, data: d, historico: true,
          observacao: "C6 · " + tit.toLowerCase(), origem: origem("c6cdb", d, sai, tit, vez(d, sai, tit)) });
      } else if (["RENDIMENTOS", "JUROS SOBRE CAPITAL", "DIVIDENDOS"].includes(tit) && ent) {
        const tk = (desc || "").trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z0-9]/g, "");
        saida.push({ tipo: "provento", ticker: tk, valor: ent, data: d, observacao: ("C6 · " + tit.toLowerCase()).slice(0, 120),
          origem: origem("c6prov", d, tk, ent, tit, vez(d, tk, ent, tit)) });
      }
    }
    for (const e of estornos) {
      const i = compras.findIndex((c) => (e.ticker == null || c.ticker === e.ticker) && c.data === e.data && Math.abs(c.valor - e.valor) < 0.01);
      if (i >= 0) compras.splice(i, 1);
    }
    for (const c of compras) {
      const preco = resolvePreco ? resolvePreco(c.ticker, c.data) : null;
      if (!preco) continue;
      const q = Math.max(1, Math.round(c.valor / preco));
      saida.push({ tipo: "ativo", ticker: c.ticker, quantidade: q, preco: c.valor / q, data: c.data, observacao: "C6 · compra",
        origem: origem("c6", c.data, c.ticker, c.valor, vez(c.data, c.ticker, c.valor)) });
    }
    return saida;
  }

  function pulaPreambulo(texto) {
    const ls = texto.split(/\r?\n/);
    for (let i = 0; i < Math.min(40, ls.length); i++) {
      const l = ls[i].toLowerCase().replace(/\s/g, "");
      if (l.startsWith("datalan") || l.startsWith("data,") || l.startsWith("data;")) return ls.slice(i).join("\n");
    }
    return texto;
  }

  /** Uma tabela → { formato, itens, avisos } ou null se nenhum layout bate.
   *  Os layouts de cabeçalho exato (B3, Binance) vêm antes dos genéricos. */
  function leTabela(linhas, { tituloCaixa, resolvePreco } = {}) {
    if (!linhas.length) return null;
    for (const f of [leBinanceExtrato, leBinanceTrades, leBinanceConvert, leB3Negociacao, leB3Movimentacao]) {
      const r = f(linhas, resolvePreco);
      if (r) return r;
    }
    let itens = leC6(linhas, resolvePreco), formato = "C6";
    if (!itens.length) { itens = leCorretora(linhas); formato = "corretora"; }
    if (!itens.length) { itens = lePicpay(linhas, tituloCaixa || "Cofrinho PicPay"); formato = "PicPay"; }
    return itens.length ? { formato, itens, avisos: [] } : null;
  }

  /** `resolvePreco(ticker, dia, classe)`: preço de fechamento em reais
   *  (classe "cripto" para a Binance; sem classe, ação da B3 para o C6).
   *  `rascunho`: 1ª passada, que só descobre quais preços pedir; não falha
   *  por não ter lançamento (eles dependem desses preços). */
  async function le(arquivo, { senha, tituloCaixa, resolvePreco, rascunho } = {}) {
    const tabelas = (await tabelasDoArquivo(arquivo, senha)).filter((t) => t.linhas.length);
    if (!tabelas.length) throw new Error("não consegui ler nenhuma linha do arquivo");
    const formatos = [], itens = [], avisos = [];
    for (const t of tabelas) {
      const r = leTabela(t.linhas, { tituloCaixa, resolvePreco });
      if (!r) continue;
      if (!formatos.includes(r.formato)) formatos.push(r.formato);
      itens.push(...r.itens);
      avisos.push(...r.avisos);
    }
    if (!formatos.length) {
      throw new Error("formato não reconhecido. Colunas: " + Object.keys(tabelas[0].linhas[0]).slice(0, 10).join(", "));
    }
    if (!itens.length && !rascunho) {
      throw new Error(`li o extrato ${formatos.join(" e ")}, mas nada nele vira lançamento. ${avisos.join(" ")}`.trim());
    }
    return { formato: formatos.join(" + "), itens, avisos };
  }

  FC.importador = { le, csv, leTabela, matrizXlsx, objetos };
})();
