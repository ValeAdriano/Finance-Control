/* Início: o retrato do patrimônio em uma tela. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;

  function saudacao() {
    const h = new Date().getHours();
    return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }

  function macro(m) {
    const itens = [["selic_meta", "Selic"], ["cdi", "CDI"], ["ipca_12m", "IPCA 12m"], ["juro_real", "Juro real"]];
    const fontes = m.fontes || {};
    return html`<dl class="macro">${itens.map(([k, r]) => {
      const f = fontes[k] || {};
      let quando = "", atrasado = false;
      if (f.data) {
        const iso = FC.datas.deBr(f.data);
        if (iso) {
          const d = FC.datas.dias(iso, FC.datas.hoje());
          quando = d < 0 ? "vigente a partir de " + f.data : "apurado em " + f.data;
          atrasado = d > 40;
        }
      }
      return html`<div><dt>${r} ${FC.ajuda(`${f.descricao || ""}. Fonte: ${f.origem || "—"}.`)}</dt>
        <dd>${ok(m[k]) ? fmt.num(m[k]) + "%" : "—"}</dd><small class="${atrasado ? "atrasado" : ""}">${quando || " "}</small></div>`;
    })}</dl>`;
  }

  function alocacao(d) {
    if (!d.alocacao.length) return "";
    const escala = Math.max(...d.alocacao.map((l) => Math.max(l.pct, l.alvo_pct))) * 1.12 || 100;
    return html`<section class="secao">
      <div class="secao-topo"><h2>Alocação por pilar</h2><span class="sub">a barra é o que você tem; o traço, a sua meta</span>
        <div class="direita"><a class="botao texto pequeno" href="#/ajustes">Mudar metas</a></div></div>
      <div class="lista">${d.alocacao.map((l) => html`
        <div class="item clicavel" data-pilar="${l.chave}" role="button" tabindex="0" aria-expanded="false">
          <span class="ponto-e" style="background:${l.cor};width:12px;height:12px"></span>
          <div class="principal">
            <div class="titulo">${l.nome}<span class="muito-fraco" style="font-weight:400;font-size:13px">${l.composicao.length} ${l.composicao.length === 1 ? "item" : "itens"}</span></div>
            <div class="aloc mt1">${FC.graficos.barraAlocacao(l.pct, l.alvo_pct, escala, l.cor)}</div>
          </div>
          <div class="valores" style="min-width:120px">
            <b>${fmt.num(l.pct, 1)}%<span class="muito-fraco" style="font-weight:400"> / ${fmt.num(l.alvo_pct, 0)}%</span></b>
            <small>${Math.abs(l.desvio_pct) < 1 ? "na meta" : l.desvio_reais > 0 ? html`aportar ${fmt.brl(l.desvio_reais, 0)}` : html`${fmt.brl(-l.desvio_reais, 0)} acima`}</small>
          </div>
        </div>
        <div class="composicao" data-de="${l.chave}" hidden style="background:var(--bg-3);border-top:1px solid var(--linha)">
          ${l.composicao.map((x) => html`<div class="flex ${x.ticker ? "clicavel-ativo" : ""}" data-ticker="${x.ticker || ""}" style="padding:10px 24px 10px 52px;gap:12px;${x.ticker ? "cursor:pointer" : ""}">
            <div class="cresce"><b style="font-size:14px">${x.nome}</b> <span class="fraco" style="font-size:12.5px">${x.tipo || ""}</span>
              <div class="trilha mt1" style="max-width:260px"><i style="width:${x.peso}%;background:${l.cor}"></i></div></div>
            <div class="direita-t" style="font-size:13.5px"><div>${fmt.brl(x.valor)}</div><div class="fraco" style="font-size:12px">${fmt.num(x.peso, 1)}% do pilar</div></div>
            <div style="width:90px;text-align:right">${ok(x.score) ? FC.pilula(x.cor, Math.round(x.score)) : ok(x.variacao) ? html`<span class="${x.variacao >= 0 ? "pos" : "neg"}">${fmt.delta(x.variacao)}%</span>` : ""}</div>
          </div>`)}
        </div>`)}
      </div></section>`;
  }

  // proventos lançados em Aportes; sem eles, os pagos calculados pela posição
  function proventos(r, div) {
    if ((!r || r.n_meses < 2) && div) {
      const meses = div.serie.filter((m) => !m.futuro).map((m) => ({ mes: m.mes, total: m.total, itens: m.itens }));
      while (meses.length && !(meses[0].total > 0)) meses.shift();
      if (meses.length >= 2) {
        const total = FC.soma(meses, (m) => m.total), ult = meses.slice(-3);
        r = { meses, total, ultimo: meses.at(-1).total, media_recente: FC.soma(ult, (m) => m.total) / ult.length, n_meses: meses.length };
      }
    }
    if (!r || r.n_meses < 2) return "";
    return html`<section class="secao">
      <div class="secao-topo"><h2>Proventos por mês</h2><span class="sub">o que a carteira deposita sem você vender nada</span></div>
      <div class="cartao">
        <dl class="kpis mb3">
          <div class="kpi"><dt>Último mês</dt><dd>${fmt.brl(r.ultimo)}</dd></div>
          <div class="kpi"><dt>Média dos 3 últimos</dt><dd>${fmt.brl(r.media_recente)}</dd></div>
          <div class="kpi"><dt>Total recebido</dt><dd>${fmt.brl(r.total)}<small>em ${r.n_meses} meses</small></dd></div>
        </dl>
        ${FC.graficos.colunas({ barras: r.meses.map((m) => ({ rotulo: FC.datas.mesAno(m.mes + "-01"), titulo: FC.datas.mesAno(m.mes + "-01"), valor: m.total, detalhe: m.itens })) })}
      </div></section>`;
  }

  function agroResumo(ag) {
    if (!ag.tem_dados || !FC.modulo("agro")) return "";
    return html`<section class="secao">
      <div class="secao-topo"><h2>Agronegócio</h2><span class="sub">rebanho e resultado da atividade</span>
        <div class="direita"><a class="botao texto pequeno" href="#/agro">Abrir ${icone("chevron", 14)}</a></div></div>
      <a class="cartao clicavel" href="#/agro" style="display:block;color:inherit;text-decoration:none">
        <dl class="kpis">
          <div class="kpi"><dt>${icone("boi", 16)} Rebanho</dt><dd>${fmt.int(ag.total)}<small>cabeças</small></dd></div>
          <div class="kpi"><dt>Valor estimado</dt><dd>${fmt.brl(ag.valorRebanho, 0)}</dd></div>
          <div class="kpi"><dt>Resultado da atividade</dt><dd class="${ag.financeiro.resultado >= 0 ? "pos" : "neg"}">${fmt.brl(ag.financeiro.resultado, 0)}
            ${ok(ag.financeiro.retorno_pct) ? html`<small>${fmt.delta(ag.financeiro.retorno_pct)}% sobre o capital aportado</small>` : ""}</dd></div>
        </dl></a></section>`;
  }

  // ---- crescimento: uma foto por dia, gravada pelo app e pelo agendamento
  // período do gráfico de crescimento e o que ele mostra
  // padrão: todo o histórico, em patrimônio; volta a ele sempre que você
  // chega ao Início vindo de outra tela
  const CRESC_PADRAO = { periodo: "tudo", vista: "patrimonio", de: null, ate: null };
  const cresc = { ...CRESC_PADRAO };
  let rotaAnterior = location.hash;
  window.addEventListener("hashchange", () => {
    const eInicio = (h) => !h || h === "#" || h.startsWith("#/inicio");
    if (eInicio(location.hash) && !eInicio(rotaAnterior)) Object.assign(cresc, CRESC_PADRAO);
    rotaAnterior = location.hash;
  });
  // Espaçamento do gráfico conforme o tamanho do período: com anos de
  // histórico, um ponto por mês; em meses, um por semana; no curto
  // prazo, um por dia. Fica sempre o primeiro e o último ponto (hoje).
  function granularidade(de, ate) {
    const dias = FC.datas.dias(de, ate);
    return dias > 400 ? "mes" : dias > 75 ? "semana" : "dia";
  }
  function espaca(pontos, grao) {
    if (grao === "dia" || pontos.length < 3) return pontos;
    const chave = grao === "mes" ? (d) => d.slice(0, 7) : (d) => Math.floor(FC.datas.dias(pontos[0][0], d) / 7);
    const saida = [pontos[0]];
    for (let i = 1; i < pontos.length; i++) {
      const fimDoGrupo = i === pontos.length - 1 || chave(pontos[i + 1][0]) !== chave(pontos[i][0]);
      if (fimDoGrupo) saida.push(pontos[i]);           // o último valor de cada mês/semana
    }
    return saida;
  }

  // série reconstruída (cara de calcular): uma vez por montagem da carteira
  const cacheSerie = new WeakMap();
  function serieDoPainel(d) {
    const e = FC.estado;
    // refaz quando os proventos chegam depois da montagem
    const c = cacheSerie.get(d);
    if (c && c.proventos === e.proventos) return c.r;
    // proventos pagos entram como dinheiro que voltou (rendimento e TWR os contam)
    let pagamentos = [];
    try { if (e.proventos) pagamentos = FC.dividendos.analisa(d, e.base, e.proventos).pagamentos; } catch (err) { console.error(err); }
    let r = { pontos: [], inicio: null };
    try { r = FC.rentab.serieDiaria(e.base, e.mercado, e.mercado.indices, e.prefs, d.resumo.patrimonio > 0 ? d.resumo.patrimonio : null, pagamentos); }
    catch (err) { console.error(err); }
    cacheSerie.set(d, { proventos: e.proventos, r });
    return r;
  }

  // ---- comparação: o mesmo dinheiro, com os mesmos aportes nas mesmas datas,
  // aplicado só na Selic ou só no Ibovespa. Comparar com o índice puro
  // enganaria: o aporte pareceria ganho.
  const comparar = () => FC.local.ler("cresc-comparar", { selic: false, ibov: false });
  let benchPedido = false;
  function garanteIbov(anos) {
    const e = FC.estado;
    if (e.bench || benchPedido) return;
    benchPedido = true;
    FC.mercado.benchmarks(Math.min(10, Math.max(2, anos)))
      .then((b) => { e.bench = b; if (location.hash.startsWith("#/inicio") || !location.hash) FC.rerender({ suave: true, semAnimacao: true }); })
      .catch((err) => { console.error(err); e.bench = { ibov: [], erro: true }; })
      .finally(() => { benchPedido = false; });
  }
  // valor dia a dia de uma carteira que só tivesse o índice
  function simula(trecho, retorno) {
    let v = trecho[0].valor;
    const out = [[trecho[0].data, v]];
    for (let i = 1; i < trecho.length; i++) {
      const r = retorno(trecho[i - 1].data, trecho[i].data);
      v = v * (r == null ? 1 : r) + (trecho[i].fluxo - trecho[i - 1].fluxo);
      out.push([trecho[i].data, v]);
    }
    return out;
  }

  function crescimento(d) {
    // 1) o patrimônio reconstruído dia a dia pelo painel: posições × preço
    //    de cada dia + renda fixa rendendo aporte a aporte + rebanho;
    // 2) antes disso, os meses anotados à parte (Notion), que guardam só o
    //    total — ficam numa linha tracejada, sem se emendar à do painel.
    const hoje = FC.datas.hoje();
    const ser = serieDoPainel(d);
    const painel = ser.pontos;
    const anotados = (d.registros || []).filter((r) => r.origem === "importado").map((r) => ({ data: r.data, valor: r.patrimonio }));
    if (!painel.length && !anotados.length) return "";
    const primeiroDia = [anotados[0] && anotados[0].data, ser.inicio].filter(Boolean).sort()[0];

    const periodos = { ano: [FC.datas.soma(hoje, -365), hoje], mes: [FC.datas.soma(hoje, -30), hoje], tudo: [primeiroDia, hoje],
      custom: [cresc.de || FC.datas.soma(hoje, -90), cresc.ate || hoje] };
    const [de, ate] = periodos[cresc.periodo] || periodos.tudo;
    const grao = granularidade(de < primeiroDia ? primeiroDia : de, ate);
    const trecho = painel.filter((p) => p.data >= de && p.data <= ate);
    // a série anotada entra com o mês anterior ao período, para a linha não começar no meio
    const dentroAnot = anotados.filter((r) => r.data >= de && r.data <= ate);
    const antesAnot = dentroAnot.length ? [...anotados].reverse().find((r) => r.data < de) : null;
    const trechoAnot = (antesAnot ? [antesAnot] : []).concat(dentroAnot);

    // rendimento = variação do patrimônio menos o dinheiro que entrou no período
    let rend = null, serieRend = [], cdiPer = null;
    const p0 = trecho[0], p1 = trecho.at(-1);
    if (trecho.length >= 2) {
      const fluxo = p1.fluxo - p0.fluxo;
      const abs = p1.valor - p0.valor - fluxo;
      const capital = p0.valor + Math.max(0, fluxo);
      rend = { abs, pct: capital > 0 ? (abs / capital) * 100 : null };
      serieRend = trecho.map((p) => [p.data, p.valor - p0.valor - (p.fluxo - p0.fluxo)]);
      const ix = FC.estado.mercado.indices;
      if (ix) cdiPer = (ix.fator("cdi", 100, p0.data, p1.data).f - 1) * 100;
    }
    // aportes: o fluxo sem os proventos pagos (que saem do fluxo como dinheiro que voltou)
    const provPer = trecho.length >= 2 ? (p1.proventos || 0) - (p0.proventos || 0) : 0;
    const fluxoPer = trecho.length >= 2 ? p1.fluxo - p0.fluxo + provPer : 0;

    // referências ligadas
    const cmp = comparar(), refs = [];
    if (trecho.length >= 2) {
      const ix = FC.estado.mercado.indices;
      if (cmp.selic && ix) {
        const estimada = !ix.ultimo || !ix.ultimo.selic;
        refs.push({ k: "selic", nome: estimada ? "Selic (pelo CDI)" : "Selic", classe: "lselic",
          pontos: simula(trecho, (a, b) => ix.fator("selic", 100, a, b).f),
          indice: (ix.fator("selic", 100, p0.data, p1.data).f - 1) * 100 });
      }
      if (cmp.ibov) {
        const b = FC.estado.bench;
        if (!b) garanteIbov(Math.ceil(FC.datas.dias(p0.data, hoje) / 365) + 1);
        const serie = b && b.ibov && b.ibov.length ? b.ibov : null;
        if (serie) {
          const pt = (x) => FC.carteira.precoEm(serie, x) ?? serie[0][1];
          refs.push({ k: "ibov", nome: "Ibovespa", classe: "libov",
            pontos: simula(trecho, (a, c) => pt(c) / pt(a)), indice: (pt(p1.data) / pt(p0.data) - 1) * 100 });
        } else refs.push({ k: "ibov", nome: "Ibovespa", carregando: !(b && b.erro), erro: !!(b && b.erro) });
      }
    }
    const refsProntas = refs.filter((r) => r.pontos);

    const seletor = html`<div class="flex quebra mb3" style="gap:10px">
      <div class="segmentado" role="group" id="seg-periodo" aria-label="Período">
        ${[["tudo", "Tudo"], ["ano", "Ano"], ["mes", "Mês"], ["custom", "Personalizado"]].map(([k, v]) => html`<button type="button" data-p="${k}" aria-pressed="${cresc.periodo === k}">${v}</button>`)}</div>
      ${cresc.periodo === "custom" ? html`<div class="flex" style="gap:8px">
        <input class="entrada" type="date" id="per-de" value="${de}" min="${primeiroDia}" max="${hoje}" style="max-width:170px;min-height:36px;font-size:14px" aria-label="De">
        <span class="fraco">até</span>
        <input class="entrada" type="date" id="per-ate" value="${ate}" min="${primeiroDia}" max="${hoje}" style="max-width:170px;min-height:36px;font-size:14px" aria-label="Até"></div>` : ""}
      <div class="comparar" role="group" aria-label="Comparar com">
        <span class="fraco">Comparar com</span>
        <button type="button" class="comparar-bt selic" data-cmp="selic" aria-pressed="${!!cmp.selic}">Selic</button>
        <button type="button" class="comparar-bt ibov" data-cmp="ibov" aria-pressed="${!!cmp.ibov}">Ibovespa</button>
      </div>
      <div class="segmentado" role="group" id="seg-vista" aria-label="O que mostrar" style="margin-left:auto">
        <button type="button" data-v="patrimonio" aria-pressed="${cresc.vista === "patrimonio"}">Patrimônio</button>
        <button type="button" data-v="rendimento" aria-pressed="${cresc.vista === "rendimento"}">Rendimento</button></div>
    </div>`;

    const series = [];
    if (trechoAnot.length >= 2) series.push({ nome: "Anotado à parte", pontos: espaca(trechoAnot.map((r) => [r.data, r.valor]), "dia"), classe: "lref" });
    for (const r of refsProntas) series.push({ nome: r.nome, pontos: espaca(r.pontos, grao), classe: r.classe });
    if (trecho.length >= 2) series.push({ nome: "Patrimônio", pontos: espaca(trecho.map((p) => [p.data, p.valor]), grao), classe: "l1", area: true });
    // buraco de verdade: o último mês anotado bem antes do primeiro dia do painel
    const lacuna = trechoAnot.length >= 2 && trecho.length >= 2 && FC.datas.dias(trechoAnot.at(-1).data, trecho[0].data) > 45;

    const grafico = cresc.vista === "rendimento"
      ? (serieRend.length >= 2
        ? html`${FC.graficos.linhas({ series: [
            ...refsProntas.map((r) => ({ nome: r.nome, pontos: espaca(r.pontos.map(([dt, v], i) => [dt, v - p0.valor - (trecho[i].fluxo - p0.fluxo)]), grao), classe: r.classe })),
            { nome: "Rendimento", pontos: espaca(serieRend, grao), classe: "l2", area: false }], altura: 240, zero: true })}
          ${refsProntas.length ? html`<div class="legenda-g"><span><i class="k2"></i>sua carteira</span>${refsProntas.map((r) => html`<span><i class="k${r.k}"></i>${r.nome}, com os mesmos aportes</span>`)}</div>` : ""}
          <p class="texto-p mt2">Quanto o patrimônio rendeu no período, já sem o dinheiro que você aportou ou retirou.</p>`
        : html`<div class="mensagem info">${icone("info", 18)}<span>O painel ainda não tem dias suficientes neste período para medir o rendimento. Escolha um período maior.</span></div>`)
      : (series.length
        ? html`${FC.graficos.linhas({ series, altura: 240 })}
          <div class="legenda-g">${trecho.length >= 2 ? html`<span><i class="k1"></i>calculado pelo painel, dia a dia, com o que está cadastrado nele</span>` : ""}${trechoAnot.length >= 2 ? html`<span><i class="kref"></i>total anotado à parte (Notion), mês a mês</span>` : ""}${refsProntas.map((r) => html`<span><i class="k${r.k}"></i>${r.nome}, com os mesmos aportes</span>`)}</div>
          ${trechoAnot.length >= 2 && trecho.length >= 2 && !lacuna ? html`<p class="texto-p mt2">As duas linhas medem coisas diferentes: a tracejada é o total que você anotava; a cheia só conhece o que já foi cadastrado no painel em cada data.</p>` : ""}
          ${lacuna ? html`<p class="texto-p mt2">Entre ${FC.datas.mesAno(trechoAnot.at(-1).data)} e ${FC.datas.mesAno(trecho[0].data)} não há registro — o gráfico deixa o intervalo em branco em vez de inventar a linha.</p>` : ""}`
        : html`<div class="mensagem info">${icone("info", 18)}<span>Só há um registro neste período.</span></div>`);

    return html`<section class="secao" id="crescimento">
      <div class="secao-topo"><h2>Crescimento do patrimônio</h2><span class="sub">${cresc.periodo === "tudo" ? "desde " + FC.datas.mesAno(primeiroDia) : cresc.periodo === "ano" ? "últimos 12 meses" : FC.datas.br(de) + " a " + FC.datas.br(ate)} · um ponto por ${grao === "mes" ? "mês" : grao}</span></div>
      <div class="cartao">
        ${seletor}
        <dl class="kpis mb3">
          <div class="kpi"><dt>Rendimento no período</dt><dd class="${rend ? (rend.abs >= 0 ? "pos" : "neg") : "fraco"}">${rend ? html`${rend.abs >= 0 ? "+" : "−"}${fmt.brl(Math.abs(rend.abs))}` : "—"}
            <small>${rend && FC.ok(rend.pct) ? fmt.delta(rend.pct, 2) + "% sem contar aportes" + (provPer > 0.005 ? `, com ${fmt.brlTexto(provPer)} de proventos` : "") : "sem dias suficientes"}</small></dd></div>
          <div class="kpi pequeno"><dt>Aportes no período</dt><dd>${Math.abs(fluxoPer) > 0.005 ? html`${fluxoPer >= 0 ? "+" : "−"}${fmt.brl(Math.abs(fluxoPer))}` : fmt.brl(0)}<small>${fluxoPer < 0 ? "saiu mais do que entrou" : "dinheiro novo que entrou"}</small></dd></div>
          ${FC.ok(cdiPer) ? html`<div class="kpi pequeno"><dt>CDI no período</dt><dd>${fmt.num(cdiPer, 2)}%<small>para comparar com o rendimento</small></dd></div>` : ""}
          <div class="kpi pequeno"><dt>Patrimônio ${p1 && p1.data === hoje ? "agora" : "no fim"}</dt><dd>${fmt.brl(p1 ? p1.valor : (trechoAnot.at(-1) || {}).valor || 0)}<small>${trecho.length >= 2 ? (() => { const v = p1.valor - p0.valor; return html`<span class="rs">${v >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(v))}</span> no período, com aportes`; })() : ""}</small></dd></div>
        </dl>
        ${refs.some((r) => r.carregando) ? html`<p class="texto-p mb2">Buscando o histórico do Ibovespa…</p>` : ""}
        ${refs.some((r) => r.erro) ? html`<p class="texto-p mb2">O histórico do Ibovespa não veio agora. Tente atualizar daqui a pouco.</p>` : ""}
        ${refsProntas.length ? html`<dl class="kpis mb3 comparar-kpis">${refsProntas.map((r) => {
          const fim = r.pontos.at(-1)[1], dif = p1.valor - fim;
          return html`<div class="kpi pequeno"><dt><i class="ponto-cmp k${r.k}"></i>Se fosse ${r.nome}</dt>
            <dd>${fmt.brl(fim)}<small>${r.nome.split(" ")[0]} no período: ${fmt.delta(r.indice, 2)}% · você está <b class="${dif >= 0 ? "pos" : "neg"}">${dif >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(dif))}</b> ${dif >= 0 ? "acima" : "abaixo"}</small></dd></div>`;
        })}</dl>` : ""}
        ${grafico}
      </div></section>`;
  }

  // ---- topo: quanto tenho, quanto coloquei, quanto ganhei
  // o IR vem de FC.impostos quando o módulo existe; sem ele, valores brutos
  function resumoIR(d) {
    if (typeof FC.impostos === "undefined" || !FC.impostos.resumo) return null;
    try { return FC.impostos.resumo(d, FC.estado.base); } catch (err) { console.error(err); return null; }
  }

  // a TIR contra o CDI e a inflação do mesmo período; com menos de 90 dias,
  // tudo no período, sem anualizar
  function comparativo(t) {
    if (!t || !t.desde) return null;
    const hoje = FC.datas.hoje(), dias = FC.datas.dias(t.desde, hoje);
    const anual = ok(t.xirr) && dias >= 90;
    const meu = anual ? t.xirr : t.periodo_pct;
    if (!ok(meu) || dias < 1) return null;
    const ix = FC.estado.mercado && FC.estado.mercado.indices;
    let cdi = null, ipca = null;
    if (ix && !ix.vazio) {
      const taxa = (f) => (anual ? (Math.pow(f, 365 / dias) - 1) * 100 : (f - 1) * 100);
      try {
        const fc = ix.fator("cdi", 100, t.desde, hoje).f, fi = ix.fator("ipca", 0, t.desde, hoje).f;
        // fator 1 num período longo = série sem dados, não juro zero
        if (fc !== 1 || dias < 5) cdi = taxa(fc);
        if (fi !== 1 || dias < 5) ipca = taxa(fi);
      } catch (err) { console.error(err); }
    }
    return { meu, anual, dias, cdi, ipca, desde: t.desde };
  }

  function frase(c) {
    if (!c) return "";
    const n = (v) => fmt.num(v, 1) + "%";
    const quando = c.anual ? "ao ano" : `nos ${fmt.int(c.dias)} dias desde ${FC.datas.br(c.desde)}`;
    if (!ok(c.cdi) || !ok(c.ipca)) return html`<div class="mensagem info mt3">${icone("info", 18)}<span>Seu dinheiro rendeu <b>${n(c.meu)}</b> ${quando}.</span></div>`;
    const cls = c.meu >= c.cdi ? "ok" : c.meu >= c.ipca ? "alerta" : "erro";
    const leitura = cls === "ok" ? "Você está ganhando do CDI." : cls === "alerta" ? "Ganhou da inflação, mas ficou abaixo do CDI." : "Ficou abaixo da inflação: o dinheiro perdeu poder de compra.";
    return html`<div class="mensagem ${cls} mt3">${icone(cls === "ok" ? "check" : cls === "alerta" ? "info" : "alerta", 18)}<span>
      Seu dinheiro rendeu <b>${n(c.meu)}</b> ${quando}. O CDI rendeu <b>${n(c.cdi)}</b> e a inflação <b>${n(c.ipca)}</b> no mesmo período.
      ${c.anual ? "" : "Com menos de 90 dias de história, os números são do período, sem anualizar."} ${leitura}</span></div>`;
  }

  function topo(d, imp, seq) {
    const r = d.resumo, t = d.rentab && d.rentab.total;
    const bruto = imp && ok(imp.bruto) ? imp.bruto : r.patrimonio;
    const tenho = imp && ok(imp.liquido) ? imp.liquido : bruto;
    const temIR = !!imp && ok(imp.ir_estimado) && imp.ir_estimado > 0.005;
    const colocou = t ? t.aplicado - (t.devolvido || 0) : null;
    const ganho = t ? (imp && ok(imp.ganho_liquido) ? imp.ganho_liquido : t.ganho) : null;
    const ganhoPct = ok(ganho) && colocou > 0.005 ? (ganho / colocou) * 100 : null;
    const dica = imp
      ? "Estimativa do que ficaria com você se resgatasse tudo hoje: o patrimônio a preço de agora menos o imposto de renda sobre o ganho (e o IOF, nos primeiros 30 dias). Isenções, como LCI, LCA e ações até o limite mensal, já entram na conta."
      : "Soma de tudo a preço de agora: bolsa, cripto, renda fixa com rendimento e rebanho. Ainda sem descontar o imposto de renda.";
    return html`<div class="cartao heroi">
      <p class="rotulo">Quanto eu tenho ${FC.ajuda(dica)}</p>
      <p class="valor"><span class="rs" data-conta="${tenho}">${fmt.brlTexto(tenho)}</span></p>
      ${temIR ? html`<p class="fraco" style="font-size:13px;margin:-8px 0 14px">líquido estimado · bruto <span class="rs">${fmt.brlTexto(bruto)}</span>, IR estimado <span class="rs">${fmt.brlTexto(imp.ir_estimado)}</span></p>` : ""}
      ${t ? html`<dl class="kpis mb3">
        <div class="kpi"><dt>Quanto eu coloquei</dt><dd>${fmt.brl(colocou)}<small>${t.devolvido > 0.005 ? `o que saiu do bolso, já descontados ${fmt.brlTexto(t.devolvido, 0)} que voltaram` : "o que saiu do seu bolso"}</small></dd></div>
        <div class="kpi"><dt>Quanto ganhei</dt><dd class="${ganho >= 0 ? "pos" : "neg"}">${ganho >= 0 ? "+" : "−"}${fmt.brl(Math.abs(ganho))}
          <small>${ok(ganhoPct) ? html`<b class="${ganhoPct >= 0 ? "pos" : "neg"}">${fmt.delta(ganhoPct, 1)}%</b> sobre o que você colocou` : ""}${imp && ok(imp.ganho_liquido) ? ", já sem IR" : ""}</small></dd></div>
      </dl>` : ""}
      <div class="chips">
        ${r.bolsa || !r.cripto ? html`<span class="chip"><span class="ponto" style="background:var(--s1)"></span>Bolsa <b class="rs">${fmt.brlTexto(r.bolsa)}</b></span>` : ""}
        ${r.renda_fixa ? html`<span class="chip"><span class="ponto" style="background:var(--s2)"></span>Renda fixa <b class="rs">${fmt.brlTexto(r.renda_fixa)}</b></span>` : ""}
        ${r.agro ? html`<span class="chip"><span class="ponto" style="background:var(--s5)"></span>Agro <b class="rs">${fmt.brlTexto(r.agro)}</b></span>` : ""}
        ${r.cripto ? html`<span class="chip"><span class="ponto" style="background:var(--s3)"></span>Cripto <b class="rs">${fmt.brlTexto(r.cripto)}</b></span>` : ""}
        ${r.variacao_hoje ? html`<span class="chip">Hoje <b class="${r.variacao_hoje >= 0 ? "pos" : "neg"} rs">${r.variacao_hoje >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(r.variacao_hoje))}</b></span>` : ""}
        ${seq ? C.chipSequencia(seq) : ""}
      </div>
    </div>`;
  }

  // "ver detalhes": as medidas técnicas, por classe, e os juros do dia
  const CLASSES_RT = [["bolsa", "Ações, FIIs e ETFs", "var(--s1)"], ["cripto", "Cripto", "var(--s3)"],
    ["renda_fixa", "Renda fixa", "var(--s2)"], ["agro", "Agronegócio", "var(--s5)"]];
  function detalhesTecnicos(d, imp) {
    const rt = d.rentab, t = rt && rt.total;
    const p = (v) => (ok(v) ? `${fmt.delta(v, 2)}%` : "—");
    const cor = (v) => (ok(v) ? (v >= 0 ? "pos" : "neg") : "fraco");
    let twr = null;
    try { const s = serieDoPainel(d).pontos; if (s.length >= 2) twr = FC.rentab.twr(s); } catch (err) { console.error(err); }
    const classes = t ? CLASSES_RT.filter(([k]) => rt.classes[k] && (k !== "agro" || FC.modulo("agro"))) : [];
    return C.detalhes(html`
      ${t ? html`<dl class="kpis">
        <div class="kpi pequeno"><dt>TIR ${FC.ajuda("Taxa interna de retorno com a data de cada aporte, resgate e provento (XIRR): a taxa anual que o dinheiro rendeu. Aparece a partir de 90 dias.")}</dt>
          <dd class="${cor(t.xirr)}">${p(t.xirr)}<small>${ok(t.xirr) ? "ao ano" : "precisa de 90 dias"}</small></dd></div>
        <div class="kpi pequeno"><dt>No período ${FC.ajuda("Ganho dividido pelo capital médio que ficou aplicado, ponderado pelo tempo de cada aporte (Modified Dietz).")}</dt>
          <dd class="${cor(t.periodo_pct)}">${p(t.periodo_pct)}<small>desde ${FC.datas.br(t.desde)}</small></dd></div>
        <div class="kpi pequeno"><dt>TWR ${FC.ajuda("Retorno ponderado pelo tempo: encadeia o rendimento de cada dia e ignora o tamanho dos aportes. É a medida usada por fundos para comparar com o CDI ou o Ibovespa.")}</dt>
          <dd class="${cor(twr)}">${p(twr)}<small>pela série diária do painel</small></dd></div>
      </dl>` : ""}
      ${classes.length ? html`<div class="lista mt2" style="box-shadow:none">${classes.map(([k, nome, c]) => {
        const x = rt.classes[k], ir = imp && imp.por_classe && imp.por_classe[k];
        return html`<div class="item"><span class="ponto-e" style="background:${c};width:12px;height:12px"></span>
          <div class="principal"><div class="titulo">${nome}</div>
            <div class="detalhe">colocou ${fmt.brlTexto(x.aplicado - (x.devolvido || 0))} · vale ${fmt.brlTexto(x.valor_atual)}${ir && ir.ir > 0.005 ? ` · IR estimado ${fmt.brlTexto(ir.ir)}` : ""}</div></div>
          <div class="valores"><b class="${x.ganho >= 0 ? "pos" : "neg"}">${x.ganho >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(x.ganho))}</b>
            <small>${ok(x.xirr) ? `${p(x.xirr)} ao ano` : `${p(x.periodo_pct)} no período`}</small></div></div>`;
      })}</div>` : ""}
      ${imp && imp.notas && imp.notas.length ? html`<ul class="texto-p mt2" style="padding-left:18px">${imp.notas.map((n) => html`<li>${n}</li>`)}</ul>` : ""}
      <div class="mt3">${macro(d.macro)}</div>
      <p class="texto-p mt2">A frase de cima usa a TIR (o rendimento ao ano, com a data de cada aporte) e compara com o CDI e o IPCA acumulados desde o primeiro aporte. Os valores ainda não descontam o IR, que aparece no total líquido.</p>
      <p class="texto-p mt1"><a href="#/irpf">Relatório para a declaração do IR ${icone("chevron", 12)}</a></p>`);
  }

  // ---- alertas: os altos primeiro; três à vista, o resto recolhido
  const NIVEL = { alto: ["alerta", "var(--vermelho)"], medio: ["alerta", "var(--amarelo)"], info: ["info", "var(--acento)"] };
  function itemAlerta(a) {
    const [ic, cor] = NIVEL[a.nivel] || NIVEL.info;
    const miolo = html`<span style="color:${cor};flex:none">${icone(ic, 20)}</span>
      <div class="principal"><div class="titulo" style="white-space:normal">${a.titulo}</div><div class="detalhe" style="white-space:normal">${a.texto}</div></div>`;
    return a.link ? html`<a class="item clicavel" href="${a.link}" style="color:inherit;text-decoration:none">${miolo}<span class="chevron">${icone("chevron", 18)}</span></a>`
      : html`<div class="item">${miolo}</div>`;
  }
  function alertas(lista) {
    if (!lista.length) return "";
    const vis = lista.slice(0, 3), resto = lista.slice(3);
    return html`<section class="secao">
      <div class="secao-topo"><h2>Atenção</h2><span class="sub">o que merece um olhar na sua carteira</span></div>
      <div class="lista">${vis.map(itemAlerta)}</div>
      ${resto.length ? C.detalhes(html`<div class="lista">${resto.map(itemAlerta)}</div>`, `Ver mais ${resto.length} ${resto.length === 1 ? "aviso" : "avisos"}`) : ""}
    </section>`;
  }

  // ---- próximos 30 dias: vencimentos de renda fixa e proventos a receber
  function proximos30(d, div) {
    const hoje = FC.datas.hoje(), lim = FC.datas.soma(hoje, 30);
    const itens = [];
    for (const t of d.rendaFixa || []) {
      if (!t.vencimento || t.vencimento < hoje || t.vencimento > lim || !(t.valor_aplicado > 0.005)) continue;
      let valor = t.valor_aplicado, liq = false;
      if (typeof FC.impostos !== "undefined" && FC.impostos.titulo) {
        try { const x = FC.impostos.titulo(t, FC.infoTitulo(FC.estado.prefs, t.id)); if (x && ok(x.liquido)) { valor = x.liquido; liq = true; } } catch (err) { console.error(err); }
      }
      itens.push({ data: t.vencimento, titulo: t.nome, detalhe: liq ? "vence · valor líquido estimado" : "vence · valor estimado", valor, ic: "calendario" });
    }
    for (const p of (div && div.proximos) || []) {
      if (!p.pagamento || p.pagamento < hoje || p.pagamento > lim) continue;
      itens.push({ data: p.pagamento, titulo: p.ticker, detalhe: `${p.tipo ? String(p.tipo).toLowerCase() : "provento"} a receber`, valor: p.valor, ic: "moeda" });
    }
    if (!itens.length) return "";
    itens.sort((a, b) => a.data.localeCompare(b.data));
    const quando = (iso) => { const n = FC.datas.dias(hoje, iso); return n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`; };
    return html`<section class="secao">
      <div class="secao-topo"><h2>Próximos 30 dias</h2><span class="sub">dinheiro que deve cair na conta</span></div>
      <div class="lista">${itens.map((x) => html`<div class="item">
        <span style="color:${x.ic === "moeda" ? "var(--verde)" : "var(--acento)"}">${icone(x.ic, 20)}</span>
        <div class="principal"><div class="titulo">${x.titulo}</div><div class="detalhe">${x.detalhe} · ${FC.datas.br(x.data)}</div></div>
        <div class="valores"><b>${fmt.brl(x.valor)}</b><small>${quando(x.data)}</small></div></div>`)}</div>
    </section>`;
  }

  // ---- renda passiva: proventos por mês contra a renda que se quer
  function rendaPassiva(div) {
    if (!div) return "";
    const res = div.resumo;
    const media = res.recebido_12m > 0 ? res.recebido_12m / 12 : 0;
    const mensal = media > 0 ? media : res.mensal_estimado || 0;
    const alvo = FC.objetivos(FC.estado.prefs).renda_desejada_mensal;
    if (!(mensal > 0) && !alvo) return "";
    const pct = alvo ? Math.min(100, (mensal / alvo) * 100) : null;
    return html`<section class="secao">
      <div class="secao-topo"><h2>Renda passiva</h2><span class="sub">o que a carteira deposita sem você vender nada</span>
        <div class="direita"><a class="botao texto pequeno" href="#/dividendos">Dividendos ${icone("chevron", 14)}</a></div></div>
      <div class="cartao">
        <dl class="kpis">
          <div class="kpi"><dt>Você recebe por mês ${FC.ajuda("Média mensal dos proventos dos últimos 12 meses, já sem o IR do JCP. Sem pagamentos no período, a estimativa pelos proventos de cada ativo.")}</dt>
            <dd class="pos">${fmt.brl(mensal)}<small>${media > 0 ? "média dos últimos 12 meses, líquida" : "estimado pelos proventos de 12 meses"}</small></dd></div>
          ${alvo ? html`<div class="kpi"><dt>Sua meta</dt><dd>${fmt.brl(alvo)}<small>por mês, para viver de renda</small></dd></div>` : ""}
        </dl>
        ${alvo ? html`<div class="trilha mt3" style="height:10px;border-radius:5px" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%;background:var(--verde)"></i></div>
          <p class="texto-p mt1"><b>${fmt.num(pct, pct < 10 ? 1 : 0)}%</b> do caminho para viver de renda${pct < 100 ? html` · faltam <span class="rs">${fmt.brlTexto(alvo - mensal)}</span> por mês` : " — meta alcançada!"}</p>`
        : html`<p class="texto-p mt2">Quanto você quer receber por mês para viver de renda? <a href="#/ajustes">Defina em Ajustes → Objetivos</a> e acompanhe aqui o caminho.</p>`}
      </div></section>`;
  }

  function melhores(d) {
    const top = d.ativos.filter((a) => ok(a.score)).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!top.length) return "";
    return html`<section class="secao">
      <div class="secao-topo"><h2>Mais aderentes aos seus critérios</h2><span class="sub">carteira e watchlist, pelo score</span>
        <div class="direita"><a class="botao texto pequeno" href="#/ativos">Ver todos ${icone("chevron", 14)}</a></div></div>
      <div class="lista">${top.map((a) => html`<div class="item clicavel" data-abre="${a.ticker}" role="button" tabindex="0">
        ${FC.anel(a.score, a.cor)}
        <div class="principal"><div class="titulo">${a.ticker} ${a.na_carteira ? "" : FC.pilula("cinza", "watchlist")}</div>
          <div class="detalhe">${a.tipo_rotulo}${a.segmento ? " · " + a.segmento : ""}</div></div>
        <div class="esconde-mob">${C.indicadores(a)}</div>
        <div class="valores"><b>${fmt.preco(a.preco)}</b><small>${a.veredito_curto}</small></div>
        <span class="chevron">${icone("chevron", 18)}</span></div>`)}</div></section>`;
  }

  // os cartões das retrospectivas só aparecem no fim do período:
  // últimos 5 dias do mês e de 27 a 31 de dezembro (em Ajustes, sempre)
  function retrospectivas() {
    const itens = [];
    if (FC.recap.naJanela("ano")) itens.push(["ano", `Seu ${FC.recap.periodoDe("ano").rotulo} em retrospectiva`, "o ano inteiro contado em etapas"]);
    if (FC.recap.naJanela("mes")) itens.push(["mes", `Retrospectiva de ${FC.recap.periodoDe("mes").rotulo.split(" ")[0].toLowerCase()}`, "seu mês contado em etapas"]);
    return html`${itens.map(([tipo, t, s]) => html`<a class="cartao clicavel recap-entrada mt3 ${tipo === "ano" ? "ano" : ""}" href="#/retrospectiva/${tipo}">
      <span class="recap-entrada-ic">${icone("play", 22)}</span>
      <span><b>${t}</b><small>${s}, com os seus números</small></span>
      <span class="chevron">${icone("chevron", 18)}</span></a>`)}`;
  }

  function comecar() {
    return html`<section class="secao">
      <div class="secao-topo"><h2>Comece por aqui</h2><span class="sub">cadastre o que você tem; o resto o painel calcula</span></div>
      <div class="grade ${FC.modulo("agro") ? "g3" : "g2"}">
        <div class="cartao clicavel" data-comeca="ativo"><div style="color:var(--acento)">${icone("ativos", 28)}</div>
          <h3 class="mt2">Ações, FIIs e ETFs${FC.modulo("cripto") ? " e cripto" : ""}</h3><p class="sub">Adicione o que você tem ou acompanha. O painel busca cotações e avalia cada um.</p></div>
        <div class="cartao clicavel" data-comeca="rf"><div style="color:var(--verde)">${icone("moeda", 28)}</div>
          <h3 class="mt2">Renda fixa</h3><p class="sub">CDBs, Tesouro e caixa, comparados com o CDI do dia.</p></div>
        ${FC.modulo("agro") ? html`<a class="cartao clicavel" href="#/agro" style="color:inherit;text-decoration:none"><div style="color:var(--terra)">${icone("boi", 28)}</div>
          <h3 class="mt2">Rebanho</h3><p class="sub">Compras, vendas, custos e pesagens do gado.</p></a>` : ""}
      </div></section>`;
  }

  FC.telas.inicio = async function (raiz) {
    const d = FC.estado.dados;
    const vazio = !d.ativos.length && !d.rendaFixa.length && !d.agro.tem_dados;
    const nome = ((FC.auth.usuario.user_metadata || {}).nome || "").trim();
    const seq = C.sequencia();
    const t = d.rentab && d.rentab.total;
    const imp = resumoIR(d);
    // proventos: uma análise só, usada por próximos 30 dias, renda passiva e gráfico
    let div = null;
    try { if (FC.estado.proventos) div = FC.dividendos.analisa(d, FC.estado.base, FC.estado.proventos); } catch (err) { console.error(err); }
    let avisos = [];
    try { if (FC.alertas) avisos = FC.alertas.calcula(d, FC.estado.base, FC.estado.prefs); } catch (err) { console.error(err); }

    raiz.innerHTML = String(html`
      ${C.estadoMercado()}
      <p class="fraco" style="font-size:15px;margin-bottom:8px">${saudacao()}${nome ? ", " + nome : ""}.</p>
      ${topo(d, imp, seq)}
      ${t ? frase(comparativo(t)) : ""}
      ${t ? detalhesTecnicos(d, imp) : html`<div class="mt3">${macro(d.macro)}</div>`}
      ${retrospectivas()}
      ${vazio ? comecar() : ""}
      ${alertas(avisos)}
      ${proximos30(d, div)}
      ${rendaPassiva(div)}
      ${alocacao(d)}
      ${crescimento(d)}
      ${proventos(d.historico.renda_mensal, div)}
      ${agroResumo(d.agro)}
      ${melhores(d)}
      ${d.atualizado ? html`<p class="texto-p mt4 centro" style="margin-inline:auto">Preços atualizados ${FC.datas.ha(FC.estado.spotEm) || "—"} (a cada minuto com o app aberto) · cripto pelo CoinGecko, bolsa pelo Yahoo Finance, fundamentos pelo Fundamentus e juros pelo Banco Central.</p>` : ""}
    `);

    FC.$$("[data-pilar]", raiz).forEach((el) => {
      const alterna = () => {
        const comp = FC.$(`[data-de="${el.dataset.pilar}"]`, raiz);
        const abrir = comp.hidden;
        comp.hidden = !abrir;
        el.setAttribute("aria-expanded", String(abrir));
        if (abrir) comp.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.32,.72,0,1)" });
      };
      el.addEventListener("click", alterna);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alterna(); } });
    });
    FC.$$("[data-ticker]", raiz).forEach((el) => { if (el.dataset.ticker) el.addEventListener("click", () => C.abreAtivo(el.dataset.ticker)); });
    FC.$$("[data-abre]", raiz).forEach((el) => {
      el.addEventListener("click", () => C.abreAtivo(el.dataset.abre));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") C.abreAtivo(el.dataset.abre); });
    });
    const repinta = () => setTimeout(() => FC.rerender({ suave: true }), 200);
    FC.$$("#seg-periodo button", raiz).forEach((b) => b.addEventListener("click", () => { cresc.periodo = b.dataset.p; repinta(); }));
    FC.$$("#seg-vista button", raiz).forEach((b) => b.addEventListener("click", () => { cresc.vista = b.dataset.v; repinta(); }));
    FC.$$("[data-cmp]", raiz).forEach((b) => b.addEventListener("click", () => {
      const c = comparar(); c[b.dataset.cmp] = !c[b.dataset.cmp];
      FC.local.gravar("cresc-comparar", c); repinta();
    }));
    ["#per-de", "#per-ate"].forEach((sel) => {
      const el = FC.$(sel, raiz);
      if (el) el.addEventListener("change", () => {
        cresc.de = FC.$("#per-de", raiz).value || null; cresc.ate = FC.$("#per-ate", raiz).value || null;
        if (cresc.de && cresc.ate && cresc.de > cresc.ate) [cresc.de, cresc.ate] = [cresc.ate, cresc.de];
        FC.rerender({ suave: true, semAnimacao: true });
      });
    });
    C.comemoraSequencia(raiz, seq);
    FC.$$("[data-comeca]", raiz).forEach((el) => el.addEventListener("click", () => (el.dataset.comeca === "ativo" ? C.formAtivo() : C.formRendaFixa())));
  };
})();
