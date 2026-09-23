/* Investimentos: ações, FIIs, ETFs e renda fixa, avaliados pelos seus
 * critérios. É também onde se cadastra e edita cada um. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let filtro = "todos";

  function linhaAtivo(a) {
    if (a.erro) {
      return html`<div class="item clicavel" data-edita="${a.ticker}">
        ${FC.anel(null, "cinza")}
        <div class="principal"><div class="titulo">${a.ticker}</div><div class="detalhe">${a.erro}</div></div>
        <span class="chevron">${icone("chevron", 18)}</span></div>`;
    }
    const p = a.posicao;
    return html`<div class="item clicavel" data-abre="${a.ticker}" role="button" tabindex="0">
      ${FC.anel(a.score, a.cor)}
      <div class="principal">
        <div class="titulo">${a.ticker} ${a.na_carteira ? "" : FC.pilula("cinza", "watchlist")}</div>
        <div class="detalhe">${a.tipo_rotulo}${a.segmento ? " · " + a.segmento : ""} · ${FC.PILAR_NOME[a.pilar] || ""}</div>
      </div>
      <div class="esconde-mob" style="flex:1.2;min-width:0">${C.indicadores(a)}</div>
      <div class="valores" style="min-width:92px"><b>${fmt.preco(a.preco)}</b><small class="${FC.ok(a.variacao_dia) ? (a.variacao_dia >= 0 ? "pos" : "neg") : ""}">${FC.ok(a.variacao_dia) ? fmt.delta(a.variacao_dia, 2) + "% hoje" : "preço"}</small></div>
      <div class="valores esconde-mob" style="min-width:120px">
        ${p ? html`<b>${fmt.brl(p.atual)}</b><small>${fmt.qtd(p.quantidade)} ${FC.unidade(a, p.quantidade)}${ok(p.variacao) ? html` · <span class="${p.variacao >= 0 ? "pos" : "neg"}">${fmt.delta(p.variacao)}%</span>` : ""}</small>`
            : html`<small class="muito-fraco">sem posição</small>`}
      </div>
      <div class="esconde-mob" style="width:120px;text-align:right">${FC.pilula(a.cor, a.veredito_curto)}</div>
      <span class="chevron">${icone("chevron", 18)}</span></div>`;
  }

  function lista(d) {
    let ativos = [...d.ativos];
    if (filtro === "carteira") ativos = ativos.filter((a) => a.na_carteira);
    if (filtro === "watchlist") ativos = ativos.filter((a) => !a.na_carteira);
    ativos.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    if (!ativos.length) {
      return html`<div class="lista">${C.vazio("📈", d.ativos.length ? "Nada neste filtro" : "Nenhum ativo ainda",
        d.ativos.length ? "Troque o filtro acima para ver os outros." : "Adicione ações, FIIs, ETFs ou criptomoedas. O painel busca as cotações e avalia cada um pelas quatro lentes.",
        d.ativos.length ? "" : html`<button class="botao" data-novo="ativo">Adicionar ativo</button>`)}</div>`;
    }
    return html`<div class="lista">${ativos.map(linhaAtivo)}</div>`;
  }

  function rendaFixa(d) {
    return html`<section class="secao">
      <div class="secao-topo"><h2>Renda fixa</h2>
        <span class="sub">${ok(d.macro.cdi) ? `comparada ao CDI de hoje (${fmt.num(d.macro.cdi)}%)` : "CDBs, Tesouro e caixa"}</span>
        <div class="direita"><button class="botao sec pequeno" data-novo="rf">${icone("aportes", 16)} Título</button></div></div>
      ${d.rendaFixa.length ? html`<div class="lista">${d.rendaFixa.map((r) => html`
        <div class="item clicavel" data-rf="${r.id}" role="button" tabindex="0">
          <span style="color:var(--verde)">${icone("moeda", 26)}</span>
          <div class="principal"><div class="titulo">${r.nome}</div>
            <div class="detalhe">${r.base}${r.vencimento ? " · vence " + FC.datas.br(r.vencimento) : ""}${ok(r.real) ? " · real " + fmt.num(r.real) + "% a.a." : ""}</div></div>
          <div class="esconde-mob">${FC.pilula(r.cor, r.leitura)}</div>
          <div class="valores"><b>${fmt.brl(r.valor_aplicado)}</b>${r.aportado_aqui ? html`<small>inclui ${fmt.brl(r.aportado_aqui)} de aportes</small>` : html`<small>${ok(r.nominal) ? fmt.num(r.nominal) + "% a.a." : ""}</small>`}</div>
          <span class="chevron">${icone("chevron", 18)}</span></div>`)}</div>
        <p class="texto-p mt2">A comparação é a foto de hoje. Um título IPCA+ rende menos que o CDI enquanto a Selic está alta e a inflação baixa, e a relação se inverte no cenário oposto.</p>`
        : html`<div class="lista">${C.vazio("🏦", "Nenhum título", "Cadastre CDBs, Tesouro Direto ou a conta remunerada para eles entrarem no patrimônio e na alocação.", html`<button class="botao" data-novo="rf">Adicionar título</button>`)}</div>`}
    </section>`;
  }

  FC.telas.ativos = async function (raiz, params) {
    const d = FC.estado.dados;
    const nCart = d.ativos.filter((a) => a.na_carteira).length;
    raiz.innerHTML = String(html`
      ${C.cabecalho("Investimentos", "Ações, FIIs, ETFs e cripto pelos seus critérios, e a renda fixa contra o CDI.",
        html`<button class="botao" data-novo="ativo">${icone("aportes", 18)} Ativo</button>`)}
      ${C.estadoMercado()}
      <form class="cartao mb3" id="f-analisar" style="padding:16px 20px">
        <div class="flex quebra" style="gap:12px">
          <span style="color:var(--acento)">${icone("ativos", 22)}</span>
          <div class="cresce" style="min-width:180px"><label class="sr" for="an-ticker">Código para analisar</label>
            <input class="entrada" id="an-ticker" list="an-lista" placeholder="Analisar qualquer código: PETR4, HGLG11, BOVA11, BTC…" autocomplete="off" style="text-transform:uppercase"></div>
          <select class="entrada" id="an-classe" style="max-width:190px" aria-label="Tipo">
            <option value="auto">Tipo automático</option>${Object.entries(FC.CLASSES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
          <button class="botao" type="submit">Analisar</button>
        </div>
        <datalist id="an-lista"></datalist>
      </form>
      ${C.resumoInvestido(d)}
      <div class="secao-topo mt3"><h2>Sua lista</h2></div>
      <div class="flex entre quebra mb2">
        <div class="segmentado" role="group" aria-label="Filtrar">
          <button type="button" data-f="todos" aria-pressed="${filtro === "todos"}">Todos · ${d.ativos.length}</button>
          <button type="button" data-f="carteira" aria-pressed="${filtro === "carteira"}">Carteira · ${nCart}</button>
          <button type="button" data-f="watchlist" aria-pressed="${filtro === "watchlist"}">Watchlist · ${d.ativos.length - nCart}</button>
        </div>
        <span class="texto-p">ordenados pela aderência aos seus critérios</span>
      </div>
      <div id="lista-ativos">${lista(d)}</div>
      ${rendaFixa(d)}
    `);

    const liga = (el) => {
      FC.$$("[data-abre]", el).forEach((x) => {
        x.addEventListener("click", () => C.abreAtivo(x.dataset.abre));
        x.addEventListener("keydown", (e) => { if (e.key === "Enter") C.abreAtivo(x.dataset.abre); });
      });
      FC.$$("[data-edita]", el).forEach((x) => x.addEventListener("click", () => {
        const a = C.acharAtivo(x.dataset.edita); if (a) C.formAtivo(a.item);
      }));
      FC.$$("[data-novo]", el).forEach((x) => x.addEventListener("click", () => (x.dataset.novo === "ativo" ? C.formAtivo() : C.formRendaFixa())));
    };
    liga(raiz);
    FC.$$("[data-rf]", raiz).forEach((x) => x.addEventListener("click", () => {
      const r = FC.estado.base.rendaFixa.find((y) => String(y.id) === x.dataset.rf); if (r) C.formRendaFixa(r);
    }));
    FC.$$("[data-f]", raiz).forEach((b) => b.addEventListener("click", () => {
      filtro = b.dataset.f;
      const alvo = FC.$("#lista-ativos", raiz);
      alvo.innerHTML = String(lista(FC.estado.dados));
      alvo.firstElementChild && alvo.firstElementChild.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "cubic-bezier(.32,.72,0,1)" });
      FC.animar(alvo);
      liga(alvo);
    }));
    if (params[0]) setTimeout(() => C.abreAtivo(params[0].toUpperCase()), 200);

    // ---- análise avulsa: qualquer código, sem precisar cadastrar
    const uni = FC.estado.mercado.universo;
    if (uni) {
      // sugestões: todas as ações e FIIs do Fundamentus (preenchido depois de pintar)
      setTimeout(() => {
        const dl = FC.$("#an-lista", raiz);
        if (dl) dl.innerHTML = [...Object.keys(uni.acoes), ...Object.keys(uni.fiis)].sort().map((t) => `<option value="${t}">`).join("");
      }, 50);
    }
    FC.$("#f-analisar", raiz).addEventListener("submit", async (e) => {
      e.preventDefault();
      const bruto = FC.$("#an-ticker", raiz).value.trim().toUpperCase();
      let classe = FC.$("#an-classe", raiz).value;
      const ticker = bruto.replace(classe === "cripto" ? /[^A-Z0-9-]/g : /[^A-Z0-9-]/g, "");
      if (ticker.length < 2) return FC.ui.aviso("Digite um código.", "erro");
      if (C.acharAtivo(ticker)) return C.abreAtivo(ticker);
      if (classe === "auto") classe = C.adivinhaClasse(ticker);
      await C.analisaAvulso(ticker, classe, FC.$("#f-analisar button", raiz));
    });
  };
})();
