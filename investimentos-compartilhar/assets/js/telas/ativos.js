/* Investimentos: ações, FIIs, ETFs e renda fixa, avaliados pelos seus
 * critérios. É também onde se cadastra e edita cada um. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let filtro = "todos";
  let aba = "lista";          // lista | pagadoras
  const ranking = { tipo: "acoes", freq: "qualquer", dyMin: 4, liqMin: 1, ordem: "nota", resultado: null, chave: null, carregando: false, progresso: 0 };

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
    if (filtro === "dividendos") {
      const pr = FC.estado.proventos || {};
      const ha12 = FC.datas.soma(FC.datas.hoje(), -365);
      ativos = ativos.filter((a) => ((pr[a.ticker] || {}).lista || []).some((p) => p.data_com > ha12));
    }
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

  // ---------------------------------------------------------------- pagadoras
  const chaveRanking = () => [ranking.tipo, ranking.liqMin].join("|");

  function candidatos() {
    const u = FC.estado.mercado.universo;
    if (!u) return [];
    const fonte = ranking.tipo === "fiis" ? u.fiis : u.acoes;
    const liq = (Number(ranking.liqMin) || 0) * 1e6;
    // o Fundamentus já dá o DY: pré-seleciona as 45 que mais pagam entre as
    // líquidas, e a análise de cada uma confirma com os proventos reais
    return Object.values(fonte).filter((x) => (x.liquidez || 0) >= liq && x.dy > 0 && x.dy < 40 && x.cotacao > 0)
      .sort((a, b) => b.dy - a.dy).slice(0, 45)
      .map((x) => ({ ticker: x.ticker, classe: ranking.tipo === "fiis" ? "fii" : "acao_br", fund: x }));
  }

  async function montaRanking(raiz, forcar = false) {
    if (ranking.carregando) return;
    if (!forcar && ranking.resultado && ranking.chave === chaveRanking()) return;
    ranking.carregando = true; ranking.progresso = 0;
    const cands = candidatos();
    const pintaProgresso = () => { const el = FC.$("#rk-progresso i", raiz); if (el) el.style.width = ranking.progresso + "%"; };
    try {
      const provs = {};
      for (let i = 0; i < cands.length; i += 15) {
        Object.assign(provs, await FC.mercado.proventos(cands.slice(i, i + 15).map((c) => ({ ticker: c.ticker, classe: c.classe }))));
        ranking.progresso = Math.round(((i + 15) / cands.length) * 100); pintaProgresso();
      }
      ranking.resultado = cands.map((c) => ({ ...FC.dividendos.analisaPagadora({ ticker: c.ticker, classe: c.classe, lista: (provs[c.ticker] || {}).lista,
        preco: c.fund.cotacao, fund: c.classe === "acao_br" ? c.fund : null }), segmento: c.fund.segmento || "", liquidez: c.fund.liquidez, lista: (provs[c.ticker] || {}).lista || [] }));
      ranking.chave = chaveRanking();
    } catch (e) { FC.ui.erro(e); } finally { ranking.carregando = false; }
    if (location.hash.startsWith("#/ativos") && aba === "pagadoras") FC.rerender({ suave: true, semAnimacao: true });
  }

  function filtrados() {
    const ordemFreq = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 4, anual: 5 };
    let l = (ranking.resultado || []).filter((r) => r.soma12 > 0 && (r.dy12 || 0) >= (Number(ranking.dyMin) || 0));
    if (ranking.freq === "mensal") l = l.filter((r) => r.frequencia === "mensal");
    if (ranking.freq === "trimestral") l = l.filter((r) => (ordemFreq[r.frequencia] || 9) <= 3);
    if (ranking.freq === "regular") l = l.filter((r) => r.anos_com_pagamento === 5);
    const ord = { nota: (a, b) => b.nota - a.nota, dy: (a, b) => b.dy12 - a.dy12,
      regularidade: (a, b) => b.anos_com_pagamento - a.anos_com_pagamento || (b.estabilidade || 0) - (a.estabilidade || 0) || b.nota - a.nota };
    return l.sort(ord[ranking.ordem]);
  }

  const calendario = (meses) => html`<span style="display:inline-flex;gap:2px" title="meses em que costuma pagar">${meses.map((n, i) =>
    html`<i style="width:7px;height:14px;border-radius:2px;background:${n >= 2 ? "var(--verde)" : n === 1 ? "var(--verde-suave)" : "var(--campo)"}" title="${FC.dividendos.NOMES_MES[i]}"></i>`)}</span>`;

  function secaoPagadoras() {
    const e = FC.estado;
    if (!e.mercado.universo) return html`<div class="carregando-tela" style="min-height:20vh"><div class="roda"></div></div>`;
    const pronto = ranking.resultado && ranking.chave === chaveRanking();
    const l = pronto ? filtrados() : [];
    return html`
      <form class="cartao mb3" id="f-rank">
        <div class="flex quebra" style="gap:12px;align-items:flex-end">
          <div class="segmentado" role="group" id="rk-tipo">
            <button type="button" data-v="acoes" aria-pressed="${ranking.tipo === "acoes"}">Ações</button>
            <button type="button" data-v="fiis" aria-pressed="${ranking.tipo === "fiis"}">FIIs</button></div>
          <div class="campo" style="min-width:170px"><label for="rk-freq">Frequência</label><select id="rk-freq">
            ${[["qualquer", "Qualquer"], ["mensal", "Mensal"], ["trimestral", "Trimestral ou mais"], ["regular", "Pagou nos 5 últimos anos"]].map(([k, v]) => html`<option value="${k}" ${ranking.freq === k ? "selected" : ""}>${v}</option>`)}</select></div>
          <div class="campo" style="width:120px"><label for="rk-dy">DY mínimo (%)</label><input id="rk-dy" inputmode="decimal" value="${ranking.dyMin}"></div>
          <div class="campo" style="width:150px"><label for="rk-liq">Liquidez (R$ mi/dia)</label><input id="rk-liq" inputmode="decimal" value="${ranking.liqMin}"></div>
          <div class="campo" style="min-width:150px"><label for="rk-ordem">Ordenar por</label><select id="rk-ordem">
            ${[["nota", "Nota de dividendos"], ["dy", "DY 12 meses"], ["regularidade", "Regularidade"]].map(([k, v]) => html`<option value="${k}" ${ranking.ordem === k ? "selected" : ""}>${v}</option>`)}</select></div>
        </div>
        <p class="texto-p mt2">Pré-seleciona as ${ranking.tipo === "fiis" ? "FIIs" : "ações"} líquidas de maior DY no Fundamentus e analisa os proventos reais de cada uma: frequência, meses de pagamento, 5 anos de histórico, crescimento e payout. Não é recomendação.</p>
      </form>
      ${!pronto ? html`<div class="cartao"><p class="mb2">Analisando os proventos de cada ${ranking.tipo === "fiis" ? "fundo" : "empresa"}… a primeira vez leva alguns segundos.</p>
          <div class="trilha" id="rk-progresso"><i style="width:${ranking.progresso}%;animation:none;transition:width .3s"></i></div></div>`
        : html`<div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>#</th><th>Ativo</th><th>Nota</th><th class="n">DY 12m</th><th>Frequência</th><th>Meses em que paga</th><th class="n">Anos pagando</th><th class="n">Crescimento</th><th class="n">Payout</th><th>Próximo</th></tr></thead>
          <tbody>${l.length ? l.map((r, i) => html`<tr class="clicavel ${FC.estado.base.ativos.some((a) => a.ticker === r.ticker) ? "meu" : ""}" data-pagadora="${r.ticker}">
            <td class="fraco">${i + 1}</td>
            <td><b>${r.ticker}</b><span class="leg">${r.segmento || (r.classe === "fii" ? "FII" : "Ação")}</span></td>
            <td><div class="flex" style="gap:8px">${FC.anel(r.nota, r.cor)}<span class="pilula ${r.cor} sem-ponto" style="font-size:11.5px">${r.classificacao}</span></div></td>
            <td class="n"><b>${fmt.num(r.dy12)}%</b><span class="leg">média 5a ${ok(r.dy_medio5) ? fmt.num(r.dy_medio5) + "%" : "—"}</span></td>
            <td>${r.frequencia}<span class="leg">${r.intervalo_meses ? "a cada " + fmt.num(r.intervalo_meses, r.intervalo_meses % 1 ? 1 : 0) + (r.intervalo_meses === 1 ? " mês" : " meses") : ""}</span></td>
            <td>${calendario(r.meses)}</td>
            <td class="n">${r.anos_com_pagamento}/5</td>
            <td class="n ${ok(r.crescimento) ? (r.crescimento >= 0 ? "pos" : "neg") : ""}">${ok(r.crescimento) ? fmt.delta(r.crescimento) + "% a.a." : "—"}</td>
            <td class="n ${ok(r.payout) && r.payout > 100 ? "neg" : ""}">${ok(r.payout) ? fmt.num(r.payout, 0) + "%" : "—"}</td>
            <td>${r.proximo ? html`<b>${FC.datas.br(r.proximo.pagamento || r.proximo.data_com).slice(0, 5)}</b><span class="leg">${fmt.preco(r.proximo.valor)}/cota</span>` : html`<span class="muito-fraco">—</span>`}</td>
          </tr>`) : html`<tr><td colspan="10" class="fraco" style="padding:28px 16px">Nenhum ativo com esses filtros. Baixe o DY mínimo ou mude a frequência.</td></tr>`}</tbody></table></div>
          <p class="texto-p mt2"><b>Nota de dividendos</b> (0–100): DY 30%, anos pagando 20%, frequência 15%, estabilidade 15%, crescimento 10%, payout 10%. Meses em verde forte: pagou nesse mês em 2 dos últimos 3 anos.</p>`}`;
  }

  function ligaPagadoras(raiz) {
    const area = FC.$("#area-pagadoras", raiz);
    if (!FC.estado.mercado.universo) return;
    const pronto = ranking.resultado && ranking.chave === chaveRanking();
    if (!pronto) montaRanking(raiz);
    const repinta = () => FC.rerender({ suave: true, semAnimacao: true });
    FC.$$("#rk-tipo button", area).forEach((b) => b.addEventListener("click", () => { ranking.tipo = b.dataset.v; ranking.dyMin = b.dataset.v === "fiis" ? 8 : 4; setTimeout(repinta, 180); }));
    [["#rk-freq", "freq"], ["#rk-ordem", "ordem"]].forEach(([s, k]) => FC.$(s, area).addEventListener("change", (e) => { ranking[k] = e.target.value; repinta(); }));
    let espera = null;
    [["#rk-dy", "dyMin"], ["#rk-liq", "liqMin"]].forEach(([s, k]) => FC.$(s, area).addEventListener("input", (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { const v = FC.lerNum(e.target.value); if (v != null) { ranking[k] = v; repinta(); } }, 600);
    }));
    FC.$$("[data-pagadora]", area).forEach((tr) => tr.addEventListener("click", () => abrePagadora((ranking.resultado || []).find((r) => r.ticker === tr.dataset.pagadora))));
  }

  // análise completa de uma pagadora
  function abrePagadora(r) {
    if (!r) return;
    const barrasAno = r.anos.map((a) => ({ rotulo: String(a.ano), titulo: `${a.ano} · ${a.eventos} pagamento(s)`, valor: a.valor, cor: "var(--s2)" }))
      .concat([{ rotulo: "12m", titulo: "últimos 12 meses", valor: r.soma12, cor: "var(--s1)" }]);
    const ultimos = [...(r.lista || [])].sort((a, b) => (b.pagamento || b.data_com).localeCompare(a.pagamento || a.data_com)).slice(0, 12);
    const notas = [["DY", r.notas.dy, "30%"], ["Anos pagando", r.notas.consistencia, "20%"], ["Frequência", r.notas.frequencia, "15%"],
      ["Estabilidade", r.notas.estabilidade, "15%"], ["Crescimento", r.notas.crescimento, "10%"], ["Payout", r.notas.payout, "10%"]];
    const f = FC.ui.folha({
      titulo: `${r.ticker} · dividendos`, larga: true,
      corpo: html`
        <div class="flex quebra" style="gap:20px;margin-bottom:20px">${FC.anel(r.nota, r.cor, true)}
          <div class="cresce"><div class="fraco" style="font-size:13px">${r.segmento || (r.classe === "fii" ? "Fundo imobiliário" : "Ação")}</div>
            <div class="mt1">${FC.pilula(r.cor, r.classificacao)}</div>
            <p class="texto-p mt1">Paga ${r.frequencia === "mensal" ? "todo mês" : r.frequencia}${r.meses_que_paga.length && r.frequencia !== "mensal" ? `, normalmente em ${r.meses_que_paga.join(", ")}` : ""}.</p></div></div>
        <dl class="kpis mb3">
          <div class="kpi pequeno"><dt>DY 12 meses</dt><dd>${fmt.num(r.dy12)}%<small>${fmt.preco(r.soma12)} por cota · preço ${fmt.preco(r.preco)}</small></dd></div>
          <div class="kpi pequeno"><dt>DY médio 5 anos</dt><dd>${ok(r.dy_medio5) ? fmt.num(r.dy_medio5) + "%" : "—"}</dd></div>
          <div class="kpi pequeno"><dt>Frequência</dt><dd>${r.frequencia}<small>${r.eventos12} pagamento(s) em 12 meses</small></dd></div>
          <div class="kpi pequeno"><dt>Anos pagando</dt><dd>${r.anos_com_pagamento} de 5</dd></div>
          <div class="kpi pequeno"><dt>Crescimento</dt><dd class="${ok(r.crescimento) ? (r.crescimento >= 0 ? "pos" : "neg") : ""}">${ok(r.crescimento) ? fmt.delta(r.crescimento) + "% a.a." : "—"}<small>12m de hoje × 12m de 3 anos atrás</small></dd></div>
          ${ok(r.payout) ? html`<div class="kpi pequeno"><dt>Payout</dt><dd class="${r.payout > 100 ? "neg" : ""}">${fmt.num(r.payout, 0)}%<small>do lucro vira provento</small></dd></div>` : ""}
          ${r.pct_jcp ? html`<div class="kpi pequeno"><dt>Em JCP</dt><dd>${fmt.num(r.pct_jcp, 0)}%<small>15% de IR na fonte</small></dd></div>` : ""}
        </dl>
        ${r.alertas.map((a) => html`<div class="mensagem alerta mb2" style="font-size:13px">${icone("alerta", 16)}<span>${a}</span></div>`)}
        <h3 style="font-size:17px;margin:18px 0 4px">Proventos por cota, por ano</h3>
        <p class="texto-p mb2">R$ pagos por cota em cada ano (pela data com) e nos últimos 12 meses.</p>
        ${FC.graficos.colunas({ barras: barrasAno, y: "num", privado: false, altura: 200 })}
        <h3 style="font-size:17px;margin:22px 0 8px">Meses em que paga</h3>
        <div class="flex quebra" style="gap:6px">${r.meses.map((n, i) => html`<div style="text-align:center;width:44px">
          <div style="height:34px;border-radius:8px;background:${n >= 2 ? "var(--verde)" : n === 1 ? "var(--verde-suave)" : "var(--campo)"}"></div>
          <small class="fraco">${FC.dividendos.NOMES_MES[i]}</small></div>`)}</div>
        <p class="texto-p mt1">Verde forte: pagou nesse mês em pelo menos 2 dos últimos 3 anos.</p>
        <h3 style="font-size:17px;margin:22px 0 8px">Como a nota é formada</h3>
        <div class="barras-h">${notas.map(([n, v, peso], i) => html`<div class="b" style="--i:${i}"><span>${n} <small class="muito-fraco">${peso}</small></span>
          <span class="t"><i style="width:${Math.round(v)}%;background:var(--acento)"></i></span><span class="v">${Math.round(v)}</span></div>`)}</div>
        <h3 style="font-size:17px;margin:22px 0 8px">Últimos proventos</h3>
        <div class="lista">${ultimos.map((p) => html`<div class="item"><div class="principal"><div class="titulo">${FC.pilula({ Dividendo: "verde", JCP: "azul", Rendimento: "terra" }[p.tipo] || "cinza", p.tipo)}</div>
          <div class="detalhe">data com ${FC.datas.br(p.data_com)} · paga ${p.pagamento ? FC.datas.br(p.pagamento) : "a definir"}</div></div>
          <div class="valores"><b>${fmt.preco(p.valor)}</b><small>por cota${r.preco ? " · " + fmt.num((p.valor / r.preco) * 100) + "% do preço" : ""}</small></div></div>`)}</div>
        <p class="texto-p mt3">Fonte: Fundamentus. Não é recomendação de compra ou venda.</p>`,
      rodape: html`<button class="botao sec" data-acao="analise">Análise das 4 lentes</button><button class="botao" data-acao="add">Adicionar</button>`,
    });
    FC.$("[data-acao=analise]", f.el).addEventListener("click", () => { f.fechar(); setTimeout(() => C.acharAtivo(r.ticker) ? C.abreAtivo(r.ticker) : C.analisaAvulso(r.ticker, r.classe), 240); });
    FC.$("[data-acao=add]", f.el).addEventListener("click", () => { f.fechar(); setTimeout(() => C.formAtivo({ ticker: r.ticker, classe: r.classe, pilar: r.classe === "fii" ? "real_estate" : "acoes", lista: "watchlist", quantidade: 0, _novo: true }), 240); });
  }

  FC.telas.ativos = async function (raiz, params) {
    const d = FC.estado.dados;
    const nCart = d.ativos.filter((a) => a.na_carteira).length;
    raiz.innerHTML = String(html`
      ${C.cabecalho("Investimentos", "Ações, FIIs, ETFs e cripto pelos seus critérios, e a renda fixa contra o CDI.",
        html`<button class="botao" data-novo="ativo">${icone("aportes", 18)} Ativo</button>`)}
      ${C.estadoMercado()}
      <div class="segmentado mb3" role="group" id="seg-aba" aria-label="Seção">
        <button type="button" data-aba="lista" aria-pressed="${aba === "lista"}">Minha lista</button>
        <button type="button" data-aba="pagadoras" aria-pressed="${aba === "pagadoras"}">Pagadoras de dividendos</button></div>
      <div id="area-pagadoras" ${aba === "pagadoras" ? "" : "hidden"}>${aba === "pagadoras" ? secaoPagadoras() : ""}</div>
      <div id="area-lista" ${aba === "lista" ? "" : "hidden"}>
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
          <button type="button" data-f="dividendos" aria-pressed="${filtro === "dividendos"}">Pagam dividendos</button>
        </div>
        <span class="texto-p">ordenados pela aderência aos seus critérios</span>
      </div>
      <div id="lista-ativos">${lista(d)}</div>
      ${rendaFixa(d)}
      </div>
    `);
    FC.$$("#seg-aba button", raiz).forEach((b) => b.addEventListener("click", () => { aba = b.dataset.aba; setTimeout(() => FC.rerender({ suave: true, semAnimacao: true }), 180); }));
    if (aba === "pagadoras") ligaPagadoras(raiz);

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
    FC.$$("[data-f]", raiz).forEach((b) => b.addEventListener("click", async () => {
      filtro = b.dataset.f;
      if (filtro === "dividendos" && !FC.estado.proventos) await FC.carregaProventos();
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
