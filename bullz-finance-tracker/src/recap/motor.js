/* Motor do palco, parte 2: o player da retrospectiva (port de
 * telas/retrospectiva.js) e o palco do vídeo de divulgação (o canvas de
 * FC.abrePromo), mais a gravação. Roda no navegador de verdade: WebView no
 * celular, iframe de public/palco.html na web. Inicia com window.__inicia(cfg). */

(function(){
  var FC = window.FC, envia = window.__envia, html = FC.html, icone = FC.icone;
  var CFG = null;

  // grava o canvas (com a trilha) e entrega o arquivo: no app, em pedaços
  // base64 para o React Native salvar e compartilhar; no navegador, download
  function gravador(canvas, audio, taxa) {
    if (!window.MediaRecorder || !canvas.captureStream) { FC.ui.aviso("Este aparelho não grava vídeo aqui. Atualize o sistema ou use o Chrome no computador.", "erro"); return null; }
    var tipos = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    var tipo = tipos.find(function (x) { return MediaRecorder.isTypeSupported(x); });
    if (!tipo) { FC.ui.aviso("Este aparelho não grava vídeo neste formato.", "erro"); return null; }
    var stream = canvas.captureStream(30);
    if (audio) audio.fluxo.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
    var rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: taxa, audioBitsPerSecond: 192000 });
    var partes = [];
    rec.ondataavailable = function (e) { if (e.data.size) partes.push(e.data); };
    return { tipo: tipo, ext: tipo.indexOf("video/mp4") === 0 ? "mp4" : "webm", rec: rec, stream: stream, partes: partes };
  }
  function entrega(g, nome) {
    var blob = new Blob(g.partes, { type: g.tipo.split(";")[0] });
    g.stream.getVideoTracks().forEach(function (tr) { tr.stop(); });
    if (!window.ReactNativeWebView) {
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = nome; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      FC.ui.aviso("Vídeo salvo (" + (blob.size / 1048576).toFixed(1) + " MB)");
      return Promise.resolve();
    }
    // pedaços múltiplos de 3 bytes: o base64 de cada um se concatena sem padding no meio
    var PEDACO = 3 * 262144, pos = 0;
    envia({ ev: "video-ini", nome: nome, mime: blob.type, tamanho: blob.size });
    return new Promise(function (ok) {
      (function proximo() {
        if (pos >= blob.size) { envia({ ev: "video-fim", nome: nome, mime: blob.type, tamanho: blob.size }); return ok(); }
        var fr = new FileReader();
        fr.onload = function () { envia({ ev: "video-parte", b64: String(fr.result).split(",")[1] || "" }); pos += PEDACO; setTimeout(proximo, 0); };
        fr.onerror = function () { envia({ ev: "video-erro" }); ok(); };
        fr.readAsDataURL(blob.slice(pos, pos + PEDACO));
      })();
    });
  }

  // ------------------------------------------------------------ retrospectiva (port de telas/retrospectiva.js)
  function retro(data) {
    var R = FC.recapRender, W = R.W, H = R.H, BOTAO_FINAL = R.BOTAO_FINAL;
    var reduzido = CFG.reduzido, privado = CFG.privado, mudo = CFG.mudo;
    var opts = function () { return { privado: privado, reduzido: reduzido }; };
    var etapas = R.etapas(data, opts()), dur = R.duracao(data, opts());
    var t = 0, tocando = false, comecou = false, inicio = 0, t0 = 0, raf = 0, audio = null, gravando = null;
    document.documentElement.style.setProperty("--seguro-topo", CFG.seguro.topo + "px");
    var el = document.createElement("div");
    el.className = "historia";
    el.innerHTML = String(html`
      <div class="historia-palco">
        <canvas width="${W}" height="${H}" role="img" aria-label="Retrospectiva de ${data.rotulo.toLowerCase()}"></canvas>
        <div class="historia-topo">
          <div class="historia-barras"></div>
          <div class="historia-cab">
            <span class="historia-marca">${FC.logo(32)}</span>
            <span class="historia-nome"><b>Retrospectiva ${data.tipo === "ano" ? "do ano" : "do mês"}</b><small>${data.rotulo}</small></span>
            <button type="button" class="historia-bt" data-c="mudo"></button>
            <button type="button" class="historia-bt" data-c="privado"></button>
            <button type="button" class="historia-bt" data-c="exportar" aria-label="Exportar vídeo" title="Exportar vídeo">${icone("exportar", 20)}</button>
            <button type="button" class="historia-bt" data-c="fechar" aria-label="Fechar">${icone("fechar", 20)}</button>
          </div>
        </div>
        <div class="historia-pausa" hidden>${icone("pausa", 30)}</div>
        <div class="historia-gravando" hidden><span class="ponto-rec"></span><span data-rec>Gravando…</span></div>
        <button type="button" class="historia-comecar">
          <span class="historia-comecar-ic">${icone("play", 34)}</span>
          <b>${data.tipo === "ano" ? "Seu " + data.rotulo : "Sua retrospectiva de " + data.rotulo.split(" ")[0].toLowerCase()}</b>
          <small>toque para começar · use o som</small>
        </button>
      </div>
      <button type="button" class="historia-seta esq" aria-label="Etapa anterior">${icone("voltar", 26)}</button>
      <button type="button" class="historia-seta dir" aria-label="Próxima etapa">${icone("chevron", 26)}</button>`);
    document.body.appendChild(el);
    var $ = function (s) { return FC.$(s, el); };
    var canvas = $("canvas"), ctx = canvas.getContext("2d"), barras = $(".historia-barras"), comecar = $(".historia-comecar");
    function montaBarras() { barras.innerHTML = etapas.map(function () { return "<span><i></i></span>"; }).join(""); }
    var etapaDe = function (x) { return Math.max(0, etapas.findIndex(function (e) { return x >= e.ini && x < e.fim; })) || (x >= dur ? etapas.length - 1 : 0); };
    var corAtual = null;
    function desenha() {
      R.render(ctx, t, data, opts());
      var i = t >= dur ? etapas.length - 1 : etapaDe(t);
      FC.$$("i", barras).forEach(function (b, k) {
        var e = etapas[k];
        b.style.transform = "scaleX(" + (k < i ? 1 : k > i ? 0 : Math.min(1, (t - e.ini) / (e.fim - e.ini))) + ")";
      });
      if (corAtual !== etapas[i].cor) { corAtual = etapas[i].cor; el.style.setProperty("--cor", corAtual); envia({ ev: "cor", cor: corAtual }); }
    }
    function quadro(agora) {
      if (!tocando) return;
      t = t0 + (agora - inicio) / 1000;
      if (t >= dur) { t = dur; pausa(); if (gravando) gravando.fim(); }
      desenha();
      if (tocando) raf = requestAnimationFrame(quadro);
    }
    function botoes() {
      $("[data-c=mudo]").innerHTML = String(icone(mudo ? "somDesligado" : "som", 20));
      $("[data-c=mudo]").setAttribute("aria-label", mudo ? "Ligar o som" : "Tirar o som");
      $("[data-c=privado]").innerHTML = String(icone(privado ? "olhoFechado" : "olho", 20));
      $("[data-c=privado]").setAttribute("aria-label", privado ? "Mostrar valores" : "Esconder valores");
      $("[data-c=privado]").setAttribute("aria-pressed", String(privado));
    }
    function garanteAudio() {
      if (!audio) { try { audio = FC.recapAudio.criar(data, opts()); audio.mudo(mudo); } catch (e) { console.error(e); } }
      if (audio) audio.retoma();
    }
    function toca() {
      if (t >= dur - 0.01) t = 0;
      garanteAudio();
      tocando = true; t0 = t; inicio = performance.now();
      if (audio) audio.toca(t);
      $(".historia-pausa").hidden = true;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(quadro);
    }
    function pausa() { tocando = false; cancelAnimationFrame(raf); if (audio) audio.para(); }
    function vaiPara(nt) {
      t = Math.max(0, Math.min(dur, nt));
      if (tocando) { t0 = t; inicio = performance.now(); if (audio) audio.toca(t); }
      desenha();
    }
    function proxima() {
      var i = etapaDe(t);
      if (i < etapas.length - 1) vaiPara(etapas[i + 1].ini + 0.001); else vaiPara(dur);
      if (!tocando && t < dur) toca();
    }
    function anterior() {
      var i = etapaDe(t), e = etapas[i];
      vaiPara(t - e.ini > 1.2 || i === 0 ? e.ini + 0.001 : etapas[i - 1].ini + 0.001);
      if (!tocando) toca();
    }
    function fecha() { pausa(); if (audio) audio.fecha(); envia({ ev: "fechar" }); }
    function noQuadro(e) {
      var r = canvas.getBoundingClientRect(), k = Math.min(r.width / W, r.height / H);
      var ox = r.left + (r.width - W * k) / 2, oy = r.top + (r.height - H * k) / 2;
      return { x: (e.clientX - ox) / k, y: (e.clientY - oy) / k, larg: r.width, rx: e.clientX - r.left };
    }
    comecar.addEventListener("click", function () { comecou = true; comecar.hidden = true; el.classList.add("comecou"); t = 0; toca(); });
    var segura = null, segurou = false, estavaTocando = false, palco = $(".historia-palco");
    palco.addEventListener("pointerdown", function (e) {
      if (!comecou || gravando || e.target.closest("button")) return;
      segurou = false; estavaTocando = tocando; clearTimeout(segura);
      segura = setTimeout(function () { segurou = true; if (tocando) { pausa(); $(".historia-pausa").hidden = false; } }, 230);
    });
    palco.addEventListener("pointerup", function (e) {
      if (!comecou || gravando || e.target.closest("button")) return;
      clearTimeout(segura);
      if (segurou) { if (estavaTocando) toca(); return; }
      var p = noQuadro(e), b = BOTAO_FINAL;
      if (etapaDe(t) === etapas.length - 1 && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return fecha();
      if (p.rx < p.larg * 0.35) anterior(); else proxima();
    });
    palco.addEventListener("pointercancel", function () { clearTimeout(segura); });
    palco.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    $(".historia-seta.esq").addEventListener("click", function () { if (comecou && !gravando) anterior(); });
    $(".historia-seta.dir").addEventListener("click", function () { if (!comecou) comecar.click(); else if (!gravando) proxima(); });
    $("[data-c=fechar]").addEventListener("click", fecha);
    $("[data-c=mudo]").addEventListener("click", function () { mudo = !mudo; FC.local.gravar("recap-mudo", mudo); if (audio) audio.mudo(mudo); botoes(); });
    $("[data-c=privado]").addEventListener("click", function () {
      var id = etapas[etapaDe(t)].id, estava = tocando;
      pausa(); privado = !privado;
      etapas = R.etapas(data, opts()); dur = R.duracao(data, opts());
      if (audio) { audio.fecha(); audio = null; }
      var e = etapas.find(function (x) { return x.id === id; }) || etapas[0];
      t = e.ini + 0.001; montaBarras(); botoes();
      if (estava) toca(); else desenha();
    });
    $("[data-c=exportar]").addEventListener("click", function () {
      if (gravando) return;
      pausa(); comecou = true; comecar.hidden = true; el.classList.add("comecou");
      garanteAudio();
      var g = gravador(canvas, audio, 6000000); if (!g) return;
      var aviso = $(".historia-gravando"), rot = $("[data-rec]");
      el.classList.add("gravando"); aviso.hidden = false;
      var fmtT = function (s) { return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };
      var relogio = setInterval(function () { rot.textContent = "Gravando o vídeo… " + fmtT(t) + " de " + fmtT(dur) + " · mantenha esta tela aberta"; }, 250);
      gravando = { fim: function () { clearInterval(relogio); setTimeout(function () { g.rec.stop(); }, 300); } };
      g.rec.onstop = function () {
        rot.textContent = "Preparando o arquivo…";
        entrega(g, "retrospectiva-" + data.mes + "." + g.ext).then(function () { el.classList.remove("gravando"); aviso.hidden = true; gravando = null; });
      };
      g.rec.start(250); t = 0; toca();
    });
    document.addEventListener("keydown", function (e) {
      if (gravando) return;
      if (e.key === "Escape") return fecha();
      if (!comecou) { if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); comecar.click(); } return; }
      if (e.key === "ArrowRight") proxima();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === " ") { e.preventDefault(); if (tocando) { pausa(); $(".historia-pausa").hidden = false; } else toca(); }
    });
    montaBarras(); botoes();
    t = 3.4; desenha(); t = 0;
    requestAnimationFrame(function () { el.classList.add("visivel"); });
    window.__retro = { quadro: function (x) { t = x; desenha(); }, etapas: function () { return etapas; } };
  }

  // ------------------------------------------------------------ vídeo de divulgação (o palco de FC.abrePromo)
  function promo() {
    var d = CFG.dados, o = CFG.opts, formato = CFG.formato, t = CFG.t, TOTAL = FC.promo.TOTAL;
    var tocando = false, t0 = 0, inicio = 0, raf = 0, audio = null, mudo = false, gravando = null, ultimoT = 0;
    var el = document.createElement("div");
    el.className = "promo-palco";
    el.innerHTML = '<canvas></canvas><div class="promo-gravando" hidden><span class="ponto-rec"></span><span data-rec>Gravando…</span></div>';
    document.body.appendChild(el);
    var canvas = el.querySelector("canvas"), ctx = canvas.getContext("2d");
    function dimensiona() { var wh = formato === "vertical" ? [1080, 1920] : [1920, 1080]; canvas.width = wh[0]; canvas.height = wh[1]; }
    function avisaT(forca) { var agora = performance.now(); if (forca || agora - ultimoT > 100) { ultimoT = agora; envia({ ev: "t", t: t, tocando: tocando, total: TOTAL }); } }
    function desenha() { FC.promo.render(ctx, t, d, o); avisaT(); }
    function linhaDoTempo() {
      var ev = [], C = FC.promo.CENAS;
      C.forEach(function (c, i) { if (i) ev.push({ t: c.ini, tipo: "whoosh" }); });
      var p = C[1], ini = p.ini + 0.9, du = 1.8;
      for (var k = 0; k < 24; k++) ev.push({ t: ini + du * (1 - Math.pow(1 - k / 24, 0.55)), tipo: "tick", freq: 620 + 900 * (k / 24) });
      ev.push({ t: ini + du, tipo: "ding" }); ev.push({ t: C[C.length - 1].ini + 0.2, tipo: "acorde" });
      return { eventos: ev.sort(function (a, b) { return a.t - b.t; }), total: TOTAL, positivo: true };
    }
    function garanteAudio() {
      if (!audio) { try { audio = FC.recapAudio.criar(d, { linha: linhaDoTempo() }); audio.mudo(mudo); } catch (e) { console.error(e); } }
      if (audio) audio.retoma();
    }
    function quadro(agora) {
      if (!tocando) return;
      t = t0 + (agora - inicio) / 1000;
      if (t >= TOTAL) { t = TOTAL; para(); if (gravando) gravando.fim(); }
      desenha();
      if (tocando) raf = requestAnimationFrame(quadro);
    }
    function toca() { if (t >= TOTAL - 0.01) t = 0; garanteAudio(); tocando = true; t0 = t; inicio = performance.now(); if (audio) audio.toca(t); raf = requestAnimationFrame(quadro); avisaT(true); }
    function para() { tocando = false; cancelAnimationFrame(raf); if (audio) audio.para(); avisaT(true); }
    window.__cmdPromo = function (m) {
      if (m.cmd === "toca") { if (!gravando) toca(); }
      else if (m.cmd === "pausa") { if (!gravando) para(); }
      else if (m.cmd === "vai") { t = Math.max(0, Math.min(TOTAL, m.t)); if (tocando) { t0 = t; inicio = performance.now(); if (audio) audio.toca(t); } desenha(); avisaT(true); }
      else if (m.cmd === "opts") { o = m.opts; desenha(); }
      else if (m.cmd === "dados") { d = m.dados; if (audio) { audio.fecha(); audio = null; } desenha(); }
      else if (m.cmd === "formato") { formato = m.formato; dimensiona(); desenha(); }
      else if (m.cmd === "mudo") { mudo = !!m.mudo; if (audio) audio.mudo(mudo); }
      else if (m.cmd === "fecha") { para(); if (audio) audio.fecha(); }
      else if (m.cmd === "exporta") {
        if (gravando) return;
        para(); garanteAudio();
        var g = gravador(canvas, audio, 8000000); if (!g) return;
        var aviso = el.querySelector(".promo-gravando"), rot = el.querySelector("[data-rec]");
        aviso.hidden = false; envia({ ev: "gravando", ligado: true });
        var rel = setInterval(function () { rot.textContent = "Gravando… " + Math.floor(t) + " de " + Math.round(TOTAL) + " s"; }, 250);
        gravando = { fim: function () { clearInterval(rel); setTimeout(function () { g.rec.stop(); }, 300); } };
        g.rec.onstop = function () {
          rot.textContent = "Preparando o arquivo…";
          entrega(g, "bullz-divulgacao-" + formato + "." + g.ext).then(function () { aviso.hidden = true; gravando = null; envia({ ev: "gravando", ligado: false }); });
        };
        g.rec.start(250); t = 0; toca();
      }
    };
    dimensiona(); desenha();
  }

  window.__cmd = function (m) { if (window.__cmdPromo) window.__cmdPromo(m); };
  window.addEventListener("message", function (e) { if (e.origin === location.origin && e.data && e.data.cmd) window.__cmd(e.data); });
  // o app manda a configuração: embutida (WebView) ou por mensagem (iframe do palco.html)
  window.__inicia = function (cfg) {
    if (CFG) return;
    CFG = cfg;
    if (cfg.prefs) window.__prefs(cfg.prefs);
    try { if (CFG.modo === "retro") retro(CFG.data); else promo(); envia({ ev: "pronto" }); }
    catch (e) { envia({ ev: "aviso", texto: "O player não abriu: " + ((e && e.message) || e), tipo: "erro" }); }
  };
  window.addEventListener("message", function (e) { if (e.origin === location.origin && e.data && e.data.cmd === "inicia") window.__inicia(e.data.cfg); });
  envia({ ev: "carregado" });
})();
