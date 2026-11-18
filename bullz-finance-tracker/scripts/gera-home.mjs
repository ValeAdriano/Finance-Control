/* Gera a home pública estática (Marco 13) dentro do build web.
 *
 *   node scripts/gera-home.mjs [dist]      (roda no fim do `npm run build`)
 *
 * O `expo export` deixa o app (SPA) em dist/index.html. Aqui ele vira
 * dist/app.html e dist/index.html passa a ser a home: HTML estático, sem
 * consulta ao banco, com a copy de content/home.pt-BR.ts, os capítulos de
 * content/tour.ts, as capturas da conta demo (public/capturas) e o vídeo
 * (public/video). A Vercel serve "/" pelo arquivo e o resto reescreve para
 * /app (vercel.json). Quem já tem sessão vai direto para o app.
 *
 * CSP do vercel.json: nenhum script inline (o JS está em /home.js e
 * /home-sessao.js); estilo inline é permitido. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leTs } from "./le-ts.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(RAIZ, process.argv[2] || "dist");
const C = await leTs(path.join(RAIZ, "content", "home.pt-BR.ts"));
const T = await leTs(path.join(RAIZ, "content", "tour.ts"));

// ---------------------------------------------------------------- o app vira /app.html
const idx = path.join(DIST, "index.html"), app = path.join(DIST, "app.html");
if (!fs.existsSync(idx)) { console.error(`sem ${idx}: rode o expo export antes`); process.exit(1); }
const atual = fs.readFileSync(idx, "utf8");
if (atual.includes('id="root"') || atual.includes("expo-reset")) fs.renameSync(idx, app);
else if (!fs.existsSync(app)) { console.error("index.html não é o app e não há app.html"); process.exit(1); }

// ---------------------------------------------------------------- utilidades
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const COR = { rf: "#30d158", acoes: "#0a84ff", cripto: "#bf5af2", agro: "#c9a77c" };
const cap = (nome, tam, tema = "escuro") => `/capturas/${nome}-${tam}-${tema}.webp`;
const temCaptura = (nome) => fs.existsSync(path.join(RAIZ, "public", "capturas", `${nome}-desktop-escuro.webp`));
const imagem = (nome, alt, { eager = false, classe = "" } = {}) => `<picture class="${classe}">
  <source media="(max-width: 640px)" srcset="${cap(nome, "celular")}" width="390" height="844">
  <img src="${cap(nome, "desktop")}" width="1440" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
</picture>`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------- seções
const nav = `<header class="nav"><div class="larg nav-in">
  <a class="logo" href="/" aria-label="Bullz, início"><img src="/assets/img/icone.svg" width="28" height="28" alt=""><span>Bullz</span></a>
  <nav aria-label="Seções"><ul>${C.nav.links.map((l) => `<li><a href="${l.href}">${esc(l.rotulo)}</a></li>`).join("")}</ul></nav>
  <a class="btn btn-claro" href="/inicio">${esc(C.nav.entrar)}</a>
</div></header>`;

const hero = `<section class="hero" aria-labelledby="hero-t">
  <div class="ceu" aria-hidden="true"></div>
  <div class="larg hero-in">
    <div class="hero-txt">
      <h1 id="hero-t">${esc(C.hero.titulo)}</h1>
      <p class="sub">${esc(C.hero.sub)}</p>
      <div class="ctas"><a class="btn btn-claro" href="/inicio">${esc(C.hero.entrar)}</a><a class="btn btn-vidro" href="#tour">${esc(C.hero.tour)}</a></div>
    </div>
    <div class="aparelhos" aria-hidden="true">
      <div class="desktop"><div class="barra"><i></i><i></i><i></i></div>
        <video class="auto" muted playsinline loop preload="none" poster="${T.arquivos.poster}" width="1280" height="720">
          <source src="${T.arquivos.webm}" type="video/webm"><source src="${T.arquivos.mp4}" type="video/mp4"></video></div>
      <div class="celular"><div class="tela"><img class="rola" src="${cap("inicio", "celular")}" width="390" height="844" alt="" fetchpriority="high"></div></div>
    </div>
  </div>
</section>`;

const tour = `<section id="tour" class="secao" aria-labelledby="tour-t"><div class="larg">
  <h2 id="tour-t">${esc(C.tour.titulo)}</h2><p class="sub">${esc(C.tour.sub)}</p>
  <div class="tour">
    <video id="video-tour" controls muted playsinline preload="none" poster="${T.arquivos.poster}" width="1280" height="720">
      <source src="${T.arquivos.webm}" type="video/webm"><source src="${T.arquivos.mp4}" type="video/mp4">
      <track kind="captions" srclang="pt-BR" label="Português" src="${T.arquivos.vtt}" default></video>
    <ol class="capitulos">${T.capitulos.map((c, i) => `<li><button type="button" data-t="${c.inicio}"><span class="tempo">${mmss(c.inicio)}</span><span class="cap-t">${esc(c.titulo)}</span></button></li>`).join("")}</ol>
  </div>
</div></section>`;

const telasColagem = ["plano-mensal", "projecao", "agro-lotes", "potes", "alertas"].filter(temCaptura);
const colagem = `<section class="colagem" aria-label="Telas do app"><div class="larg colagem-in">
  ${telasColagem.map((n, i) => `<div class="flutua f${i}" data-vel="${[0.06, -0.04, 0.09, -0.07, 0.05][i]}">${imagem(n, `Tela do Bullz: ${n.replace(/-/g, " ")}`)}</div>`).join("")}
</div></section>`;

const marquee = `<section class="marquee" aria-label="${esc(C.conectaCom.titulo)}"><div class="larg"><p class="etq">${esc(C.conectaCom.titulo)}</p></div>
  <div class="trilho"><ul>${[...C.conectaCom.nomes, ...C.conectaCom.nomes].map((n, i) => `<li${i >= C.conectaCom.nomes.length ? ' aria-hidden="true"' : ""}>${esc(n)}</li>`).join("")}</ul></div>
</section>`;

const pilares = `<section class="secao" aria-labelledby="pil-t"><div class="larg">
  <h2 id="pil-t">${esc(C.pilares.titulo)}</h2>
  <div class="grade4">${C.pilares.itens.map((p) => `<article class="pilar" style="--cor:${COR[p.chave]}"><span class="ponto" aria-hidden="true"></span><h3>${esc(p.nome)}</h3><p>${esc(p.frase)}</p></article>`).join("")}</div>
</div></section>`;

const blocos = `<section id="${C.funcionalidades.id}" class="secao" aria-label="Como funciona"><div class="larg">
  ${C.funcionalidades.itens.map((f, i) => `<article class="bloco${i % 2 ? " inv" : ""}">
    <div class="bloco-txt"><p class="etq">${esc(f.etiqueta)}</p><h2>${esc(f.titulo)}</h2><p>${esc(f.texto)}</p></div>
    <div class="bloco-img">${f.captura && temCaptura(f.captura) ? imagem(f.captura, `${f.etiqueta}: tela do Bullz com a conta demo`) : f.conversa ? `<div class="chat" role="img" aria-label="Exemplo de conversa com um assistente de IA">${f.conversa.map((m) => `<p class="msg ${m.quem === "você" ? "eu" : "ia"}"><b>${esc(m.quem)}</b>${esc(m.texto)}</p>`).join("")}</div>` : ""}</div>
  </article>`).join("")}
</div></section>`;

const mais = `<section class="secao" aria-labelledby="mais-t"><div class="larg">
  <h2 id="mais-t">${esc(C.maisCoisas.titulo)}</h2>
  <div class="grade3">${C.maisCoisas.itens.map((x) => `<article class="card"><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></article>`).join("")}</div>
</div></section>`;

const promessas = `<section id="${C.promessas.id}" class="secao" aria-labelledby="pro-t"><div class="larg">
  <h2 id="pro-t">${esc(C.promessas.titulo)}</h2>
  <div class="grade3">${C.promessas.itens.map((x) => `<article class="promessa"><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></article>`).join("")}</div>
</div></section>`;

const perguntas = `<section id="${C.perguntas.id}" class="secao" aria-labelledby="faq-t"><div class="larg estreito">
  <h2 id="faq-t">${esc(C.perguntas.titulo)}</h2>
  ${C.perguntas.itens.map((q) => `<details><summary>${esc(q.p)}</summary><p>${esc(q.r)}</p></details>`).join("")}
</div></section>`;

const cta = `<section class="cta" aria-labelledby="cta-t"><div class="ceu baixo" aria-hidden="true"></div><div class="larg">
  <h2 id="cta-t">${esc(C.ctaFinal.titulo)}</h2><p class="sub">${esc(C.ctaFinal.sub)}</p><a class="btn btn-claro grande" href="/inicio">${esc(C.ctaFinal.botao)}</a>
</div></section>`;

const rodape = `<footer class="rodape"><div class="larg rodape-in"><p>${esc(C.rodape.texto)}</p><ul>${C.rodape.links.map((l) => `<li><a href="${l.href}">${esc(l.rotulo)}</a></li>`).join("")}</ul></div></footer>`;

// ---------------------------------------------------------------- estilo
const css = `
:root{--bg:#050607;--bg2:#0d0f12;--card:#13161b;--linha:rgba(255,255,255,.09);--ink:#f5f5f7;--ink2:#a1a1aa;--acento:#0a84ff;color-scheme:dark}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.55 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}img,video{max-width:100%;height:auto;display:block}
.larg{width:100%;max-width:1180px;margin:0 auto;padding:0 20px}.estreito{max-width:760px}
h1,h2,h3{margin:0;letter-spacing:-.02em;font-weight:650}h1{font-size:clamp(38px,7vw,76px);line-height:1.04}
h2{font-size:clamp(28px,4.4vw,48px);line-height:1.1}h3{font-size:19px}
.sub{color:var(--ink2);font-size:clamp(17px,2vw,21px);margin:14px 0 0;max-width:640px}
.etq{color:var(--ink2);font-size:13px;text-transform:uppercase;letter-spacing:.14em;margin:0 0 10px;font-weight:600}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;border-radius:999px;font-weight:600;text-decoration:none;font-size:16px}
.btn-claro{background:#f5f5f7;color:#050607}.btn-claro:hover{background:#fff}
.btn-vidro{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(8px)}
.btn.grande{min-height:54px;padding:0 34px;font-size:18px;margin-top:28px}
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--acento);outline-offset:3px}
.nav{position:sticky;top:0;z-index:20;background:rgba(5,6,7,.72);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--linha)}
.nav-in{display:flex;align-items:center;gap:24px;height:60px}.nav ul{display:flex;gap:22px;list-style:none;margin:0;padding:0}
.nav nav{margin-left:auto}.nav nav a{color:var(--ink2);text-decoration:none;font-size:15px}.nav nav a:hover{color:var(--ink)}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:19px}
@media (max-width:720px){.nav nav{display:none}.nav .btn{margin-left:auto}}
.hero{position:relative;overflow:hidden;padding:72px 0 40px}
.ceu{position:absolute;inset:0;z-index:-1;background:
 radial-gradient(1200px 420px at 50% 112%,rgba(201,167,124,.30),transparent 60%),
 radial-gradient(900px 300px at 50% 100%,rgba(48,209,88,.10),transparent 70%),
 radial-gradient(1px 1px at 12% 18%,#fff8 50%,transparent),radial-gradient(1px 1px at 72% 12%,#fff6 50%,transparent),
 radial-gradient(1.5px 1.5px at 38% 30%,#fff7 50%,transparent),radial-gradient(1px 1px at 86% 34%,#fff5 50%,transparent),
 radial-gradient(1px 1px at 22% 42%,#fff4 50%,transparent),radial-gradient(1.5px 1.5px at 58% 8%,#fff8 50%,transparent),
 linear-gradient(180deg,#02040a 0%,#07101f 46%,#0b0e14 78%,#050607 100%)}
.ceu.baixo{opacity:.8}
.hero-in{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:center}
.ctas{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}
.aparelhos{position:relative;min-height:440px}
.desktop{position:absolute;right:0;top:20px;width:92%;border-radius:14px;overflow:hidden;background:#111;border:1px solid var(--linha);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.desktop .barra{height:26px;display:flex;gap:6px;align-items:center;padding:0 12px;background:#1b1d22}.desktop .barra i{width:9px;height:9px;border-radius:50%;background:#3a3d44}
.celular{position:absolute;left:0;bottom:0;width:190px;padding:9px;border-radius:34px;background:#0b0c0e;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px rgba(0,0,0,.7)}
.celular .tela{height:390px;border-radius:26px;overflow:hidden}
.rola{animation:rola 14s ease-in-out infinite alternate}@keyframes rola{0%,12%{transform:translateY(0)}88%,100%{transform:translateY(-46%)}}
@media (max-width:900px){.hero-in{grid-template-columns:1fr}.aparelhos{min-height:360px;margin-top:10px}.celular{width:150px}.celular .tela{height:300px}}
.secao{padding:96px 0}
.tour{display:grid;grid-template-columns:1fr 280px;gap:22px;margin-top:34px;align-items:start}
.tour video{width:100%;border-radius:16px;border:1px solid var(--linha);background:#000;aspect-ratio:16/9}
.capitulos{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.capitulos button{width:100%;display:flex;gap:12px;align-items:baseline;text-align:left;background:transparent;border:1px solid transparent;color:var(--ink);padding:10px 12px;border-radius:12px;font:inherit;cursor:pointer;min-height:44px}
.capitulos button:hover{background:var(--card)}.capitulos button[aria-current="true"]{background:var(--card);border-color:var(--linha)}
.tempo{color:var(--ink2);font-variant-numeric:tabular-nums;font-size:14px;min-width:34px}.cap-t{font-weight:600}
@media (max-width:900px){.tour{grid-template-columns:1fr}.capitulos{grid-template-columns:repeat(2,1fr)}}
.colagem{padding:20px 0 40px;overflow:hidden}.colagem-in{position:relative;height:420px}
.flutua{position:absolute;width:44%;border-radius:12px;overflow:hidden;border:1px solid var(--linha);box-shadow:0 24px 60px rgba(0,0,0,.55);will-change:transform}
.f0{left:0;top:30px}.f1{left:28%;top:0;z-index:2;width:46%}.f2{right:0;top:50px}.f3{left:8%;top:210px;width:36%;z-index:3}.f4{right:6%;top:230px;width:36%;z-index:3}
@media (max-width:720px){.colagem-in{height:300px}.flutua{width:58%}.f1{left:30%;width:62%}.f3,.f4{display:none}}
.marquee{padding:44px 0;border-top:1px solid var(--linha);border-bottom:1px solid var(--linha);overflow:hidden}
.trilho{overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.trilho ul{display:flex;gap:56px;list-style:none;margin:0;padding:0;width:max-content;animation:corre 32s linear infinite}
.trilho li{font-size:22px;font-weight:600;color:#c7c7cc;white-space:nowrap}@keyframes corre{to{transform:translateX(-50%)}}
.grade4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:36px}.grade3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:36px}
@media (max-width:900px){.grade4{grid-template-columns:repeat(2,1fr)}.grade3{grid-template-columns:1fr}}@media (max-width:480px){.grade4{grid-template-columns:1fr}}
.pilar,.card,.promessa{background:var(--card);border:1px solid var(--linha);border-radius:18px;padding:24px}
.pilar{border-top:3px solid var(--cor)}.pilar .ponto{display:block;width:12px;height:12px;border-radius:50%;background:var(--cor);margin-bottom:16px}
.pilar p,.card p,.promessa p{color:var(--ink2);margin:8px 0 0;font-size:16px}
.promessa h3{font-size:24px}
.bloco{display:grid;grid-template-columns:1fr 1.25fr;gap:48px;align-items:center;padding:56px 0;border-bottom:1px solid var(--linha)}
.bloco:last-child{border-bottom:0}.bloco.inv .bloco-txt{order:2}
.bloco-txt p:last-child{color:var(--ink2);font-size:18px;margin-top:16px}
.bloco-img img{border-radius:14px;border:1px solid var(--linha);box-shadow:0 24px 60px rgba(0,0,0,.45)}
@media (max-width:900px){.bloco{grid-template-columns:1fr;gap:24px}.bloco.inv .bloco-txt{order:0}.bloco-img img{max-height:640px;width:auto;margin:0 auto}}
.chat{background:var(--card);border:1px solid var(--linha);border-radius:18px;padding:22px;display:grid;gap:12px}
.msg{margin:0;padding:12px 16px;border-radius:14px;max-width:88%;font-size:16px}.msg b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink2);margin-bottom:4px}
.msg.eu{justify-self:end;background:#0a84ff26}.msg.ia{background:#ffffff0d}
details{border-bottom:1px solid var(--linha);padding:18px 0}summary{cursor:pointer;font-weight:600;font-size:19px;min-height:44px;display:flex;align-items:center}
details p{color:var(--ink2);margin:8px 0 0}
.cta{position:relative;overflow:hidden;text-align:center;padding:130px 0}.cta .sub{margin-left:auto;margin-right:auto}
.rodape{border-top:1px solid var(--linha);padding:28px 0 40px;color:var(--ink2);font-size:14px}
.rodape-in{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.rodape ul{display:flex;gap:18px;list-style:none;margin:0;padding:0}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.rola,.trilho ul{animation:none}.flutua{transform:none!important}}
`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(C.meta.titulo)}</title>
<meta name="description" content="${esc(C.meta.descricao)}">
<meta name="theme-color" content="#050607">
<meta name="color-scheme" content="dark">
<meta name="referrer" content="no-referrer">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(C.meta.titulo)}">
<meta property="og:description" content="${esc(C.meta.descricao)}">
<meta property="og:image" content="${C.meta.imagem}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/svg+xml" href="/assets/img/icone.svg">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" as="image" href="${cap("inicio", "celular")}" fetchpriority="high">
<script src="/home-sessao.js"></script>
<style>${css.replace(/\n/g, "")}</style>
<script src="/home.js" defer></script>
</head>
<body>
<a class="pular" href="#tour" style="position:absolute;left:-9999px">Pular para o tour</a>
${nav}
<main>
${hero}
${tour}
${colagem}
${marquee}
${pilares}
${blocos}
${mais}
${promessas}
${perguntas}
${cta}
</main>
${rodape}
</body>
</html>
`;

// quem já entrou vai direto para o app; link antigo "/#/ativos" vai para "/ativos"
const sessao = `/* home pública: já tem sessão? vai para o app (gerado por scripts/gera-home.mjs) */
(function(){try{var h=location.hash;if(h&&h.indexOf("#/")===0){location.replace(h.slice(1));return;}
var s=localStorage.getItem("fc-sessao");if(s&&/refresh_token/.test(s)){location.replace("/inicio");}}catch(e){}})();
`;
const js = `/* home pública: tour com capítulos, vídeos só quando aparecem e colagem (gerado por scripts/gera-home.mjs) */
(function(){
var calmo=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var v=document.getElementById("video-tour"),bts=[].slice.call(document.querySelectorAll(".capitulos button"));
function marca(t){var a=null;bts.forEach(function(b){if(+b.dataset.t<=t+0.05)a=b;});bts.forEach(function(b){b.setAttribute("aria-current",b===a?"true":"false");});}
bts.forEach(function(b){b.addEventListener("click",function(){var t=+b.dataset.t;if(v.readyState<1){v.preload="auto";v.load();v.addEventListener("loadedmetadata",function f(){v.removeEventListener("loadedmetadata",f);v.currentTime=t;marca(t);v.play().catch(function(){});});}else{v.currentTime=t;marca(t);v.play().catch(function(){});}});});
if(v){v.addEventListener("timeupdate",function(){marca(v.currentTime);});marca(0);}
var autos=[].slice.call(document.querySelectorAll("video.auto"));
if(!calmo&&"IntersectionObserver" in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(e.isIntersecting){if(el.preload!=="auto"){el.preload="auto";}el.play().catch(function(){});}else el.pause();});},{threshold:.25});
window.addEventListener("load",function(){autos.forEach(function(el){io.observe(el);});});}
var fl=[].slice.call(document.querySelectorAll(".flutua"));
if(!calmo&&fl.length){var pend=false;function mexe(){pend=false;var y=window.scrollY;fl.forEach(function(el){var r=el.parentElement.getBoundingClientRect();var d=(r.top+r.height/2)-innerHeight/2;el.style.transform="translateY("+(d*(+el.dataset.vel||0)).toFixed(1)+"px)";});}
addEventListener("scroll",function(){if(!pend){pend=true;requestAnimationFrame(mexe);}},{passive:true});mexe();}
})();
`;
fs.writeFileSync(path.join(DIST, "index.html"), html);
fs.writeFileSync(path.join(DIST, "home.js"), js);
fs.writeFileSync(path.join(DIST, "home-sessao.js"), sessao);
console.log(`home pública: ${DIST}/index.html (${(html.length / 1024).toFixed(1)} KB); app em app.html`);
