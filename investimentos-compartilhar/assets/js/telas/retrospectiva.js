/* Retrospectiva do mês — o player em tela cheia, no formato stories.
 *
 * Quem desenha é FC.recapRender.render(ctx, t, data, opts); aqui ficam
 * o relógio, a navegação por etapas (toque à direita avança, à esquerda
 * volta, segurar pausa), o som e a exportação do vídeo. O player vive no
 * <body>, fora do conteúdo que o app repinta a cada minuto. */
(function () {
  const FC = window.FC;
  const { html, icone } = FC;
  const { W, H, BOTAO_FINAL } = FC.recapRender;

  let aberto = null, abertoChave = null;

  // #/retrospectiva/mes ou #/retrospectiva/ano; um terceiro pedaço
  // ("ajustes") diz para onde voltar ao fechar
  FC.telas.retrospectiva = async function (raiz, params = []) {
    raiz.innerHTML = "";
    const tipo = params[0] === "ano" ? "ano" : "mes", volta = params[1] === "ajustes" ? "#/ajustes" : "#/inicio";
    const chave = tipo + volta;
    if (aberto && abertoChave === chave) return;
    if (aberto) { aberto.destroi(); aberto = null; }
    const uid = FC.auth.usuario.id, hoje = FC.datas.hoje();
    const data = tipo === "ano" ? await FC.recap.getYearRecap(uid, hoje.slice(0, 4)) : await FC.recap.getMonthRecap(uid, hoje.slice(0, 7));
    if (!location.hash.startsWith("#/retrospectiva")) return;
    aberto = monta(data, volta); abertoChave = chave;
  };
  window.addEventListener("hashchange", () => {
    if (aberto && !location.hash.startsWith("#/retrospectiva")) { aberto.destroi(); aberto = null; }
  });

  function monta(data, volta = "#/inicio") {
    const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let privado = !!FC.local.ler("privado", false);
    const opts = () => ({ privado, reduzido });
    let etapas = FC.recapRender.etapas(data, opts()), dur = FC.recapRender.duracao(data, opts());
    let t = 0, tocando = false, comecou = false, inicio = 0, t0 = 0, raf = 0;
    let audio = null, mudo = !!FC.local.ler("recap-mudo", false), gravando = null;

    const el = document.createElement("div");
    el.className = "historia";
    el.innerHTML = String(html`
      <div class="historia-palco">
        <canvas width="${W}" height="${H}" role="img" aria-label="Retrospectiva de ${data.rotulo.toLowerCase()}"></canvas>
        <div class="historia-topo">
          <div class="historia-barras"></div>
          <div class="historia-cab">
            <span class="historia-marca">${FC.logo(14)}</span>
            <span class="historia-nome"><b>Retrospectiva ${data.tipo === "ano" ? "do ano" : "do mês"}</b><small>dados de exemplo</small></span>
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
          <b>${data.tipo === "ano" ? `Seu ${data.rotulo}` : `Sua retrospectiva de ${data.rotulo.split(" ")[0].toLowerCase()}`}</b>
          <small>toque para começar · use o som</small>
        </button>
      </div>
      <button type="button" class="historia-seta esq" aria-label="Etapa anterior">${icone("voltar", 26)}</button>
      <button type="button" class="historia-seta dir" aria-label="Próxima etapa">${icone("chevron", 26)}</button>`);
    document.body.appendChild(el);
    document.documentElement.classList.add("ob-aberto");

    const canvas = FC.$("canvas", el), ctx = canvas.getContext("2d");
    const barras = FC.$(".historia-barras", el), comecar = FC.$(".historia-comecar", el);

    function montaBarras() {
      barras.innerHTML = etapas.map(() => '<span><i></i></span>').join("");
    }
    const etapaDe = (x) => Math.max(0, etapas.findIndex((e) => x >= e.ini && x < e.fim)) || (x >= dur ? etapas.length - 1 : 0);
    let corAtual = null;
    function desenha() {
      FC.recapRender.render(ctx, t, data, opts());
      const i = t >= dur ? etapas.length - 1 : etapaDe(t);
      FC.$$("i", barras).forEach((b, k) => {
        const e = etapas[k];
        b.style.transform = `scaleX(${k < i ? 1 : k > i ? 0 : Math.min(1, (t - e.ini) / (e.fim - e.ini))})`;
      });
      if (corAtual !== etapas[i].cor) { corAtual = etapas[i].cor; el.style.setProperty("--cor", corAtual); }
    }
    function quadro(agora) {
      if (!tocando) return;
      t = t0 + (agora - inicio) / 1000;
      if (t >= dur) { t = dur; pausa(); if (gravando) gravando.fim(); }
      desenha();
      if (tocando) raf = requestAnimationFrame(quadro);
    }
    function botoes() {
      FC.$("[data-c=mudo]", el).innerHTML = String(icone(mudo ? "somDesligado" : "som", 20));
      FC.$("[data-c=mudo]", el).setAttribute("aria-label", mudo ? "Ligar o som" : "Tirar o som");
      FC.$("[data-c=privado]", el).innerHTML = String(icone(privado ? "olhoFechado" : "olho", 20));
      FC.$("[data-c=privado]", el).setAttribute("aria-label", privado ? "Mostrar valores" : "Esconder valores");
      FC.$("[data-c=privado]", el).setAttribute("aria-pressed", String(privado));
    }

    // o som só nasce aqui, dentro de um gesto
    function garanteAudio() {
      if (!audio) { try { audio = FC.recapAudio.criar(data, opts()); audio.mudo(mudo); } catch (e) { console.error(e); } }
      if (audio) audio.retoma();
    }
    function toca() {
      if (t >= dur - 0.01) t = 0;
      garanteAudio();
      tocando = true; t0 = t; inicio = performance.now();
      if (audio) audio.toca(t);
      FC.$(".historia-pausa", el).hidden = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(quadro);
    }
    function pausa() {
      tocando = false;
      cancelAnimationFrame(raf);
      if (audio) audio.para();
    }
    function vaiPara(nt) {
      t = Math.max(0, Math.min(dur, nt));
      if (tocando) { t0 = t; inicio = performance.now(); if (audio) audio.toca(t); }
      desenha();
    }
    function proxima() {
      const i = etapaDe(t);
      if (i < etapas.length - 1) vaiPara(etapas[i + 1].ini + 0.001);
      else vaiPara(dur);
      if (!tocando && t < dur) toca();
    }
    function anterior() {
      const i = etapaDe(t), e = etapas[i];
      // perto do começo da etapa, volta uma; senão, recomeça a atual
      vaiPara(t - e.ini > 1.2 || i === 0 ? e.ini + 0.001 : etapas[i - 1].ini + 0.001);
      if (!tocando) toca();
    }
    function fecha() { location.hash = volta; }

    // área de desenho real do canvas (object-fit: contain)
    function noQuadro(e) {
      const r = canvas.getBoundingClientRect(), k = Math.min(r.width / W, r.height / H);
      const ox = r.left + (r.width - W * k) / 2, oy = r.top + (r.height - H * k) / 2;
      return { x: (e.clientX - ox) / k, y: (e.clientY - oy) / k, larg: r.width, rx: e.clientX - r.left };
    }

    comecar.addEventListener("click", () => {
      comecou = true; comecar.hidden = true; el.classList.add("comecou");
      t = 0; toca();
    });
    // toque curto navega, segurar pausa
    let segura = null, segurou = false, estavaTocando = false;
    const palco = FC.$(".historia-palco", el);
    palco.addEventListener("pointerdown", (e) => {
      if (!comecou || gravando || e.target.closest("button")) return;
      segurou = false; estavaTocando = tocando;
      clearTimeout(segura);
      segura = setTimeout(() => { segurou = true; if (tocando) { pausa(); FC.$(".historia-pausa", el).hidden = false; } }, 230);
    });
    palco.addEventListener("pointerup", (e) => {
      if (!comecou || gravando || e.target.closest("button")) return;
      clearTimeout(segura);
      if (segurou) { if (estavaTocando) toca(); return; }
      const p = noQuadro(e), b = BOTAO_FINAL;
      if (etapaDe(t) === etapas.length - 1 && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return fecha();
      if (p.rx < p.larg * 0.35) anterior(); else proxima();
    });
    palco.addEventListener("pointercancel", () => clearTimeout(segura));
    palco.addEventListener("contextmenu", (e) => e.preventDefault());
    FC.$(".historia-seta.esq", el).addEventListener("click", () => { if (comecou && !gravando) anterior(); });
    FC.$(".historia-seta.dir", el).addEventListener("click", () => { if (!comecou) comecar.click(); else if (!gravando) proxima(); });

    FC.$("[data-c=fechar]", el).addEventListener("click", fecha);
    FC.$("[data-c=mudo]", el).addEventListener("click", () => {
      mudo = !mudo; FC.local.gravar("recap-mudo", mudo);
      if (audio) audio.mudo(mudo);
      botoes();
    });
    FC.$("[data-c=privado]", el).addEventListener("click", () => {
      // a sequência de etapas pode mudar: recomeça a etapa equivalente
      const id = etapas[etapaDe(t)].id, estava = tocando;
      pausa();
      privado = !privado;
      etapas = FC.recapRender.etapas(data, opts()); dur = FC.recapRender.duracao(data, opts());
      if (audio) { audio.fecha(); audio = null; }
      const e = etapas.find((x) => x.id === id) || etapas[0];
      t = e.ini + 0.001;
      montaBarras(); botoes();
      if (estava) toca(); else desenha();
    });
    FC.$("[data-c=exportar]", el).addEventListener("click", exporta);

    const tecla = (e) => {
      if (gravando) return;
      if (e.key === "Escape") return fecha();
      if (!comecou) { if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); comecar.click(); } return; }
      if (e.key === "ArrowRight") proxima();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === " ") { e.preventDefault(); if (tocando) { pausa(); FC.$(".historia-pausa", el).hidden = false; } else toca(); }
    };
    document.addEventListener("keydown", tecla);

    // ------------------------------------------------------------ exportar
    // grava a sequência inteira em tempo real, com o áudio mixado
    async function exporta() {
      if (gravando) return;
      if (!window.MediaRecorder || !canvas.captureStream) return FC.ui.aviso("Este navegador não grava vídeo. Use o Chrome, o Edge ou o Safari atualizado.", "erro");
      const tipos = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const tipo = tipos.find((x) => MediaRecorder.isTypeSupported(x));
      if (!tipo) return FC.ui.aviso("Este navegador não grava vídeo neste formato.", "erro");
      pausa();
      comecou = true; comecar.hidden = true; el.classList.add("comecou");
      garanteAudio();
      const stream = canvas.captureStream(30);
      if (audio) audio.fluxo.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 });
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const aviso = FC.$(".historia-gravando", el), rot = FC.$("[data-rec]", el);
      el.classList.add("gravando"); aviso.hidden = false;
      const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      const relogio = setInterval(() => { rot.textContent = `Gravando o vídeo… ${fmtT(t)} de ${fmtT(dur)} · mantenha esta aba aberta`; }, 250);
      gravando = { fim() { clearInterval(relogio); setTimeout(() => rec.stop(), 300); } };
      rec.onstop = () => {
        const ext = tipo.startsWith("video/mp4") ? "mp4" : "webm";
        const blob = new Blob(partes, { type: tipo.split(";")[0] });
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = `retrospectiva-${data.mes}.${ext}`; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        el.classList.remove("gravando"); aviso.hidden = true; gravando = null;
        stream.getVideoTracks().forEach((tr) => tr.stop());
        FC.ui.aviso(`Vídeo salvo (${(blob.size / 1048576).toFixed(1)} MB)`);
      };
      rec.start(250);
      t = 0; toca();
    }

    // capa: a abertura já formada, esperando o toque
    montaBarras(); botoes();
    t = 3.4; desenha(); t = 0;
    requestAnimationFrame(() => el.classList.add("visivel"));
    return {
      destroi() {
        pausa();
        if (audio) audio.fecha();
        document.removeEventListener("keydown", tecla);
        document.documentElement.classList.remove("ob-aberto");
        el.classList.remove("visivel");
        setTimeout(() => el.remove(), 250);
      },
      _quadro: (x) => { t = x; desenha(); },
    };
  }
})();
