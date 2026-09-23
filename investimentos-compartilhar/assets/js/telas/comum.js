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

  C.vazio = (emoji, titulo, texto, acao) => html`<div class="vazio">
    <div class="icone-grande">${emoji}</div><h3 style="font-size:19px;margin-bottom:6px">${titulo}</h3>
    <p class="texto-p" style="margin:0 auto 16px">${texto}</p>${acao || ""}</div>`;

  C.indicadores = (a) => html`<span class="indicadores">${(a.destaques || []).map((m, i) => html`${i ? html`<i>·</i>` : ""}${m.rotulo_curto} <b>${fmt.metrica(m.valor, m.unidade)}</b>`)}</span>`;

  // ---------------------------------------------------------------- dinheiro investido
  // Quanto você colocou em cada classe, quanto vale agora (quantidade ×
  // preço de agora) e o resultado. Mostra de onde veio o preço e quando.
  C.resumoInvestido = function (d, { compacto = false } = {}) {
    const pc = d.resumo.por_classe || {};
    const classes = [["bolsa", "Ações, FIIs e ETFs", "var(--s1)"], ["cripto", "Cripto", "var(--s3)"]].filter(([k]) => pc[k]);
    if (!classes.length) return "";
    const tot = classes.reduce((t, [k]) => ({ inv: t.inv + pc[k].investido, atu: t.atu + pc[k].atual_com_custo, todo: t.todo + pc[k].atual }), { inv: 0, atu: 0, todo: 0 });
    const res = tot.atu - tot.inv, varp = tot.inv ? (tot.atu / tot.inv - 1) * 100 : null;
    const e = FC.estado;
    const fontes = [pc.cripto ? "cripto pelo CoinGecko" : "", pc.bolsa ? "bolsa pelo Yahoo Finance (atraso de ~15 min)" : ""].filter(Boolean).join(", ");
    return html`<section class="secao">
      <div class="secao-topo"><h2>Seu dinheiro investido</h2>
        <span class="sub">${e.spotEm ? `preços de ${FC.datas.ha(e.spotEm)}` : "buscando preços…"} · ${fontes}</span></div>
      <div class="cartao">
        <dl class="kpis">
          <div class="kpi"><dt>Você colocou</dt><dd>${fmt.brl(tot.inv)}<small>soma do preço médio × quantidade</small></dd></div>
          <div class="kpi"><dt>Vale agora</dt><dd>${fmt.brl(tot.atu)}<small>quantidade × preço de agora</small></dd></div>
          <div class="kpi"><dt>Resultado</dt><dd class="${res >= 0 ? "pos" : "neg"}">${fmt.brl(res)}<small>${ok(varp) ? fmt.delta(varp) + "% sobre o que você colocou" : ""}</small></dd></div>
        </dl>
        ${compacto && classes.length < 2 ? "" : html`<div class="lista mt3" style="box-shadow:none">${classes.map(([k, nome, cor]) => {
          const c = pc[k];
          return html`<div class="item"><span class="ponto-e" style="background:${cor};width:12px;height:12px"></span>
            <div class="principal"><div class="titulo">${nome}</div>
              <div class="detalhe">${c.n} ativo${c.n === 1 ? "" : "s"} · colocou ${fmt.brlTexto(c.investido)} · vale ${fmt.brlTexto(c.atual_com_custo)}</div></div>
            <div class="valores"><b class="${c.resultado >= 0 ? "pos" : "neg"}">${c.resultado >= 0 ? "+" : "−"}${fmt.brlTexto(Math.abs(c.resultado))}</b><small>${ok(c.variacao) ? fmt.delta(c.variacao) + "%" : ""}</small></div></div>`;
        })}</div>`}
        ${tot.todo - tot.atu > 0.005 ? html`<p class="texto-p mt2">Fora da conta acima: ${fmt.brl(tot.todo - tot.atu)} em ${classes.flatMap(([k]) => pc[k].sem_custo).join(", ")}, sem preço médio — sem o custo não dá para saber o ganho. Preencha em Investimentos → Editar.</p>` : ""}
      </div></section>`;
  };

  C.acharAtivo = (ticker) => (FC.estado.dados.ativos || []).find((a) => a.ticker === ticker);

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
            <select id="a-classe" name="classe">${Object.entries(FC.CLASSES).map(([k, v]) => html`<option value="${k}" ${item.classe === k ? "selected" : ""}>${v}</option>`)}</select></div>
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
    const ajustaPosicao = () => { FC.$("#a-posicao", form).style.display = lista.value === "watchlist" ? "none" : ""; };
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
    const f = FC.ui.folha({
      titulo: novo ? "Novo título de renda fixa" : "Editar título",
      corpo: html`<form class="form" id="f-rf">
        <div class="campo"><label for="r-nome">Nome</label><input id="r-nome" name="nome" value="${item.nome || ""}" placeholder="CDB Banco X 2028" required maxlength="80"></div>
        <div class="linha2">
          <div class="campo"><label for="r-tipo">Indexador</label><select id="r-tipo" name="tipo">
            <option value="cdi" ${item.tipo === "cdi" ? "selected" : ""}>% do CDI</option>
            <option value="ipca" ${item.tipo === "ipca" ? "selected" : ""}>IPCA + taxa</option>
            <option value="prefixado" ${item.tipo === "prefixado" ? "selected" : ""}>Prefixado</option></select></div>
          <div class="campo"><label for="r-taxa">Taxa contratada</label><input id="r-taxa" name="taxa" inputmode="decimal" value="${item.taxa ?? ""}" placeholder="110">
            <span class="dica" id="r-dica"></span></div>
        </div>
        <div class="linha2">
          <div class="campo"><label for="r-valor">Saldo inicial (R$)</label><input id="r-valor" name="valor_aplicado" inputmode="decimal" value="${item.valor_aplicado ? String(item.valor_aplicado).replace(".", ",") : ""}" placeholder="0,00">
            <span class="dica">o que já estava aplicado antes. Se vai lançar o dinheiro em Aportes, deixe 0 — senão ele conta duas vezes.</span></div>
          <div class="campo"><label for="r-venc">Vencimento</label><input id="r-venc" name="vencimento" type="date" value="${item.vencimento || ""}"></div>
        </div>
        <div class="campo"><label for="r-pilar">Pilar</label><select id="r-pilar" name="pilar">
          ${FC.PILARES.filter((p) => p.chave !== "agro").map((p) => html`<option value="${p.chave}" ${item.pilar === p.chave ? "selected" : ""}>${p.nome}</option>`)}</select></div>
        ${!novo && aportadoRf(item.nome) ? html`<div class="mensagem info">${icone("info", 16)}<span>Saldo total: <b>${fmt.brl(item.valor_aplicado + aportadoRf(item.nome))}</b> = saldo inicial ${fmt.brl(item.valor_aplicado)} + ${fmt.brl(aportadoRf(item.nome))} em aportes registrados.</span></div>` : ""}
        <div id="r-erro" class="mensagem erro" hidden></div>
      </form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Remover</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-rf", f.el);
    const dica = () => {
      FC.$("#r-dica", form).textContent = { cdi: "110 = 110% do CDI", ipca: "6,5 = IPCA + 6,5% ao ano", prefixado: "13,2 = 13,2% ao ano" }[FC.$("#r-tipo", form).value];
    };
    FC.$("#r-tipo", form).addEventListener("change", dica); dica();
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma(`Remover ${item.nome}?`, { botao: "Remover", perigo: true }))) return;
      try { await FC.db.apagar("renda_fixa", item.id); f.fechar(); await C.depoisDeMudar("Título removido"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const linha = { nome: d.nome, tipo: d.tipo, taxa: FC.lerNum(d.taxa), valor_aplicado: FC.lerNum(d.valor_aplicado) || 0,
        vencimento: d.vencimento || null, pilar: d.pilar };
      const erro = FC.$("#r-erro", form);
      if (!linha.nome) { erro.textContent = "Dê um nome ao título."; erro.hidden = false; return; }
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), async () => {
          if (novo) await FC.db.inserir("renda_fixa", linha); else await FC.db.atualizar("renda_fixa", item.id, linha);
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
