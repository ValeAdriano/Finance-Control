/* Agronegócio: controle do rebanho como investimento.
 * Compras, vendas, nascimentos, mortes, mudanças de categoria, custos e
 * pesagens. O rebanho de hoje é a soma de tudo isso. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let aba = "movs";
  let filtro = { categoria: "", fazenda: "", ano: "" };

  const LANCAMENTOS = [
    { id: "compra", nome: "Compra", desc: "gado comprado", icone: "aportes", cor: "var(--acento)" },
    { id: "venda", nome: "Venda", desc: "gado vendido", icone: "moeda", cor: "var(--verde)" },
    { id: "nascimento", nome: "Nascimento", desc: "bezerros nascidos", icone: "boi", cor: "var(--terra)" },
    { id: "morte", nome: "Morte", desc: "perdas do rebanho", icone: "alerta", cor: "var(--vermelho)" },
    { id: "reclassificacao", nome: "Mudança de categoria", desc: "ex.: bezerro → garrote", icone: "atualizar", cor: "var(--s3)" },
    { id: "entrada", nome: "Outra entrada", desc: "estoque inicial, transferência", icone: "importar", cor: "var(--ink-2)" },
    { id: "saida", nome: "Outra saída", desc: "consumo, doação, transferência", icone: "exportar", cor: "var(--ink-2)" },
    { id: "custo", nome: "Custo", desc: "ração, vacina, pasto, frete…", icone: "renda", cor: "var(--s4)" },
    { id: "pesagem", nome: "Pesagem", desc: "peso médio de um lote", icone: "balanca", cor: "var(--s5)" },
  ];

  const opcoesCat = (sel) => Object.entries(FC.CATEGORIAS_GADO).map(([k, v]) => html`<option value="${k}" ${sel === k ? "selected" : ""}>${v}</option>`);
  const unicos = (arr) => [...new Set(arr.filter(Boolean))].sort();

  function listasSugestao() {
    const ag = FC.estado.base.agro;
    const faz = unicos([...ag.movs, ...ag.custos, ...ag.pesagens].map((x) => x.fazenda));
    const lotes = unicos([...ag.movs, ...ag.custos, ...ag.pesagens].map((x) => x.lote));
    const contra = unicos(ag.movs.map((x) => x.contraparte));
    return html`<datalist id="dl-faz">${faz.map((f) => html`<option value="${f}">`)}</datalist>
      <datalist id="dl-lote">${lotes.map((f) => html`<option value="${f}">`)}</datalist>
      <datalist id="dl-contra">${contra.map((f) => html`<option value="${f}">`)}</datalist>`;
  }

  // ---------------------------------------------------------------- escolher o lançamento
  function escolher() {
    const f = FC.ui.folha({
      titulo: "Novo lançamento",
      corpo: html`<div class="grade g3" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        ${LANCAMENTOS.map((l) => html`<button class="cartao clicavel" data-l="${l.id}" style="text-align:left;border:1px solid var(--linha);cursor:pointer;padding:16px">
          <span style="color:${l.cor}">${icone(l.icone, 24)}</span>
          <div style="font-weight:600;margin-top:8px">${l.nome}</div><div class="fraco" style="font-size:12.5px">${l.desc}</div></button>`)}
      </div>`,
    });
    FC.$$("[data-l]", f.el).forEach((b) => b.addEventListener("click", () => {
      f.fechar();
      setTimeout(() => {
        const t = b.dataset.l;
        if (t === "custo") formCusto();
        else if (t === "pesagem") formPesagem();
        else formMovimento(t);
      }, 230);
    }));
  }

  // ---------------------------------------------------------------- movimento
  function formMovimento(tipo, item) {
    const novo = !item;
    item = item || { tipo, data: FC.datas.hoje(), categoria: tipo === "nascimento" ? "bezerro" : "boi_magro", cabecas: "" };
    tipo = item.tipo;
    const cfg = FC.estado.prefs.agro;
    const comPreco = ["compra", "venda"].includes(tipo);
    const comValor = comPreco || ["entrada", "saida"].includes(tipo);
    const modoInicial = item.preco_arroba ? "arroba" : item.preco_cabeca ? "cabeca" : item.valor_total ? "total" : "arroba";
    const T = FC.TIPOS_MOV[tipo];
    const f = FC.ui.folha({
      titulo: (novo ? "" : "Editar · ") + T.nome,
      corpo: html`<form class="form" id="f-mov">${listasSugestao()}
        <div class="linha3">
          <div class="campo"><label for="m-data">Data</label><input id="m-data" name="data" type="date" value="${item.data}" required></div>
          <div class="campo"><label for="m-cat">${tipo === "reclassificacao" ? "De" : "Categoria"}</label><select id="m-cat" name="categoria">${opcoesCat(item.categoria)}</select></div>
          ${tipo === "reclassificacao"
            ? html`<div class="campo"><label for="m-dest">Para</label><select id="m-dest" name="categoria_destino">${opcoesCat(item.categoria_destino || "garrote")}</select></div>`
            : html`<div class="campo"><label for="m-cab">Cabeças</label><input id="m-cab" name="cabecas" inputmode="numeric" value="${item.cabecas}" placeholder="0" required></div>`}
        </div>
        ${tipo === "reclassificacao" ? html`<div class="linha2"><div class="campo"><label for="m-cab">Cabeças</label><input id="m-cab" name="cabecas" inputmode="numeric" value="${item.cabecas}" placeholder="0" required></div>
          <div class="campo"><label for="m-peso">Peso médio (kg vivo)</label><input id="m-peso" name="peso_medio_kg" inputmode="decimal" value="${item.peso_medio_kg ?? ""}" placeholder="opcional"></div></div>` : ""}
        ${tipo !== "reclassificacao" ? html`<div class="linha2">
          <div class="campo"><label for="m-peso">Peso médio (kg vivo)</label><input id="m-peso" name="peso_medio_kg" inputmode="decimal" value="${item.peso_medio_kg ?? ""}" placeholder="${FC.PESO_TIPICO[item.categoria]}">
            <span class="dica" id="m-arr"></span></div>
          ${comValor ? html`<div class="campo"><span class="rot">Como o preço foi fechado</span>
            <div class="segmentado" role="group" id="m-modo" style="align-self:flex-start">
              <button type="button" data-m="arroba" aria-pressed="${modoInicial === "arroba"}">Por @</button>
              <button type="button" data-m="cabeca" aria-pressed="${modoInicial === "cabeca"}">Por cabeça</button>
              <button type="button" data-m="total" aria-pressed="${modoInicial === "total"}">Total</button></div></div>` : html`<div></div>`}
        </div>` : ""}
        ${comValor ? html`<div class="linha3">
          <div class="campo" data-modo="arroba"><label for="m-parr">Preço da @ (R$)</label><input id="m-parr" name="preco_arroba" inputmode="decimal" value="${item.preco_arroba ?? (novo ? cfg.preco_arroba : "")}"></div>
          <div class="campo" data-modo="cabeca"><label for="m-pcab">Preço por cabeça (R$)</label><input id="m-pcab" name="preco_cabeca" inputmode="decimal" value="${item.preco_cabeca ?? ""}"></div>
          <div class="campo" data-modo="total"><label for="m-tot">Valor total (R$)</label><input id="m-tot" name="valor_total" inputmode="decimal" value="${item.valor_total || ""}"></div>
          ${comPreco ? html`<div class="campo"><label for="m-desp">Despesas da operação (R$)</label><input id="m-desp" name="despesas" inputmode="decimal" value="${item.despesas || ""}" placeholder="frete, comissão, Funrural">
            </div>` : ""}
        </div>
        <div class="cartao" style="background:var(--bg-3);box-shadow:none;padding:14px 18px" id="m-resumo"></div>` : ""}
        <div class="linha3">
          <div class="campo"><label for="m-faz">Fazenda</label><input id="m-faz" name="fazenda" list="dl-faz" value="${item.fazenda || ""}" maxlength="60"></div>
          <div class="campo"><label for="m-lote">Lote</label><input id="m-lote" name="lote" list="dl-lote" value="${item.lote || ""}" maxlength="40"></div>
          ${comPreco ? html`<div class="campo"><label for="m-contra">${tipo === "compra" ? "Vendedor" : "Comprador"}</label><input id="m-contra" name="contraparte" list="dl-contra" value="${item.contraparte || ""}" maxlength="80"></div>` : html`<div></div>`}
        </div>
        <div class="campo"><label for="m-obs">Observação</label><input id="m-obs" name="observacao" value="${item.observacao || ""}" maxlength="240"></div>
        <div id="m-aviso"></div>
      </form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Excluir</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-mov", f.el);
    let modo = modoInicial;
    const rend = Number(cfg.rendimento_carcaca) || 52;
    const campo = (n) => FC.lerNum((FC.$(`[name=${n}]`, form) || {}).value);

    function recalcula() {
      const cab = campo("cabecas"), peso = campo("peso_medio_kg");
      const arr = FC.$("#m-arr", form);
      if (arr) arr.textContent = peso ? `${fmt.num(FC.agro.arrobas(peso, rend), 1)} @ por cabeça (rendimento ${fmt.num(rend, 0)}%)` : "";
      FC.$$("[data-modo]", form).forEach((c) => { c.style.display = c.dataset.modo === modo ? "" : "none"; });
      const res = FC.$("#m-resumo", form);
      if (res) {
        const valor = FC.agro.valorDaOperacao({ modo, cabecas: cab, peso_medio_kg: peso, preco_arroba: campo("preco_arroba"), preco_cabeca: campo("preco_cabeca"), valor_total: campo("valor_total") }, rend);
        const desp = campo("despesas") || 0;
        const totArr = cab && peso ? cab * FC.agro.arrobas(peso, rend) : null;
        const liquido = tipo === "venda" ? valor - desp : valor + desp;
        res.innerHTML = String(html`<dl class="kpis" style="gap:8px 28px">
          <div class="kpi pequeno"><dt>Valor da operação</dt><dd>${fmt.brl(valor)}</dd></div>
          ${totArr ? html`<div class="kpi pequeno"><dt>Arrobas</dt><dd>${fmt.num(totArr, 1)} @</dd></div>` : ""}
          ${cab && valor ? html`<div class="kpi pequeno"><dt>Por cabeça</dt><dd>${fmt.brl(valor / cab)}</dd></div>` : ""}
          ${totArr && valor ? html`<div class="kpi pequeno"><dt>Por @</dt><dd>${fmt.brl(valor / totArr)}</dd></div>` : ""}
          ${comPreco && desp ? html`<div class="kpi pequeno"><dt>${tipo === "venda" ? "Líquido recebido" : "Custo total"}</dt><dd>${fmt.brl(liquido)}</dd></div>` : ""}
        </dl>`);
      }
      // aviso quando a saída passa do que o rebanho tem
      const aviso = FC.$("#m-aviso", form);
      const T2 = FC.TIPOS_MOV[tipo];
      if (aviso && (T2.sinal < 0 || tipo === "reclassificacao") && cab) {
        const cat = FC.$("[name=categoria]", form).value;
        const agAtual = FC.estado.dados.agro;
        const volta = !novo && FC.TIPOS_MOV[item.tipo].sinal < 0 ? item.cabecas : 0;
        const temCat = Math.max(0, agAtual.rebanho[cat] || 0) + (volta && item.categoria === cat ? volta : 0);
        const temTotal = agAtual.total + volta;
        const nome = FC.CATEGORIAS_GADO[cat].toLowerCase();
        if (cab > temTotal) {
          aviso.innerHTML = String(html`<div class="mensagem alerta">${icone("alerta", 16)}<span>O rebanho registrado tem só ${fmt.int(temTotal)} cabeça(s) no total. Se o gado já existia antes de você começar a usar o painel, registre o estoque inicial com <b>Outra entrada</b>.</span></div>`);
        } else if (cab > temCat && tipo !== "reclassificacao") {
          aviso.innerHTML = String(html`<div class="mensagem info">${icone("info", 16)}<span>Hoje há ${fmt.int(temCat)} ${nome}(s) registrado(s). As outras ${fmt.int(cab - temCat)} cabeça(s) saem das categorias de onde o animal veio (ex.: boi magro que engordou).</span></div>`);
        } else aviso.innerHTML = "";
      }
    }
    FC.$$("#m-modo button", form).forEach((b) => b.addEventListener("click", () => { modo = b.dataset.m; recalcula(); }));
    form.addEventListener("input", recalcula);
    form.addEventListener("change", recalcula);
    recalcula();

    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma("Excluir este lançamento? O rebanho e o resultado são recalculados.", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_movimentos", item.id); f.fechar(); await C.depoisDeMudar("Lançamento excluído"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const cab = Math.round(FC.lerNum(d.cabecas) || 0);
      if (!(cab > 0)) return FC.ui.aviso("Informe quantas cabeças.", "erro");
      if (tipo === "reclassificacao" && d.categoria === d.categoria_destino) return FC.ui.aviso("Escolha categorias diferentes.", "erro");
      const peso = FC.lerNum(d.peso_medio_kg);
      const linha = {
        data: d.data, tipo, categoria: d.categoria, categoria_destino: tipo === "reclassificacao" ? d.categoria_destino : null,
        cabecas: cab, peso_medio_kg: peso, fazenda: d.fazenda || null, lote: d.lote || null,
        contraparte: comPreco ? d.contraparte || null : null, observacao: d.observacao || "",
        preco_arroba: null, preco_cabeca: null, valor_total: 0, despesas: comPreco ? FC.lerNum(d.despesas) || 0 : 0,
      };
      if (comValor) {
        linha.valor_total = FC.agro.valorDaOperacao({ modo, cabecas: cab, peso_medio_kg: peso, preco_arroba: FC.lerNum(d.preco_arroba), preco_cabeca: FC.lerNum(d.preco_cabeca), valor_total: FC.lerNum(d.valor_total) }, rend);
        if (modo === "arroba") linha.preco_arroba = FC.lerNum(d.preco_arroba);
        if (modo === "cabeca") linha.preco_cabeca = FC.lerNum(d.preco_cabeca);
        if (comPreco && !(linha.valor_total > 0)) return FC.ui.aviso(modo === "arroba" && !peso ? "Para fechar por @, informe o peso médio." : "Informe o preço.", "erro");
      }
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => (novo ? FC.db.inserir("agro_movimentos", linha) : FC.db.atualizar("agro_movimentos", item.id, linha)));
        f.fechar();
        await C.depoisDeMudar(novo ? `${T.nome} registrada` : "Lançamento atualizado");
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- custo
  function formCusto(item) {
    const novo = !item;
    item = item || { data: FC.datas.hoje(), categoria: "nutricao" };
    const f = FC.ui.folha({
      titulo: novo ? "Novo custo" : "Editar custo",
      corpo: html`<form class="form" id="f-custo">${listasSugestao()}
        <div class="linha3">
          <div class="campo"><label for="c-data">Data</label><input id="c-data" name="data" type="date" value="${item.data}" required></div>
          <div class="campo"><label for="c-cat">Categoria</label><select id="c-cat" name="categoria">${Object.entries(FC.CATEGORIAS_CUSTO).map(([k, v]) => html`<option value="${k}" ${item.categoria === k ? "selected" : ""}>${v}</option>`)}</select></div>
          <div class="campo"><label for="c-valor">Valor (R$)</label><input id="c-valor" name="valor" inputmode="decimal" value="${item.valor ?? ""}" required placeholder="0,00"></div>
        </div>
        <div class="campo"><label for="c-desc">Descrição</label><input id="c-desc" name="descricao" value="${item.descricao || ""}" maxlength="160" placeholder="10 sacos de sal mineral"></div>
        <div class="linha2">
          <div class="campo"><label for="c-faz">Fazenda</label><input id="c-faz" name="fazenda" list="dl-faz" value="${item.fazenda || ""}"></div>
          <div class="campo"><label for="c-lote">Lote</label><input id="c-lote" name="lote" list="dl-lote" value="${item.lote || ""}"></div>
        </div></form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Excluir</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-custo", f.el);
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma("Excluir este custo?", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_custos", item.id); f.fechar(); await C.depoisDeMudar("Custo excluído"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const valor = FC.lerNum(d.valor);
      if (!(valor > 0)) return FC.ui.aviso("Informe o valor.", "erro");
      const linha = { data: d.data, categoria: d.categoria, valor, descricao: d.descricao || "", fazenda: d.fazenda || null, lote: d.lote || null };
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => (novo ? FC.db.inserir("agro_custos", linha) : FC.db.atualizar("agro_custos", item.id, linha)));
        f.fechar();
        await C.depoisDeMudar(novo ? "Custo registrado" : "Custo atualizado");
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- pesagem
  function formPesagem(item) {
    const novo = !item;
    item = item || { data: FC.datas.hoje(), categoria: "boi_magro" };
    const f = FC.ui.folha({
      titulo: novo ? "Nova pesagem" : "Editar pesagem",
      corpo: html`<form class="form" id="f-pes">${listasSugestao()}
        <p class="texto-p">A pesagem mais recente de cada categoria define o peso usado para estimar o valor do rebanho. Pesagens do mesmo lote em datas diferentes geram o GMD.</p>
        <div class="linha3">
          <div class="campo"><label for="p-data">Data</label><input id="p-data" name="data" type="date" value="${item.data}" required></div>
          <div class="campo"><label for="p-cat">Categoria</label><select id="p-cat" name="categoria">${opcoesCat(item.categoria)}</select></div>
          <div class="campo"><label for="p-cab">Cabeças pesadas</label><input id="p-cab" name="cabecas" inputmode="numeric" value="${item.cabecas ?? ""}" required></div>
        </div>
        <div class="linha3">
          <div class="campo"><label for="p-peso">Peso médio (kg)</label><input id="p-peso" name="peso_medio_kg" inputmode="decimal" value="${item.peso_medio_kg ?? ""}" required></div>
          <div class="campo"><label for="p-lote">Lote</label><input id="p-lote" name="lote" list="dl-lote" value="${item.lote || ""}"></div>
          <div class="campo"><label for="p-faz">Fazenda</label><input id="p-faz" name="fazenda" list="dl-faz" value="${item.fazenda || ""}"></div>
        </div>
        <div class="campo"><label for="p-obs">Observação</label><input id="p-obs" name="observacao" value="${item.observacao || ""}" maxlength="160"></div></form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Excluir</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-pes", f.el);
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma("Excluir esta pesagem?", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_pesagens", item.id); f.fechar(); await C.depoisDeMudar("Pesagem excluída"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const linha = { data: d.data, categoria: d.categoria, cabecas: Math.round(FC.lerNum(d.cabecas) || 0), peso_medio_kg: FC.lerNum(d.peso_medio_kg),
        lote: d.lote || null, fazenda: d.fazenda || null, observacao: d.observacao || "" };
      if (!(linha.cabecas > 0 && linha.peso_medio_kg > 0)) return FC.ui.aviso("Informe cabeças e peso médio.", "erro");
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => (novo ? FC.db.inserir("agro_pesagens", linha) : FC.db.atualizar("agro_pesagens", item.id, linha)));
        f.fechar();
        await C.depoisDeMudar(novo ? "Pesagem registrada" : "Pesagem atualizada");
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- cotação
  function formCotacao() {
    const cfg = FC.estado.prefs.agro;
    const f = FC.ui.folha({
      titulo: "Cotação e avaliação do rebanho",
      corpo: html`<form class="form" id="f-cot">
        <p class="texto-p">O valor do rebanho é estimado por: cabeças × peso vivo × rendimento de carcaça ÷ 15 × preço da arroba. Atualize o preço com a cotação da sua praça (CEPEA, Scot, frigorífico).</p>
        <div class="linha3">
          <div class="campo"><label for="q-arr">Preço da @ do boi (R$)</label><input id="q-arr" name="preco_arroba" inputmode="decimal" value="${cfg.preco_arroba ?? ""}" required></div>
          <div class="campo"><label for="q-rend">Rendimento de carcaça (%)</label><input id="q-rend" name="rendimento_carcaca" inputmode="decimal" value="${cfg.rendimento_carcaca ?? 52}"></div>
          <div class="campo"><label for="q-data">Data da cotação</label><input id="q-data" name="data_cotacao" type="date" value="${cfg.data_cotacao || FC.datas.hoje()}"></div>
        </div>
        <h3 style="font-size:15px;margin-top:8px">Por categoria (opcional)</h3>
        <p class="texto-p">Bezerro e vaca costumam ter preço diferente do boi. Preencha o preço da @ ou um valor fixo por cabeça — o que estiver preenchido vale no lugar do padrão.</p>
        <div class="lista" style="box-shadow:none">
          ${Object.entries(FC.CATEGORIAS_GADO).map(([k, v]) => html`<div class="item" style="gap:10px">
            <div class="principal"><div class="titulo" style="font-size:14px">${v}</div></div>
            <input class="entrada" style="max-width:130px;min-height:38px;font-size:14px" name="arr_${k}" inputmode="decimal" placeholder="R$/@" value="${(cfg.arroba_por_categoria || {})[k] ?? ""}" aria-label="Preço da arroba de ${v}">
            <input class="entrada" style="max-width:150px;min-height:38px;font-size:14px" name="cab_${k}" inputmode="decimal" placeholder="R$/cabeça" value="${(cfg.valor_cabeca_por_categoria || {})[k] ?? ""}" aria-label="Valor por cabeça de ${v}">
          </div>`)}
        </div></form>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-cot", f.el);
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const porArr = {}, porCab = {};
      for (const k of Object.keys(FC.CATEGORIAS_GADO)) {
        const a = FC.lerNum(d["arr_" + k]), c = FC.lerNum(d["cab_" + k]);
        if (a > 0) porArr[k] = a;
        if (c > 0) porCab[k] = c;
      }
      const agro = { preco_arroba: FC.lerNum(d.preco_arroba) || 0, rendimento_carcaca: FC.lerNum(d.rendimento_carcaca) || 52,
        data_cotacao: d.data_cotacao || null, arroba_por_categoria: porArr, valor_cabeca_por_categoria: porCab };
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => FC.db.gravaPrefs({ agro }));
        f.fechar();
        await C.depoisDeMudar("Cotação atualizada");
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- histórico
  function filtra(lista) {
    return lista.filter((x) => (!filtro.categoria || x.categoria === filtro.categoria || x.categoria_destino === filtro.categoria)
      && (!filtro.fazenda || (x.fazenda || "") === filtro.fazenda) && (!filtro.ano || x.data.startsWith(filtro.ano)));
  }

  function historico() {
    const ag = FC.estado.base.agro;
    const anos = unicos([...ag.movs, ...ag.custos, ...ag.pesagens].map((x) => x.data.slice(0, 4))).reverse();
    const fazendas = unicos([...ag.movs, ...ag.custos, ...ag.pesagens].map((x) => x.fazenda));
    const ord = (a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em));
    let corpo;
    if (aba === "movs") {
      const l = filtra(ag.movs).sort(ord);
      corpo = l.length ? l.map((m) => {
        const T = FC.TIPOS_MOV[m.tipo];
        const cat = FC.CATEGORIAS_GADO[m.categoria] + (m.tipo === "reclassificacao" ? " → " + FC.CATEGORIAS_GADO[m.categoria_destino] : "");
        const sinal = T.sinal > 0 ? "+" : T.sinal < 0 ? "−" : "";
        const det = [m.peso_medio_kg ? fmt.num(m.peso_medio_kg, 0) + " kg" : "", m.preco_arroba ? fmt.brlTexto(m.preco_arroba) + "/@" : "",
          m.preco_cabeca ? fmt.brlTexto(m.preco_cabeca) + "/cab" : "", m.fazenda, m.lote ? "lote " + m.lote : "", m.contraparte, m.observacao].filter(Boolean).join(" · ");
        return html`<div class="item clicavel" data-mov="${m.id}">
          <div style="width:44px;text-align:center"><b style="font-size:17px;display:block;line-height:1">${m.data.slice(8, 10)}</b><small class="muito-fraco">${FC.datas.mesAno(m.data)}</small></div>
          <div class="principal"><div class="titulo">${sinal}${fmt.int(m.cabecas)} ${cat} ${FC.pilula(T.cor, T.nome)}</div><div class="detalhe">${det || " "}</div></div>
          <div class="valores">${m.valor_total ? html`<b class="${m.tipo === "venda" ? "pos" : ""}">${fmt.brl(m.valor_total)}</b>` : ""}${m.despesas ? html`<small>despesas ${fmt.brl(m.despesas)}</small>` : ""}</div>
          <span class="chevron">${icone("chevron", 18)}</span></div>`;
      }) : C.vazio("🐂", "Nenhum movimento", "Registre compras, vendas, nascimentos e mortes. Se o gado já existia, comece com uma “Outra entrada” de estoque inicial.");
    } else if (aba === "custos") {
      const l = filtra(ag.custos).sort(ord);
      corpo = l.length ? l.map((c) => html`<div class="item clicavel" data-custo="${c.id}">
          <div style="width:44px;text-align:center"><b style="font-size:17px;display:block;line-height:1">${c.data.slice(8, 10)}</b><small class="muito-fraco">${FC.datas.mesAno(c.data)}</small></div>
          <div class="principal"><div class="titulo">${FC.CATEGORIAS_CUSTO[c.categoria]}</div><div class="detalhe">${[c.descricao, c.fazenda, c.lote ? "lote " + c.lote : ""].filter(Boolean).join(" · ") || " "}</div></div>
          <div class="valores"><b>${fmt.brl(c.valor)}</b></div><span class="chevron">${icone("chevron", 18)}</span></div>`)
        : C.vazio("🧾", "Nenhum custo", "Ração, sal, vacinas, arrendamento, frete: tudo entra no resultado da atividade.");
    } else {
      const l = filtra(ag.pesagens).sort(ord);
      corpo = l.length ? l.map((p) => html`<div class="item clicavel" data-pes="${p.id}">
          <div style="width:44px;text-align:center"><b style="font-size:17px;display:block;line-height:1">${p.data.slice(8, 10)}</b><small class="muito-fraco">${FC.datas.mesAno(p.data)}</small></div>
          <div class="principal"><div class="titulo">${fmt.int(p.cabecas)} ${FC.CATEGORIAS_GADO[p.categoria]}</div><div class="detalhe">${[p.lote ? "lote " + p.lote : "", p.fazenda, p.observacao].filter(Boolean).join(" · ") || " "}</div></div>
          <div class="valores"><b>${fmt.num(p.peso_medio_kg, 1)} kg</b><small>${fmt.num(FC.agro.arrobas(p.peso_medio_kg, FC.estado.dados.agro.rendimento), 1)} @</small></div>
          <span class="chevron">${icone("chevron", 18)}</span></div>`)
        : C.vazio("⚖️", "Nenhuma pesagem", "Pese os lotes de tempos em tempos: o valor do rebanho fica mais preciso e o painel calcula o ganho de peso diário.");
    }
    return html`
      <div class="flex entre quebra mb2">
        <div class="segmentado" role="group" aria-label="Histórico" id="seg-hist">
          <button type="button" data-aba="movs" aria-pressed="${aba === "movs"}">Movimentos · ${ag.movs.length}</button>
          <button type="button" data-aba="custos" aria-pressed="${aba === "custos"}">Custos · ${ag.custos.length}</button>
          <button type="button" data-aba="pes" aria-pressed="${aba === "pes"}">Pesagens · ${ag.pesagens.length}</button>
        </div>
        <div class="filtros" style="margin:0">
          <div class="campo"><select id="fl-cat" aria-label="Categoria"><option value="">Todas as categorias</option>${opcoesCat(filtro.categoria)}</select></div>
          ${fazendas.length > 1 ? html`<div class="campo"><select id="fl-faz" aria-label="Fazenda"><option value="">Todas as fazendas</option>${fazendas.map((x) => html`<option ${filtro.fazenda === x ? "selected" : ""}>${x}</option>`)}</select></div>` : ""}
          ${anos.length > 1 ? html`<div class="campo"><select id="fl-ano" aria-label="Ano"><option value="">Todos os anos</option>${anos.map((x) => html`<option ${filtro.ano === x ? "selected" : ""}>${x}</option>`)}</select></div>` : ""}
        </div>
      </div>
      <div class="lista">${corpo}</div>`;
  }

  // ---------------------------------------------------------------- tela
  FC.telas.agro = async function (raiz) {
    const ag = FC.estado.dados.agro;
    const cfg = FC.estado.prefs.agro;
    const fin = ag.financeiro;
    const custosCat = Object.entries(fin.custos_por_categoria).sort((a, b) => b[1] - a[1]);
    const maxCusto = custosCat.length ? custosCat[0][1] : 1;
    const fazendas = Object.entries(ag.porFazenda).map(([f, cats]) => [f, Object.values(cats).reduce((s, n) => s + Math.max(0, n), 0)]).filter(([, n]) => n > 0);

    raiz.innerHTML = String(html`
      ${C.cabecalho("Agronegócio", "Seu rebanho como investimento: movimentos, custos, pesagens e resultado.",
        html`<button class="botao sec" id="bt-cotacao">${icone("moeda", 18)} Cotação</button><button class="botao" id="bt-novo">${icone("aportes", 18)} Lançamento</button>`)}
      ${ag.ajustes.length ? html`<div class="mensagem info mb3">${icone("info", 18)}<span>O gado muda de categoria sem lançamento: ${ag.ajustes.map((x) => `${FC.datas.br(x.data)}, ${x.cabecas} ${FC.CATEGORIAS_GADO[x.de].toLowerCase()} saíram como ${FC.CATEGORIAS_GADO[x.para].toLowerCase()} (${FC.TIPOS_MOV[x.tipo].nome.toLowerCase()})`).join("; ")}.</span></div>` : ""}
      ${ag.inconsistentes.length ? html`<div class="mensagem alerta mb3">${icone("alerta", 18)}<span>Saíram mais cabeças do que entraram em: <b>${ag.inconsistentes.map((c) => FC.CATEGORIAS_GADO[c]).join(", ")}</b>.
        Se o gado já existia antes de você começar a registrar, lance o estoque inicial com “Outra entrada”.</span></div>` : ""}
      <div class="cartao heroi">
        <p class="rotulo">Rebanho</p>
        <p class="valor"><span data-conta="${ag.total}" data-modo="int">${fmt.int(ag.total)}</span> <span style="font-size:.45em;color:var(--ink-2);font-weight:500">cabeças</span></p>
        <div class="chips">
          <span class="chip">Valor estimado <b class="rs">${fmt.brlTexto(ag.valorRebanho, 0)}</b></span>
          <button class="chip" id="chip-arroba" style="border:0;cursor:pointer">@ <b>${fmt.brlTexto(cfg.preco_arroba)}</b>${cfg.data_cotacao ? " em " + FC.datas.br(cfg.data_cotacao) : ""} ${icone("editar", 13)}</button>
          ${ag.tem_dados ? html`<span class="chip">Resultado <b class="${fin.resultado >= 0 ? "pos" : "neg"} rs">${fmt.brlTexto(fin.resultado, 0)}</b></span>` : ""}
        </div>
      </div>

      ${!ag.tem_dados ? html`<section class="secao"><div class="lista">${C.vazio("🐄", "Comece seu controle do gado",
        "Lance o rebanho que você já tem como “Outra entrada” (estoque inicial) e, daqui para frente, cada compra, venda, nascimento, morte e custo. O painel conta o rebanho, estima o valor pela arroba e calcula o resultado.",
        html`<button class="botao" data-inicio-agro>Registrar estoque inicial</button>`)}</div></section>` : html`

      <section class="secao">
        <div class="secao-topo"><h2>Resultado da atividade</h2><span class="sub">o que entrou, o que saiu e o que o rebanho vale hoje</span></div>
        <div class="cartao">
          <dl class="kpis">
            <div class="kpi"><dt>Investido ${FC.ajuda("Compras (com frete, comissão e impostos da operação), o valor do gado que entrou como estoque inicial ou transferência, e todos os custos lançados.")}</dt><dd>${fmt.brl(fin.investido, 0)}<small>${fmt.brl(fin.gasto_compras, 0)} em gado · ${fmt.brl(fin.custos, 0)} em custos</small></dd></div>
            <div class="kpi"><dt>Recebido em vendas</dt><dd>${fmt.brl(fin.receita_vendas, 0)}<small>${fmt.int(fin.cab_vendidas)} cabeças, já sem as despesas</small></dd></div>
            <div class="kpi"><dt>Rebanho hoje</dt><dd>${fmt.brl(ag.valorRebanho, 0)}<small>estimado pela arroba</small></dd></div>
            <div class="kpi"><dt>Resultado ${FC.ajuda("Recebido em vendas + valor estimado do rebanho − tudo o que foi investido. É o ganho econômico, mesmo sem ter vendido tudo.")}</dt>
              <dd class="${fin.resultado >= 0 ? "pos" : "neg"}">${fmt.brl(fin.resultado, 0)}${ok(fin.retorno_pct) ? html`<small>${fmt.delta(fin.retorno_pct)}% sobre o investido</small>` : ""}</dd></div>
          </dl>
          <hr class="sep">
          <dl class="kpis">
            <div class="kpi pequeno"><dt>Caixa líquido ${FC.ajuda("Só o dinheiro que já entrou menos o que já saiu. Fica negativo enquanto o rebanho está em formação.")}</dt><dd class="${fin.caixa_liquido >= 0 ? "pos" : "neg"}">${fmt.brl(fin.caixa_liquido, 0)}</dd></div>
            ${ok(fin.preco_medio_arroba_venda) ? html`<div class="kpi pequeno"><dt>Preço médio da @ vendida</dt><dd>${fmt.brl(fin.preco_medio_arroba_venda)}</dd></div>` : ""}
            ${ok(fin.custo_medio_cabeca_compra) ? html`<div class="kpi pequeno"><dt>Custo médio por cabeça comprada</dt><dd>${fmt.brl(fin.custo_medio_cabeca_compra, 0)}</dd></div>` : ""}
            <div class="kpi pequeno"><dt>Nascimentos</dt><dd>${fmt.int(fin.nascimentos)}</dd></div>
            <div class="kpi pequeno"><dt>Mortes</dt><dd>${fmt.int(fin.mortes)}${ok(fin.mortalidade_pct) ? html`<small>${fmt.num(fin.mortalidade_pct, 1)}% do que entrou</small>` : ""}</dd></div>
          </dl>
        </div>
      </section>

      ${ag.porCategoria.length ? html`<section class="secao">
        <div class="secao-topo"><h2>Rebanho por categoria</h2><span class="sub">cabeças, peso e valor estimado</span></div>
        <div class="gado-cat entra">${ag.porCategoria.map((c, i) => html`<div class="cartao" style="--i:${i}">
          <div class="rot-cat">${c.nome}</div><div class="n-cab">${fmt.int(c.cabecas)}</div>
          <small>${fmt.num(c.kg, 0)} kg · ${fmt.num(c.arrobas_cabeca, 1)} @/cab</small>
          <small>peso ${c.fonte_peso === "pesagem" ? "da pesagem de " + FC.datas.br(c.data_peso) : c.fonte_peso === "movimento" ? "do último lançamento" : "típico (sem pesagem)"}</small>
          <div style="margin-top:8px;font-weight:600" class="rs">${fmt.brlTexto(c.valor, 0)}</div>
          <small>${c.por_cabeca ? "valor fixo por cabeça" : fmt.brlTexto(c.preco_arroba) + "/@"}</small></div>`)}</div>
      </section>` : ""}

      ${ag.serie.length > 1 ? html`<section class="secao">
        <div class="secao-topo"><h2>Evolução</h2><span class="sub">mês a mês</span></div>
        <div class="grade g2">
          <div class="cartao"><h3>Cabeças no rebanho</h3><p class="sub mb2">entradas menos saídas, acumulado</p>
            ${FC.graficos.linhas({ series: [{ nome: "Cabeças", pontos: ag.serie.map((s) => [s.data, s.cabecas]), classe: "l1", area: true }], y: "int", altura: 220, zero: true, degrau: true, privado: false })}</div>
          <div class="cartao"><h3>Dinheiro na atividade</h3><p class="sub mb2">acumulado desde o primeiro lançamento</p>
            ${FC.graficos.linhas({ series: [
              { nome: "Investido", pontos: ag.serie.map((s) => [s.data, s.investido]), classe: "l3" },
              { nome: "Recebido", pontos: ag.serie.map((s) => [s.data, s.recebido]), classe: "l2" }], altura: 220, zero: true })}
            <div class="legenda-g"><span><i class="k3"></i>investido</span><span><i class="k2"></i>recebido em vendas</span></div></div>
        </div></section>` : ""}

      <div class="grade g2 secao">
        ${custosCat.length ? html`<div><div class="secao-topo"><h2>Custos por categoria</h2></div>
          <div class="cartao"><div class="barras-h">${custosCat.map(([k, v], i) => html`<div class="b" style="--i:${i}">
            <span>${FC.CATEGORIAS_CUSTO[k]}</span><span class="t"><i style="width:${(v / maxCusto) * 100}%;--i:${i}"></i></span><span class="v rs">${fmt.brlTexto(v, 0)}</span></div>`)}</div>
            <p class="texto-p mt2">${ag.total ? html`Custo acumulado por cabeça no rebanho atual: <b class="rs">${fmt.brlTexto(fin.custos / ag.total, 0)}</b>` : ""}</p></div></div>` : ""}
        ${ag.gmd.length ? html`<div><div class="secao-topo"><h2>Ganho de peso</h2><span class="sub">GMD por lote</span></div>
          <div class="lista">${ag.gmd.map((g) => html`<div class="item">
            <div class="principal"><div class="titulo">${g.nome}</div><div class="detalhe">${fmt.num(g.peso_ini, 0)} → ${fmt.num(g.peso_fim, 0)} kg em ${g.dias} dias · ${g.pesagens} pesagens</div></div>
            <div class="valores"><b class="${g.gmd >= 0 ? "pos" : "neg"}">${fmt.num(g.gmd, 3)} kg/dia</b><small>${fmt.num(g.arrobas_mes, 2)} @/mês</small></div></div>`)}</div></div>` : ""}
        ${fazendas.length > 1 ? html`<div><div class="secao-topo"><h2>Por fazenda</h2></div>
          <div class="lista">${fazendas.map(([f, n]) => html`<div class="item"><div class="principal"><div class="titulo">${f}</div>
            <div class="detalhe">${Object.entries(ag.porFazenda[f]).filter(([, x]) => x > 0).map(([c, x]) => `${x} ${FC.CATEGORIAS_GADO[c].toLowerCase()}`).join(" · ")}</div></div>
            <div class="valores"><b>${fmt.int(n)}</b><small>cabeças</small></div></div>`)}</div></div>` : ""}
      </div>
      `}

      <section class="secao" id="area-hist">${historico()}</section>
    `);

    FC.$("#bt-novo", raiz).addEventListener("click", escolher);
    FC.$("#bt-cotacao", raiz).addEventListener("click", formCotacao);
    FC.$("#chip-arroba", raiz).addEventListener("click", formCotacao);
    const ini = FC.$("[data-inicio-agro]", raiz);
    if (ini) ini.addEventListener("click", () => formMovimento("entrada"));

    function ligaHist() {
      const area = FC.$("#area-hist", raiz);
      const repinta = () => { area.innerHTML = String(historico()); FC.animar(area); ligaHist(); };
      FC.$$("#seg-hist button", area).forEach((b) => b.addEventListener("click", () => { aba = b.dataset.aba; setTimeout(repinta, 180); }));
      [["#fl-cat", "categoria"], ["#fl-faz", "fazenda"], ["#fl-ano", "ano"]].forEach(([sel, k]) => {
        const el = FC.$(sel, area);
        if (el) el.addEventListener("change", () => { filtro[k] = el.value; repinta(); });
      });
      const ag2 = FC.estado.base.agro;
      FC.$$("[data-mov]", area).forEach((x) => x.addEventListener("click", () => formMovimento(null, ag2.movs.find((m) => m.id === x.dataset.mov))));
      FC.$$("[data-custo]", area).forEach((x) => x.addEventListener("click", () => formCusto(ag2.custos.find((m) => m.id === x.dataset.custo))));
      FC.$$("[data-pes]", area).forEach((x) => x.addEventListener("click", () => formPesagem(ag2.pesagens.find((m) => m.id === x.dataset.pes))));
    }
    ligaHist();
  };
})();
