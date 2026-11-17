/* Importador de extratos: B3 (Negociação e Movimentação, CSV e XLSX) e
 * Binance (histórico de transações, trades spot e Convert).
 *
 *   node --test testes/importador.test.js
 *
 * Os arquivos de exemplo seguem os cabeçalhos que a B3 e a Binance exportam;
 * o XLSX é montado de verdade com o zip.js, como o app recebe. */
const test = require("node:test");
const assert = require("node:assert/strict");
const zip = require("@zip.js/zip.js");
const { carregaNucleo } = require("./nucleo.js");

zip.configure({ useWebWorkers: false });
const { FC, contexto } = carregaNucleo({ zip });
// o zip.js roda fora do vm: os bytes precisam ser do mesmo "mundo" que ele
contexto.TextDecoder = TextDecoder;
contexto.Uint8Array = Uint8Array;
// como no app (src/nucleo/index.ts): o zip.js já está carregado
FC.carregaScript = async () => {};
const I = FC.importador;
// o núcleo roda num vm: arrays de lá não são "deepEqual" aos daqui
const igual = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

const arquivo = (nome, conteudo) => ({
  name: nome,
  arrayBuffer: async () => (typeof conteudo === "string" ? new TextEncoder().encode(conteudo) : conteudo).buffer,
});

// ---------------------------------------------------------------- XLSX de verdade
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const letra = (i) => String.fromCharCode(65 + i);
async function xlsx(abas) {
  const strings = [];
  const idx = (s) => { let i = strings.indexOf(s); if (i < 0) { i = strings.length; strings.push(s); } return i; };
  const folhas = abas.map(({ linhas }) => `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${
    linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => v === "" || v == null ? ""
      : typeof v === "number" ? `<c r="${letra(c)}${r + 1}"><v>${v}</v></c>`
        : `<c r="${letra(c)}${r + 1}" t="s"><v>${idx(v)}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`);
  const w = new zip.ZipWriter(new zip.Uint8ArrayWriter());
  const add = (n, t) => w.add(n, new zip.TextReader(t));
  await add("[Content_Types].xml", "<Types/>");
  await add("xl/workbook.xml", `<workbook xmlns:r="r"><sheets>${abas.map((a, i) => `<sheet name="${esc(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  await add("xl/_rels/workbook.xml.rels", `<Relationships>${abas.map((a, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`);
  await add("xl/sharedStrings.xml", `<sst>${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`);
  for (let i = 0; i < folhas.length; i++) await add(`xl/worksheets/sheet${i + 1}.xml`, folhas[i]);
  return w.close();
}

// ---------------------------------------------------------------- B3
const NEG_CAB = ["Data do Negócio", "Tipo de Movimentação", "Mercado", "Prazo/Vencimento", "Instituição", "Código de Negociação", "Quantidade", "Preço", "Valor"];

test("B3 Negociação (CSV): compra, venda, fracionário sem o F e opção ignorada", async () => {
  const txt = [NEG_CAB.join(";"),
    "15/03/2024;Compra;Mercado à Vista;-;XP INVESTIMENTOS;PETR4;100;R$ 38,50;R$ 3.850,00",
    "15/03/2024;Compra;Mercado Fracionário;-;XP INVESTIMENTOS;PETR4F;7;R$ 38,50;R$ 269,50",
    "20/04/2024;Venda;Mercado à Vista;-;XP INVESTIMENTOS;MXRF11;10;10,30;103,00",
    "22/04/2024;Compra;Opção de Compra;19/04/2024;XP INVESTIMENTOS;PETRD400;100;0,50;50,00"].join("\n");
  const r = await I.le(arquivo("negociacao.csv", txt));
  assert.equal(r.formato, "B3 · Negociação");
  assert.equal(r.itens.length, 3);
  const [a, b, c] = r.itens;
  igual([a.ticker, a.quantidade, a.preco, a.data, a.venda], ["PETR4", 100, 38.5, "2024-03-15", false]);
  assert.equal(b.ticker, "PETR4");
  assert.match(b.observacao, /fracionário/);
  igual([c.ticker, c.venda, c.quantidade], ["MXRF11", true, 10]);
  assert.notEqual(a.origem, b.origem);
  assert.match(r.avisos.join(" "), /Opção de Compra/);
});

test("B3 Negociação (XLSX): números e datas da planilha, mesma origem do CSV", async () => {
  const buf = await xlsx([{ nome: "Negociação", linhas: [NEG_CAB,
    ["15/03/2024", "Compra", "Mercado à Vista", "-", "XP INVESTIMENTOS", "PETR4", 100, 38.5, 3850],
    [45397, "Compra", "Mercado Fracionário", "-", "XP", "ITSA4F", 3, 9.876, 29.628]] }]);
  const r = await I.le(arquivo("negociacao.xlsx", buf));
  assert.equal(r.formato, "B3 · Negociação");
  assert.equal(r.itens.length, 2);
  assert.equal(r.itens[0].preco, 38.5);
  igual([r.itens[1].ticker, r.itens[1].data, r.itens[1].preco], ["ITSA4", "2024-04-15", 9.876]);
  const csv = await I.le(arquivo("n.csv", NEG_CAB.join(";") + "\n15/03/2024;Compra;Mercado à Vista;-;XP INVESTIMENTOS;PETR4;100;38,50;3.850,00"));
  assert.equal(csv.itens[0].origem, r.itens[0].origem, "o mesmo negócio em CSV e XLSX não pode duplicar");
});

test("B3 Movimentação: proventos, desdobro e bonificação; liquidação fica de fora", async () => {
  const buf = await xlsx([{ nome: "Movimentação", linhas: [
    ["Entrada/Saída", "Data", "Movimentação", "Produto", "Instituição", "Quantidade", "Preço unitário", "Valor da Operação"],
    ["Credito", "28/06/2024", "Dividendo", "BBAS3 - BANCO DO BRASIL S/A", "XP", 100, 0.45, 45],
    ["Credito", "28/06/2024", "Juros Sobre Capital Próprio", "ITSA4 - ITAUSA S/A", "XP", 200, 0.02, 3.4],
    ["Credito", "15/07/2024", "Rendimento", "MXRF11 - MAXI RENDA FII", "XP", 50, 0.1, 5],
    ["Credito", "16/04/2024", "Desdobro", "BBAS3 - BANCO DO BRASIL S/A", "XP", 100, "-", "-"],
    ["Credito", "20/05/2024", "Bonificação em Ativos", "ITSA4 - ITAUSA S/A", "XP", 4, "-", "-"],
    ["Credito", "15/03/2024", "Transferência - Liquidação", "PETR4 - PETROBRAS", "XP", 100, 38.5, 3850],
    ["Debito", "10/03/2024", "Transferência - Liquidação", "PETR4 - PETROBRAS", "XP", 10, 37, 370],
    ["Credito", "15/01/2025", "Juros", "Tesouro IPCA+ com Juros Semestrais 2035", "XP", 1, 60, 60],
    ["Credito", "02/02/2024", "Leilão de Fração", "ITSA4 - ITAUSA S/A", "XP", 0.4, 9.5, 3.8],
  ] }]);
  const r = await I.le(arquivo("movimentacao.xlsx", buf));
  assert.equal(r.formato, "B3 · Movimentação");
  const prov = r.itens.filter((i) => i.tipo === "provento");
  igual(prov.map((p) => [p.ticker, p.valor]), [["BBAS3", 45], ["ITSA4", 3.4], ["MXRF11", 5]]);
  const evt = r.itens.filter((i) => i.tipo === "ativo");
  igual(evt.map((e) => [e.ticker, e.quantidade, e.preco]), [["BBAS3", 100, 0], ["ITSA4", 4, 0]]);
  const avisos = r.avisos.join(" ");
  assert.match(avisos, /2 liquidação/);
  assert.match(avisos, /Negociação/);
  assert.match(avisos, /Leilão de Fração \(1\)/);
  assert.match(avisos, /Juros \(1\)/);
});

test("B3 Movimentação só com liquidações explica o que fazer", async () => {
  const txt = "Entrada/Saída;Data;Movimentação;Produto;Instituição;Quantidade;Preço unitário;Valor da Operação\n" +
    "Credito;15/03/2024;Transferência - Liquidação;PETR4 - PETROBRAS;XP;100;38,5;3850";
  await assert.rejects(I.le(arquivo("m.csv", txt)), /Negociação/);
});

// ---------------------------------------------------------------- Binance
// preços de fechamento em reais por moeda (o que FC.mercado.historicos devolve)
const PRECOS = { BTC: 350000, ETH: 18000, BNB: 3000, USDT: 5, SOL: 800 };
async function leDuasPassadas(arq) {
  const pedidos = new Set();
  await I.le(arq, { rascunho: true, resolvePreco: (tk, dia, classe) => { pedidos.add(tk + ":" + classe); return null; } });
  const r = await I.le(arq, { resolvePreco: (tk) => PRECOS[tk] ?? null });
  return { r, pedidos };
}
const por = (itens, tk) => itens.filter((i) => i.ticker === tk);

test("Binance histórico de transações: troca em várias linhas, taxa em BNB, BRL, rendimentos", async () => {
  const txt = [
    '"User_ID","UTC_Time","Account","Operation","Coin","Change","Remark"',
    // depósito em reais e compra de USDT com BRL (preço exato: 500 BRL)
    '"1","2024-01-02 10:00:00","Spot","Deposit","BRL","500",""',
    '"1","2024-01-02 10:05:00","Spot","Transaction Buy","USDT","100",""',
    '"1","2024-01-02 10:05:00","Spot","Transaction Spend","BRL","-500",""',
    // USDT → BTC, taxa em BNB no segundo seguinte; data no formato novo AA-MM-DD
    '"1","24-01-03 12:00:00","Spot","Transaction Buy","BTC","0.0002",""',
    '"1","24-01-03 12:00:00","Spot","Transaction Spend","USDT","-14",""',
    '"1","24-01-03 12:00:01","Spot","Transaction Fee","BNB","-0.001",""',
    // Convert USDT → ETH
    '"1","2024-01-04 09:00:00","Spot","Binance Convert","USDT","-36",""',
    '"1","2024-01-04 09:00:00","Spot","Binance Convert","ETH","0.01",""',
    // rendimento, assinatura do Earn, saque, futuros
    '"1","2024-01-05 00:00:00","Earn","Simple Earn Flexible Interest","USDT","0.5",""',
    '"1","2024-01-05 00:00:00","Spot","Simple Earn Flexible Subscription","USDT","-10",""',
    '"1","2024-01-06 00:00:00","Spot","Withdraw","ETH","-0.005",""',
    '"1","2024-01-06 00:00:00","USD-M Futures","Funding Fee","USDT","-0.1",""',
    '"1","2024-01-07 00:00:00","Spot","Distribution","SOL","1.2E-3",""',
  ].join("\n");
  const { r, pedidos } = await leDuasPassadas(arquivo("binance.csv", txt));
  assert.equal(r.formato, "Binance · Histórico de transações");
  assert.ok(pedidos.has("USDT:cripto") && pedidos.has("BNB:cripto"));
  for (const i of r.itens) assert.equal(i.classe, "cripto");
  assert.ok(!r.itens.some((i) => i.ticker === "BRL"), "real não vira ativo");

  const usdt = por(r.itens, "USDT");
  const compraUsdt = usdt.find((i) => !i.venda && i.data === "2024-01-02");
  assert.equal(compraUsdt.quantidade, 100);
  assert.equal(compraUsdt.preco, 5, "500 BRL / 100 USDT");

  const btc = por(r.itens, "BTC")[0];
  assert.equal(btc.data, "2024-01-03");
  assert.equal(btc.quantidade, 0.0002);
  // custo = 14 USDT × 5 + 0,001 BNB × 3000 = 73
  assert.ok(Math.abs(btc.quantidade * btc.preco - 73) < 1e-9);
  assert.ok(usdt.some((i) => i.venda && i.quantidade === 14));
  assert.ok(por(r.itens, "BNB").some((i) => i.venda && i.quantidade === 0.001));

  const eth = por(r.itens, "ETH")[0];
  assert.ok(Math.abs(eth.quantidade * eth.preco - 180) < 1e-9, "36 USDT × 5");
  assert.equal(por(r.itens, "ETH").length, 1, "saque não vira venda");

  const juros = usdt.find((i) => i.data === "2024-01-05");
  igual([juros.quantidade, juros.preco], [0.5, 0]);
  const sol = por(r.itens, "SOL")[0];
  igual([sol.quantidade, sol.preco], [0.0012, 0]);

  const avisos = r.avisos.join(" ");
  assert.match(avisos, /Deposit \(1\)/);
  assert.match(avisos, /USD-M Futures \(1\)/);
  assert.match(avisos, /Simple Earn Flexible Subscription/);

  // importar de novo gera as mesmas origens
  const de_novo = (await leDuasPassadas(arquivo("binance.csv", txt))).r;
  igual(de_novo.itens.map((i) => i.origem), r.itens.map((i) => i.origem));
  assert.equal(new Set(r.itens.map((i) => i.origem)).size, r.itens.length);
});

test("Binance histórico de transações: sem preço do dia, avisa e não inventa", async () => {
  const txt = "User_ID,UTC_Time,Account,Operation,Coin,Change,Remark\n" +
    "1,2024-02-01 10:00:00,Spot,Transaction Buy,XYZ,10,\n1,2024-02-01 10:00:00,Spot,Transaction Spend,ABC,-5,";
  await assert.rejects(I.le(arquivo("b.csv", txt), { resolvePreco: () => null }), /Sem preço do dia/);
});

test("Binance histórico de trades (formato novo e antigo)", async () => {
  const novo = [
    "Date(UTC),Pair,Side,Price,Executed,Amount,Fee",
    "2024-03-01 12:00:00,BTCUSDT,BUY,62000,0.00100000BTC,62.00000000USDT,0.00000100BTC",
    "2024-03-02 12:00:00,ETHBRL,SELL,\"17,500\",0.0500ETH,875.00BRL,0.875BRL",
    "2024-03-03 12:00:00,SOLUSDT,BUY,130,1.00SOL,\"1,130.00USDT\",0.0004BNB",
  ].join("\n");
  const { r } = await leDuasPassadas(arquivo("trades.csv", novo));
  assert.equal(r.formato, "Binance · Histórico de trades");
  const btc = por(r.itens, "BTC")[0];
  assert.ok(Math.abs(btc.quantidade - 0.000999) < 1e-12, "taxa em BTC sai da quantidade");
  assert.ok(Math.abs(btc.quantidade * btc.preco - 310) < 1e-9, "62 USDT × 5");
  const eth = por(r.itens, "ETH")[0];
  assert.equal(eth.venda, true);
  assert.ok(Math.abs(eth.quantidade * eth.preco - 874.125) < 1e-9, "valor líquido em reais");
  const sol = por(r.itens, "SOL")[0];
  assert.ok(Math.abs(sol.quantidade * sol.preco - (1130 * 5 + 0.0004 * 3000)) < 1e-9, "milhar com vírgula e taxa em BNB");

  const antigo = "Date(UTC),Market,Type,Price,Amount,Total,Fee,Fee Coin\n2021-05-10 08:00:00,BNBBTC,BUY,0.01,2,0.02,0.0015,BNB";
  const a = (await leDuasPassadas(arquivo("t.csv", antigo))).r;
  const bnb = por(a.itens, "BNB")[0];
  assert.ok(Math.abs(bnb.quantidade - 1.9985) < 1e-12);
  assert.ok(Math.abs(bnb.quantidade * bnb.preco - 0.02 * 350000) < 1e-6);
  assert.ok(por(a.itens, "BTC")[0].venda);
});

test("Binance Convert", async () => {
  const txt = "Date,Wallet,Pair,Type,Sell,Buy,Price,Inverse Price,Date Updated,Status\n" +
    "2024-04-01 10:00:00,Spot Wallet,BTC/USDT,Market,100 USDT,0.0014 BTC,1 USDT = 0.000014 BTC,1 BTC = 71428 USDT,2024-04-01 10:00:00,Successful\n" +
    "2024-04-02 10:00:00,Spot Wallet,BTC/USDT,Limit,50 USDT,0.0007 BTC,x,y,2024-04-02 10:00:00,Expired";
  const { r } = await leDuasPassadas(arquivo("convert.csv", txt));
  assert.equal(r.formato, "Binance · Convert");
  assert.equal(r.itens.length, 2, "só a conversão concluída, duas pernas");
  const btc = por(r.itens, "BTC")[0];
  assert.ok(Math.abs(btc.quantidade * btc.preco - 500) < 1e-9);
});

// ---------------------------------------------------------------- leitor de XLSX
test("leitor de XLSX: strings ricas, inline, colunas puladas e entidades", () => {
  const shared = '<sst><si><t>Data</t></si><si><r><t>Pro</t></r><r><t xml:space="preserve">duto &amp; cia</t></r></si></sst>';
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>45000</v></c><c r="B2" t="inlineStr"><is><t>x</t></is></c><c r="C2"><v>1.5E-7</v></c></row></sheetData></worksheet>';
  const m = I.matrizXlsx(sheet, shared);
  igual(m, [["Data", "", "Produto & cia"], ["45000", "x", "0,00000015"]]);
});

test("formatos antigos continuam: corretora genérica", async () => {
  const r = await I.le(arquivo("c.csv", "Data;Ticker;Quantidade;Preço;Operação\n01/02/2024;ITSA4;10;9,50;Compra"));
  assert.equal(r.formato, "corretora");
  assert.equal(r.itens[0].ticker, "ITSA4");
});
