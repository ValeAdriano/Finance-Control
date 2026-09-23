/* Aportes: cada compra, venda, provento e movimento de renda fixa.
 * A posição e o preço médio saem daqui — não são digitados à mão. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let tipo = "compra";          // compra | venda | caixa | provento
  let filtroHist = "todos";

  const casasQtd = (a) => (a && a.classe === "cripto" ? 8 : 0);
  const arredonda = (v, casas) => Math.floor(v * 10 ** casas + 1e-9) / 10 ** casas;
  const numTxt = (v) => (ok(v) ? String(Number(v.toPrecision(10))).replace(".", ",") : "");

  // ---------------------------------------------------------------- recorrentes
  // Tudo em que você já aportou vira um atalho; ativos da carteira e
  // títulos ainda sem aporte também aparecem, no fim.
  function recorrentes() {
    const b = FC.estado.base;
    const grupos = new Map();
    const ord = [...b.aportes].sort((x, y) => y.data.localeCompare(x.data) || String(y.criado_em).localeCompare(String(x.criado_em)));
    for (const a of ord) {
      if (a.tipo === "provento" || (a.tipo === "caixa" && (a.historico || a.origem || a.valor < 0))) continue;
      if (a.tipo === "ativo" && a.quantidade < 0) continue;
      const k = a.tipo === "ativo" ? "a:" + a.ticker : "c:" + a.titulo;
      const g = grupos.get(k) || { k, tipo: a.tipo, nome: a.tipo === "ativo" ? a.ticker : a.titulo, n: 0, ultimo: a };
      g.n++;
      grupos.set(k, g);
    }
    for (const a of b.ativos) if (a.lista === "carteira" && !grupos.has("a:" + a.ticker)) grupos.set("a:" + a.ticker, { k: "a:" + a.ticker, tipo: "ativo", nome: a.ticker, n: 0, ultimo: null });
    for (const r of b.rendaFixa) if (!grupos.has("c:" + r.nome)) grupos.set("c:" + r.nome, { k: "c:" + r.nome, tipo: "caixa", nome: r.nome, n: 0, ultimo: null });
    return [...grupos.values()].sort((x, y) => (y.ultimo ? 1 : 0) - (x.ultimo ? 1 : 0) || (y.ultimo && x.ultimo ? y.ultimo.data.localeCompare(x.ultimo.data) : x.nome.localeCompare(y.nome)));
  }

  function cartaoRecorrente(g) {
    const a = g.tipo === "ativo" ? C.acharAtivo(g.nome) : null;
    const u = g.ultimo;
    const icon = g.tipo === "caixa" ? icone("moeda", 22) : a && a.classe === "cripto" ? icone("renda", 22) : icone("ativos", 22);
    const cor = g.tipo === "caixa" ? "var(--verde)" : a && a.classe === "cripto" ? "var(--s3)" : "var(--acento)";
    const sub = u
      ? (g.tipo === "ativo" ? `último: ${fmt.qtd(u.quantidade)} por ${fmt.brlTexto(u.valor)}` : `último: ${fmt.brlTexto(u.valor)}`) + ` · ${FC.datas.br(u.data).slice(0, 5)}`
      : "sem aportes ainda";
    return html`<button type="button" class="cartao clicavel" data-repete="${g.k}" style="text-align:left;border:1px solid var(--linha);cursor:pointer;padding:16px 18px;display:flex;flex-direction:column;gap:6px;width:100%;height:100%">
      <div class="flex" style="gap:10px"><span style="color:${cor}">${icon}</span><b style="font-size:16px">${g.nome}</b>
        ${g.n > 1 ? html`<span class="pilula cinza sem-ponto" style="margin-left:auto">${g.n}×</span>` : ""}</div>
      <span class="fraco rs" style="font-size:12.5px">${sub}</span>
      <span style="color:var(--acento);font-size:14px;font-weight:500">${u ? "Repetir" : "Aportar"} ${icone("chevron", 13)}</span></button>`;
  }

  // Interface simplificada: valor e quantidade, e pronto.
  function repetir(g) {
    const u = g.ultimo;
    if (g.tipo === "caixa") {
      const t = FC.estado.base.rendaFixa.find((r) => r.nome === g.nome);
      const saldo = (t ? t.valor_aplicado : 0) + C.aportadoRf(g.nome);
      const f = FC.ui.folha({
        titulo: `Aportar em ${g.nome}`,
        corpo: html`<form class="form" id="f-rep">
          <div class="campo"><label for="rp-valor">Valor (R$)</label><input id="rp-valor" name="valor" inputmode="decimal" value="${u ? numTxt(u.valor) : ""}" placeholder="0,00" required></div>
          <div class="campo"><label for="rp-data">Data</label><input id="rp-data" name="data" type="date" value="${FC.datas.hoje()}"></div>
          <p class="texto-p">Saldo atual: ${fmt.brl(saldo)}. O valor soma a ele.</p></form>`,
        rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Adicionar</button>`,
      });
      const form = FC.$("#f-rep", f.el);
      FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
      FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = FC.lerNum(FC.$("#rp-valor", form).value);
        if (!(v > 0)) return FC.ui.aviso("Informe o valor.", "erro");
        await grava(FC.$("[data-acao=salvar]", f.el), { tipo: "caixa", titulo: g.nome, valor: v, data: FC.$("#rp-data", form).value || FC.datas.hoje(), observacao: "" },
          `${fmt.brlTexto(v)} adicionado a ${g.nome}`, f);
      });
      return;
    }
    const a = C.acharAtivo(g.nome);
    const unid = FC.unidade(a || { ticker: g.nome }, 2);
    const preco = a && ok(a.preco) ? a.preco : null;
    const f = FC.ui.folha({
      titulo: `Aportar em ${g.nome}`,
      corpo: html`<form class="form" id="f-rep">
        <div class="linha2">
          <div class="campo"><label for="rp-valor">Valor (R$)</label><input id="rp-valor" name="valor" inputmode="decimal" value="${u ? numTxt(u.valor) : ""}" placeholder="0,00" required></div>
          <div class="campo"><label for="rp-qtd">Quantidade (${unid})</label><input id="rp-qtd" name="quantidade" inputmode="decimal" placeholder="${a && a.classe === "cripto" ? "0,00045" : "0"}" required>
            <span class="dica">vem calculada pelo preço de agora — ajuste para o que a corretora executou</span></div>
        </div>
        <div class="campo"><label for="rp-data">Data</label><input id="rp-data" name="data" type="date" value="${FC.datas.hoje()}"></div>
        <div class="cartao" style="background:var(--bg-3);box-shadow:none;padding:14px 18px" id="rp-conta"></div></form>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Adicionar</button>`,
    });
    const form = FC.$("#f-rep", f.el);
    const vEl = FC.$("#rp-valor", form), qEl = FC.$("#rp-qtd", form);
    let qtdManual = false;
    const conta = () => {
      const v = FC.lerNum(vEl.value), q = FC.lerNum(qEl.value);
      if (!qtdManual && v > 0 && preco) qEl.value = numTxt(arredonda(v / preco, casasQtd(a))) || "";
      const q2 = FC.lerNum(qEl.value);
      const efetivo = v > 0 && q2 > 0 ? v / q2 : null;
      FC.$("#rp-conta", form).innerHTML = String(html`<dl class="kpis" style="gap:8px 28px">
        <div class="kpi pequeno"><dt>Preço pago por ${unid}</dt><dd>${efetivo ? fmt.preco(efetivo) : "—"}</dd></div>
        <div class="kpi pequeno"><dt>Preço de agora</dt><dd>${preco ? fmt.preco(preco) : "—"}${efetivo && preco ? html`<small>${fmt.delta((efetivo / preco - 1) * 100, 2)}% de diferença</small>` : ""}</dd></div>
        ${a && a.posicao && q2 > 0 ? html`<div class="kpi pequeno"><dt>Posição depois</dt><dd>${fmt.qtd(a.posicao.quantidade + q2)} ${unid}</dd></div>` : ""}</dl>`);
      return q;
    };
    vEl.addEventListener("input", conta);
    qEl.addEventListener("input", () => { qtdManual = true; conta(); });
    conta();
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = FC.lerNum(vEl.value), q = FC.lerNum(qEl.value);
      if (!(v > 0 && q > 0)) return FC.ui.aviso("Informe o valor e a quantidade.", "erro");
      await grava(FC.$("[data-acao=salvar]", f.el), { tipo: "ativo", ticker: g.nome, quantidade: q, preco: v / q, valor: v,
        data: FC.$("#rp-data", form).value || FC.datas.hoje(), observacao: "" }, `${fmt.qtd(q)} ${unid} por ${fmt.brlTexto(v)} adicionado`, f);
    });
  }

  // ---------------------------------------------------------------- novo aporte
  function sugestoesAtivos() {
    const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
    const meus = FC.estado.base.ativos.map((a) => a.ticker);
    return [...new Set([...meus, "BTC", "ETH", "SOL", "BNB", "USDT", ...Object.keys(u.acoes), ...Object.keys(u.fiis)])];
  }

  function formNovo(pre) {
    if (tipo === "compra" || tipo === "venda") {
      return html`<form class="form" id="f-novo">
        <div class="linha3">
          <div class="campo"><label for="nv-ticker">Ativo</label>
            <input id="nv-ticker" name="ticker" list="nv-lista" value="${pre || ""}" placeholder="BTC, PETR4, HGLG11…" required autocomplete="off" style="text-transform:uppercase">
            <datalist id="nv-lista"></datalist></div>
          <div class="campo"><label for="nv-qtd">Quantidade</label><input id="nv-qtd" name="quantidade" inputmode="decimal" placeholder="0" required></div>
          <div class="campo"><label for="nv-valor">Valor total (R$)</label><input id="nv-valor" name="valor" inputmode="decimal" placeholder="0,00" required>
            <span class="dica">o que ${tipo === "venda" ? "você recebeu" : "você pagou"}, como no extrato</span></div>
        </div>
        <div id="nv-novo" hidden class="cartao" style="background:var(--bg-3);box-shadow:none;padding:14px 18px">
          <p class="texto-p mb2"><b id="nv-nome"></b> ainda não está na sua carteira — vai ser adicionado junto com este aporte.</p>
          <div class="linha2">
            <div class="campo"><label for="nv-classe">Tipo</label><select id="nv-classe" name="classe">${Object.entries(FC.CLASSES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
            <div class="campo"><label for="nv-pilar">Pilar</label><select id="nv-pilar" name="pilar">${FC.PILARES.filter((p) => p.chave !== "agro").map((p) => html`<option value="${p.chave}">${p.nome}</option>`)}</select></div>
          </div></div>
        <div class="linha2">
          <div class="campo"><label for="nv-data">Data</label><input id="nv-data" name="data" type="date" value="${FC.datas.hoje()}" required></div>
          <div class="campo"><label for="nv-obs">Observação</label><input id="nv-obs" name="observacao" maxlength="120" placeholder="corretora, motivo…"></div>
        </div>
        <div id="nv-previa"></div>
        <div class="flex entre quebra"><span class="fraco" id="nv-conta"></span><button class="botao" type="submit">Registrar ${tipo}</button></div>
      </form>`;
    }
    if (tipo === "caixa") {
      const titulos = FC.estado.base.rendaFixa.map((r) => r.nome);
      return html`<form class="form" id="f-novo">
        <div class="linha3">
          <div class="campo"><label for="cx-titulo">Título</label><input id="cx-titulo" name="titulo" list="cx-lista" value="${titulos.length === 1 ? titulos[0] : ""}" placeholder="CDB Banco X, Tesouro Selic…" required maxlength="80" autocomplete="off">
            <datalist id="cx-lista">${titulos.map((t) => html`<option value="${t}">`)}</datalist></div>
          <div class="campo"><span class="rot">Movimento</span><div class="segmentado" role="group" id="cx-op" style="align-self:flex-start">
            <button type="button" data-op="aporte" aria-pressed="true">Aporte</button><button type="button" data-op="resgate" aria-pressed="false">Resgate</button></div></div>
          <div class="campo"><label for="cx-valor">Valor (R$)</label><input id="cx-valor" name="valor" inputmode="decimal" placeholder="0,00" required></div>
        </div>
        <div id="cx-novo" hidden class="cartao" style="background:var(--bg-3);box-shadow:none;padding:14px 18px">
          <p class="texto-p mb2"><b id="cx-nome"></b> é um título novo — ele é criado com saldo zero e este aporte vira o saldo.</p>
          <div class="linha3">
            <div class="campo"><label for="cx-tipo">Indexador</label><select id="cx-tipo" name="tipo_rf">
              <option value="cdi">% do CDI</option><option value="ipca">IPCA + taxa</option><option value="prefixado">Prefixado</option></select></div>
            <div class="campo"><label for="cx-taxa">Taxa</label><input id="cx-taxa" name="taxa" inputmode="decimal" placeholder="100"><span class="dica" id="cx-dica-taxa">100 = 100% do CDI</span></div>
            <div class="campo"><label for="cx-venc">Vencimento</label><input id="cx-venc" name="vencimento" type="date"></div>
          </div></div>
        <div class="linha2">
          <div class="campo"><label for="cx-data">Data</label><input id="cx-data" name="data" type="date" value="${FC.datas.hoje()}"></div>
          <div class="campo"><label for="cx-obs">Observação</label><input id="cx-obs" name="observacao" maxlength="120"></div>
        </div>
        <p class="texto-p" id="cx-saldo"></p>
        <div class="flex" style="justify-content:flex-end"><button class="botao" type="submit">Registrar</button></div>
      </form>`;
    }
    const d = FC.estado.dados;
    return html`<form class="form" id="f-novo">
      <div class="linha3">
        <div class="campo"><label for="pv-ticker">Ativo</label><input id="pv-ticker" name="ticker" list="pv-lista" placeholder="ITSA4" required style="text-transform:uppercase">
          <datalist id="pv-lista">${d.ativos.map((a) => html`<option value="${a.ticker}">`)}</datalist></div>
        <div class="campo"><label for="pv-valor">Valor recebido (R$)</label><input id="pv-valor" name="valor" inputmode="decimal" placeholder="0,00" required></div>
        <div class="campo"><label for="pv-data">Data</label><input id="pv-data" name="data" type="date" value="${FC.datas.hoje()}"></div>
      </div>
      <div class="campo"><label for="pv-obs">Observação</label><input id="pv-obs" name="observacao" maxlength="120" placeholder="dividendo, JCP, rendimento…"></div>
      <p class="texto-p">Provento não mexe na posição nem no custo: fica registrado para você ver quanto a carteira já pagou.</p>
      <div class="flex" style="justify-content:flex-end"><button class="botao" type="submit">Registrar</button></div>
    </form>`;
  }

  function previa(a) {
    if (!a || a.erro) return "";
    return html`<div class="cartao" style="background:var(--bg-3);box-shadow:none;padding:16px 20px">
      <div class="flex quebra" style="gap:24px">
        ${FC.anel(a.score, a.cor)}
        <dl class="kpis" style="gap:8px 32px">
          <div class="kpi pequeno"><dt>Preço de agora</dt><dd>${fmt.preco(a.preco)}</dd></div>
          ${a.posicao ? html`<div class="kpi pequeno"><dt>Você tem</dt><dd>${fmt.qtd(a.posicao.quantidade)} ${FC.unidade(a, a.posicao.quantidade)}</dd></div>` : ""}
          <div class="kpi pequeno"><dt>Avaliação</dt><dd style="font-size:15px">${FC.pilula(a.cor, a.veredito_curto)}</dd></div>
        </dl>
        <div class="cresce">${C.indicadores(a)}</div>
        <button class="botao texto pequeno" type="button" data-ver="${a.ticker}">Ver análise</button>
      </div></div>`;
  }

  // grava o aporte (e fecha a folha, se veio de uma)
  async function grava(botao, linha, msg, folha) {
    try {
      await FC.ui.ocupado(botao, async () => {
        await FC.db.inserir("aportes", linha);
        // comprou algo que estava só na watchlist: passa para a carteira
        const at = linha.tipo === "ativo" && linha.quantidade > 0 && FC.estado.base.ativos.find((x) => x.ticker === linha.ticker);
        if (at && at.lista === "watchlist") await FC.db.atualizar("ativos", at.id, { lista: "carteira" });
      });
      if (folha) folha.fechar();
      await C.depoisDeMudar(msg, true);
      FC.db.log("aporte", { destino: linha.ticker || linha.titulo, valor: linha.valor });
    } catch (e) { FC.ui.erro(e); }
  }

  function historico(d) {
    let lista = [...FC.estado.base.aportes].sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)));
    if (filtroHist !== "todos") lista = lista.filter((a) => a.tipo === filtroHist);
    const total = FC.soma(lista.filter((a) => a.tipo !== "provento"), (a) => a.valor);
    const itens = lista.slice(0, 400);
    let mesAnt = null;
    return html`
      <div class="secao-topo"><h2>Histórico</h2><span class="sub">${lista.length} lançamento${lista.length === 1 ? "" : "s"}${filtroHist !== "provento" && total ? html` · ${fmt.brl(total)} líquido` : ""}</span>
        <div class="direita"><div class="campo filtros" style="margin:0"><select id="hist-filtro" aria-label="Filtrar histórico">
          <option value="todos" ${filtroHist === "todos" ? "selected" : ""}>Tudo</option>
          <option value="ativo" ${filtroHist === "ativo" ? "selected" : ""}>Ativos</option>
          <option value="caixa" ${filtroHist === "caixa" ? "selected" : ""}>Renda fixa</option>
          <option value="provento" ${filtroHist === "provento" ? "selected" : ""}>Proventos</option></select></div></div></div>
      <div class="lista">${itens.length ? itens.map((a) => {
        const mes = a.data.slice(0, 7);
        const cab = mes !== mesAnt ? html`<div class="grupo-titulo">${new Date(mes + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>` : "";
        mesAnt = mes;
        const cor = a.tipo === "provento" ? "verde" : a.tipo === "caixa" ? "azul" : a.venda || a.quantidade < 0 ? "amarelo" : "azul";
        const rot = a.tipo === "provento" ? "Provento" : a.tipo === "caixa" ? (a.valor < 0 ? "Resgate" : "Renda fixa") : a.venda || a.quantidade < 0 ? "Venda" : "Compra";
        return html`${cab}<div class="item">
          <div style="width:44px;text-align:center"><b style="font-size:17px;display:block;line-height:1">${a.data.slice(8, 10)}</b><small class="muito-fraco">${FC.datas.mesAno(a.data).split("/")[0]}</small></div>
          <div class="principal"><div class="titulo">${a.tipo === "caixa" ? a.titulo : a.ticker} ${FC.pilula(cor, rot)}</div>
            <div class="detalhe">${a.tipo === "ativo" ? `${fmt.qtd(Math.abs(a.quantidade))} × ${fmt.preco(a.preco)}` : ""}${a.observacao ? (a.tipo === "ativo" ? " · " : "") + a.observacao : ""}${a.historico ? " · só na curva" : ""}</div></div>
          <div class="valores"><b class="${a.tipo === "provento" ? "pos" : ""}">${fmt.brl(a.valor)}</b></div>
          <button class="icone-bt" data-apaga="${a.id}" title="Excluir" aria-label="Excluir lançamento">${icone("lixo", 17)}</button>
        </div>`;
      }) : C.vazio("🧾", "Nenhum lançamento", "Registre a primeira compra acima ou importe o extrato da corretora.")}</div>
      ${lista.length > 400 ? html`<p class="texto-p mt2">Mostrando os 400 mais recentes.</p>` : ""}`;
  }

  FC.telas.aportes = async function (raiz, params) {
    const d = FC.estado.dados;
    const pre = (params[0] || "").toUpperCase();
    if (pre) tipo = "compra";
    const rec = recorrentes();
    raiz.innerHTML = String(html`
      ${C.cabecalho("Aportes", "Compras, vendas, proventos e renda fixa. A posição e o preço médio saem daqui.",
        html`<button class="botao sec" id="bt-importar">${icone("importar", 18)} Importar extrato</button>`)}
      ${rec.length ? html`<section class="mb3">
        <div class="secao-topo"><h2>Repetir aporte</h2><span class="sub">toque, informe valor e quantidade, pronto</span></div>
        <div class="grade entra" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${rec.slice(0, 12).map((g, i) => html`<div style="--i:${i}">${cartaoRecorrente(g)}</div>`)}</div>
      </section>` : ""}
      <div class="secao-topo mt3"><h2>Novo aporte</h2><span class="sub">em algo que você já tem ou em algo novo</span></div>
      <div class="cartao">
        <div class="segmentado mb3" role="group" aria-label="Tipo de lançamento" id="seg-tipo">
          <button type="button" data-t="compra" aria-pressed="${tipo === "compra"}">Compra</button>
          <button type="button" data-t="venda" aria-pressed="${tipo === "venda"}">Venda</button>
          <button type="button" data-t="caixa" aria-pressed="${tipo === "caixa"}">Renda fixa</button>
          <button type="button" data-t="provento" aria-pressed="${tipo === "provento"}">Provento</button>
        </div>
        <div id="area-form"></div>
      </div>
      <section class="secao" id="area-hist">${historico(d)}</section>
    `);

    FC.$$("[data-repete]", raiz).forEach((b) => b.addEventListener("click", () => repetir(rec.find((g) => g.k === b.dataset.repete))));

    const areaForm = FC.$("#area-form", raiz);
    function montaForm() {
      areaForm.innerHTML = String(formNovo(pre));
      areaForm.firstElementChild && areaForm.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      FC.animar(areaForm);
      ligaForm();
    }
    FC.$$("#seg-tipo button", raiz).forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.t; montaForm(); }));

    function ligaForm() {
      const form = FC.$("#f-novo", areaForm);
      if (!form) return;

      // ------ compra / venda
      if (tipo === "compra" || tipo === "venda") {
        const tk = FC.$("#nv-ticker", form), q = FC.$("#nv-qtd", form), v = FC.$("#nv-valor", form);
        const cls = FC.$("#nv-classe", form), pil = FC.$("#nv-pilar", form);
        setTimeout(() => { const dl = FC.$("#nv-lista", form); if (dl) dl.innerHTML = sugestoesAtivos().map((t) => `<option value="${t}">`).join(""); }, 30);
        const pilarDe = { acao_br: "acoes", acao_us: "acoes", fii: "real_estate", etf_br: "alternativos", etf_us: "alternativos", cripto: "alternativos" };
        let classeManual = false;
        cls.addEventListener("change", () => { classeManual = true; pil.value = pilarDe[cls.value]; atualiza(); });
        const atualiza = () => {
          const t = tk.value.trim().toUpperCase();
          const a = C.acharAtivo(t);
          const novo = !!t && !a && tipo === "compra";
          FC.$("#nv-novo", form).hidden = !novo;
          if (novo) {
            FC.$("#nv-nome", form).textContent = t;
            if (!classeManual) { cls.value = C.adivinhaClasse(t); pil.value = pilarDe[cls.value]; }
          }
          FC.$("#nv-previa", form).innerHTML = String(previa(a));
          FC.animar(FC.$("#nv-previa", form));
          const ver = FC.$("[data-ver]", form);
          if (ver) ver.addEventListener("click", () => C.abreAtivo(ver.dataset.ver));
          const cripto = (a && a.classe === "cripto") || (novo && cls.value === "cripto");
          FC.$("label[for=nv-qtd]", form).textContent = cripto ? `Quantidade (${t.split("-")[0].replace(/\d+$/, "") || "moedas"})` : "Quantidade";
          q.placeholder = cripto ? "0,00045" : "0";
          const qq = FC.lerNum(q.value), vv = FC.lerNum(v.value);
          FC.$("#nv-conta", form).innerHTML = qq > 0 && vv > 0 ? String(html`Preço por unidade <b>${fmt.preco(vv / qq)}</b>${a && ok(a.preco) ? html` · agora ${fmt.preco(a.preco)}` : ""}`) : "";
        };
        [tk, q, v].forEach((el) => el.addEventListener("input", atualiza));
        atualiza();
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = FC.dadosDoForm(form);
          const cripto = f.classe === "cripto";
          const t = (f.ticker || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
          const qq = FC.lerNum(f.quantidade), vv = FC.lerNum(f.valor);
          if (t.length < 2) return FC.ui.aviso("Informe o código do ativo.", "erro");
          if (!(qq > 0 && vv > 0)) return FC.ui.aviso("Quantidade e valor precisam ser maiores que zero.", "erro");
          const existe = C.acharAtivo(t);
          if (tipo === "venda" && !existe) return FC.ui.aviso(`${t} não está na sua carteira.`, "erro");
          if (tipo === "venda" && existe.posicao && qq > existe.posicao.quantidade + 1e-9) {
            if (!(await FC.ui.confirma(`Você tem ${fmt.qtd(existe.posicao.quantidade)} ${FC.unidade(existe, 2)} registrados e está vendendo ${fmt.qtd(qq)}. Registrar mesmo assim?`, { botao: "Registrar" }))) return;
          }
          const venda = tipo === "venda";
          const botao = FC.$("button[type=submit]", form);
          try {
            if (!existe) {
              await FC.ui.ocupado(botao, () => FC.db.inserir("ativos", { ticker: cripto ? t : t.replace(/-/g, ""), classe: f.classe, pilar: f.pilar, lista: "carteira", quantidade: 0 }));
            }
          } catch (err) { return FC.ui.erro(err); }
          await grava(botao, { tipo: "ativo", ticker: existe ? existe.ticker : cripto ? t : t.replace(/-/g, ""), quantidade: venda ? -qq : qq, preco: vv / qq,
            valor: venda ? -vv : vv, data: f.data || FC.datas.hoje(), observacao: f.observacao || "", venda }, venda ? "Venda registrada" : "Aporte registrado");
        });
        return;
      }

      // ------ renda fixa
      if (tipo === "caixa") {
        const ti = FC.$("#cx-titulo", form);
        let op = "aporte";
        FC.$$("#cx-op button", form).forEach((b) => b.addEventListener("click", () => { op = b.dataset.op; }));
        const dicaTaxa = () => { FC.$("#cx-dica-taxa", form).textContent = { cdi: "100 = 100% do CDI", ipca: "6,5 = IPCA + 6,5% ao ano", prefixado: "13,2 = 13,2% ao ano" }[FC.$("#cx-tipo", form).value]; };
        FC.$("#cx-tipo", form).addEventListener("change", dicaTaxa);
        const atualiza = () => {
          const nome = ti.value.trim();
          const t = FC.estado.base.rendaFixa.find((r) => r.nome.toLowerCase() === nome.toLowerCase());
          FC.$("#cx-novo", form).hidden = !nome || !!t;
          FC.$("#cx-nome", form).textContent = nome;
          const ap = t ? C.aportadoRf(t.nome) : 0;
          FC.$("#cx-saldo", form).innerHTML = t ? String(html`Saldo atual de <b>${t.nome}</b>: ${fmt.brl(t.valor_aplicado + ap)}. Este lançamento soma a ele.`) : "";
        };
        ti.addEventListener("input", atualiza);
        atualiza(); dicaTaxa();
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = FC.dadosDoForm(form);
          const vv = FC.lerNum(f.valor);
          const nome = (f.titulo || "").trim();
          if (!nome) return FC.ui.aviso("Informe o título.", "erro");
          if (!(vv > 0)) return FC.ui.aviso("Informe um valor maior que zero.", "erro");
          const t = FC.estado.base.rendaFixa.find((r) => r.nome.toLowerCase() === nome.toLowerCase());
          if (!t && op === "resgate") return FC.ui.aviso("Não dá para resgatar de um título que não existe.", "erro");
          const botao = FC.$("button[type=submit]", form);
          try {
            if (!t) {
              // título novo nasce com saldo zero: o aporte é o saldo (nada conta duas vezes)
              await FC.ui.ocupado(botao, () => FC.db.inserir("renda_fixa", { nome, tipo: f.tipo_rf, taxa: FC.lerNum(f.taxa), vencimento: f.vencimento || null, valor_aplicado: 0, pilar: "caixa" }));
            }
          } catch (err) { return FC.ui.erro(err); }
          await grava(botao, { tipo: "caixa", titulo: t ? t.nome : nome, valor: op === "resgate" ? -vv : vv, data: f.data || FC.datas.hoje(), observacao: f.observacao || "" },
            op === "resgate" ? "Resgate registrado" : "Aporte registrado");
        });
        return;
      }

      // ------ provento
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = FC.dadosDoForm(form);
        const vv = FC.lerNum(f.valor);
        if (!(vv > 0)) return FC.ui.aviso("Informe um valor maior que zero.", "erro");
        await grava(FC.$("button[type=submit]", form), { tipo: "provento", ticker: (f.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
          valor: vv, data: f.data || FC.datas.hoje(), observacao: f.observacao || "" }, "Provento registrado");
      });
    }

    function ligaHist() {
      const area = FC.$("#area-hist", raiz);
      FC.$("#hist-filtro", area).addEventListener("change", (e) => {
        filtroHist = e.target.value;
        area.innerHTML = String(historico(FC.estado.dados));
        FC.animar(area); ligaHist();
      });
      FC.$$("[data-apaga]", area).forEach((b) => b.addEventListener("click", async () => {
        if (!(await FC.ui.confirma("Excluir este lançamento? A posição e o preço médio são recalculados.", { botao: "Excluir", perigo: true }))) return;
        try { await FC.db.apagar("aportes", b.dataset.apaga); await C.depoisDeMudar("Lançamento excluído"); } catch (e) { FC.ui.erro(e); }
      }));
    }

    FC.$("#bt-importar", raiz).addEventListener("click", () => importar(d));
    montaForm();
    ligaHist();
  };

  // ---------------------------------------------------------------- importação
  function importar(d) {
    const titulos = d.rendaFixa.map((r) => r.nome);
    const f = FC.ui.folha({
      titulo: "Importar extrato",
      corpo: html`<form class="form" id="f-imp">
        <p class="texto-p">Reconhece o extrato de negociação da corretora (compras e vendas), o extrato de conta do C6 (compras, proventos e CDB) e o do PicPay (cofrinhos).
          Importar o mesmo arquivo duas vezes não duplica nada.</p>
        <div class="campo"><label for="imp-arq">Arquivo (CSV ou ZIP)</label><input id="imp-arq" name="arquivo" type="file" accept=".csv,.zip,.txt" required></div>
        <div class="linha2">
          <div class="campo"><label for="imp-senha">Senha do ZIP (se tiver)</label><input id="imp-senha" name="senha" type="password" autocomplete="off"></div>
          <div class="campo"><label for="imp-cofre">Cofrinho vai para</label><select id="imp-cofre" name="cofre">
            ${titulos.length ? titulos.map((t) => html`<option>${t}</option>`) : html`<option>Cofrinho PicPay</option>`}</select></div>
        </div>
        <p class="texto-p">${icone("cadeado", 13)} O arquivo é lido aqui no seu navegador. Só os lançamentos reconhecidos vão para o banco.</p>
        <div id="imp-res"></div>
      </form>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Fechar</button><button class="botao" data-acao="importar">Importar</button>`,
    });
    const form = FC.$("#f-imp", f.el);
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    FC.$("[data-acao=importar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const arq = FC.$("#imp-arq", form).files[0];
      const res = FC.$("#imp-res", form);
      if (!arq) return FC.ui.aviso("Escolha um arquivo.", "erro");
      try {
        await FC.ui.ocupado(FC.$("[data-acao=importar]", f.el), async () => {
          const opcoes = { senha: FC.$("#imp-senha", form).value || null, tituloCaixa: FC.$("#imp-cofre", form).value };
          // 1ª passada descobre quais preços o extrato do C6 precisa;
          // busca esses históricos e lê de novo, agora com o preço do dia
          const pedidos = new Set();
          opcoes.resolvePreco = (t) => { pedidos.add(t); return null; };
          let lido = await FC.importador.le(arq, opcoes);
          if (pedidos.size) {
            const h = await FC.mercado.historicos([...pedidos].map((t) => ({ ticker: t, classe: "acao_br" })), 3);
            Object.assign(FC.estado.mercado.historicos, h);
            opcoes.resolvePreco = (t, dia) => { const s = h[t]; return s && !s.erro ? FC.carteira.precoEm(s.precos, dia) : null; };
            lido = await FC.importador.le(arq, opcoes);
          }
          const linhas = lido.itens.map((i) => ({
            tipo: i.tipo, data: i.data, ticker: i.ticker || null,
            quantidade: i.tipo === "ativo" ? (i.venda ? -i.quantidade : i.quantidade) : null,
            preco: i.tipo === "ativo" ? i.preco : null,
            valor: i.tipo === "ativo" ? (i.venda ? -1 : 1) * i.quantidade * i.preco : i.valor,
            titulo: i.titulo || null, observacao: (i.observacao || "").slice(0, 160), origem: i.origem,
            historico: !!i.historico, venda: !!i.venda,
          }));
          const novos = await FC.db.inserirVarios("aportes", linhas, "user_id,origem");
          // ativos que apareceram no extrato e ainda não estão cadastrados
          const conhecidos = new Set(FC.estado.base.ativos.map((a) => a.ticker));
          const universo = FC.estado.mercado.universo || { fiis: {}, acoes: {} };
          const faltam = [...new Set(linhas.filter((l) => l.tipo === "ativo").map((l) => l.ticker))].filter((t) => !conhecidos.has(t));
          const novosAtivos = faltam.map((t) => {
            const classe = universo.fiis[t] ? "fii" : universo.acoes[t] ? "acao_br" : "etf_br";
            return { ticker: t, classe, pilar: { fii: "real_estate", acao_br: "acoes", etf_br: "alternativos" }[classe], lista: "carteira", quantidade: 0 };
          });
          if (novosAtivos.length) await FC.db.inserirVarios("ativos", novosAtivos, "user_id,ticker");
          res.innerHTML = String(html`<div class="mensagem ok">${icone("check", 18)}<span>
            <b>${novos.length}</b> lançamento(s) importado(s) do extrato ${lido.formato}.
            ${linhas.length - novos.length ? html` ${linhas.length - novos.length} já estavam registrados e foram ignorados.` : ""}
            ${novosAtivos.length ? html` Cadastrei ${novosAtivos.length} ativo(s) novo(s): ${novosAtivos.map((a) => a.ticker).join(", ")} — confira classe e pilar em Investimentos.` : ""}</span></div>`);
          await C.depoisDeMudar(null, true);
        });
      } catch (err) {
        res.innerHTML = String(html`<div class="mensagem erro">${icone("alerta", 18)}<span>${FC.ui.traduzErro(err.message || String(err))}</span></div>`);
      }
    });
  }
})();
