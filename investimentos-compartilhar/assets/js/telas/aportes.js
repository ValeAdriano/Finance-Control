/* Aportes: cada compra, venda, provento e movimento de renda fixa.
 * A posição e o preço médio saem daqui — não são digitados à mão. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let tipo = "ativo";
  let filtroHist = "todos";

  function formAtivo(d, pre) {
    const opcoes = [...d.ativos].sort((a, b) => a.ticker.localeCompare(b.ticker));
    if (!opcoes.length) {
      return html`<div class="mensagem info">${icone("info", 18)}<span>Cadastre primeiro o ativo em Investimentos — depois é só registrar as compras aqui.
        <button class="botao texto pequeno" data-novo-ativo>Adicionar ativo</button></span></div>`;
    }
    return html`<form class="form" id="f-ap-ativo">
      <div class="linha3">
        <div class="campo"><label for="ap-ticker">Ativo</label><select id="ap-ticker" name="ticker" required>
          <option value="">Escolha…</option>
          ${opcoes.map((a) => html`<option value="${a.ticker}" ${pre === a.ticker ? "selected" : ""}>${a.ticker} — ${a.tipo_rotulo}</option>`)}</select></div>
        <div class="campo"><span class="rot">Operação</span>
          <div class="segmentado" role="group" id="ap-op" style="align-self:flex-start">
            <button type="button" data-op="compra" aria-pressed="true">Compra</button><button type="button" data-op="venda" aria-pressed="false">Venda</button></div></div>
        <div class="campo"><label for="ap-data">Data</label><input id="ap-data" name="data" type="date" value="${FC.datas.hoje()}" required></div>
      </div>
      <div class="linha3">
        <div class="campo"><label for="ap-qtd">Quantidade</label><input id="ap-qtd" name="quantidade" inputmode="decimal" placeholder="0" required></div>
        <div class="campo"><label for="ap-preco">Preço por cota (R$)</label><input id="ap-preco" name="preco" inputmode="decimal" placeholder="0,00" required>
          <span class="dica" id="ap-dica-preco">vem com a cotação de hoje — ajuste para o que você pagou</span></div>
        <div class="campo"><label for="ap-obs">Observação</label><input id="ap-obs" name="observacao" maxlength="120" placeholder="corretora, motivo…"></div>
      </div>
      <div id="ap-previa"></div>
      <div class="flex entre quebra"><span class="fraco" id="ap-total"></span><button class="botao" type="submit">Registrar</button></div>
    </form>`;
  }

  function formCaixa(d) {
    const titulos = d.rendaFixa.map((r) => r.nome);
    if (!titulos.length) {
      return html`<div class="mensagem info">${icone("info", 18)}<span>Cadastre um título de renda fixa em Investimentos para registrar aportes nele.
        <button class="botao texto pequeno" data-novo-rf>Adicionar título</button></span></div>`;
    }
    return html`<form class="form" id="f-ap-caixa">
      <div class="linha3">
        <div class="campo"><label for="cx-titulo">Título</label><select id="cx-titulo" name="titulo">${titulos.map((t) => html`<option>${t}</option>`)}</select></div>
        <div class="campo"><span class="rot">Movimento</span><div class="segmentado" role="group" id="cx-op" style="align-self:flex-start">
          <button type="button" data-op="aporte" aria-pressed="true">Aporte</button><button type="button" data-op="resgate" aria-pressed="false">Resgate</button></div></div>
        <div class="campo"><label for="cx-data">Data</label><input id="cx-data" name="data" type="date" value="${FC.datas.hoje()}"></div>
      </div>
      <div class="linha2">
        <div class="campo"><label for="cx-valor">Valor (R$)</label><input id="cx-valor" name="valor" inputmode="decimal" placeholder="0,00" required></div>
        <div class="campo"><label for="cx-obs">Observação</label><input id="cx-obs" name="observacao" maxlength="120"></div>
      </div>
      <p class="texto-p">O valor soma ao saldo do título. Se você preferir, pode só editar o saldo direto no título, em Investimentos.</p>
      <div class="flex" style="justify-content:flex-end"><button class="botao" type="submit">Registrar</button></div>
    </form>`;
  }

  function formProvento(d) {
    return html`<form class="form" id="f-ap-prov">
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
          <div class="kpi pequeno"><dt>Cotação de hoje</dt><dd>${fmt.preco(a.preco)}</dd></div>
          <div class="kpi pequeno"><dt>Avaliação</dt><dd style="font-size:15px">${FC.pilula(a.cor, a.veredito_curto)}</dd></div>
        </dl>
        <div class="cresce">${C.indicadores(a)}</div>
        <button class="botao texto pequeno" type="button" data-ver="${a.ticker}">Ver análise</button>
      </div></div>`;
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
    if (pre) tipo = "ativo";
    raiz.innerHTML = String(html`
      ${C.cabecalho("Aportes", "Compras, vendas, proventos e renda fixa. A posição e o preço médio saem daqui.",
        html`<button class="botao sec" id="bt-importar">${icone("importar", 18)} Importar extrato</button>`)}
      <div class="cartao">
        <div class="segmentado mb3" role="group" aria-label="Tipo de lançamento" id="seg-tipo">
          <button type="button" data-t="ativo" aria-pressed="${tipo === "ativo"}">Ativo</button>
          <button type="button" data-t="caixa" aria-pressed="${tipo === "caixa"}">Renda fixa</button>
          <button type="button" data-t="provento" aria-pressed="${tipo === "provento"}">Provento</button>
        </div>
        <div id="area-form"></div>
      </div>
      <section class="secao" id="area-hist">${historico(d)}</section>
    `);

    const areaForm = FC.$("#area-form", raiz);
    function montaForm() {
      areaForm.innerHTML = String(tipo === "ativo" ? formAtivo(d, pre) : tipo === "caixa" ? formCaixa(d) : formProvento(d));
      areaForm.firstElementChild && areaForm.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      FC.animar(areaForm);
      ligaForm();
    }
    FC.$$("#seg-tipo button", raiz).forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.t; montaForm(); }));

    function ligaForm() {
      const novoAtivo = FC.$("[data-novo-ativo]", areaForm);
      if (novoAtivo) novoAtivo.addEventListener("click", () => C.formAtivo());
      const novoRf = FC.$("[data-novo-rf]", areaForm);
      if (novoRf) novoRf.addEventListener("click", () => C.formRendaFixa());

      const fa = FC.$("#f-ap-ativo", areaForm);
      if (fa) {
        let op = "compra";
        FC.$$("#ap-op button", fa).forEach((b) => b.addEventListener("click", () => { op = b.dataset.op; }));
        const sel = FC.$("#ap-ticker", fa), qtd = FC.$("#ap-qtd", fa), preco = FC.$("#ap-preco", fa);
        const atualiza = (trocouAtivo) => {
          const a = C.acharAtivo(sel.value);
          FC.$("#ap-previa", fa).innerHTML = String(previa(a));
          FC.animar(FC.$("#ap-previa", fa));
          const v = FC.$("[data-ver]", fa);
          if (v) v.addEventListener("click", () => C.abreAtivo(v.dataset.ver));
          if (trocouAtivo && a && ok(a.preco)) preco.value = String(Number(a.preco.toPrecision(10))).replace(".", ",");
          if (trocouAtivo) {
            const cripto = a && a.classe === "cripto";
            FC.$("label[for=ap-qtd]", fa).textContent = cripto ? `Quantidade (${FC.unidade(a)})` : "Quantidade";
            FC.$("label[for=ap-preco]", fa).textContent = cripto ? `Preço por ${FC.unidade(a)} (R$)` : "Preço por cota (R$)";
            qtd.placeholder = cripto ? "0,0035" : "0";
          }
          const q = FC.lerNum(qtd.value), p = FC.lerNum(preco.value);
          FC.$("#ap-total", fa).innerHTML = q && p ? `Total <b class="rs">${FC.fmt.brlTexto(q * p)}</b>` : "";
        };
        sel.addEventListener("change", () => atualiza(true));
        qtd.addEventListener("input", () => atualiza(false));
        preco.addEventListener("input", () => atualiza(false));
        if (sel.value) atualiza(true);
        fa.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = FC.dadosDoForm(fa);
          const q = FC.lerNum(f.quantidade), p = FC.lerNum(f.preco);
          if (!f.ticker) return FC.ui.aviso("Escolha o ativo.", "erro");
          if (!(q > 0 && p > 0)) return FC.ui.aviso("Quantidade e preço precisam ser maiores que zero.", "erro");
          const venda = op === "venda";
          const linha = { tipo: "ativo", ticker: f.ticker, quantidade: venda ? -q : q, preco: p, valor: (venda ? -q : q) * p,
            data: f.data || FC.datas.hoje(), observacao: f.observacao || "", venda };
          await grava(FC.$("button[type=submit]", fa), linha, venda ? "Venda registrada" : "Compra registrada");
        });
      }
      const fc = FC.$("#f-ap-caixa", areaForm);
      if (fc) {
        let op = "aporte";
        FC.$$("#cx-op button", fc).forEach((b) => b.addEventListener("click", () => { op = b.dataset.op; }));
        fc.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = FC.dadosDoForm(fc);
          const v = FC.lerNum(f.valor);
          if (!(v > 0)) return FC.ui.aviso("Informe um valor maior que zero.", "erro");
          await grava(FC.$("button[type=submit]", fc), { tipo: "caixa", titulo: f.titulo, valor: op === "resgate" ? -v : v,
            data: f.data || FC.datas.hoje(), observacao: f.observacao || "" }, op === "resgate" ? "Resgate registrado" : "Aporte registrado");
        });
      }
      const fp = FC.$("#f-ap-prov", areaForm);
      if (fp) {
        fp.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = FC.dadosDoForm(fp);
          const v = FC.lerNum(f.valor);
          if (!(v > 0)) return FC.ui.aviso("Informe um valor maior que zero.", "erro");
          await grava(FC.$("button[type=submit]", fp), { tipo: "provento", ticker: (f.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
            valor: v, data: f.data || FC.datas.hoje(), observacao: f.observacao || "" }, "Provento registrado");
        });
      }
    }

    async function grava(botao, linha, msg) {
      try {
        await FC.ui.ocupado(botao, () => FC.db.inserir("aportes", linha));
        await C.depoisDeMudar(msg, true);
      } catch (e) { FC.ui.erro(e); }
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
