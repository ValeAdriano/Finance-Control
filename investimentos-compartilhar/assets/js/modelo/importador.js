/* Importação de extratos (CSV ou ZIP, com ou sem senha).
 *
 * Detecta o layout pelo cabeçalho: C6, nota de corretora ou PicPay.
 * Nada é importado duas vezes: cada lançamento vira uma origem única, e
 * a tabela recusa repetidas (unique user_id + origem). */
(function () {
  const FC = window.FC;
  const ZIPJS = "https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js";

  function num(txt) {
    if (txt == null) return null;
    let s = String(txt).trim().replace(/[−–]/g, "-").replace(/R\$/g, "").replace(/[\s ]/g, "");
    const neg = s.startsWith("-") || s.startsWith("(");
    s = s.replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const v = Number(s);
    return Number.isFinite(v) ? (neg ? -v : v) : null;
  }

  function data(txt) {
    const t = String(txt || "").trim();
    let m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(t);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
  }

  // ---------------------------------------------------------------- leitura
  async function textoDoArquivo(arquivo, senha) {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    let bruto = buf;
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      await FC.carregaScript(ZIPJS);
      const leitor = new window.zip.ZipReader(new window.zip.Uint8ArrayReader(buf), senha ? { password: senha } : {});
      const entradas = await leitor.getEntries();
      const e = entradas.find((x) => /\.(csv|txt)$/i.test(x.filename));
      if (!e) throw new Error("o ZIP não contém nenhum CSV");
      if (e.encrypted && !senha) throw new Error("o arquivo está protegido — informe a senha do ZIP");
      try {
        bruto = await e.getData(new window.zip.Uint8ArrayWriter(), senha ? { password: senha } : {});
      } catch (err) {
        if (/password/i.test(String(err))) throw new Error("senha incorreta para este arquivo");
        throw err;
      }
      await leitor.close();
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bruto).replace(/^﻿/, ""); }
    catch (e) { return new TextDecoder("iso-8859-1").decode(bruto); }
  }

  function separador(amostra) {
    const conta = (c) => (amostra.match(new RegExp("\\" + c, "g")) || []).length;
    const cands = [";", ",", "\t"].map((c) => [c, conta(c)]).sort((a, b) => b[1] - a[1]);
    return cands[0][1] ? cands[0][0] : ",";
  }

  // CSV com aspas, quebra de linha dentro de campo e separador detectado
  function csv(texto) {
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
    if (!linhas.length) return [];
    const cab = linhas[0].map((c) => c.trim());
    return linhas.slice(1).map((l) => Object.fromEntries(cab.map((c, i) => [c, (l[i] || "").trim()])));
  }

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

  const origem = (inst, ...partes) => inst + ":" + FC.hash([inst, ...partes].join("|")).slice(0, 14);

  function contador() {
    const vistos = {};
    return (...partes) => { const k = partes.join("|"); vistos[k] = (vistos[k] || 0) + 1; return vistos[k]; };
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
      const ticker = bruto ? bruto.split(/\s+/)[0].replace(/[^A-Z0-9]/g, "") : "";
      let q = num(r[cQ]);
      if (!(d && ticker && q)) continue;
      let preco = cP ? num(r[cP]) : null;
      const total = cV ? num(r[cV]) : null;
      if (!preco && total && q) preco = Math.abs(total) / Math.abs(q);
      if (!preco) continue;
      const mov = cT ? (r[cT] || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "compra";
      if (VENDA.some((v) => mov.startsWith(v))) q = -Math.abs(q);
      else if (mov && !COMPRA.some((c) => mov.startsWith(c))) continue;
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
      const ent = num(r[cE]) || 0, sai = num(r[cX]) || 0;
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

  async function le(arquivo, { senha, tituloCaixa, resolvePreco } = {}) {
    const texto = pulaPreambulo(await textoDoArquivo(arquivo, senha));
    const linhas = csv(texto);
    if (!linhas.length) throw new Error("não consegui ler nenhuma linha do arquivo");
    const cols = Object.keys(linhas[0]);
    let itens = leC6(linhas, resolvePreco), formato = "C6";
    if (!itens.length) { itens = leCorretora(linhas); formato = "corretora"; }
    if (!itens.length) { itens = lePicpay(linhas, tituloCaixa || "Cofrinho PicPay"); formato = "PicPay"; }
    if (!itens.length) throw new Error("formato não reconhecido. Colunas: " + cols.slice(0, 10).join(", "));
    return { formato, itens };
  }

  FC.importador = { le, csv };
})();
