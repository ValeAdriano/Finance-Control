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

  function evolucao(h) {
    if (!h.pontos || h.pontos.length < 3) return "";
    const ganhoPct = h.custo_final ? (h.ganho / h.custo_final) * 100 : null;
    return html`<section class="secao">
      <div class="secao-topo"><h2>Evolução da carteira</h2><span class="sub">reconstruída dos seus aportes desde ${FC.datas.mesAno(h.primeiro)}</span></div>
      <div class="cartao">
        <dl class="kpis mb3">
          <div class="kpi"><dt>Valor hoje</dt><dd>${fmt.brl(h.valor_final)}</dd></div>
          <div class="kpi"><dt>Você colocou</dt><dd>${fmt.brl(h.custo_final)}</dd></div>
          <div class="kpi"><dt>Ganho</dt><dd class="${h.ganho >= 0 ? "pos" : "neg"}">${fmt.brl(h.ganho)}${ok(ganhoPct) ? html`<small>${fmt.delta(ganhoPct)}% sobre o que entrou</small>` : ""}</dd></div>
          ${h.total_proventos ? html`<div class="kpi"><dt>Proventos recebidos</dt><dd>${fmt.brl(h.total_proventos)}<small>${h.proventos.length} pagamentos</small></dd></div>` : ""}
        </dl>
        ${FC.graficos.linhas({ series: [
          { nome: "Valor da carteira", pontos: h.pontos.map((p) => [p.data, p.valor]), classe: "l1", area: true },
          { nome: "Você colocou", pontos: h.pontos.map((p) => [p.data, p.custo]), classe: "lref" },
        ], altura: 280 })}
        <div class="legenda-g"><span><i class="k1"></i>valor da carteira</span><span><i class="kref"></i>quanto você colocou</span></div>
        <p class="texto-p mt2">A distância entre as linhas é o ganho. Sozinha, a linha do valor confundiria crescimento por aporte com crescimento por rendimento.
          ${h.so_caixa ? " Por enquanto só há aportes de renda fixa, que entram pelo valor aplicado." : h.rendimento_rf > 1 ? html` A renda fixa entra pelo principal aportado, por isso a curva fica ${fmt.brl(h.rendimento_rf)} abaixo do patrimônio.` : ""}</p>
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
    if (!ag.tem_dados) return "";
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
  // Dinheiro que entrou (ou saiu) no período: aportes, resgates, vendas,
  // compras e custos do agro. Crescer porque você colocou dinheiro não é
  // ganho — o ganho é a variação do patrimônio MENOS esse fluxo.
  function fluxoEntre(de, ate) {
    const b = FC.estado.base;
    const dentro = (d) => d > de && d <= ate;
    let f = 0;
    for (const a of b.aportes) {
      if (!dentro(a.data)) continue;
      if (a.tipo === "ativo") f += a.valor;                      // venda já vem negativa
      else if (a.tipo === "caixa" && !a.historico) f += a.valor; // resgate já vem negativo
    }
    for (const m of b.agro.movs) {
      if (!dentro(m.data)) continue;
      if (m.tipo === "compra") f += m.valor_total + m.despesas;
      else if (m.tipo === "venda") f -= m.valor_total - m.despesas;
      else if (m.tipo === "entrada") f += m.valor_total;
      else if (m.tipo === "saida") f -= m.valor_total;
    }
    for (const c of b.agro.custos) if (dentro(c.data)) f += c.valor;
    return f;
  }

  // Ganho entre um registro-base e agora. Os meses importados guardam só o
  // capital investido (sem valor de mercado), então nunca servem de base.
  function ganhoDesde(regs, base, ultimo) {
    if (!base || !base.patrimonio || base === ultimo) return null;
    const fluxo = fluxoEntre(base.data, ultimo.data);
    const abs = ultimo.patrimonio - base.patrimonio - fluxo;
    const capital = base.patrimonio + Math.max(0, fluxo);
    return { abs, pct: capital ? (abs / capital) * 100 : null, desde: base.data, fluxo };
  }
  // registros do período: o valor no início (último registro antes dele)
  // e tudo o que caiu dentro
  function recorte(regs, de, ate) {
    const antes = [...regs].reverse().find((r) => r.data < de);
    const dentro = regs.filter((r) => r.data >= de && r.data <= ate);
    return antes ? [antes, ...dentro] : dentro;
  }

  function crescimento(d) {
    // registros gravados + o valor de agora como ponto de hoje
    const hoje = FC.datas.hoje();
    const r0 = d.resumo;
    let regs = (d.registros || []).filter((r) => r.data !== hoje);
    if (FC.estado.mercado.universo && r0.patrimonio > 0) {
      regs = regs.concat([{ data: hoje, origem: "app", patrimonio: r0.patrimonio, renda_variavel: r0.bolsa, cripto: r0.cripto,
        renda_fixa: r0.renda_fixa, agro: r0.agro, ao_vivo: true }]);
    }
    if (!regs.length) return "";

    const primeiroDia = regs[0].data;
    const periodos = { semana: [FC.datas.soma(hoje, -7), hoje], mes: [FC.datas.soma(hoje, -30), hoje], tudo: [primeiroDia, hoje],
      custom: [cresc.de || FC.datas.soma(hoje, -90), cresc.ate || hoje] };
    const [de, ate] = periodos[cresc.periodo];
    const trecho = recorte(regs, de, ate);

    // rendimento só se mede entre registros do painel (com valor de mercado)
    const medidos = trecho.filter((r) => r.origem !== "importado");
    let rend = null, serieRend = [];
    if (medidos.length >= 2) {
      const base = medidos[0];
      serieRend = medidos.map((r) => [r.data, r.patrimonio - base.patrimonio - fluxoEntre(base.data, r.data)]);
      rend = ganhoDesde(medidos, base, medidos.at(-1));
    }
    const fimPer = trecho.at(-1);
    const fluxoPer = trecho.length ? fluxoEntre(trecho[0].data, fimPer.data) : 0;

    const seletor = html`<div class="flex quebra mb3" style="gap:10px">
      <div class="segmentado" role="group" id="seg-periodo" aria-label="Período">
        ${[["tudo", "Tudo"], ["semana", "Semana"], ["mes", "Mês"], ["custom", "Personalizado"]].map(([k, v]) => html`<button type="button" data-p="${k}" aria-pressed="${cresc.periodo === k}">${v}</button>`)}</div>
      ${cresc.periodo === "custom" ? html`<div class="flex" style="gap:8px">
        <input class="entrada" type="date" id="per-de" value="${de}" min="${primeiroDia}" max="${hoje}" style="max-width:170px;min-height:36px;font-size:14px" aria-label="De">
        <span class="fraco">até</span>
        <input class="entrada" type="date" id="per-ate" value="${ate}" min="${primeiroDia}" max="${hoje}" style="max-width:170px;min-height:36px;font-size:14px" aria-label="Até"></div>` : ""}
      <div class="segmentado" role="group" id="seg-vista" aria-label="O que mostrar" style="margin-left:auto">
        <button type="button" data-v="patrimonio" aria-pressed="${cresc.vista === "patrimonio"}">Patrimônio</button>
        <button type="button" data-v="rendimento" aria-pressed="${cresc.vista === "rendimento"}">Rendimento</button></div>
    </div>`;

    const grafico = cresc.vista === "rendimento"
      ? (serieRend.length >= 2
        ? html`${FC.graficos.linhas({ series: [{ nome: "Rendimento", pontos: serieRend, classe: "l2", area: false }], altura: 240, zero: true })}
          <p class="texto-p mt2">Quanto o patrimônio rendeu no período, já sem o dinheiro que você aportou ou retirou.</p>`
        : html`<div class="mensagem info">${icone("info", 18)}<span>Ainda não há registros diários suficientes neste período para medir o rendimento. O painel grava um por dia — escolha um período maior ou volte em alguns dias.</span></div>`)
      : (trecho.length >= 2
        ? FC.graficos.linhas({ series: [{ nome: "Patrimônio", pontos: trecho.map((r) => [r.data, r.patrimonio]), classe: "l1", area: true }], altura: 240 })
        : html`<div class="mensagem info">${icone("info", 18)}<span>Só há um registro neste período.</span></div>`);

    return html`<section class="secao" id="crescimento">
      <div class="secao-topo"><h2>Crescimento do patrimônio</h2><span class="sub">${cresc.periodo === "tudo" ? "desde " + FC.datas.mesAno(primeiroDia) : FC.datas.br(de) + " a " + FC.datas.br(ate)}</span></div>
      <div class="cartao">
        ${seletor}
        <dl class="kpis mb3">
          <div class="kpi"><dt>Rendimento no período</dt><dd class="${rend ? (rend.abs >= 0 ? "pos" : "neg") : "fraco"}">${rend ? html`${rend.abs >= 0 ? "+" : "−"}${fmt.brl(Math.abs(rend.abs))}` : "—"}
            <small>${rend && FC.ok(rend.pct) ? fmt.delta(rend.pct, 2) + "% sem contar aportes" : "sem registros suficientes"}</small></dd></div>
          <div class="kpi pequeno"><dt>Aportes no período</dt><dd>${Math.abs(fluxoPer) > 0.005 ? html`${fluxoPer >= 0 ? "+" : "−"}${fmt.brl(Math.abs(fluxoPer))}` : fmt.brl(0)}<small>${fluxoPer < 0 ? "saiu mais do que entrou" : "dinheiro novo que entrou"}</small></dd></div>
          <div class="kpi pequeno"><dt>Patrimônio ${fimPer && fimPer.ao_vivo ? "agora" : "no fim"}</dt><dd>${fmt.brl(fimPer ? fimPer.patrimonio : 0)}<small>${trecho.length >= 2 ? (() => { const v = fimPer.patrimonio - trecho[0].patrimonio; return html`<span class="rs">${v >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(v))}</span> no período, com aportes`; })() : ""}</small></dd></div>
        </dl>
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

  function comecar() {
    return html`<section class="secao">
      <div class="secao-topo"><h2>Comece por aqui</h2><span class="sub">cadastre o que você tem; o resto o painel calcula</span></div>
      <div class="grade g3">
        <div class="cartao clicavel" data-comeca="ativo"><div style="color:var(--acento)">${icone("ativos", 28)}</div>
          <h3 class="mt2">Ações, FIIs, ETFs e cripto</h3><p class="sub">Adicione o que você tem ou acompanha. O painel busca cotações e avalia cada um.</p></div>
        <div class="cartao clicavel" data-comeca="rf"><div style="color:var(--verde)">${icone("moeda", 28)}</div>
          <h3 class="mt2">Renda fixa</h3><p class="sub">CDBs, Tesouro e caixa, comparados com o CDI do dia.</p></div>
        <a class="cartao clicavel" href="#/agro" style="color:inherit;text-decoration:none"><div style="color:var(--terra)">${icone("boi", 28)}</div>
          <h3 class="mt2">Rebanho</h3><p class="sub">Compras, vendas, custos e pesagens do gado.</p></a>
      </div></section>`;
  }

  FC.telas.inicio = async function (raiz) {
    const d = FC.estado.dados;
    const r = d.resumo;
    const vazio = !d.ativos.length && !d.rendaFixa.length && !d.agro.tem_dados;
    const nome = ((FC.auth.usuario.user_metadata || {}).nome || "").trim();

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
          ${r.tem_preco_medio ? html`<span class="chip">Resultado nas posições <b class="${r.resultado >= 0 ? "pos" : "neg"}">${fmt.delta(r.variacao)}%</b></span>` : ""}
          ${r.variacao_hoje ? html`<span class="chip">Hoje <b class="${r.variacao_hoje >= 0 ? "pos" : "neg"} rs">${r.variacao_hoje >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(r.variacao_hoje))}</b></span>` : ""}
        </div>
      </div>
      <div class="mt3">${macro(d.macro)}</div>
      ${vazio ? comecar() : ""}
      ${C.resumoInvestido(d, { compacto: true })}
      ${alocacao(d)}
      ${crescimento(d)}
      ${dividendos(d)}
      ${agroResumo(d.agro)}
      ${melhores(d)}
      ${evolucao(d.historico)}
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
    ["#per-de", "#per-ate"].forEach((sel) => {
      const el = FC.$(sel, raiz);
      if (el) el.addEventListener("change", () => {
        cresc.de = FC.$("#per-de", raiz).value || null; cresc.ate = FC.$("#per-ate", raiz).value || null;
        if (cresc.de && cresc.ate && cresc.de > cresc.ate) [cresc.de, cresc.ate] = [cresc.ate, cresc.de];
        FC.rerender({ suave: true, semAnimacao: true });
      });
    });
    FC.$$("[data-comeca]", raiz).forEach((el) => el.addEventListener("click", () => (el.dataset.comeca === "ativo" ? C.formAtivo() : C.formRendaFixa())));
  };
})();
