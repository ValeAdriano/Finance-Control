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

  function proventos(r) {
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
            ${ok(ag.financeiro.retorno_pct) ? html`<small>${fmt.delta(ag.financeiro.retorno_pct)}% sobre o investido</small>` : ""}</dd></div>
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
    if (cacheSerie.has(d)) return cacheSerie.get(d);
    const e = FC.estado;
    let r = { pontos: [], inicio: null };
    try { r = FC.rentab.serieDiaria(e.base, e.mercado, e.mercado.indices, e.prefs, d.resumo.patrimonio > 0 ? d.resumo.patrimonio : null); }
    catch (err) { console.error(err); }
    cacheSerie.set(d, r);
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
    let rend = null, serieRend = [], twrPer = null, cdiPer = null;
    const p0 = trecho[0], p1 = trecho.at(-1);
    if (trecho.length >= 2) {
      const fluxo = p1.fluxo - p0.fluxo;
      const abs = p1.valor - p0.valor - fluxo;
      const capital = p0.valor + Math.max(0, fluxo);
      rend = { abs, pct: capital > 0 ? (abs / capital) * 100 : null };
      serieRend = trecho.map((p) => [p.data, p.valor - p0.valor - (p.fluxo - p0.fluxo)]);
      twrPer = FC.rentab.twr(trecho);
      const ix = FC.estado.mercado.indices;
      if (ix) cdiPer = (ix.fator("cdi", 100, p0.data, p1.data).f - 1) * 100;
    }
    const fluxoPer = trecho.length >= 2 ? p1.fluxo - p0.fluxo : 0;

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
            <small>${rend && FC.ok(rend.pct) ? fmt.delta(rend.pct, 2) + "% sem contar aportes" : "sem dias suficientes"}</small></dd></div>
          <div class="kpi pequeno"><dt>Aportes no período</dt><dd>${Math.abs(fluxoPer) > 0.005 ? html`${fluxoPer >= 0 ? "+" : "−"}${fmt.brl(Math.abs(fluxoPer))}` : fmt.brl(0)}<small>${fluxoPer < 0 ? "saiu mais do que entrou" : "dinheiro novo que entrou"}</small></dd></div>
          ${FC.ok(twrPer) ? html`<div class="kpi pequeno"><dt>TWR ${FC.ajuda("Retorno ponderado pelo tempo: encadeia o rendimento de cada dia e ignora o tamanho dos aportes. É a medida para comparar a carteira com o CDI ou o Ibovespa.")}</dt><dd class="${twrPer >= 0 ? "pos" : "neg"}">${fmt.delta(twrPer, 2)}%<small>${FC.ok(cdiPer) ? `CDI no período: ${fmt.num(cdiPer, 2)}%` : ""}</small></dd></div>` : ""}
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

  function dividendos(d) {
    if (!FC.estado.proventos) return "";
    const r = FC.dividendos.analisa(d, FC.estado.base, FC.estado.proventos);
    if (!r.porAtivo.length || !(r.resumo.mensal_estimado > 0 || r.proximos.length)) return "";
    const prox = r.proximos.find((p) => p.pagamento) || r.proximos[0];
    return html`<section class="secao">
      <div class="secao-topo"><h2>Dividendos</h2><span class="sub">o que suas ações e FIIs depositam</span>
        <div class="direita"><a class="botao texto pequeno" href="#/dividendos">Abrir ${icone("chevron", 14)}</a></div></div>
      <a class="cartao clicavel" href="#/dividendos" style="display:block;color:inherit;text-decoration:none">
        <dl class="kpis">
          <div class="kpi"><dt>Por mês (estimado)</dt><dd class="pos">${fmt.brl(r.resumo.mensal_estimado)}</dd></div>
          <div class="kpi"><dt>Próximos 30 dias</dt><dd>${fmt.brl(r.resumo.proximos_30d)}</dd></div>
          ${prox ? html`<div class="kpi"><dt>Próximo pagamento</dt><dd>${prox.ticker} <span class="rs">${fmt.brlTexto(prox.valor)}</span><small>${prox.pagamento ? "em " + FC.datas.br(prox.pagamento) : "data com " + FC.datas.br(prox.data_com)}</small></dd></div>` : ""}
        </dl></a></section>`;
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
    const r = d.resumo;
    const vazio = !d.ativos.length && !d.rendaFixa.length && !d.agro.tem_dados;
    const nome = ((FC.auth.usuario.user_metadata || {}).nome || "").trim();
    const seq = C.sequencia();

    raiz.innerHTML = String(html`
      ${C.estadoMercado()}
      <p class="fraco" style="font-size:15px;margin-bottom:8px">${saudacao()}${nome ? ", " + nome : ""}.</p>
      <div class="cartao heroi">
        <p class="rotulo">Patrimônio</p>
        <p class="valor"><span class="rs" data-conta="${r.patrimonio}">${fmt.brlTexto(r.patrimonio)}</span></p>
        <div class="chips">
          ${r.bolsa || !r.cripto ? html`<span class="chip"><span class="ponto" style="background:var(--s1)"></span>Bolsa <b class="rs">${fmt.brlTexto(r.bolsa)}</b></span>` : ""}
          ${r.renda_fixa ? html`<span class="chip"><span class="ponto" style="background:var(--s2)"></span>Renda fixa <b class="rs">${fmt.brlTexto(r.renda_fixa)}</b></span>` : ""}
          ${r.agro ? html`<span class="chip"><span class="ponto" style="background:var(--s5)"></span>Agro <b class="rs">${fmt.brlTexto(r.agro)}</b></span>` : ""}
          ${r.cripto ? html`<span class="chip"><span class="ponto" style="background:var(--s3)"></span>Cripto <b class="rs">${fmt.brlTexto(r.cripto)}</b></span>` : ""}
          ${d.rentab && d.rentab.total && FC.ok(d.rentab.total.periodo_pct) ? html`<span class="chip" title="ganho ÷ capital médio aplicado, cada aporte com a sua data">Rendimento <b class="${d.rentab.total.periodo_pct >= 0 ? "pos" : "neg"}">${fmt.delta(d.rentab.total.periodo_pct)}%</b>${FC.ok(d.rentab.total.xirr) ? html` · ${fmt.delta(d.rentab.total.xirr)}% a.a.` : ""}</span>` : ""}
          ${seq ? C.chipSequencia(seq) : ""}
          ${r.variacao_hoje ? html`<span class="chip">Hoje <b class="${r.variacao_hoje >= 0 ? "pos" : "neg"} rs">${r.variacao_hoje >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(r.variacao_hoje))}</b></span>` : ""}
        </div>
      </div>
      ${retrospectivas()}
      <div class="mt3">${macro(d.macro)}</div>
      ${vazio ? comecar() : ""}
      ${C.resumoInvestido(d, { compacto: true })}
      ${alocacao(d)}
      ${crescimento(d)}
      ${dividendos(d)}
      ${agroResumo(d.agro)}
      ${melhores(d)}
      ${proventos(d.historico.renda_mensal)}
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
