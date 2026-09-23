/* Simular: monta uma cesta de compra e mostra o efeito na alocação antes
 * de comprar — com dinheiro novo ou tirando do caixa. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  const cesta = {};

  FC.telas.simular = async function (raiz) {
    const d = FC.estado.dados;
    const ativos = d.ativos.filter((a) => !a.erro && ok(a.preco)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const base = d.alocacao;
    const patrimonio = FC.soma(base, (l) => l.valor);

    raiz.innerHTML = String(html`
      ${C.cabecalho("Simular aporte", "Monte a cesta e veja o efeito na alocação antes de comprar.")}
      ${C.estadoMercado()}
      ${!ativos.length ? html`<div class="lista">${C.vazio("🧺", "Nada para simular ainda", "Adicione ativos em Investimentos. Eles aparecem aqui com a cotação de hoje.")}</div>` : html`
      <div class="cartao sem-pad rolagem">
        <table class="tabela" id="tab-cesta">
          <thead><tr><th>Ativo</th><th>Score</th><th class="n">Preço</th><th class="n">Cotas</th><th class="n">Valor</th><th class="esconde-mob">Indicadores</th></tr></thead>
          <tbody>${ativos.map((a) => html`<tr data-t="${a.ticker}">
            <td><b>${a.ticker}</b><span class="leg">${a.tipo_rotulo} · ${FC.PILAR_NOME[a.pilar] || ""}</span></td>
            <td><div class="flex" style="gap:10px"><div class="trilha" style="width:70px"><i style="width:${Math.round(a.score || 0)}%;background:var(--${a.cor === "verde" ? "verde" : a.cor === "vermelho" ? "vermelho" : a.cor === "amarelo" ? "s3" : "ink-3"})"></i></div><b style="font-variant-numeric:tabular-nums">${ok(a.score) ? Math.round(a.score) : "—"}</b></div></td>
            <td class="n">${fmt.preco(a.preco)}</td>
            <td class="n"><input class="entrada cesta-qtd" inputmode="decimal" placeholder="0" value="${cesta[a.ticker] || ""}" aria-label="cotas de ${a.ticker}"></td>
            <td class="n"><span class="rs" data-v>—</span></td>
            <td class="esconde-mob">${C.indicadores(a)}</td></tr>`)}</tbody>
        </table>
      </div>
      <div class="cartao mt2" style="position:sticky;bottom:${window.innerWidth <= 920 ? "84px" : "16px"};z-index:5" id="rodape-cesta">
        <div class="flex entre quebra">
          <dl class="kpis"><div class="kpi"><dt>Total da cesta</dt><dd class="rs" id="s-total">R$ 0,00</dd></div>
            <div class="kpi"><dt>Ativos</dt><dd id="s-n">0</dd></div>
            <div class="kpi"><dt>Score médio ponderado</dt><dd id="s-score">—</dd></div></dl>
          <div class="flex"><button class="botao sec" id="bt-limpar">Limpar</button><button class="botao" id="bt-registrar" disabled>Registrar como compras</button></div>
        </div>
      </div>
      <section class="secao">
        <div class="secao-topo"><h2>Efeito na alocação</h2><span class="sub">a mesma cesta, conforme de onde sai o dinheiro</span></div>
        <div id="cenarios"><div class="lista">${C.vazio("📊", "Digite as cotas acima", "A alocação depois da compra aparece aqui, nos dois cenários.")}</div></div>
      </section>`}
    `);
    if (!ativos.length) return;

    const mapa = Object.fromEntries(ativos.map((a) => [a.ticker, a]));
    function calcula() {
      let total = 0, n = 0, somaScore = 0;
      const porPilar = {};
      FC.$$("#tab-cesta tbody tr", raiz).forEach((tr) => {
        const a = mapa[tr.dataset.t];
        const q = FC.lerNum(FC.$("input", tr).value) || 0;
        cesta[a.ticker] = q || "";
        const v = q * a.preco;
        tr.classList.toggle("tem-cota", q > 0);
        FC.$("[data-v]", tr).textContent = q > 0 ? fmt.brlTexto(v) : "—";
        if (q > 0) { total += v; n++; somaScore += (a.score || 0) * v; porPilar[a.pilar] = (porPilar[a.pilar] || 0) + v; }
      });
      FC.$("#s-total", raiz).textContent = fmt.brlTexto(total);
      FC.$("#s-n", raiz).textContent = n;
      FC.$("#s-score", raiz).textContent = total ? Math.round(somaScore / total) : "—";
      FC.$("#bt-registrar", raiz).disabled = !total;
      const alvo = FC.$("#cenarios", raiz);
      if (!total) { alvo.innerHTML = String(html`<div class="lista">${C.vazio("📊", "Digite as cotas acima", "A alocação depois da compra aparece aqui, nos dois cenários.")}</div>`); return; }
      const cenario = (novo) => {
        const totDepois = novo ? patrimonio + total : patrimonio;
        const linhas = FC.PILARES.map((p) => {
          const b = base.find((l) => l.chave === p.chave) || { valor: 0, pct: 0, alvo_pct: Number(d.alocacao_alvo[p.chave]) || 0 };
          let v = b.valor + (porPilar[p.chave] || 0);
          if (!novo && p.chave === "caixa") v = b.valor - total;
          const pctD = totDepois ? (v / totDepois) * 100 : 0;
          return { nome: p.nome, cor: p.cor, hoje: b.pct, pct: pctD, desvio: pctD - b.alvo_pct, alvo: b.alvo_pct, v };
        }).filter((l) => l.v > 0 || l.alvo > 0 || l.hoje > 0);
        const pior = linhas.reduce((m, l) => (Math.abs(l.desvio) > Math.abs(m.desvio) ? l : m), linhas[0]);
        return html`<table class="tabela"><thead><tr><th>Pilar</th><th class="n">Hoje</th><th class="n">Depois</th><th class="n">vs meta</th></tr></thead>
          <tbody>${linhas.map((l) => html`<tr><td><span class="ponto-e" style="background:${l.cor}"></span> ${l.nome}</td><td class="n fraco">${fmt.num(l.hoje, 1)}%</td>
            <td class="n"><b>${fmt.num(l.pct, 1)}%</b></td><td class="n ${l === pior && Math.abs(l.desvio) >= 1 ? "neg" : "fraco"}">${fmt.delta(l.desvio, 1, " p.p.")}</td></tr>`)}</tbody></table>`;
      };
      const caixa = (base.find((l) => l.chave === "caixa") || { valor: 0 }).valor;
      alvo.innerHTML = String(html`<div class="grade g2">
        <div class="cartao"><h3>A · Dinheiro novo</h3><p class="sub mb2">o patrimônio cresce e o caixa fica onde está</p>${cenario(true)}</div>
        <div class="cartao"><h3>B · Saindo do caixa</h3><p class="sub mb2">${caixa < total ? html`<span class="neg">o caixa atual (${fmt.brl(caixa)}) não cobre a cesta</span>` : "o patrimônio não muda, só a composição"}</p>${cenario(false)}</div></div>
        <p class="texto-p mt2">O desvio em vermelho marca o pilar que fica mais distante da meta depois da compra.</p>`);
    }
    FC.$$("#tab-cesta input", raiz).forEach((i) => i.addEventListener("input", calcula));
    FC.$("#bt-limpar", raiz).addEventListener("click", () => { FC.$$("#tab-cesta input", raiz).forEach((i) => { i.value = ""; }); calcula(); });
    FC.$("#bt-registrar", raiz).addEventListener("click", async (e) => {
      const botao = e.currentTarget;
      const itens = Object.entries(cesta).filter(([t, q]) => q > 0 && mapa[t]).map(([t, q]) => ({ tipo: "ativo", ticker: t, quantidade: q, preco: mapa[t].preco,
        valor: q * mapa[t].preco, data: FC.datas.hoje(), observacao: "cesta simulada" }));
      if (!(await FC.ui.confirma(`Registrar ${itens.length} compra(s) com data de hoje e a cotação atual? Dá para ajustar o preço depois, em Aportes.`, { botao: "Registrar" }))) return;
      try {
        await FC.ui.ocupado(botao, () => FC.db.inserirVarios("aportes", itens));
        Object.keys(cesta).forEach((k) => delete cesta[k]);
        await C.depoisDeMudar(`${itens.length} compra(s) registrada(s)`);
      } catch (err) { FC.ui.erro(err); }
    });
    calcula();
  };
})();
