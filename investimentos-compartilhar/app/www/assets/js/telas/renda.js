/* Renda: empresas de setores perenes pelos seus quatro critérios. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let criterios = null;
  let soAprovados = false;
  // cotação ao vivo das empresas do universo (Yahoo), renovada a cada 2 min
  const vivo = { em: 0, dados: {}, buscando: false };
  async function atualizaVivo(cfg) {
    if (vivo.buscando || Date.now() - vivo.em < 2 * 60 * 1000) return false;
    vivo.buscando = true;
    try {
      const itens = Object.values(cfg.setores || {}).flatMap((b) => Object.keys(b.empresas || {})).map((t) => ({ ticker: t, classe: "acao_br" }));
      const d = await FC.mercado.cotacoes(itens);
      for (const [t, v] of Object.entries(d)) if (v && FC.ok(v.preco)) vivo.dados[t] = v;
      vivo.em = Date.now();
      return true;
    } catch (e) { console.error(e); return false; } finally { vivo.buscando = false; }
  }
  // o preço entra nas contas que dependem dele (DY, P/L, P/VP, preço justo);
  // lucro, dividendo e patrimônio por ação vêm do Fundamentus
  function comPrecoVivo(acoes) {
    const saida = { ...acoes };
    for (const [t, v] of Object.entries(vivo.dados)) {
      const a = acoes[t];
      if (!a || !a.cotacao) continue;
      const k = v.preco / a.cotacao;
      saida[t] = { ...a, cotacao: v.preco, variacao_dia: v.variacao_dia,
        // payout (DY × P/L) e DL/EBITDA não dependem do preço: ficam iguais
        dy: a.dy != null ? a.dy / k : a.dy, pl: a.pl != null ? a.pl * k : a.pl, pvp: a.pvp != null ? a.pvp * k : a.pvp };
    }
    return saida;
  }

  const pct = (v, c = 2) => (ok(v) ? fmt.num(v, c) + "%" : "—");

  function tabela(b, crit) {
    const med = b.medianas;
    return html`<div class="cabecalho" style="margin:40px 0 12px;align-items:baseline">
        <div><h2 style="font-size:20px">${b.setor}</h2>
        <p class="sub" style="font-size:13px">${crit.alvo === "fixo" ? `preço justo com piso de ${fmt.num(crit.dy_desejado)}%` : html`preço justo com o DY mediano do setor, <b>${pct(med.dy)}</b>`} · ${b.aprovadas} de ${b.total} passam</p></div>
        ${b.mediana_fina ? html`<span class="pilula amarelo">mediana de só ${b.n_dy} empresa${b.n_dy === 1 ? "" : "s"} — referência frágil</span>` : ""}
      </div>
      <div class="cartao sem-pad rolagem"><table class="tabela">
        <thead><tr><th>Empresa</th><th class="n">Cotação</th><th class="n">L/P</th><th class="n">Preço justo</th><th class="n">DL/EBITDA</th>
          <th class="n">Payout</th><th class="n">DY</th><th class="n">ROE</th><th class="n">P/VP</th><th></th></tr></thead>
        <tbody>
          <tr class="mediana"><td>Mediana do setor</td><td class="n">—</td><td class="n">${pct(med.lucro_preco)}</td><td class="n">—</td>
            <td class="n">${b.sem_ebitda ? "n/a" : ok(med.dl_ebitda) ? fmt.num(med.dl_ebitda, 1) + "x" : "—"}</td>
            <td class="n">${pct(med.payout, 0)}</td><td class="n"><b>${pct(med.dy)}</b></td><td class="n">${pct(med.roe, 0)}</td><td class="n">${ok(med.pvp) ? fmt.num(med.pvp) : "—"}</td><td></td></tr>
          ${b.linhas.filter((l) => !soAprovados || l.passa).map((l) => l.ausente
            ? html`<tr class="apagado"><td><b>${l.nome}</b><span class="leg">${l.ticker}</span></td><td colspan="9" class="fraco">não encontrado no Fundamentus — confira o código em Ajustes → Universo de renda</td></tr>`
            : html`<tr class="clicavel ${l.passa ? "" : "apagado"} ${l.tenho ? "meu" : ""}" data-renda="${l.ticker}">
              <td><b>${l.nome}</b><span class="leg">${l.ticker}${l.tenho ? " · na carteira" : ""}</span></td>
              <td class="n">${fmt.num(l.cotacao)}${ok(l.variacao_dia) ? html`<span class="leg ${l.variacao_dia >= 0 ? "pos" : "neg"}">${fmt.delta(l.variacao_dia, 2)}% hoje</span>` : ""}</td>
              <td class="n">${pct(l.lucro_preco)}</td>
              <td class="n">${ok(l.preco_justo) ? html`<b>${fmt.num(l.preco_justo)}</b><span class="leg">${Math.abs(l.desconto) < 0.5 ? "na cota" : l.desconto > 0 ? fmt.num(l.desconto, 0) + "% acima da cota" : fmt.num(-l.desconto, 0) + "% abaixo"}</span>` : "—"}</td>
              <td class="n ${l.testes.divida === false ? "neg" : ""}">${l.sem_ebitda ? html`<span class="muito-fraco">n/a</span>` : ok(l.dl_ebitda) ? fmt.num(l.dl_ebitda, 1) + "x" : "—"}</td>
              <td class="n"><span class="${l.testes.payout === false ? "neg" : ""}">${pct(l.payout, 0)}</span>${ok(l.payout_vs_setor) ? html`<span class="leg">${fmt.delta(l.payout_vs_setor, 0)} p.p.</span>` : ""}</td>
              <td class="n"><b>${pct(l.dy)}</b>${ok(l.dy_vs_setor) ? html`<span class="leg">${fmt.delta(l.dy_vs_setor)} p.p. vs setor</span>` : ""}</td>
              <td class="n fraco">${pct(l.roe, 0)}</td><td class="n fraco">${ok(l.pvp) ? fmt.num(l.pvp) : "—"}</td>
              <td>${l.passa ? FC.pilula("verde", "passa") : FC.pilula("vermelho", `${l.n_reprovados} critério${l.n_reprovados === 1 ? "" : "s"}`)}</td></tr>`)}
        </tbody></table></div>`;
  }

  FC.telas.renda = async function (raiz, params) {
    const cfg = FC.estado.prefs.renda;
    const padrao = { ...cfg.criterios_padrao, alvo: "setor" };
    criterios = criterios || { ...padrao };
    const universo = FC.estado.mercado.universo;
    if (!universo) {
      raiz.innerHTML = String(html`${C.cabecalho("Renda", "Empresas de setores que não dependem de preço de commodity.")}${C.estadoMercado()}
        <div class="carregando-tela" style="min-height:30vh"><div class="roda"></div></div>`);
      return;
    }
    if (Date.now() - vivo.em > 2 * 60 * 1000) atualizaVivo(cfg).then((mudou) => { if (mudou && location.hash.startsWith("#/renda")) FC.rerender({ suave: true, semAnimacao: true }); });
    let linhas = FC.renda.analisa(comPrecoVivo(universo.acoes), cfg, criterios);
    const meus = new Set(FC.estado.dados.ativos.filter((a) => a.posicao).map((a) => a.ticker));
    linhas.forEach((l) => { l.tenho = meus.has(l.ticker); });
    const blocos = FC.renda.agrupaPorSetor(linhas, cfg);
    const resumo = FC.renda.resumo(linhas);

    raiz.innerHTML = String(html`
      ${C.cabecalho("Renda", "Empresas de setores perenes — tarifa regulada, contrato longo ou spread — pelos seus quatro critérios.")}
      <p class="texto-p mb2" style="margin-top:-12px">${vivo.em ? `Cotações ao vivo do Yahoo Finance (${FC.datas.ha(new Date(vivo.em))}, atraso de ~15 min); DY, P/L e P/VP recalculados com o preço de agora.` : "Buscando cotações ao vivo…"} Lucro, dividendos e patrimônio vêm do Fundamentus.</p>
      ${C.estadoMercado()}
      <form class="cartao" id="f-crit">
        <div class="flex entre quebra mb2"><h3>Seus critérios</h3>
          <div class="segmentado" role="group" id="seg-alvo">
            <button type="button" data-alvo="setor" aria-pressed="${criterios.alvo !== "fixo"}">DY mediano do setor</button>
            <button type="button" data-alvo="fixo" aria-pressed="${criterios.alvo === "fixo"}">Piso fixo</button></div></div>
        <div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));display:grid">
          <div class="campo" id="c-piso" style="${criterios.alvo === "fixo" ? "" : "opacity:.45"}"><label for="dy_desejado">Piso de DY (%)</label><input id="dy_desejado" name="dy_desejado" inputmode="decimal" value="${criterios.dy_desejado}"></div>
          <div class="campo"><label for="payout_maximo">Payout máximo (%)</label><input id="payout_maximo" name="payout_maximo" inputmode="decimal" value="${criterios.payout_maximo}"></div>
          <div class="campo"><label for="dl_ebitda_maximo">DL/EBITDA máximo</label><input id="dl_ebitda_maximo" name="dl_ebitda_maximo" inputmode="decimal" value="${criterios.dl_ebitda_maximo}"></div>
          <div class="campo"><label for="liquidez_minima">Liquidez mínima (R$ mi/dia)</label><input id="liquidez_minima" name="liquidez_minima" inputmode="decimal" value="${criterios.liquidez_minima}"></div>
        </div>
        <div class="flex entre quebra mt2">
          <label class="check"><span class="interruptor"><input type="checkbox" id="so-aprov" ${soAprovados ? "checked" : ""}><span></span></span> Só os que passam</label>
          <button class="botao texto pequeno" type="button" id="bt-padrao">Voltar ao padrão</button></div>
        <p class="texto-p mt1">O <b>preço justo</b> é o preço em que o dividendo de hoje renderia o DY alvo. Contra a mediana do setor, cada empresa é medida pelas próprias pares — banco, energia, saneamento e telecom vivem em patamares de yield diferentes.</p>
      </form>

      <section class="secao">
        <div class="secao-topo"><h2>Panorama dos setores</h2><span class="sub">DY mediano · ${resumo.aprovados} de ${resumo.total} empresas passam</span></div>
        <div class="grade auto entra">${blocos.map((b, i) => html`<div class="cartao clicavel" style="--i:${i}" data-vai="${b.setor}">
          <div class="fraco" style="font-size:13px">${b.setor}</div>
          <div style="font-size:30px;font-weight:600;letter-spacing:-.03em">${ok(b.medianas.dy) ? fmt.num(b.medianas.dy) : "—"}<span style="font-size:15px;color:var(--ink-2)">%</span></div>
          <div class="fraco" style="font-size:13px">${b.aprovadas} de ${b.total} passam${b.tenho ? ` · ${b.tenho} na carteira` : ""}</div></div>`)}</div>
      </section>

      ${blocos.map((b) => html`<div id="setor-${b.setor.replace(/\W/g, "")}">${tabela(b, criterios)}</div>`)}

      <p class="texto-p mt4"><b>L/P</b> é o inverso do P/L, lido como rendimento. <b>Payout</b> = DY × P/L. A linha cinza é a <b>mediana</b>, não a média: um payout de 250% num ano de venda de ativo estragaria a referência dos vizinhos.
        Banco não tem EBITDA, então o critério de dívida não se aplica a ele (n/a).</p>
    `);

    const form = FC.$("#f-crit", raiz);
    let espera = null;
    const aplica = () => {
      const d = FC.dadosDoForm(form);
      for (const k of ["dy_desejado", "payout_maximo", "dl_ebitda_maximo", "liquidez_minima"]) {
        const v = FC.lerNum(d[k]);
        if (v != null) criterios[k] = v;
      }
      clearTimeout(espera);
      espera = setTimeout(() => FC.rerender({ suave: true }), 450);
    };
    form.addEventListener("input", aplica);
    FC.$$("#seg-alvo button", raiz).forEach((b) => b.addEventListener("click", () => { criterios.alvo = b.dataset.alvo; setTimeout(() => FC.rerender({ suave: true }), 200); }));
    FC.$("#so-aprov", raiz).addEventListener("change", (e) => { soAprovados = e.target.checked; FC.rerender({ suave: true }); });
    FC.$("#bt-padrao", raiz).addEventListener("click", () => { criterios = { ...padrao }; soAprovados = false; FC.rerender({ suave: true }); });
    FC.$$("[data-vai]", raiz).forEach((c) => c.addEventListener("click", () => {
      const alvo = FC.$("#setor-" + c.dataset.vai.replace(/\W/g, ""), raiz);
      alvo && alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    FC.$$("[data-renda]", raiz).forEach((tr) => tr.addEventListener("click", () => detalhe(tr.dataset.renda, linhas, cfg)));
    if (params[0]) detalhe(params[0].toUpperCase(), linhas, cfg);
  };

  // ---------------------------------------------------------------- detalhe
  async function detalhe(ticker, linhas, cfg) {
    const l = linhas.find((x) => x.ticker === ticker);
    let anos = 5;
    const setor = l ? l.setor : "";
    const f = FC.ui.folha({ titulo: l ? l.nome : ticker, larga: true, corpo: html`<div class="carregando-tela" style="min-height:240px"><div class="roda"></div></div>` });

    async function pinta() {
      f.corpo.innerHTML = '<div class="carregando-tela" style="min-height:240px"><div class="roda"></div></div>';
      try {
        const [h, b] = await Promise.all([FC.mercado.historicos([{ ticker, classe: "acao_br" }], anos), FC.mercado.benchmarks(anos)]);
        const s = h[ticker];
        if (!s || s.erro) throw new Error("histórico indisponível no Yahoo");
        const c = FC.renda.compara(s, b.cdi, b.ibov);
        const r = c.resumo || {};
        const aa = (t) => (ok(t) && c.anos > 0 ? (Math.pow(1 + t / 100, 1 / c.anos) - 1) * 100 : null);
        const bloco = (nome, k, cls) => html`<div class="kpi"><dt><i class="${cls}" style="width:14px;height:3px;display:inline-block;border-radius:2px"></i> ${nome}</dt>
          <dd class="${k === "com_dividendos" || k === "so_preco" ? ((r[k] || 0) >= 0 ? "pos" : "neg") : "fraco"}">${ok(r[k]) ? fmt.delta(r[k]) + "%" : "—"}<small>${ok(aa(r[k])) ? fmt.delta(aa(r[k])) + "% ao ano" : ""}</small></dd></div>`;
        f.corpo.innerHTML = String(html`
          <div class="flex entre quebra mb2"><span class="fraco">${ticker}${setor ? " · " + setor : ""}</span>
            <div class="segmentado" role="group" id="seg-anos">${[3, 5, 10].map((n) => html`<button type="button" data-anos="${n}" aria-pressed="${anos === n}">${n} anos</button>`)}</div></div>
          <h3 style="font-size:17px">Retorno de R$ 100 investidos</h3>
          <p class="texto-p mb2">A curva com dividendos reinveste cada pagamento no preço do dia — é o retorno de quem nunca vende.</p>
          <dl class="kpis mb3">${bloco("Com dividendos", "com_dividendos", "k1")}${bloco("Só a cota", "so_preco", "k2")}${bloco("Ibovespa", "ibov", "kref")}${bloco("CDI", "cdi", "kref2")}</dl>
          ${FC.graficos.linhas({ series: [
            { nome: "Com dividendos", pontos: c.com_dividendos || [], classe: "l1" },
            { nome: "Só a cota", pontos: c.so_preco || [], classe: "l2" },
            { nome: "Ibovespa", pontos: c.ibov || [], classe: "lref" },
            { nome: "CDI", pontos: c.cdi || [], classe: "lref2" }], y: "base100", altura: 280, privado: false })}
          <div class="legenda-g"><span><i class="k1"></i>com dividendos reinvestidos</span><span><i class="k2"></i>só a valorização</span><span><i class="kref"></i>Ibovespa</span><span><i class="kref2"></i>CDI</span></div>
          ${ok(r.com_dividendos) && ok(r.so_preco) ? html`<div class="mensagem info mt3"><span>Em ${fmt.num(c.anos, 1)} anos e ${(s.dividendos || []).length} pagamentos, a cota ${r.so_preco >= 0 ? "subiu" : "caiu"} <b>${fmt.num(Math.abs(r.so_preco), 1)}%</b>
            e quem reinvestiu terminou com <b>${fmt.delta(r.com_dividendos)}%</b> — <b>${fmt.num(r.com_dividendos - r.so_preco, 1)} p.p.</b> vieram do dividendo.
            ${ok(r.cdi) ? (r.com_dividendos > r.cdi ? ` No mesmo período o CDI rendeu ${fmt.num(r.cdi, 1)}%.` : ` No mesmo período o CDI rendeu ${fmt.num(r.cdi, 1)}%, mais que a ação — sem oscilação nem risco de empresa.`) : ""}</span></div>` : ""}
          ${l && !l.ausente ? html`<h3 style="font-size:17px;margin-top:28px">Os critérios hoje</h3>
            <div class="lista mt2">
              ${[["Payout", "dividendo ÷ lucro", pct(l.payout, 0), l.payout == null ? "sem dado" : l.payout > 100 ? "distribui mais do que lucra" : "cabe dentro do lucro", l.testes.payout],
                 ["Lucro sobre preço", "inverso do P/L", pct(l.lucro_preco), `cada R$ 100 na ação geram ${ok(l.lucro_preco) ? fmt.num(l.lucro_preco) : "—"} de lucro ao ano`, l.testes.lucrativa],
                 ["Preço justo", `para DY de ${pct(l.dy_alvo)}`, ok(l.preco_justo) ? fmt.num(l.preco_justo) : "—", ok(l.desconto) ? (l.desconto >= 0 ? `${fmt.num(l.desconto, 0)}% abaixo do preço que daria o yield` : `precisaria cair ${fmt.num(-l.desconto, 0)}% para dar o yield`) : "sem dividendo em 12 meses", l.testes.preco],
                 ["Dívida líquida / EBITDA", "alavancagem", l.sem_ebitda ? "n/a" : ok(l.dl_ebitda) ? fmt.num(l.dl_ebitda, 1) + "x" : "—", l.sem_ebitda ? "banco não tem EBITDA" : ok(l.dl_ebitda) ? (l.dl_ebitda < 0 ? "caixa líquido" : `${fmt.num(l.dl_ebitda, 1)} anos de geração de caixa`) : "múltiplos indisponíveis", l.testes.divida]]
                .map(([t, s2, v, leit, teste]) => html`<div class="item"><div class="principal"><div class="titulo">${t}</div><div class="detalhe">${s2} · ${leit}</div></div>
                  <div class="valores"><b>${v}</b></div>${teste == null ? FC.pilula("cinza", "n/a") : teste ? FC.pilula("verde", "passa") : FC.pilula("vermelho", "reprovado")}</div>`)}
            </div>` : ""}`);
        FC.animar(f.corpo);
        FC.$$("[data-anos]", f.corpo).forEach((bt) => bt.addEventListener("click", () => { anos = Number(bt.dataset.anos); setTimeout(pinta, 200); }));
      } catch (e) {
        f.corpo.innerHTML = String(html`<div class="mensagem erro">${icone("alerta", 18)}<span>${e.message || e}</span></div>`);
      }
    }
    pinta();
  }
})();
