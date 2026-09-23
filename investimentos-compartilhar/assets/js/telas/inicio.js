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
  let visao = "total";
  function variacaoDesde(regs, dias) {
    if (regs.length < 2) return null;
    const ultimo = regs.at(-1);
    const limite = FC.datas.soma(ultimo.data, -dias);
    const base = [...regs].reverse().find((r) => r.data <= limite);
    if (!base || !base.patrimonio) return null;
    return { abs: ultimo.patrimonio - base.patrimonio, pct: (ultimo.patrimonio / base.patrimonio - 1) * 100, desde: base.data };
  }
  function kpiVar(rot, v) {
    return html`<div class="kpi pequeno"><dt>${rot}</dt><dd class="${v ? (v.abs >= 0 ? "pos" : "neg") : "fraco"}">${v ? fmt.delta(v.pct) + "%" : "—"}
      <small>${v ? fmt.brl(v.abs) : "sem registro tão antigo"}</small></dd></div>`;
  }
  function crescimento(d) {
    // os registros gravados + o valor de agora como ponto de hoje (o
    // registro de hoje pode ainda não ter sido gravado, ou estar velho)
    const hoje = FC.datas.hoje();
    const r0 = d.resumo;
    let regs = (d.registros || []).filter((r) => r.data !== hoje);
    if (FC.estado.mercado.universo && r0.patrimonio > 0) {
      regs = regs.concat([{ data: hoje, origem: "app", registrado_em: new Date().toISOString(), patrimonio: r0.patrimonio,
        renda_variavel: r0.bolsa, cripto: r0.cripto, renda_fixa: r0.renda_fixa, agro: r0.agro, ao_vivo: true,
        ativos: d.ativos.filter((a) => a.posicao) }]);
    } else regs = d.registros || [];
    if (!regs.length) return "";
    const primeiro = regs[0], ultimo = regs.at(-1);
    const total = regs.length > 1 ? { abs: ultimo.patrimonio - primeiro.patrimonio, pct: primeiro.patrimonio ? (ultimo.patrimonio / primeiro.patrimonio - 1) * 100 : null } : null;
    const grafico = regs.length < 2
      ? html`<div class="mensagem info mt2">${icone("info", 18)}<span>O acompanhamento começou em ${FC.datas.br(primeiro.data)}. O painel guarda uma foto por dia — ao abrir o app e, com ele fechado, todo dia às 18h —, e o gráfico aparece a partir do segundo registro.</span></div>`
      : visao === "total"
        ? html`${FC.graficos.linhas({ series: [{ nome: "Patrimônio", pontos: regs.map((r) => [r.data, r.patrimonio]), classe: "l1", area: true }], altura: 260 })}`
        : (() => {
          const series = [
            { nome: "Bolsa", pontos: regs.map((r) => [r.data, r.renda_variavel]), classe: "l1", k: "k1" },
            { nome: "Cripto", pontos: regs.map((r) => [r.data, r.cripto]), classe: "l3", k: "k3" },
            { nome: "Renda fixa", pontos: regs.map((r) => [r.data, r.renda_fixa]), classe: "l2", k: "k2" },
            { nome: "Agro", pontos: regs.map((r) => [r.data, r.agro]), classe: "l4", k: "k4" }].filter((s) => s.pontos.some((p) => p[1] > 0));
          return html`${FC.graficos.linhas({ series, altura: 260, zero: true })}
            <div class="legenda-g">${series.map((s) => html`<span><i class="${s.k}"></i>${s.nome.toLowerCase()}</span>`)}</div>`;
        })();
    const recentes = [...regs].reverse().slice(0, 7);
    return html`<section class="secao" id="crescimento">
      <div class="secao-topo"><h2>Crescimento do patrimônio</h2><span class="sub">${regs.length} registro${regs.length === 1 ? "" : "s"} diário${regs.length === 1 ? "" : "s"} desde ${FC.datas.br(primeiro.data)}</span>
        ${regs.length > 1 ? html`<div class="direita"><div class="segmentado" role="group" id="seg-visao">
          <button type="button" data-v="total" aria-pressed="${visao === "total"}">Total</button>
          <button type="button" data-v="classe" aria-pressed="${visao === "classe"}">Por classe</button></div></div>` : ""}</div>
      <div class="cartao">
        <dl class="kpis mb3">
          <div class="kpi"><dt>${ultimo.ao_vivo ? "Agora" : "Último registro"}</dt><dd>${fmt.brl(ultimo.patrimonio)}<small>${ultimo.ao_vivo ? "ao vivo · registrado todo dia" : FC.datas.br(ultimo.data) + " · " + (ultimo.origem === "automatico" ? "automático" : "pelo app")}</small></dd></div>
          ${kpiVar("7 dias", variacaoDesde(regs, 7))}
          ${kpiVar("30 dias", variacaoDesde(regs, 30))}
          <div class="kpi pequeno"><dt>Desde o início</dt><dd class="${total ? (total.abs >= 0 ? "pos" : "neg") : "fraco"}">${total && FC.ok(total.pct) ? fmt.delta(total.pct) + "%" : "—"}<small>${total ? fmt.brl(total.abs) : "a partir do 2º dia"}</small></dd></div>
        </dl>
        ${grafico}
        <details class="mt3"><summary style="cursor:pointer;color:var(--acento);font-size:14px">Últimos registros</summary>
          <div class="lista mt2" style="box-shadow:none">${recentes.map((r, i) => {
            const ant = regs[regs.length - 2 - i];
            const dv = ant && ant.patrimonio ? (r.patrimonio / ant.patrimonio - 1) * 100 : null;
            return html`<div class="item"><div class="principal"><div class="titulo">${FC.datas.br(r.data)} ${FC.pilula(r.origem === "automatico" ? "azul" : "cinza", r.origem === "automatico" ? "automático" : "app")}</div>
              <div class="detalhe">${(r.ativos || []).length} ativo(s) · ${r.ao_vivo ? "valor de agora" : "gravado " + new Date(r.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></div>
              <div class="valores"><b>${fmt.brl(r.patrimonio)}</b><small class="${dv == null ? "" : dv >= 0 ? "pos" : "neg"}">${dv == null ? "primeiro registro" : fmt.delta(dv, 2) + "% no dia"}</small></div></div>`;
          })}</div></details>
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
          <span class="chip"><span class="ponto" style="background:var(--s2)"></span>Renda fixa <b class="rs">${fmt.brlTexto(r.renda_fixa)}</b></span>
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
    FC.$$("#seg-visao button", raiz).forEach((b) => b.addEventListener("click", () => { visao = b.dataset.v; setTimeout(() => FC.rerender({ suave: true }), 200); }));
    FC.$$("[data-comeca]", raiz).forEach((el) => el.addEventListener("click", () => (el.dataset.comeca === "ativo" ? C.formAtivo() : C.formRendaFixa())));
  };
})();
