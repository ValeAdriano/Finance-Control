/* Telas ao vivo (Cripto e Notícias).
 *
 *   node --test testes/ao-vivo.test.js
 *
 *   V1 — o parser de RSS da Edge Function lê os formatos dos portais
 *        (WordPress com media:content, enclosure, <img> no conteúdo, CDATA,
 *        entidades) e junta as fontes sem repetir, mais novas primeiro;
 *   V2 — toda imagem que o app aceita mostrar está liberada no img-src da
 *        CSP (vercel.json), e vice-versa;
 *   V3 — a fila de "N novas" só pega o que ainda não está na tela. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const RAIZ = path.join(__dirname, "..");

/** importa um .ts sem depender do Node saber tirar os tipos */
async function importaTs(arquivo) {
  const fonte = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
  const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

/** um trecho de .ts com a declaração `nome` (array de strings ou função pura) */
function trecho(arquivo, inicio, fim) {
  const s = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
  const i = s.indexOf(inicio);
  assert.ok(i >= 0, `${inicio} não está em ${arquivo}`);
  return s.slice(i, s.indexOf(fim, i) + fim.length);
}

const WORDPRESS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>InfoMoney</title>
<item>
  <title><![CDATA[Ibovespa abre em alta; dólar cai a R$ 5,40]]></title>
  <link>https://www.infomoney.com.br/mercados/ibovespa-abre-em-alta/</link>
  <pubDate>Mon, 26 Oct 2026 13:05:00 +0000</pubDate>
  <description><![CDATA[<p>O principal índice da B3 &#8211; o Ibovespa &#8211; sobe 0,8% com Vale.</p>]]></description>
  <media:content url="https://www.infomoney.com.br/wp-content/uploads/2026/10/b3.jpg" medium="image" width="1200"/>
</item>
<item>
  <title>Copom: o que esperar &amp; quando sai a decisão</title>
  <link>https://www.infomoney.com.br/economia/copom/?utm_source=rss</link>
  <pubDate>Mon, 26 Oct 2026 12:40:00 +0000</pubDate>
  <enclosure url="https://www.infomoney.com.br/wp-content/uploads/copom.png" type="image/png" length="1"/>
</item>
<item>
  <title>Sem link não entra</title>
</item>
</channel></rss>`;

const COINTELEGRAPH = `<rss><channel>
<item>
  <title>Bitcoin renova máxima</title>
  <link>https://br.cointelegraph.com/news/bitcoin-maxima</link>
  <pubDate>Mon, 26 Oct 2026 13:20:00 +0000</pubDate>
  <content:encoded><![CDATA[<p><img src="https://images.cointelegraph.com/images/btc.jpg" alt=""></p><p>Texto</p>]]></content:encoded>
</item>
<item>
  <title>Copom: o que esperar & quando sai a decisão</title>
  <link>https://outro.site/copom</link>
  <pubDate>Mon, 26 Oct 2026 12:00:00 +0000</pubDate>
</item>
</channel></rss>`;

test("V1 · lê título, link, data, imagem e resumo dos itens", async () => {
  const { leRss } = await importaTs("supabase/functions/mercado/rss.ts");
  const l = leRss(WORDPRESS, "InfoMoney");
  assert.equal(l.length, 2, "item sem link fica de fora");
  assert.equal(l[0].titulo, "Ibovespa abre em alta; dólar cai a R$ 5,40");
  assert.equal(l[0].quando, "2026-10-26T13:05:00.000Z");
  assert.equal(l[0].imagem, "https://www.infomoney.com.br/wp-content/uploads/2026/10/b3.jpg");
  assert.equal(l[0].resumo, "O principal índice da B3 – o Ibovespa – sobe 0,8% com Vale.");
  assert.equal(l[0].fonte, "InfoMoney");
  assert.equal(l[1].titulo, "Copom: o que esperar & quando sai a decisão");
  assert.equal(l[1].imagem, "https://www.infomoney.com.br/wp-content/uploads/copom.png");
  const c = leRss(COINTELEGRAPH, "Cointelegraph");
  assert.equal(c[0].imagem, "https://images.cointelegraph.com/images/btc.jpg", "imagem do <img> no content:encoded");
});

test("V1 · junta as fontes sem repetir título e com as mais novas primeiro", async () => {
  const { leRss, juntaNoticias } = await importaTs("supabase/functions/mercado/rss.ts");
  const j = juntaNoticias([leRss(WORDPRESS, "InfoMoney"), leRss(COINTELEGRAPH, "Cointelegraph"), leRss(WORDPRESS, "InfoMoney")]);
  assert.deepEqual(j.map((n) => n.titulo), [
    "Bitcoin renova máxima",
    "Ibovespa abre em alta; dólar cai a R$ 5,40",
    "Copom: o que esperar & quando sai a decisão",
  ]);
  assert.equal(j[2].fonte, "InfoMoney", "fica a primeira fonte que trouxe a manchete");
  assert.equal(juntaNoticias([leRss(WORDPRESS, "x")], 1).length, 1, "respeita o limite");
});

test("V1 · Atom e lixo não quebram", async () => {
  const { leRss } = await importaTs("supabase/functions/mercado/rss.ts");
  const atom = `<feed><entry><title>Nota</title><link href="https://exame.com/a"/><updated>2026-10-26T10:00:00Z</updated></entry></feed>`;
  assert.equal(leRss(atom, "Exame")[0].link, "https://exame.com/a");
  assert.deepEqual(leRss("<html>erro 503</html>", "x"), []);
  assert.deepEqual(leRss(`<item><title>a</title><link>javascript:alert(1)</link></item>`, "x"), [], "só link http(s)");
});

test("V2 · hosts de imagem do app = img-src da CSP", () => {
  const bloco = trecho("src/telas/comum/ao-vivo.tsx", "export const HOSTS_IMAGEM = [", "];");
  const hosts = [...bloco.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
  const csp = vercel.headers.find((h) => h.source === "/(.*)").headers.find((h) => h.key === "Content-Security-Policy").value;
  const img = /img-src ([^;]+)/.exec(csp)[1].split(/\s+/).filter((x) => x.startsWith("https://")).map((x) => x.slice(8)).sort();
  assert.deepEqual(img, hosts);
  assert.ok(!/img-src[^;]*\shttps:(\s|;)/.test(csp), "img-src não libera qualquer https");
  assert.ok(/script-src 'self';/.test(csp), "script-src continua só 'self'");
});

test("V3 · fila de novas manchetes", async () => {
  const fonte = trecho("src/estado/cripto.ts", "export function separaNovas", "\n}\n");
  const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
  const { separaNovas } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const n = (link) => ({ link, titulo: link });
  assert.deepEqual(separaNovas([n("a"), n("b")], [n("c")], [n("d"), n("c"), n("a"), n("e")]).map((x) => x.link), ["d", "e"]);
});
