/* Serve o dist/ como a Vercel serve (vercel.json): arquivo primeiro, cleanUrls
 * (/app → app.html), depois o rewrite de tudo para /app, e os cabeçalhos (a
 * CSP de verdade, para o teste pegar script inline proibido). */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt", ".ttf": "font/ttf" };

export async function sobe(dist, vercelJson) {
  const cfg = JSON.parse(fs.readFileSync(vercelJson, "utf8"));
  const acha = (url) => {
    const p = path.join(dist, decodeURIComponent(url));
    if (!p.startsWith(dist)) return null;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    if (fs.existsSync(p + ".html")) return p + ".html";                       // cleanUrls
    if (fs.existsSync(path.join(p, "index.html"))) return path.join(p, "index.html");
    return null;
  };
  const cabecalhos = (url) => {
    const h = {};
    for (const regra of cfg.headers || []) {
      const re = new RegExp("^" + regra.source.replace(/\(\.\*\)/g, ".*") + "$");
      if (re.test(url)) for (const x of regra.headers) h[x.key] = x.value;
    }
    return h;
  };
  const srv = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    let arq = acha(url);
    if (!arq) for (const r of cfg.rewrites || []) { if (new RegExp("^" + r.source.replace(/\(\.\*\)/g, ".*") + "$").test(url)) { arq = acha(r.destination); break; } }
    if (!arq) { res.writeHead(404); res.end("404"); return; }
    const tam = fs.statSync(arq).size, tipo = TIPOS[path.extname(arq)] || "application/octet-stream";
    const h = { "Content-Type": tipo, ...cabecalhos(url) };
    // vídeo: a tag <video> pede pedaços (Range)
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    if (range) {
      const ini = +range[1], fim = range[2] ? +range[2] : tam - 1;
      res.writeHead(206, { ...h, "Content-Range": `bytes ${ini}-${fim}/${tam}`, "Accept-Ranges": "bytes", "Content-Length": fim - ini + 1 });
      fs.createReadStream(arq, { start: ini, end: fim }).pipe(res);
      return;
    }
    res.writeHead(200, { ...h, "Content-Length": tam, "Accept-Ranges": "bytes" });
    fs.createReadStream(arq).pipe(res);
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${srv.address().port}`, fecha: () => srv.close() };
}
