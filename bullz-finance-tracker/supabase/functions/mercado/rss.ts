// Manchetes por RSS — sem dependência do Deno, para o teste rodar no Node.
//
// Lê os <item> de um feed RSS 2.0 (WordPress e afins) e devolve título,
// link, data, imagem e um resumo curto. Só manchete: o texto da matéria
// fica no site de origem, que é para onde o toque leva.

export interface Noticia {
  titulo: string;
  link: string;
  quando: string | null;
  imagem: string | null;
  resumo: string;
  fonte: string;
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
};

export function desentidade(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

const semCdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
const texto = (s: string) => desentidade(semCdata(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function campo(item: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(item);
  return m ? m[1] : null;
}

function atributo(item: string, tag: string, attr: string, filtro?: RegExp): string | null {
  for (const m of item.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))) {
    if (filtro && !filtro.test(m[1])) continue;
    const a = new RegExp(`\\s${attr}\\s*=\\s*["']([^"']+)["']`, "i").exec(m[1]);
    if (a) return desentidade(a[1]);
  }
  return null;
}

const http = (u: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

function imagemDo(item: string): string | null {
  return http(atributo(item, "media:content", "url", /medium\s*=\s*["']image|type\s*=\s*["']image|url\s*=\s*["'][^"']+\.(jpe?g|png|webp)/i))
    ?? http(atributo(item, "media:thumbnail", "url"))
    ?? http(atributo(item, "enclosure", "url", /type\s*=\s*["']image/i))
    ?? http(atributo(semCdata(campo(item, "content:encoded") ?? "") + semCdata(campo(item, "description") ?? ""), "img", "src"));
}

function dataIso(s: string | null): string | null {
  if (!s) return null;
  const t = Date.parse(texto(s));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** os itens de um feed RSS (ou Atom simples), na ordem do feed */
export function leRss(xml: string, fonte: string): Noticia[] {
  const saida: Noticia[] = [];
  const blocos = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const atom = !blocos.length ? [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]) : [];
  for (const it of blocos.length ? blocos : atom) {
    const titulo = texto(campo(it, "title") ?? "");
    const link = http(texto(campo(it, "link") ?? "")) ?? http(atributo(it, "link", "href")) ?? http(texto(campo(it, "guid") ?? ""));
    if (!titulo || !link) continue;
    const bruto = texto(campo(it, "description") ?? campo(it, "summary") ?? "");
    const resumo = bruto.length > 220 ? bruto.slice(0, 217).replace(/\s+\S*$/, "") + "…" : bruto;
    saida.push({
      titulo, link, fonte, resumo,
      quando: dataIso(campo(it, "pubDate") ?? campo(it, "dc:date") ?? campo(it, "published") ?? campo(it, "updated")),
      imagem: imagemDo(it),
    });
  }
  return saida;
}

/** junta várias fontes: sem repetir link nem título, mais recentes primeiro */
export function juntaNoticias(listas: Noticia[][], limite = 60): Noticia[] {
  const vistos = new Set<string>();
  const chaveTitulo = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const todas: Noticia[] = [];
  for (const l of listas) {
    for (const n of l) {
      const k1 = n.link.replace(/[?#].*$/, "").replace(/\/$/, ""), k2 = chaveTitulo(n.titulo);
      if (vistos.has(k1) || vistos.has(k2)) continue;
      vistos.add(k1); vistos.add(k2);
      todas.push(n);
    }
  }
  return todas
    .sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""))
    .slice(0, limite);
}
