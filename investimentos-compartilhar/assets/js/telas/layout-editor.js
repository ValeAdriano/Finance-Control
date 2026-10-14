/* Editor de layout no próprio Início (#/inicio/editar).
 *
 * Os blocos de verdade ganham uma barra com alça (arrastar), nome e olho
 * (ocultar). O menu (topo e barra do celular) se edita numa folha com a
 * prévia do celular. Tudo salva em preferencias.layout a cada soltar. */
(function () {
  const FC = window.FC;
  const { html, icone } = FC;

  const nomeRota = (id) => (FC.ROTAS.find((r) => r.id === id) || {}).nome || id;
  const iconeRota = (id) => (FC.ROTAS.find((r) => r.id === id) || {}).icone || "ativos";
  const padrao = () => FC.layout.resolve(null, { rotas: FC.ROTAS, ligada: FC.rotaLigada });
  const ED = { arrastando: false };
  let gravando = Promise.resolve();

  // ---------------------------------------------------------------- salvar
  async function salva(novo) {
    const guardar = FC.layout.paraSalvar(novo, padrao());
    FC.estado.prefs.layout = guardar;
    FC.estado.base.prefsBrutas.layout = guardar;
    FC.atualizaNavegacao();
    FC.local.gravar("ultimo-cache-base", FC.estado.base);
    gravando = gravando.then(() => FC.db.gravaPrefs({ layout: guardar }).catch((e) => FC.ui.erro(e)));
    return gravando;
  }

  // ---------------------------------------------------------------- Início em modo edição
  const NOME = Object.fromEntries(FC.LAYOUT_INICIO.map((b) => [b.id, b]));

  // envolve cada bloco renderizado: [{id, conteudo}] na ordem do layout
  function blocos(itens, ocultos) {
    return html`<div class="ed-topo" role="toolbar" aria-label="Editar o Início">
        <div class="ed-topo-txt"><b>Editando o Início</b><span>Arraste pela alça ${icone("ordenar", 14)} e use o olho para ocultar.</span></div>
        <div class="ed-topo-bt">
          <button class="botao sec pequeno" type="button" data-ed="menu">${icone("celular", 15)} Menu</button>
          <button class="botao texto pequeno" type="button" data-ed="padrao">Padrão</button>
          <button class="botao pequeno" type="button" data-ed="pronto">Concluir</button>
        </div></div>
      <div class="ed-lista" id="ed-lista">${itens.map(({ id, conteudo }) => {
        const b = NOME[id], oculto = ocultos.includes(id);
        const vazio = !String(conteudo || "").trim();
        return html`<section class="ed-bloco ${oculto ? "oculto" : ""}" data-id="${id}">
          <div class="ed-barra">
            <button type="button" class="ed-alca" aria-label="Mover ${b.nome}. Setas para cima e para baixo reordenam." title="Arrastar">${icone("ordenar", 18)}</button>
            <span class="ed-nome">${icone(b.icone, 15)} ${b.nome}</span>
            ${b.fixo ? html`<span class="ed-fixo" title="Sempre visível">${icone("cadeado", 15)}</span>`
              : html`<button type="button" class="ed-olho" data-olho="${id}" aria-pressed="${!oculto}" aria-label="${oculto ? "Mostrar" : "Ocultar"} ${b.nome}" title="${oculto ? "Mostrar" : "Ocultar"}">${icone(oculto ? "olhoFechado" : "olho", 18)}</button>`}
          </div>
          <div class="ed-conteudo" inert>${oculto ? html`<p class="ed-aviso">Oculto no Início</p>`
            : vazio ? html`<p class="ed-aviso">${b.desc}. Sem conteúdo agora: aparece quando houver.</p>` : conteudo}</div>
        </section>`;
      })}</div>`;
  }

  function ligaInicio(raiz) {
    document.body.classList.add("editando-layout");
    const lista = FC.$("#ed-lista", raiz);
    const ids = () => FC.$$(".ed-bloco", lista).map((x) => x.dataset.id);
    const gravaOrdem = () => { const l = FC.layoutAtual(); return salva({ ...l, inicio: { ...l.inicio, ordem: ids() } }); };

    // arrastar pela alça, com rolagem automática perto das bordas da tela
    let arr = null, rola = null;
    const para = () => { cancelAnimationFrame(rola); rola = null; };
    lista.addEventListener("pointerdown", (e) => {
      const alca = e.target.closest(".ed-alca");
      if (!alca) return;
      arr = { el: alca.closest(".ed-bloco"), y: e.clientY };
      arr.el.classList.add("arrastando");
      lista.classList.add("arrastando");
      ED.arrastando = true;
      try { alca.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
      e.preventDefault();
    });
    function reposiciona(y) {
      const outros = FC.$$(".ed-bloco", lista).filter((x) => x !== arr.el);
      const alvo = outros.find((x) => { const r = x.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (alvo) { if (arr.el.nextElementSibling !== alvo) lista.insertBefore(arr.el, alvo); }
      else if (lista.lastElementChild !== arr.el) lista.appendChild(arr.el);
    }
    lista.addEventListener("pointermove", (e) => {
      if (!arr) return;
      arr.y = e.clientY;
      reposiciona(e.clientY);
      const borda = 80, h = window.innerHeight;
      const vel = e.clientY < borda ? -(borda - e.clientY) / 4 : e.clientY > h - borda ? (e.clientY - (h - borda)) / 4 : 0;
      if (vel && !rola) {
        const passo = () => {
          if (!arr) return para();
          const v = arr.y < borda ? -(borda - arr.y) / 4 : arr.y > h - borda ? (arr.y - (h - borda)) / 4 : 0;
          if (!v) return para();
          window.scrollBy(0, v);
          reposiciona(arr.y);
          rola = requestAnimationFrame(passo);
        };
        rola = requestAnimationFrame(passo);
      }
    });
    const fim = () => {
      if (!arr) return;
      para();
      arr.el.classList.remove("arrastando");
      lista.classList.remove("arrastando");
      arr = null;
      ED.arrastando = false;
      gravaOrdem();
    };
    lista.addEventListener("pointerup", fim);
    lista.addEventListener("pointercancel", fim);

    lista.addEventListener("keydown", (e) => {
      const alca = e.target.closest(".ed-alca");
      if (!alca || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const item = alca.closest(".ed-bloco");
      const viz = e.key === "ArrowUp" ? item.previousElementSibling : item.nextElementSibling;
      if (!viz) return;
      if (e.key === "ArrowUp") lista.insertBefore(item, viz); else lista.insertBefore(viz, item);
      alca.focus();
      item.scrollIntoView({ block: "nearest" });
      gravaOrdem();
    });

    lista.addEventListener("click", async (e) => {
      const olho = e.target.closest("[data-olho]");
      if (!olho) return;
      const id = olho.dataset.olho, l = FC.layoutAtual();
      const ocultos = l.inicio.ocultos.includes(id) ? l.inicio.ocultos.filter((x) => x !== id) : [...l.inicio.ocultos, id];
      await salva({ ...l, inicio: { ...l.inicio, ocultos, ordem: ids() } });
      FC.rerender({ suave: true, semAnimacao: true });
    });

    FC.$$("[data-ed]", raiz).forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.ed;
      if (a === "pronto") { location.hash = "#/inicio"; FC.ui.aviso("Layout salvo"); }
      else if (a === "menu") abreMenu();
      else if (a === "padrao") {
        if (!(await FC.ui.confirma("Voltar a ordem das abas e dos blocos do Início ao padrão?", { botao: "Voltar ao padrão" }))) return;
        await salva(padrao());
        FC.rerender({ suave: true, semAnimacao: true });
        FC.ui.aviso("Layout padrão restaurado");
      }
    }));
  }

  // sai do modo edição ao trocar de tela
  window.addEventListener("hashchange", () => {
    if (!/^#\/inicio\/editar/.test(location.hash)) document.body.classList.remove("editando-layout");
  });

  // ---------------------------------------------------------------- menu (folha com a prévia do celular)
  const chip = (id) => html`<button type="button" class="lay-chip" data-id="${id}" aria-label="${nomeRota(id)}. Setas esquerda e direita mudam a posição.">
    <span class="lay-chip-ic">${icone(iconeRota(id), 20)}</span><span class="lay-chip-nome">${nomeRota(id)}</span></button>`;

  function abreMenu() {
    const f = FC.ui.folha({
      titulo: "Menu e barra do celular",
      larga: true,
      corpo: html`<p class="texto-p mb3">Arraste as abas entre a barra do celular (até 4) e “Mais”. O menu do computador mostra todas, na mesma ordem.</p>
        <div class="lay-previa">
          <div class="lay-quadro">
            <p class="lay-rotulo">${icone("celular", 15)} No celular</p>
            <div class="lay-celular"><div class="lay-celular-tela">
              <div class="lay-esqueleto"><i></i><i></i><i class="curta"></i><b></b></div>
              <div class="lay-barra" data-zona="barra" aria-label="Barra de baixo do celular"></div></div></div>
            <p class="lay-rotulo mt2">Em “Mais”</p>
            <div class="lay-mais" data-zona="mais" aria-label="Abas dentro de Mais"></div>
          </div>
          <div class="lay-quadro">
            <p class="lay-rotulo">${icone("ativos", 15)} No computador</p>
            <div class="lay-desktop"><div class="lay-desktop-topo"><span class="lay-marca">${icone("inicio", 14)}</span><nav class="lay-topo-abas" data-zona="topo"></nav></div>
              <div class="lay-esqueleto grande"><i></i><i class="curta"></i><b></b></div></div>
          </div>
        </div>`,
      rodape: html`<button class="botao" data-r="ok">Pronto</button>`,
    });
    FC.$("[data-r=ok]", f.el).addEventListener("click", () => f.fechar());
    const el = f.el;
    const bar = FC.$("[data-zona=barra]", el), tray = FC.$("[data-zona=mais]", el), topo = FC.$("[data-zona=topo]", el);
    const MAX = FC.layout.MAX_CELULAR;

    function pinta() {
      const ordem = FC.layoutAtual().nav.ordem;
      const naBarra = ordem.slice(0, MAX), emMais = ordem.slice(MAX);
      bar.innerHTML = String(html`${naBarra.map(chip)}${Array.from({ length: Math.max(0, MAX - naBarra.length) }, () => html`<span class="lay-vazio">vazio</span>`)}`);
      tray.innerHTML = String(emMais.length ? html`${emMais.map(chip)}` : html`<span class="lay-vazio larga">Nada aqui: todas as abas cabem na barra.</span>`);
      topo.innerHTML = String(html`${ordem.map((id) => html`<span class="${naBarra.includes(id) ? "na-barra" : ""}">${nomeRota(id)}</span>`)}`);
    }
    async function muda(ordem) {
      const l = FC.layoutAtual();
      salva({ ...l, nav: { ...l.nav, ordem } });
      pinta();
    }

    let a = null;
    const onde = (e) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const alvo = els.find((x) => x.classList && x.classList.contains("lay-chip") && x !== a.el);
      if (alvo) return { antes: alvo.dataset.id };
      if (els.includes(bar)) return { fimBarra: true };
      if (els.includes(tray)) return { fimMais: true };
      return null;
    };
    const marca = (t) => {
      FC.$$(".alvo", el).forEach((x) => x.classList.remove("alvo"));
      if (!t) return;
      if (t.antes) { const x = FC.$(`.lay-chip[data-id="${t.antes}"]`, el); if (x) x.classList.add("alvo"); }
      else (t.fimBarra ? bar : tray).classList.add("alvo");
    };
    for (const zona of [bar, tray]) {
      zona.addEventListener("pointerdown", (e) => {
        const c = e.target.closest(".lay-chip");
        if (!c) return;
        a = { el: c, x0: e.clientX, y0: e.clientY, alvo: null };
        c.classList.add("arrastando");
        try { c.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
        e.preventDefault();
      });
      zona.addEventListener("pointermove", (e) => {
        if (!a) return;
        a.el.style.transform = `translate(${e.clientX - a.x0}px, ${e.clientY - a.y0}px)`;
        a.alvo = onde(e);
        marca(a.alvo);
      });
      const solta = () => {
        if (!a) return;
        const { el: c, alvo } = a;
        c.classList.remove("arrastando"); c.style.transform = "";
        marca(null);
        a = null;
        if (!alvo) return;
        const ordem = FC.layoutAtual().nav.ordem.filter((x) => x !== c.dataset.id);
        const pos = alvo.antes ? ordem.indexOf(alvo.antes) : alvo.fimBarra ? Math.min(MAX - 1, ordem.length) : ordem.length;
        ordem.splice(pos, 0, c.dataset.id);
        muda(ordem);
      };
      zona.addEventListener("pointerup", solta);
      zona.addEventListener("pointercancel", () => { if (a) { a.el.classList.remove("arrastando"); a.el.style.transform = ""; marca(null); a = null; } });
      zona.addEventListener("keydown", (e) => {
        const c = e.target.closest(".lay-chip");
        if (!c || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        const ordem = FC.layoutAtual().nav.ordem, de = ordem.indexOf(c.dataset.id);
        const p = e.key === "ArrowLeft" ? de - 1 : de + 1;
        if (p < 0 || p >= ordem.length) return;
        muda(FC.layout.move(ordem, de, p));
        const novo = FC.$(`.lay-chip[data-id="${c.dataset.id}"]`, el);
        if (novo) novo.focus();
      });
    }
    pinta();
  }

  FC.layoutEditor = Object.assign(ED, { blocos, ligaInicio, abreMenu, salva });
})();
