/* Peças usadas por mais de uma tela. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone, fmt, ok } = FC;
  const C = (FC.comum = {});

  C.cabecalho = (titulo, sub, direita) => html`<div class="cabecalho">
    <div><h1>${titulo}</h1>${sub ? html`<p class="sub">${sub}</p>` : ""}</div>
    ${direita ? html`<div class="direita">${direita}</div>` : ""}</div>`;

  // faixa que diz se as cotações ainda estão chegando ou falharam
  C.estadoMercado = function () {
    const e = FC.estado;
    if (e.carregandoMercado && !e.mercado.universo) {
      return html`<div class="mensagem info mb3"><div class="roda" style="width:16px;height:16px;border-width:2px"></div>
        <span>Buscando cotações no Fundamentus, Yahoo e Banco Central… a primeira vez do dia leva alguns segundos.</span></div>`;
    }
    if (e.erroMercado) {
      return html`<div class="mensagem alerta mb3">${icone("alerta", 18)}<span>Não consegui atualizar as cotações (${e.erroMercado}).
        ${e.mercado.universo ? "Mostrando os últimos dados guardados." : "Os valores de mercado vão aparecer quando a conexão voltar."}</span></div>`;
    }
    return "";
  };

  // estados vazios: ícone da família do app num quadrado suave
  const ICONE_VAZIO = { "🧾": "recibo", "🧭": "bussola", "💼": "carteira", "🎁": "presente", "💸": "moeda", "📅": "calendario",
    "📈": "projecoes", "🏦": "renda", "🐂": "boi", "🐄": "boi", "⚖️": "balanca", "🧺": "cesta", "📊": "ativos" };
  // ---------------------------------------------------------------- sequência de aportes
  const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  // só com o módulo "Sequência e vídeo" ligado (Ajustes → Módulos)
  C.sequencia = function () {
    const e = FC.estado;
    if (!FC.modulo("engajamento")) return null;
    if (!e.base || !e.prefs.plano) return null;
    const st = FC.salario.streak({ plano: e.prefs.plano, ganhos: e.base.ganhos || [], base: e.base });
    return st.tem_meta ? st : null;
  };
  const meses = (n) => (n === 1 ? "mês" : "meses");
  C.fraseSequencia = function (st) {
    const m = st.mesAtual, nome = MES_LONGO[Number(m.mes.slice(5)) - 1];
    if (m.estado === "batido") return html`Meta de ${nome} batida. A sequência segue acesa!`;
    if (m.estado === "sem_meta") return html`Sem renda cadastrada em ${nome}, o mês não conta nem quebra a sequência.`;
    const falta = Math.max(0, m.meta - m.investido);
    return st.atual ? html`Faltam <b class="rs">${fmt.brlTexto(falta)}</b> para manter a sequência em ${nome}.`
      : html`Aporte <b class="rs">${fmt.brlTexto(falta)}</b> em ${nome} para acender o foguinho.`;
  };
  C.chipSequencia = (st) => html`<a class="chip chip-fogo" href="#/salario" title="Meses seguidos batendo a meta de aporte do plano">
    ${FC.foguinho(26, { aceso: st.atual > 0, pct: st.mesAtual.pct })}<b>${fmt.int(st.atual)}</b> ${meses(st.atual)} seguido${st.atual === 1 ? "" : "s"}</a>`;
  C.cartaoSequencia = function (st) {
    const bola = (x) => x.estado === "batido" ? FC.foguinho(22, { aceso: true })
      : x.estado === "andamento" ? FC.foguinho(26, { aceso: false, pct: x.pct })
      : x.estado === "abaixo" ? html`<span class="seq-x">${icone("fechar", 13)}</span>` : html`<span class="seq-traco"></span>`;
    const titulo = (x) => `${MES_LONGO[Number(x.mes.slice(5)) - 1]}: ${x.estado === "sem_meta" ? "sem meta" : `${fmt.brlTexto(x.investido, 0)} de ${fmt.brlTexto(x.meta, 0)}`}`;
    return html`<div class="cartao sequencia">
      <div class="seq-topo">
        ${FC.foguinho(72, { aceso: st.atual > 0, pct: st.mesAtual.pct })}
        <div class="seq-conta"><p class="seq-num"><span data-conta="${st.atual}" data-modo="int">${fmt.int(st.atual)}</span></p>
          <p class="seq-rot">${meses(st.atual)} seguido${st.atual === 1 ? "" : "s"} batendo a meta</p></div>
        <div class="seq-recorde"><span>Recorde</span><b>${fmt.int(st.recorde)}</b></div>
      </div>
      <div class="seq-meses">${st.meses.map((x) => html`<div class="seq-mes ${x.estado}" title="${titulo(x)}">
        <span class="bola">${bola(x)}</span><small>${MES_CURTO[Number(x.mes.slice(5)) - 1]}</small></div>`)}</div>
      <p class="texto-p mt2">${C.fraseSequencia(st)}</p>
    </div>`;
  };
  // a primeira vez que a meta do mês é batida: a chama acende, solta faíscas e avisa
  C.comemoraSequencia = function (raiz, st) {
    if (!st || st.mesAtual.estado !== "batido") return;
    const chave = "fc:streak-comemorado:" + st.mesAtual.mes;
    try { if (localStorage.getItem(chave)) return; localStorage.setItem(chave, "1"); } catch (err) { return; }
    FC.$$(".sequencia .seq-topo > .fogo, .chip-fogo > .fogo", raiz).forEach((f) => {
      f.classList.add("acende");
      for (let i = 0; i < 12; i++) {
        const fa = document.createElement("i");
        fa.className = "faisca";
        const ang = (i / 12) * Math.PI * 2, dist = 0.7 + Math.random() * 0.6;
        fa.style.setProperty("--x", (Math.cos(ang) * dist).toFixed(2));
        fa.style.setProperty("--y", (Math.sin(ang) * dist - 0.3).toFixed(2));
        fa.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
        f.appendChild(fa);
      }
      setTimeout(() => { f.classList.remove("acende"); FC.$$(".faisca", f).forEach((x) => x.remove()); }, 1600);
    });
    FC.ui.aviso(`Sequência de ${st.atual} ${meses(st.atual)}! Meta do mês batida.`);
  };

  // ---------------------------------------------------------------- premissas
  // objetivos e dados extras dos títulos moram em preferencias.premissas.
  // gravaPrefs sobrescreve o jsonb inteiro: sempre mescla com o que já está lá.
  C.gravaPremissas = async function (parcial) {
    const b = FC.estado.base;
    const atuais = (b.prefsBrutas && b.prefsBrutas.premissas) || {};
    const premissas = { ...atuais, ...parcial };
    await FC.db.gravaPrefs({ premissas });
    b.prefsBrutas = { ...(b.prefsBrutas || {}), premissas };
    return premissas;
  };
  // grava (ou apaga, com null) o que se sabe de um título além da tabela
  C.gravaInfoTitulo = function (id, info) {
    const b = FC.estado.base;
    const titulos = { ...(((b.prefsBrutas || {}).premissas || {}).titulos || {}) };
    if (info) titulos[id] = { ...(titulos[id] || {}), ...info }; else delete titulos[id];
    return C.gravaPremissas({ titulos });
  };

  // "ver detalhes": o número técnico fica recolhido
  C.detalhes = (corpo, rotulo = "Ver detalhes") => html`<details class="detalhes mt2"><summary style="cursor:pointer;color:var(--acento);font-size:14px">${rotulo}</summary>
    <div class="mt2">${corpo}</div></details>`;

  C.vazio = (emoji, titulo, texto, acao) => html`<div class="vazio">
    <div class="icone-grande">${icone(ICONE_VAZIO[emoji] || emoji, 26)}</div><h3 style="font-size:19px;margin-bottom:6px">${titulo}</h3>
    <p class="texto-p" style="margin:0 auto 16px">${texto}</p>${acao || ""}</div>`;

  C.indicadores = (a) => html`<span class="indicadores">${(a.destaques || []).map((m, i) => html`${i ? html`<i>·</i>` : ""}${m.rotulo_curto} <b>${fmt.metrica(m.valor, m.unidade)}</b>`)}</span>`;

  // ---------------------------------------------------------------- dinheiro investido
  // Quanto você colocou em cada classe, quanto vale agora (quantidade ×
  // preço de agora) e o resultado. Mostra de onde veio o preço e quando.
  // Quanto foi colocado, quanto vale e quanto rendeu — por classe e no total.
  // O retorno não é "valor de hoje ÷ total aportado": cada aporte conta com a
  // sua data (retorno no período, Modified Dietz) e a TIR anualiza isso.
  const NOMES_CLASSE = [["bolsa", "Ações, FIIs e ETFs", "var(--s1)"], ["cripto", "Cripto", "var(--s3)"],
    ["renda_fixa", "Renda fixa", "var(--s2)"], ["agro", "Agronegócio", "var(--s5)"]];
  C.resumoInvestido = function (d, { compacto = false } = {}) {
    const rt = d.rentab;
    if (!rt || !rt.total) return "";
    const classes = NOMES_CLASSE.filter(([k]) => rt.classes[k] && (k !== "agro" || FC.modulo("agro")));
    const t = rt.total, e = FC.estado;
    const pc = d.resumo.por_classe || {};
    const fontes = [pc.cripto ? "cripto pelo CoinGecko" : "", pc.bolsa ? "bolsa pelo Yahoo Finance (atraso de ~15 min)" : "", rt.classes.renda_fixa ? "renda fixa pelo CDI/IPCA do Banco Central" : ""].filter(Boolean).join(", ");
    const pctTxt = (v) => (ok(v) ? `${fmt.delta(v, 2)}%` : "—");
    // um número só para o cliente: ao ano (TIR) quando há 90 dias; antes, no período
    const principal = ok(t.xirr) ? [t.xirr, "ao ano"] : ok(t.periodo_pct) ? [t.periodo_pct, "desde o primeiro aporte"] : null;
    const colocou = t.aplicado - (t.devolvido || 0);
    return html`<section class="secao">
      <div class="secao-topo"><h2>Seu dinheiro investido</h2>
        <span class="sub">${e.spotEm ? `preços de ${FC.datas.ha(e.spotEm)}` : "buscando preços…"}${fontes ? " · " + fontes : ""}</span></div>
      <div class="cartao">
        <dl class="kpis">
          <div class="kpi"><dt>Você colocou</dt><dd>${fmt.brl(colocou)}<small>${t.devolvido > 0.005 ? `aportou ${fmt.brlTexto(t.aplicado)} e já voltaram ${fmt.brlTexto(t.devolvido)}` : "o que saiu do seu bolso"}</small></dd></div>
          <div class="kpi"><dt>Vale agora</dt><dd>${fmt.brl(t.valor_atual)}<small>preço de agora · renda fixa com rendimento</small></dd></div>
          <div class="kpi"><dt>Ganho</dt><dd class="${t.ganho >= 0 ? "pos" : "neg"}">${t.ganho >= 0 ? "+" : "−"}${fmt.brl(Math.abs(t.ganho))}
            <small>${principal ? html`<b class="${principal[0] >= 0 ? "pos" : "neg"}">${pctTxt(principal[0])}</b> ${principal[1]}` : ""}</small></dd></div>
        </dl>
        ${C.detalhes(html`
        ${compacto && classes.length < 2 ? "" : html`<div class="lista" style="box-shadow:none">${classes.map(([k, nome, cor]) => {
          const c = rt.classes[k];
          return html`<div class="item"><span class="ponto-e" style="background:${cor};width:12px;height:12px"></span>
            <div class="principal"><div class="titulo">${nome}</div>
              <div class="detalhe">colocou ${fmt.brlTexto(c.aplicado)}${c.devolvido > 0.005 ? ` · voltou ${fmt.brlTexto(c.devolvido)}` : ""} · vale ${fmt.brlTexto(c.valor_atual)}${ok(c.xirr) ? ` · TIR ${pctTxt(c.xirr)} a.a.` : ""}</div></div>
            <div class="valores"><b class="${c.ganho >= 0 ? "pos" : "neg"}">${c.ganho >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(c.ganho))}</b><small>${pctTxt(c.periodo_pct)} no período</small></div></div>`;
        })}</div>`}
        <dl class="kpis mt2">
          <div class="kpi pequeno"><dt>No período</dt><dd class="${corPct(t.periodo_pct)}">${pctTxt(t.periodo_pct)}<small>${t.desde ? "desde " + FC.datas.br(t.desde) : ""}</small></dd></div>
          <div class="kpi pequeno"><dt>TIR</dt><dd class="${corPct(t.xirr)}">${pctTxt(t.xirr)}<small>${ok(t.xirr) ? "ao ano" : "precisa de 90 dias"}</small></dd></div>
        </dl>
        <p class="texto-p mt2">Cada aporte entra com a sua data: o retorno no período divide o ganho pelo capital médio que ficou aplicado (Modified Dietz), e a TIR é a taxa anual equivalente — aparece a partir de 90 dias de história.</p>`)}
        ${rt.sem_custo.length ? html`<p class="texto-p mt1">Fora da conta: ${rt.sem_custo.join(", ")}, sem preço médio — sem o custo não dá para saber o ganho. Preencha em Investimentos → Editar.</p>` : ""}
        ${rt.sem_preco && rt.sem_preco.length ? html`<p class="texto-p mt1">Fora da conta por enquanto: ${rt.sem_preco.join(", ")}, sem cotação no momento.</p>` : ""}
      </div></section>`;
  };

  C.acharAtivo = (ticker) => (FC.estado.dados.ativos || []).find((a) => a.ticker === ticker);

  // ---------------------------------------------------------------- rentabilidade
  const pctTxt = (v, casas = 2) => (FC.ok(v) ? `${fmt.delta(v, casas)}%` : "—");
  const corPct = (v) => (FC.ok(v) ? (v >= 0 ? "pos" : "neg") : "fraco");
  // resumo consolidado: aplicado, ganho e UM percentual (ao ano, ou no
  // período antes de 90 dias); Dietz e TIR ficam em "ver detalhes"
  C.kpisRentab = (r, { titulo = "" } = {}) => {
    if (!r) return "";
    const anual = FC.ok(r.xirr);
    const v = anual ? r.xirr : r.periodo_pct;
    return html`<dl class="kpis mb2 rentab-kpis">
    <div class="kpi pequeno"><dt>Aplicado${titulo}</dt><dd>${r.aplicado != null ? fmt.brl(r.aplicado) : "—"}${r.devolvido > 0.005 ? html`<small>${fmt.brl(r.devolvido)} já voltou</small>` : ""}</dd></div>
    <div class="kpi pequeno"><dt>Ganho</dt><dd class="${corPct(r.ganho)}">${r.ganho != null ? html`${r.ganho >= 0 ? "+" : "−"}${fmt.brl(Math.abs(r.ganho))}` : "—"}</dd></div>
    <div class="kpi pequeno"><dt>Rendeu ${FC.ajuda("Quanto o seu dinheiro rendeu por ano, contando a data de cada aporte, resgate e provento. Antes de 90 dias de história, mostra o rendimento no período, sem anualizar.")}</dt>
      <dd class="${corPct(v)}">${pctTxt(v)}<small>${anual ? "ao ano" : r.desde ? "desde " + FC.datas.br(r.desde) : ""}</small></dd></div>
  </dl>
  <details class="detalhes mb2"><summary style="cursor:pointer;color:var(--acento);font-size:13.5px">Ver detalhes</summary>
    <dl class="kpis mt1">
      <div class="kpi pequeno"><dt>No período ${FC.ajuda("Ganho dividido pelo capital médio que ficou aplicado, ponderado pelo tempo de cada aporte (Modified Dietz).")}</dt>
        <dd class="${corPct(r.periodo_pct)}">${pctTxt(r.periodo_pct)}<small>${r.desde ? "desde " + FC.datas.br(r.desde) : ""}</small></dd></div>
      <div class="kpi pequeno"><dt>TIR ${FC.ajuda("Taxa interna de retorno com as datas de cada aporte, resgate e provento (XIRR). Aparece a partir de 90 dias de história.")}</dt>
        <dd class="${corPct(r.xirr)}">${anual ? pctTxt(r.xirr) : "—"}<small>${anual ? "ao ano" : r.dias != null && r.dias < 90 ? "precisa de 90 dias" : ""}</small></dd></div>
    </dl></details>`;
  };

  // "E se cada aporte tivesse ido para a Selic ou o Ibovespa no mesmo dia?"
  C.comparaIndices = function (fluxos, valorAtual) {
    const e = FC.estado, ix = e.mercado.indices, ibov = (e.bench || {}).ibov;
    if (!fluxos || !fluxos.length) return "";
    const c = FC.rentab.comparaIndices(fluxos, FC.datas.hoje(), ix, ibov);
    const item = (nome, cls, v) => {
      if (v == null) return html`<div class="kpi pequeno"><dt><i class="ponto-cmp ${cls}"></i>${nome}</dt><dd class="fraco">—<small>${nome === "Ibovespa" && !e.bench ? "carregando o histórico…" : "sem histórico desde o 1º aporte"}</small></dd></div>`;
      const dif = valorAtual - v;
      return html`<div class="kpi pequeno"><dt><i class="ponto-cmp ${cls}"></i>Se fosse ${nome}</dt><dd>${fmt.brl(v)}<small>você está <b class="${dif >= 0 ? "pos" : "neg"}">${dif >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(dif))}</b> ${dif >= 0 ? "acima" : "abaixo"}</small></dd></div>`;
    };
    return html`<dl class="kpis mb2 comparar-kpis">${item("Selic", "kselic", c.selic)}${item("Ibovespa", "kibov", c.ibov)}</dl>
      <p class="texto-p mb2">Cada aporte aplicado no índice no mesmo dia; vendas, resgates e proventos saem da conta na mesma data.</p>`;
  };

  // tabela: cada aporte com a sua data, a sua taxa e o seu rendimento
  C.tabelaLotesRF = function (rent) {
    if (!rent || !rent.lotes.length) return "";
    return html`<h3 style="font-size:17px;margin:4px 0 8px">Rendimento por aporte</h3>
      ${C.kpisRentab(rent)}
      ${C.comparaIndices(rent.lotes.map((l) => ({ data: l.data, valor: -l.valor })), rent.valor_atual)}
      <div class="tabela-rola"><table class="tabela lotes">
        <thead><tr><th>Data</th><th>Taxa</th><th class="n">Aplicado</th><th class="n">Vale hoje</th><th class="n">Rendeu</th><th class="n">% ao ano</th></tr></thead>
        <tbody>${rent.lotes.map((l) => html`<tr>
          <td>${FC.datas.br(l.data)}<span class="leg">${l.origem}${l.proprio ? " · taxa própria" : ""}</span></td>
          <td>${l.rotulo_taxa}</td>
          <td class="n">${fmt.brl(l.valor)}</td>
          <td class="n">${fmt.brl(l.valor_atual)}</td>
          <td class="n ${corPct(l.rendimento)}">${l.valor > 0 ? html`${l.rendimento >= 0 ? "+" : "−"}${fmt.brl(Math.abs(l.rendimento))}<span class="leg">${pctTxt(l.pct)}</span>` : "—"}</td>
          <td class="n">${FC.ok(l.pct_aa) ? pctTxt(l.pct_aa) : html`<span class="leg">${l.dias < 30 ? "menos de 30 dias" : "—"}</span>`}</td></tr>`)}</tbody>
      </table></div>
      ${rent.sem_indices ? html`<div class="mensagem alerta mt2">${icone("info", 16)}<span>Índices do Banco Central ainda carregando: por enquanto os valores estão sem rendimento.</span></div>`
        : rent.so_reserva ? html`<div class="mensagem alerta mt2">${icone("info", 16)}<span>A série diária do CDI/IPCA não carregou: o rendimento está estimado pela taxa anual de hoje do Banco Central e se ajusta quando a série voltar.</span></div>`
        : rent.estimado ? html`<p class="texto-p mt2">Os dias mais recentes (ou anteriores à série disponível) usam o último índice conhecido — o valor se ajusta quando o Banco Central publica.</p>` : ""}`;
  };

  // ações, FIIs e cripto: cada compra como um lote (vendas consomem os mais antigos)
  C.blocoRentabAtivo = function (ticker) {
    const rt = FC.estado.dados && FC.estado.dados.rentab;
    const r = rt && rt.ativos.find((x) => x.ticker === ticker);
    if (!r || !r.lotes.length) return "";
    return html`<h3 style="font-size:17px;margin:22px 0 8px">Rentabilidade por aporte</h3>
      ${r.sem_custo ? html`<div class="mensagem alerta mb2">${icone("info", 16)}<span>Sem o preço médio da posição inicial não dá para medir o retorno do ativo. Preencha em Editar.</span></div>`
        : r.sem_preco ? html`<div class="mensagem alerta mb2">${icone("info", 16)}<span>Sem a cotação de agora não dá para medir o retorno do ativo. Tente atualizar.</span></div>`
        : html`${C.kpisRentab(r)}${C.comparaIndices(r.fluxos, r.valor_atual)}`}
      <div class="tabela-rola"><table class="tabela lotes">
        <thead><tr><th>Data</th><th class="n">Qtd.</th><th class="n">Preço pago</th><th class="n">Vale hoje</th><th class="n">Resultado</th><th class="n">% ao ano</th><th class="n">Na Selic</th><th class="n">No Ibovespa</th></tr></thead>
        <tbody>${r.lotes.map((l) => html`<tr>
          <td>${FC.datas.br(l.data)}<span class="leg">${l.origem}</span></td>
          <td class="n">${fmt.qtd(l.quantidade)}</td>
          <td class="n">${l.preco != null ? fmt.preco(l.preco) : "—"}</td>
          <td class="n">${l.valor_atual != null ? fmt.brl(l.valor_atual) : "—"}</td>
          <td class="n ${corPct(l.rendimento)}">${l.rendimento != null ? html`${l.rendimento >= 0 ? "+" : "−"}${fmt.brl(Math.abs(l.rendimento))}<span class="leg">${pctTxt(l.pct)}</span>` : "—"}</td>
          <td class="n">${FC.ok(l.pct_aa) ? pctTxt(l.pct_aa) : html`<span class="leg">${l.dias < 30 ? "menos de 30 dias" : "—"}</span>`}</td>
          ${["selic", "ibov"].map((ind) => {
            const g = l.custo != null ? FC.rentab.crescimentoIndice(ind, l.data, FC.datas.hoje(), FC.estado.mercado.indices, (FC.estado.bench || {}).ibov) : null;
            return g == null ? html`<td class="n fraco">—</td>` : html`<td class="n">${fmt.brl(l.custo * g)}<span class="leg">${pctTxt((g - 1) * 100)}</span></td>`;
          })}</tr>`)}</tbody>
      </table></div>
      ${r.realizados.length ? html`<p class="texto-p mt2">Vendas: ${r.realizados.map((v) => `${fmt.qtd(v.q)} em ${FC.datas.br(v.data_venda)}${FC.ok(v.pct) ? ` (${pctTxt(v.pct)})` : ""}`).join(" · ")}.</p>` : ""}
      ${r.proventos > 0.005 ? html`<p class="texto-p mt1">Inclui ${fmt.brl(r.proventos)} em proventos já pagos, contados como dinheiro que voltou.</p>` : ""}`;
  };

  // ---------------------------------------------------------------- FII: raio-x da CVM
  // Cada tipo de FII tem um risco diferente, e a análise muda com ele.
  const TIPOS_FII = {
    fii_tijolo: ["Tijolo", "azul", "O que paga é o aluguel: P/VP, DY, vacância física (área vaga), vacância financeira (receita que deixa de entrar) e se a renda depende de poucos imóveis ou de um setor só."],
    fii_papel: ["Papel (CRI)", "amarelo", "Não há imóvel nem vacância: o risco é de crédito. P/VP, DY e o quanto a carteira depende do maior CRI."],
    fii_fof: ["Fundo de fundos", "azul", "Carteira de cotas de outros FIIs: P/VP (FOF costuma negociar com desconto), DY e o peso do maior fundo da carteira."],
    fii_hibrido: ["Híbrido", "cinza", "Imóveis e papéis juntos: P/VP, DY, vacâncias da parte de imóveis e a concentração na maior posição."],
  };
  C.blocoFii = function (a) {
    if (a.classe !== "fii") return "";
    const tipo = TIPOS_FII[a.perfil] || TIPOS_FII.fii_tijolo, c = a.cvm;
    const pctTxt = (v) => (ok(v) ? `${fmt.num(v, 1)}%` : "—");
    const fatos = [];
    if (c) {
      if (ok(c.receita_aluguel)) fatos.push(["Receita de aluguel", pctTxt(c.receita_aluguel), "do que entrou no trimestre (o resto vem de CRIs e cotas)"]);
      if (c.n_imoveis) fatos.push(["Imóveis", fmt.int(c.n_imoveis), ok(c.maior_imovel) ? `o maior traz ${pctTxt(c.maior_imovel)} da receita` : ""]);
      if (c.maior_setor) fatos.push(["Maior setor de inquilinos", c.maior_setor.nome, `${pctTxt(c.maior_setor.pct)} da receita · ${c.n_setores} setor${c.n_setores === 1 ? "" : "es"}`]);
      if (ok(c.vacancia_fisica_cvm)) fatos.push(["Vacância física", pctTxt(c.vacancia_fisica_cvm), "área vaga, ponderada pela área de cada imóvel"]);
      if (ok(c.vacancia_financeira)) fatos.push(["Vacância financeira", pctTxt(c.vacancia_financeira), "estimada: receita que os espaços vagos deixam de gerar"]);
      if (ok(c.inadimplencia)) fatos.push(["Inadimplência", pctTxt(c.inadimplencia), "ponderada pela receita de cada imóvel"]);
      if (c.cri) fatos.push(["CRIs", fmt.int(c.cri.n), `o maior é ${pctTxt(c.cri.maior)} da carteira de CRIs · 5 maiores: ${pctTxt(c.cri.top5)}`]);
      if (c.fii) fatos.push(["Cotas de FIIs", fmt.int(c.fii.n), `o maior é ${pctTxt(c.fii.maior)} · 5 maiores: ${pctTxt(c.fii.top5)}`]);
    }
    const tri = c ? c.data_referencia.slice(0, 7).split("-").reverse().join("/") : null;
    return html`<section class="raiox">
      <div class="raiox-topo">
        <div><span class="rot">Raio-X do fundo</span><b>${FC.pilula(tipo[1], tipo[0])}</b></div>
        ${c ? html`<span class="raiox-fonte">CVM · informe de ${tri}</span>` : ""}
      </div>
      <p class="texto-p">${tipo[2]}</p>
      ${fatos.length ? html`<dl class="raiox-fatos">${fatos.map(([t, v, s]) => html`<div><dt>${t}</dt><dd>${v}</dd>${s ? html`<small>${s}</small>` : ""}</div>`)}</dl>`
        : html`<p class="texto-p mt1 fraco">Sem informe trimestral na CVM para este fundo — a análise usa só os dados do Fundamentus.</p>`}
    </section>`;
  };

  // ---------------------------------------------------------------- Graham
  // bloco de destaque: preço justo, margem de segurança e a conta
  C.blocoGraham = function (g, preco) {
    if (!g) return "";
    if (g.valor == null) {
      return html`<section class="graham vazio"><div class="graham-topo"><div><span class="rot">Preço justo de Graham</span><b>não se aplica</b></div></div>
        <p class="graham-conta">${g.motivo}.</p></section>`;
    }
    const topo = Math.max(preco, g.valor) * 1.18;
    const pP = (preco / topo) * 100, pJ = (g.valor / topo) * 100;
    const [ini, fim] = pP < pJ ? [pP, pJ] : [pJ, pP];
    return html`<section class="graham">
      <div class="graham-topo">
        <div><span class="rot">Preço justo de Graham</span><b>${fmt.preco(g.valor)}</b></div>
        ${FC.pilula(g.cor, g.leitura)}
      </div>
      <div class="graham-regua ${Math.abs(pP - pJ) < 22 ? (pP <= pJ ? "perto cota-antes" : "perto justo-antes") : ""}" aria-hidden="true">
        <div class="graham-trilho"><span class="graham-vao ${g.margem >= 0 ? "pos" : "neg"}" style="left:${ini}%;width:${fim - ini}%"></span></div>
        <span class="graham-marca cota" style="left:${pP}%"><i></i><small>cotação<br><b>${fmt.preco(preco)}</b></small></span>
        <span class="graham-marca justo" style="left:${pJ}%"><i></i><small>justo<br><b>${fmt.preco(g.valor)}</b></small></span>
      </div>
      <p class="graham-conta">√(22,5 × LPA ${fmt.preco(g.lpa)} × VPA ${fmt.preco(g.vpa)}) · margem de segurança <b class="${g.margem >= 0 ? "pos" : "neg"}">${fmt.delta(g.margem, 0)}%</b></p>
      <details class="graham-sobre"><summary>Como ler</summary>
        <p class="texto-p">Benjamin Graham, mentor de Warren Buffett, estimava o valor de uma ação pelo lucro (LPA) e pelo patrimônio (VPA) por ação. O 22,5 vem dos limites dele para uma ação defensiva: P/L até 15 e P/VP até 1,5. Cotação abaixo do preço justo sugere desconto — Graham pedia uma <b>margem de segurança</b> antes de comprar. Funciona melhor em empresas maduras e lucrativas; em empresas de crescimento, ciclo de commodity ou lucro extraordinário, a fórmula tende a errar.</p>
      </details>
    </section>`;
  };

  // ---------------------------------------------------------------- detalhe do ativo
  C.detalheAtivo = function (a) {
    if (a.erro) return html`<div class="mensagem alerta">${icone("alerta", 18)}<span>${a.erro}</span></div>`;
    const pos = a.posicao;
    return html`
      <div class="flex quebra" style="gap:20px;margin-bottom:20px">
        ${FC.anel(a.score, a.cor, true)}
        <div class="cresce">
          <div style="font-size:13px;color:var(--ink-2)">${a.tipo_rotulo}${a.segmento ? " · " + a.segmento : ""}${a.classe === "cripto" && a.cambio ? ` · US$ 1 = R$ ${fmt.num(a.cambio)}` : ""}</div>
          <div class="flex" style="gap:10px;margin-top:4px">${FC.pilula(a.cor, a.veredito)}</div>
          ${a.grupo_pares ? html`<div class="texto-p mt1">Comparado com: ${a.grupo_pares}</div>` : a.classe === "cripto" ? html`<div class="texto-p mt1">Avaliada pelo preço contra a própria história</div>` : ""}
        </div>
      </div>
      <dl class="kpis mb3">
        <div class="kpi pequeno"><dt>Preço</dt><dd>${fmt.preco(a.preco)}<small>${FC.ok(a.variacao_dia) ? html`<span class="${a.variacao_dia >= 0 ? "pos" : "neg"}">${fmt.delta(a.variacao_dia, 2)}% ${a.classe === "cripto" ? "em 24 h" : "hoje"}</span> · ` : ""}${a.fonte_preco || "fechamento"}${a.preco_quando ? " · " + FC.datas.ha(a.preco_quando) : ""}</small></dd></div>
        ${FC.graficos.faixa52(a.preco, a.min_52s, a.max_52s) ? html`<div class="kpi pequeno"><dt>Faixa de 52 semanas</dt><dd>${FC.graficos.faixa52(a.preco, a.min_52s, a.max_52s)}</dd></div>` : ""}
        ${pos ? html`
          <div class="kpi pequeno"><dt>Posição</dt><dd>${fmt.brl(pos.atual)}<small>${fmt.qtd(pos.quantidade)} ${FC.unidade(a, pos.quantidade)}</small></dd></div>
          ${ok(pos.preco_medio) ? html`<div class="kpi pequeno"><dt>Preço médio</dt><dd>${fmt.preco(pos.preco_medio)}</dd></div>` : ""}
          ${ok(pos.variacao) ? html`<div class="kpi pequeno"><dt>Resultado</dt><dd class="${pos.resultado >= 0 ? "pos" : "neg"}">${fmt.delta(pos.variacao)}%<small>${fmt.brl(pos.resultado)}</small></dd></div>` : ""}
        ` : ""}
      </dl>
      ${C.blocoGraham(a.graham, a.preco)}
      ${C.blocoFii(a)}
      ${C.blocoRentabAtivo(a.ticker)}
      ${evolucaoPosicao(a)}
      ${a.avisos.map((av) => html`<div class="mensagem alerta mb2" style="font-size:13px">${icone("info", 16)}<span>${av}</span></div>`)}
      <h3 style="font-size:17px;margin:20px 0 4px">Indicadores</h3>
      <p class="texto-p">Valor de hoje frente a cada referência. Na régua, o melhor fica sempre à direita.</p>
      ${a.metricas.map((m) => (m.valor == null && !m.sinal_ruim)
        ? html`<div class="metrica vazia">${FC.ponto("cinza")}<b style="color:var(--ink-2)">${m.rotulo}</b><span>sem dado — não entra no score</span></div>`
        : html`<section class="metrica">
          <header><h4>${m.rotulo}</h4><span class="peso">peso ${m.peso}</span>
            ${m.divergencia >= 25 ? FC.pilula("amarelo", "as referências discordam") : ""}</header>
          <div class="leitura">
            <div class="agora-v"><b>${fmt.metrica(m.valor, m.unidade)}</b><small>hoje</small>
              ${m.valor_alt ? html`<div class="segunda">${fmt.num(m.valor_alt.valor)}% ${m.valor_alt.rotulo}</div>` : ""}
              ${m.sinal_ruim ? html`<div class="segunda" style="color:var(--vermelho)">negativo — reprovado</div>` : ""}</div>
            ${m.serie && m.serie.length > 4 ? html`<div>${FC.graficos.sparkline(m.serie)}<small class="muito-fraco" style="display:block;font-size:11px">3 anos${m.chave === "pvp" ? " · aproximado" : ""}</small></div>` : ""}
            ${m.nota != null ? html`<div style="margin-left:auto;text-align:right"><b style="font-size:24px;font-variant-numeric:tabular-nums">${Math.round(m.nota)}</b><small class="muito-fraco" style="display:block;font-size:11px">nota</small></div>` : ""}
          </div>
          ${FC.graficos.regua(m)}
          <div class="lentes">${m.lentes.map((L) => html`<div class="lente ${L.nota == null ? "calada" : ""}">
            ${FC.ponto(L.cor)}<span class="quem">${L.titulo}</span><span class="viu">${L.texto}</span>
            <span class="val">${L.nota != null ? Math.round(L.nota) : ""}</span></div>`)}</div>
        </section>`)}
      <p class="texto-p mt3">O score aplica mecanicamente os critérios das suas regras (Ajustes → Regras). Não é recomendação de compra ou venda.</p>`;
  };

  // a posição dia a dia, tirada dos registros diários
  function evolucaoPosicao(a) {
    const regs = (FC.estado.dados.registros || []).map((r) => [r.data, (r.ativos || []).find((x) => x.ticker === a.ticker)]).filter(([, x]) => x);
    if (regs.length < 2) return "";
    const custo = regs.filter(([, x]) => FC.ok(x.custo));
    return html`<h3 style="font-size:17px;margin:8px 0 4px">Evolução da posição</h3>
      <p class="texto-p mb2">quantidade × preço de cada dia registrado</p>
      ${FC.graficos.linhas({ series: [{ nome: "Valor", pontos: regs.map(([d, x]) => [d, x.valor]), classe: "l1", area: true },
        ...(custo.length > 1 ? [{ nome: "Custo", pontos: custo.map(([d, x]) => [d, x.custo]), classe: "lref" }] : [])], altura: 200 })}
      <div class="legenda-g mb3"><span><i class="k1"></i>valor da posição</span>${custo.length > 1 ? html`<span><i class="kref"></i>custo</span>` : ""}</div>`;
  }

  C.abreAtivo = function (ticker) {
    const a = C.acharAtivo(ticker);
    if (!a) return;
    const f = FC.ui.folha({
      titulo: a.ticker, larga: true, corpo: C.detalheAtivo(a),
      rodape: html`<button class="botao sec" data-acao="editar">${icone("editar", 16)} Editar</button>
        <a class="botao" href="#/aportes/${a.ticker}">Registrar aporte</a>`,
    });
    FC.$("[data-acao=editar]", f.el).addEventListener("click", () => { f.fechar(); setTimeout(() => C.formAtivo(a.item), 240); });
    FC.$("a.botao", f.el).addEventListener("click", () => f.fechar());
  };

  // ---------------------------------------------------------------- formulário de ativo
  const pilarPadrao = { acao_br: "acoes", acao_us: "acoes", fii: "real_estate", etf_br: "alternativos", etf_us: "alternativos", cripto: "alternativos" };
  C.formAtivo = function (item) {
    const novo = !item || !!item._novo;
    item = item || { lista: "carteira", classe: "acao_br", pilar: "acoes", quantidade: 0 };
    const f = FC.ui.folha({
      titulo: novo ? "Novo ativo" : "Editar " + item.ticker,
      corpo: html`<form class="form" id="f-ativo">
        <div class="linha2">
          <div class="campo"><label for="a-ticker">Código</label>
            <input id="a-ticker" name="ticker" value="${item.ticker || ""}" placeholder="ITSA4" required ${novo ? "" : "readonly"} style="text-transform:uppercase" autocomplete="off">
            <span class="dica" id="a-dica-ticker"></span></div>
          <div class="campo"><label for="a-lista">Lista</label>
            <select id="a-lista" name="lista">
              <option value="carteira" ${item.lista === "carteira" ? "selected" : ""}>Carteira (tenho)</option>
              <option value="watchlist" ${item.lista === "watchlist" ? "selected" : ""}>Watchlist (acompanho)</option></select></div>
        </div>
        <div class="linha2">
          <div class="campo"><label for="a-classe">Classe</label>
            <select id="a-classe" name="classe">${FC.classesLigadas(item.classe).map(([k, v]) => html`<option value="${k}" ${item.classe === k ? "selected" : ""}>${v}</option>`)}</select></div>
          <div class="campo"><label for="a-pilar">Pilar</label>
            <select id="a-pilar" name="pilar">${FC.PILARES.filter((p) => p.chave !== "agro").map((p) => html`<option value="${p.chave}" ${item.pilar === p.chave ? "selected" : ""}>${p.nome}</option>`)}</select></div>
        </div>
        <div class="linha2" id="a-posicao">
          <div class="campo"><label for="a-qtd">Quantidade inicial</label>
            <input id="a-qtd" name="quantidade" inputmode="decimal" value="${item.quantidade ? String(item.quantidade).replace(".", ",") : ""}" placeholder="0">
            <span class="dica">A posição que você já tinha. Compras novas entram em Aportes.</span></div>
          <div class="campo"><label for="a-pm">Preço médio (opcional)</label>
            <input id="a-pm" name="preco_medio" inputmode="decimal" value="${item.preco_medio ? String(item.preco_medio).replace(".", ",") : ""}" placeholder="0,00">
            <span class="dica" id="a-dica-pm"></span></div>
        </div>
        <div class="campo" id="a-desde-c"><label for="a-desde">Tenho essa posição desde</label>
          <input id="a-desde" name="data_base" type="date" value="${item.data_base || (item.criado_em ? String(item.criado_em).slice(0, 10) : "")}" max="${FC.datas.hoje()}">
          <span class="dica">a data (aproximada) da compra ao preço médio — é a partir dela que o retorno é medido</span></div>
        <div id="a-erro" class="mensagem erro" hidden></div>
      </form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Remover</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-ativo", f.el);
    const classe = FC.$("#a-classe", form), pilar = FC.$("#a-pilar", form), lista = FC.$("#a-lista", form);
    const dicas = () => {
      const c = classe.value === "cripto";
      FC.$("#a-ticker", form).placeholder = c ? "BTC" : "ITSA4";
      FC.$("#a-dica-ticker", form).textContent = c ? "BTC, ETH, SOL… Se não achar, use o código do Yahoo (ex.: PEPE24478-USD)." : "";
      FC.$("#a-dica-pm", form).textContent = c ? "em reais, por unidade (1 BTC)" : "";
    };
    classe.addEventListener("change", () => { if (novo) pilar.value = pilarPadrao[classe.value] || "acoes"; dicas(); });
    dicas();
    const ajustaPosicao = () => {
      const w = lista.value === "watchlist";
      FC.$("#a-posicao", form).style.display = w ? "none" : "";
      FC.$("#a-desde-c", form).style.display = w ? "none" : "";
    };
    lista.addEventListener("change", ajustaPosicao); ajustaPosicao();
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma(`Remover ${item.ticker} da sua lista? Os aportes registrados continuam guardados.`, { botao: "Remover", perigo: true }))) return;
      try { await FC.db.apagar("ativos", item.id); f.fechar(); await C.depoisDeMudar("Ativo removido"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const erro = FC.$("#a-erro", form);
      const linha = {
        ticker: (d.ticker || "").toUpperCase().replace(d.classe === "cripto" ? /[^A-Z0-9-]/g : /[^A-Z0-9]/g, ""),
        classe: d.classe, pilar: d.pilar, lista: d.lista,
        quantidade: d.lista === "watchlist" ? 0 : FC.lerNum(d.quantidade) || 0,
        preco_medio: d.lista === "watchlist" ? null : FC.lerNum(d.preco_medio),
        data_base: d.lista === "watchlist" ? null : d.data_base || null,
      };
      if (linha.ticker.length < (linha.classe === "cripto" ? 2 : 3)) { erro.textContent = "Informe o código do ativo (ex.: ITSA4, MXRF11, BTC)."; erro.hidden = false; return; }
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), async () => {
          if (novo) await FC.db.inserir("ativos", linha); else await FC.db.atualizar("ativos", item.id, linha);
        });
        f.fechar();
        await C.depoisDeMudar(novo ? `${linha.ticker} adicionado` : "Ativo atualizado", true);
      } catch (err) { erro.textContent = FC.ui.traduzErro(err.message); erro.hidden = false; }
    });
  };

  // ---------------------------------------------------------------- formulário de renda fixa
  // aportes manuais em um título (os de extrato não somam ao saldo)
  function aportadoRf(nome) {
    return FC.soma(FC.estado.base.aportes.filter((a) => a.tipo === "caixa" && a.titulo === nome && !a.historico && !a.origem), (a) => a.valor);
  }
  C.aportadoRf = aportadoRf;

  C.formRendaFixa = function (item) {
    const novo = !item;
    item = item || { tipo: "cdi", pilar: "caixa" };
    // instituição, isenção e reserva ficam em premissas.titulos[id]
    const info = novo ? {} : FC.infoTitulo(FC.estado.prefs, item.id);
    const sugere = (nome) => !!(FC.alertas && FC.alertas.sugereIsento(nome));
    const isento = info.isento != null ? !!info.isento : sugere(item.nome);
    const f = FC.ui.folha({
      titulo: novo ? "Novo título de renda fixa" : "Editar título",
      corpo: html`<form class="form" id="f-rf">
        <div class="campo"><label for="r-nome">Nome</label><input id="r-nome" name="nome" value="${item.nome || ""}" placeholder="CDB Banco X 2028" required maxlength="80"></div>
        <div class="linha2">
          <div class="campo"><label for="r-tipo">Indexador</label><select id="r-tipo" name="tipo">
            <option value="cdi" ${item.tipo === "cdi" ? "selected" : ""}>% do CDI</option>
            <option value="selic" ${item.tipo === "selic" ? "selected" : ""}>% da Selic</option>
            <option value="ipca" ${item.tipo === "ipca" ? "selected" : ""}>IPCA + taxa</option>
            <option value="prefixado" ${item.tipo === "prefixado" ? "selected" : ""}>Prefixado</option></select></div>
          <div class="campo"><label for="r-taxa">Taxa contratada</label><input id="r-taxa" name="taxa" inputmode="decimal" value="${item.taxa ?? ""}" placeholder="110">
            <span class="dica" id="r-dica"></span></div>
        </div>
        <div class="linha2">
          <div class="campo"><label for="r-valor">Saldo inicial (R$)</label><input id="r-valor" name="valor_aplicado" inputmode="decimal" value="${item.valor_aplicado ? String(item.valor_aplicado).replace(".", ",") : ""}" placeholder="0,00">
            <span class="dica">o que já estava aplicado antes. Se vai lançar o dinheiro em Aportes, deixe 0 — senão ele conta duas vezes.</span></div>
          <div class="campo"><label for="r-ini">Saldo inicial desde</label><input id="r-ini" name="data_inicio" type="date" value="${item.data_inicio || (item.criado_em ? String(item.criado_em).slice(0, 10) : "")}">
            <span class="dica">a partir de quando o saldo inicial rende</span></div>
        </div>
        <div class="campo"><label for="r-venc">Vencimento</label><input id="r-venc" name="vencimento" type="date" value="${item.vencimento || ""}"></div>
        <div class="campo"><label for="r-pilar">Pilar</label><select id="r-pilar" name="pilar">
          ${FC.PILARES.filter((p) => p.chave !== "agro").map((p) => html`<option value="${p.chave}" ${item.pilar === p.chave ? "selected" : ""}>${p.nome}</option>`)}</select></div>
        <div class="campo"><label for="r-inst">Instituição</label><input id="r-inst" name="instituicao" value="${info.instituicao || ""}" placeholder="Banco X" maxlength="60" autocomplete="off">
          <span class="dica">o banco que emitiu o título — serve para conferir o limite de R$ 250 mil do FGC</span></div>
        <div class="linha2">
          <label class="check"><span class="interruptor"><input type="checkbox" name="isento" id="r-isento" ${isento ? "checked" : ""}><span></span></span>Isento de IR</label>
          <label class="check"><span class="interruptor"><input type="checkbox" name="reserva" ${info.reserva ? "checked" : ""}><span></span></span>É reserva de emergência</label>
        </div>
        <span class="dica" style="font-size:12px;color:var(--ink-3)">LCI, LCA, CRI, CRA e poupança não pagam IR para pessoa física. A reserva é o dinheiro para imprevistos, que dá para resgatar a qualquer momento.</span>
        ${!novo ? (() => { const r = (FC.estado.dados.rendaFixa || []).find((x) => x.id === item.id); return r && r.rent ? html`<div class="mt2">${C.tabelaLotesRF(r.rent)}</div>` : ""; })() : ""}
        <div id="r-erro" class="mensagem erro" hidden></div>
      </form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Remover</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-rf", f.el);
    const dica = () => {
      FC.$("#r-dica", form).textContent = { cdi: "110 = 110% do CDI", selic: "100 = Tesouro Selic", ipca: "6,5 = IPCA + 6,5% ao ano", prefixado: "13,2 = 13,2% ao ano" }[FC.$("#r-tipo", form).value];
    };
    FC.$("#r-tipo", form).addEventListener("change", dica); dica();
    // enquanto a pessoa não mexer, a isenção acompanha o nome (LCI, LCA…)
    const cxIsento = FC.$("#r-isento", form);
    let isentoMexido = info.isento != null;
    cxIsento.addEventListener("change", () => { isentoMexido = true; });
    FC.$("#r-nome", form).addEventListener("input", (e) => { if (!isentoMexido) cxIsento.checked = sugere(e.target.value); });
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma(`Remover ${item.nome}?`, { botao: "Remover", perigo: true }))) return;
      try {
        await FC.db.apagar("renda_fixa", item.id); f.fechar();
        // tira o título apagado de premissas.titulos
        if ((((FC.estado.base.prefsBrutas || {}).premissas || {}).titulos || {})[item.id]) {
          try { await C.gravaInfoTitulo(item.id, null); } catch (e) { console.error(e); }
        }
        await C.depoisDeMudar("Título removido");
      } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const linha = { nome: d.nome, tipo: d.tipo, taxa: FC.lerNum(d.taxa), valor_aplicado: FC.lerNum(d.valor_aplicado) || 0,
        vencimento: d.vencimento || null, pilar: d.pilar, data_inicio: d.data_inicio || null };
      const erro = FC.$("#r-erro", form);
      if (!linha.nome) { erro.textContent = "Dê um nome ao título."; erro.hidden = false; return; }
      const extra = { instituicao: (d.instituicao || "").trim(), isento: !!d.isento, reserva: !!d.reserva };
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), async () => {
          // título novo: o id só existe depois de criado
          const salvo = novo ? await FC.db.inserir("renda_fixa", linha) : await FC.db.atualizar("renda_fixa", item.id, linha);
          const id = (salvo && salvo.id) || item.id;
          const antes = novo ? {} : info;
          const mudou = ["instituicao", "isento", "reserva"].some((k) => (k === "instituicao" ? (antes[k] || "") : !!antes[k]) !== extra[k]);
          if (id != null && (mudou || (novo && (extra.instituicao || extra.isento || extra.reserva)))) await C.gravaInfoTitulo(id, extra);
        });
        f.fechar();
        await C.depoisDeMudar(novo ? "Título adicionado" : "Título atualizado");
      } catch (err) { erro.textContent = FC.ui.traduzErro(err.message); erro.hidden = false; }
    });
  };

  // ---------------------------------------------------------------- análise avulsa
  C.adivinhaClasse = function (t) {
    const u = FC.estado.mercado.universo || { fiis: {}, acoes: {} };
    if (u.fiis[t]) return "fii";
    if (u.acoes[t]) return "acao_br";
    if (/^[A-Z]{4}\d{1,2}$/.test(t)) return "etf_br";   // padrão B3 fora do Fundamentus: ETF
    return "cripto";
  };

  C.analisaAvulso = async function (ticker, classe, botao) {
    const tarefa = async () => {
      const anos = FC.estado.prefs.regras.janela_historico_anos || 3;
      const [h, spot] = await Promise.all([
        FC.mercado.historicos([{ ticker, classe }], anos),
        FC.mercado.cotacoes([{ ticker, classe }]).catch(() => ({})),
      ]);
      if (h[ticker] && h[ticker].erro && !(FC.estado.mercado.universo.acoes[ticker] || FC.estado.mercado.universo.fiis[ticker])) {
        throw new Error(`Não achei ${ticker} (${FC.CLASSES[classe] || classe}). Confira o código ou escolha o tipo certo.`);
      }
      const a = FC.avaliador.avalia(ticker, classe, FC.estado.mercado.universo, h, FC.estado.prefs.regras, spot[ticker]);
      if (a.erro) throw new Error(a.erro);
      const s = spot[ticker];
      if (s && ok(s.preco)) { a.preco = s.preco; a.variacao_dia = s.variacao_dia; a.fonte_preco = s.fonte; a.preco_quando = s.quando; }
      a.pilar = { fii: "real_estate", acao_br: "acoes", acao_us: "acoes" }[classe] || "alternativos";
      return a;
    };
    let a;
    try { a = botao ? await FC.ui.ocupado(botao, tarefa) : await tarefa(); } catch (e) { return FC.ui.erro(e); }
    const f = FC.ui.folha({
      titulo: `${a.ticker} · análise`, larga: true, corpo: C.detalheAtivo(a),
      rodape: html`<span class="texto-p" style="margin-right:auto">Não está na sua lista.</span>
        <button class="botao sec" data-add="watchlist">Acompanhar</button><button class="botao" data-add="carteira">Adicionar à carteira</button>`,
    });
    FC.$$("[data-add]", f.el).forEach((b) => b.addEventListener("click", () => {
      f.fechar();
      setTimeout(() => C.formAtivo({ ticker: a.ticker, classe, pilar: a.pilar, lista: b.dataset.add, quantidade: 0, _novo: true }), 240);
    }));
  };

  // depois de gravar: relê o banco, completa o mercado e repinta
  C.depoisDeMudar = async function (msg, mercado = false) {
    try {
      await FC.recarregaBase();
      if (mercado) await FC.completaMercado();
      await FC.rerender({ suave: true });
      if (msg) FC.ui.aviso(msg);
    } catch (e) { FC.ui.erro(e); }
  };

  C.rotuloData = (iso) => FC.datas.br(iso);
})();
