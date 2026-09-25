/* Salário: seus ganhos, o plano de investimento e o guia de cada mês. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let mesVisto = null;

  const nomeMes = (m) => { const t = new Date(m + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t[0].toUpperCase() + t.slice(1); };
  const somaMes = (m, n) => { let [a, mm] = m.split("-").map(Number); mm += n; while (mm > 12) { mm -= 12; a++; } while (mm < 1) { mm += 12; a--; } return `${a}-${String(mm).padStart(2, "0")}`; };

  // dividendos que caíram no mês (calculados pela posição; sem proventos
  // carregados, os que você lançou em Aportes)
  function dividendosDoMes(mes) {
    const e = FC.estado;
    if (e.proventos && e.dados) {
      const r = FC.dividendos.analisa(e.dados, e.base, e.proventos);
      return FC.soma(r.pagamentos.filter((p) => p.status === "pago" && p.quando.slice(0, 7) === mes), (p) => p.valor);
    }
    return FC.soma(e.base.aportes.filter((a) => a.tipo === "provento" && a.data.slice(0, 7) === mes), (a) => a.valor);
  }

  // ---------------------------------------------------------------- ganho
  function formGanho(item) {
    const novo = !item;
    item = item || { tipo: "recorrente", categoria: "salario", inicio: FC.datas.hoje().slice(0, 8) + "01", dia_regra: "dia_util", dia_numero: 5 };
    const f = FC.ui.folha({
      titulo: novo ? "Novo ganho" : "Editar ganho",
      corpo: html`<form class="form" id="f-ganho">
        <div class="segmentado" role="group" id="g-tipo" style="align-self:flex-start">
          <button type="button" data-t="recorrente" aria-pressed="${item.tipo === "recorrente"}">Todo mês</button>
          <button type="button" data-t="avulso" aria-pressed="${item.tipo === "avulso"}">Uma vez</button></div>
        <div class="linha2">
          <div class="campo"><label for="g-nome">Nome</label><input id="g-nome" name="nome" value="${item.nome || ""}" placeholder="Salário empresa X" maxlength="80" required></div>
          <div class="campo"><label for="g-cat">Categoria</label><select id="g-cat" name="categoria">
            ${Object.entries(FC.CATEGORIAS_GANHO).map(([k, v]) => html`<option value="${k}" ${item.categoria === k ? "selected" : ""}>${v}</option>`)}</select></div>
        </div>
        <div class="linha3">
          <div class="campo"><label for="g-valor">Valor líquido (R$)</label><input id="g-valor" name="valor" inputmode="decimal" value="${item.valor ? String(item.valor).replace(".", ",") : ""}" placeholder="0,00" required>
            <span class="dica">o que cai na conta</span></div>
          <div class="campo"><label for="g-inicio" id="g-rot-inicio">${item.tipo === "avulso" ? "Data" : "Desde"}</label><input id="g-inicio" name="inicio" type="date" value="${item.inicio}" required></div>
          <div class="campo" id="g-campo-fim" ${item.tipo === "avulso" ? "hidden" : ""}><label for="g-fim">Até (opcional)</label><input id="g-fim" name="fim" type="date" value="${item.fim || ""}">
            <span class="dica">vazio = continua</span></div>
        </div>
        <div class="linha2" id="g-quando" ${item.tipo === "avulso" ? "hidden" : ""}>
          <div class="campo"><label for="g-regra">Quando cai</label><select id="g-regra" name="dia_regra">
            <option value="dia_util" ${item.dia_regra === "dia_util" ? "selected" : ""}>Nº dia útil do mês</option>
            <option value="dia_fixo" ${item.dia_regra === "dia_fixo" ? "selected" : ""}>Dia fixo do mês</option>
            <option value="ultimo_dia_util" ${item.dia_regra === "ultimo_dia_util" ? "selected" : ""}>Último dia útil</option>
            <option value="" ${!item.dia_regra ? "selected" : ""}>Sem dia definido</option></select></div>
          <div class="campo" id="g-campo-dia"><label for="g-dia" id="g-rot-dia">Qual</label>
            <input id="g-dia" name="dia_numero" inputmode="numeric" value="${item.dia_numero ?? ""}" placeholder="5">
            <span class="dica" id="g-previa-dia"></span></div>
        </div>
        <div class="campo"><label for="g-obs">Observação</label><input id="g-obs" name="observacao" value="${item.observacao || ""}" maxlength="160"></div>
      </form>`,
      rodape: html`${novo ? "" : html`<button class="botao perigo" data-acao="apagar" style="margin-right:auto">${icone("lixo", 16)} Excluir</button>`}
        <button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Salvar</button>`,
    });
    const form = FC.$("#f-ganho", f.el);
    let tipo = item.tipo;
    // prévia das próximas datas pela regra escolhida (com feriados)
    const previaDia = () => {
      const regra = FC.$("#g-regra", form).value;
      const n = Math.round(FC.lerNum(FC.$("#g-dia", form).value) || 0);
      FC.$("#g-campo-dia", form).hidden = !regra || regra === "ultimo_dia_util";
      FC.$("#g-rot-dia", form).textContent = regra === "dia_fixo" ? "Dia do mês" : "Qual dia útil";
      const hoje = FC.datas.hoje();
      const meses = [hoje.slice(0, 7), FC.datas.soma(hoje.slice(0, 7) + "-28", 7).slice(0, 7), FC.datas.soma(hoje.slice(0, 7) + "-28", 38).slice(0, 7)];
      const g = { tipo: "recorrente", dia_regra: regra || null, dia_numero: n || 1 };
      const ds = meses.map((m) => FC.salario.dataRecebimento(g, m)).filter(Boolean);
      FC.$("#g-previa-dia", form).textContent = ds.length ? "cai em " + ds.map((d) => FC.datas.br(d).slice(0, 5)).join(", ") : "";
    };
    FC.$("#g-regra", form).addEventListener("change", previaDia);
    FC.$("#g-dia", form).addEventListener("input", previaDia);
    previaDia();
    FC.$$("#g-tipo button", form).forEach((b) => b.addEventListener("click", () => {
      tipo = b.dataset.t;
      FC.$("#g-campo-fim", form).hidden = tipo === "avulso";
      FC.$("#g-quando", form).hidden = tipo === "avulso";
      FC.$("#g-rot-inicio", form).textContent = tipo === "avulso" ? "Data" : "Desde";
    }));
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    const apagar = FC.$("[data-acao=apagar]", f.el);
    if (apagar) apagar.addEventListener("click", async () => {
      if (!(await FC.ui.confirma(`Excluir "${item.nome}"?`, { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("ganhos", item.id); f.fechar(); await C.depoisDeMudar("Ganho excluído"); } catch (e) { FC.ui.erro(e); }
    });
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = FC.dadosDoForm(form);
      const valor = FC.lerNum(d.valor);
      if (!d.nome) return FC.ui.aviso("Dê um nome ao ganho.", "erro");
      if (!(valor > 0)) return FC.ui.aviso("Informe o valor.", "erro");
      const regra = tipo === "recorrente" ? d.dia_regra || null : null;
      const num = Math.round(FC.lerNum(d.dia_numero) || 0);
      if (regra === "dia_util" && !(num >= 1 && num <= 23)) return FC.ui.aviso("O dia útil vai de 1 a 23.", "erro");
      if (regra === "dia_fixo" && !(num >= 1 && num <= 31)) return FC.ui.aviso("O dia do mês vai de 1 a 31.", "erro");
      const linha = { nome: d.nome, categoria: d.categoria, tipo, valor, inicio: d.inicio, fim: tipo === "recorrente" && d.fim ? d.fim : null, observacao: d.observacao || "",
        dia_regra: regra, dia_numero: regra === "dia_util" || regra === "dia_fixo" ? num : null };
      if (linha.fim && linha.fim < linha.inicio) return FC.ui.aviso("A data final vem antes da inicial.", "erro");
      try {
        await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => (novo ? FC.db.inserir("ganhos", linha) : FC.db.atualizar("ganhos", item.id, linha)));
        f.fechar();
        await C.depoisDeMudar(novo ? "Ganho adicionado" : "Ganho atualizado");
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- plano
  function opcoesAlvo(tipo, sel) {
    const b = FC.estado.base;
    if (tipo === "pilar") return FC.PILARES.map((p) => html`<option value="${p.chave}" ${sel === p.chave ? "selected" : ""}>${p.nome}</option>`);
    if (tipo === "ativo") {
      const lista = [...new Set(b.ativos.map((a) => a.ticker))].sort();
      if (sel && !lista.includes(sel)) lista.unshift(sel);
      return lista.length ? lista.map((t) => html`<option value="${t}" ${sel === t ? "selected" : ""}>${t}</option>`) : html`<option value="">cadastre um ativo primeiro</option>`;
    }
    const lista = b.rendaFixa.map((r) => r.nome);
    if (sel && !lista.includes(sel)) lista.unshift(sel);
    return lista.length ? lista.map((t) => html`<option value="${t}" ${sel === t ? "selected" : ""}>${t}</option>`) : html`<option value="">cadastre um título primeiro</option>`;
  }

  function linhaDestino(d, i) {
    return html`<div class="item" data-dest="${i}" style="gap:10px;flex-wrap:wrap">
      <select class="entrada" data-campo="tipo" style="max-width:150px;min-height:38px;font-size:14px" aria-label="Tipo de destino">
        <option value="pilar" ${d.tipo === "pilar" ? "selected" : ""}>Pilar</option>
        <option value="ativo" ${d.tipo === "ativo" ? "selected" : ""}>Ativo</option>
        <option value="renda_fixa" ${d.tipo === "renda_fixa" ? "selected" : ""}>Renda fixa</option></select>
      <select class="entrada cresce" data-campo="alvo" style="min-height:38px;font-size:14px;min-width:140px" aria-label="Destino">${opcoesAlvo(d.tipo, d.alvo)}</select>
      <div class="flex" style="gap:6px"><input class="entrada" data-campo="pct" inputmode="decimal" value="${d.pct ?? ""}" style="width:80px;min-height:38px;font-size:14px;text-align:right" aria-label="Percentual"><span class="fraco">%</span></div>
      <button type="button" class="icone-bt" data-remove="${i}" aria-label="Remover destino">${icone("lixo", 16)}</button>
    </div>`;
  }

  function cartaoPlano(plano, rendaFixa) {
    return html`<form class="cartao" id="f-plano">
      <div class="flex entre quebra mb2"><h3>Seu plano</h3>
        <div class="segmentado" role="group" id="pl-modo">
          <button type="button" data-m="percentual" aria-pressed="${plano.modo !== "valor"}">% da renda</button>
          <button type="button" data-m="valor" aria-pressed="${plano.modo === "valor"}">Valor fixo</button></div></div>
      <div class="linha2 form">
        <div class="campo" id="pl-campo-pct" ${plano.modo === "valor" ? "hidden" : ""}><label for="pl-pct">Investir (% da renda do mês)</label>
          <input id="pl-pct" inputmode="decimal" value="${plano.percentual}"><span class="dica" id="pl-dica-pct"></span></div>
        <div class="campo" id="pl-campo-valor" ${plano.modo === "valor" ? "" : "hidden"}><label for="pl-valor">Investir por mês (R$)</label>
          <input id="pl-valor" inputmode="decimal" value="${String(plano.valor).replace(".", ",")}"></div>
        <label class="check" style="align-self:end"><span class="interruptor"><input type="checkbox" id="pl-reinv" ${plano.reinvestir_dividendos ? "checked" : ""}><span></span></span>Reinvestir os dividendos do mês</label>
      </div>
      <p class="rot fraco mt3 mb2" style="font-size:13px;font-weight:500">Para onde vai o dinheiro</p>
      <div class="lista" id="pl-destinos" style="box-shadow:none">${plano.destinos.map(linhaDestino)}</div>
      <div class="flex entre quebra mt2">
        <button type="button" class="botao texto pequeno" id="pl-add">${icone("aportes", 15)} Destino</button>
        <span id="pl-soma" class="fraco"></span>
        <button class="botao" type="submit">Salvar plano</button></div>
      <p class="texto-p mt2">Os destinos podem ser um pilar inteiro (ex.: 25% em Real Estate) ou um ativo/título específico (ex.: 40% em BTC). A projeção usa este plano para simular os próximos anos, com a renda fixa mensal de ${fmt.brl(rendaFixa)}.</p>
    </form>`;
  }

  // ---------------------------------------------------------------- tela
  FC.telas.salario = async function (raiz) {
    const b = FC.estado.base;
    const plano = JSON.parse(JSON.stringify(FC.estado.prefs.plano));
    const hoje = FC.datas.hoje().slice(0, 7);
    mesVisto = mesVisto || hoje;
    if (!FC.estado.proventos && FC.estado.mercado.universo) FC.carregaProventos().then(() => { if (location.hash.startsWith("#/salario")) FC.rerender({ suave: true, semAnimacao: true }); });

    const ganhos = b.ganhos || [];
    const guia = FC.salario.planoDoMes({ plano, ganhos, base: b, mes: mesVisto, dividendosDoMes: dividendosDoMes(mesVisto) });
    const renda = guia.renda;
    const meses = FC.salario.mesesAte(hoje, 6);
    const historico = meses.map((m) => {
      const g = FC.salario.planoDoMes({ plano, ganhos, base: b, mes: m, dividendosDoMes: 0 });
      // tudo o que entrou em investimentos no mês, com ou sem plano
      const inv = FC.soma(b.aportes.filter((a) => a.data.slice(0, 7) === m && (a.tipo === "ativo" || (a.tipo === "caixa" && !a.historico))), (a) => a.valor)
        + FC.soma(b.agro.movs.filter((x) => x.data.slice(0, 7) === m && x.tipo === "compra"), (x) => x.valor_total + x.despesas);
      return { mes: m, renda: g.renda.total, meta: g.valor_base, investido: inv };
    });
    const fixos = ganhos.filter((g) => g.tipo === "recorrente").sort((x, y) => (x.fim ? 1 : 0) - (y.fim ? 1 : 0) || y.valor - x.valor);
    const avulsos = ganhos.filter((g) => g.tipo === "avulso").sort((x, y) => y.inicio.localeCompare(x.inicio)).slice(0, 24);
    const ativoHoje = (g) => FC.salario.valeNoMes(g, hoje);
    const proximos = FC.salario.proximos(ganhos, FC.datas.hoje(), 2);
    const recebimentosDoMes = renda.itens.map((g) => ({ g, data: FC.salario.dataRecebimento(g, mesVisto) })).sort((x, y) => (x.data || "9").localeCompare(y.data || "9"));

    raiz.innerHTML = String(html`
      ${C.cabecalho("Salário", "Seus ganhos e o plano de investimento de cada mês.",
        html`<button class="botao" id="bt-ganho">${icone("aportes", 18)} Ganho</button>`)}

      <div class="flex entre quebra mb2">
        <div class="flex" style="gap:6px">
          <button class="icone-bt" id="mes-ant" aria-label="Mês anterior">${icone("voltar", 18)}</button>
          <b style="font-size:17px;min-width:150px;text-align:center">${nomeMes(mesVisto)}</b>
          <button class="icone-bt" id="mes-prox" aria-label="Próximo mês" ${mesVisto >= somaMes(hoje, 1) ? "disabled" : ""}>${icone("chevron", 18)}</button>
        </div>
        ${mesVisto !== hoje ? html`<button class="botao texto pequeno" id="mes-hoje">Voltar para este mês</button>` : ""}
      </div>

      <div class="cartao heroi">
        <p class="rotulo">Renda de ${nomeMes(mesVisto).split(" de ")[0].toLowerCase()}</p>
        <p class="valor"><span class="rs" data-conta="${renda.total}">${fmt.brlTexto(renda.total)}</span></p>
        <div class="chips">
          ${renda.fixa ? html`<span class="chip">Fixa <b class="rs">${fmt.brlTexto(renda.fixa)}</b></span>` : ""}
          ${renda.avulsa ? html`<span class="chip">Extra <b class="rs">${fmt.brlTexto(renda.avulsa)}</b></span>` : ""}
          <span class="chip"><span class="ponto" style="background:var(--s1)"></span>Investir <b class="rs">${fmt.brlTexto(guia.total)}</b>${plano.modo !== "valor" ? ` (${fmt.num(plano.percentual, 0)}%${guia.dividendos ? " + dividendos" : ""})` : ""}</span>
          <span class="chip">Sobra para gastar <b class="rs">${fmt.brlTexto(Math.max(0, guia.sobra_renda))}</b></span>
        </div>
        ${recebimentosDoMes.some((x) => x.data) ? html`<div class="flex quebra mt3" style="gap:8px">${recebimentosDoMes.map((x) => html`<span class="chip" style="background:var(--bg-3)">
          ${icone("carteira", 14)} ${x.g.nome} <b>${x.data ? FC.datas.br(x.data).slice(0, 5) : "no mês"}</b>${x.data && x.data < FC.datas.hoje() ? " ✓" : ""}</span>`)}</div>` : ""}
      </div>
      ${proximos.length && mesVisto === hoje ? (() => {
        const p = proximos[0];
        const dias = FC.datas.dias(FC.datas.hoje(), p.data);
        return html`<div class="mensagem info mt2">${icone("carteira", 18)}<span>Próximo recebimento: <b>${p.ganho.nome}</b> de <b class="rs">${fmt.brlTexto(p.valor)}</b> em <b>${FC.datas.br(p.data)}</b>
          (${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}${FC.salario.descreveRegra(p.ganho) ? ", " + FC.salario.descreveRegra(p.ganho) : ""}).</span></div>`;
      })() : ""}

      <section class="secao">
        <div class="secao-topo"><h2>Guia do mês</h2><span class="sub">o que o plano manda aportar e quanto já foi</span></div>
        ${!plano.destinos.length ? html`<div class="lista">${C.vazio("🧭", "Monte o seu plano", "Diga quanto da renda quer investir e para onde vai cada parte. Todo mês esta seção mostra o valor de cada aporte e o que falta.")}</div>`
        : !renda.total && plano.modo !== "valor" ? html`<div class="mensagem info">${icone("info", 18)}<span>Cadastre seus ganhos para o plano calcular quanto investir em ${nomeMes(mesVisto)}.</span></div>`
        : html`<div class="cartao">
          <dl class="kpis mb3">
            <div class="kpi"><dt>Investir no mês</dt><dd>${fmt.brl(guia.total)}${guia.dividendos ? html`<small>inclui ${fmt.brl(guia.dividendos)} de dividendos para reinvestir</small>` : ""}</dd></div>
            <div class="kpi"><dt>Já aportado</dt><dd class="${guia.aportado >= guia.total - 0.5 ? "pos" : ""}">${fmt.brl(guia.aportado)}</dd></div>
            <div class="kpi"><dt>Falta</dt><dd>${fmt.brl(guia.falta)}</dd></div>
          </dl>
          <div class="lista" style="box-shadow:none">${guia.destinos.map((d, i) => html`<div class="item" style="flex-wrap:wrap">
            <div class="principal" style="min-width:180px"><div class="titulo">${d.rotulo} <span class="fraco" style="font-weight:400;font-size:13px">${fmt.num(d.pct, 0)}%</span>
              ${d.feito >= 99.5 ? FC.pilula("verde", "feito") : ""}</div>
              <div class="trilha mt1" style="max-width:320px"><i style="width:${d.feito}%;background:${d.feito >= 99.5 ? "var(--verde)" : "var(--acento)"}"></i></div></div>
            <div class="valores"><b class="rs">${fmt.brlTexto(d.aportado)} de ${fmt.brlTexto(d.valor)}</b><small>${d.falta > 0.5 ? html`falta <span class="rs">${fmt.brlTexto(d.falta)}</span>` : "completo"}</small></div>
            ${d.falta > 0.5 && d.tipo !== "pilar" && mesVisto === hoje ? html`<button class="botao pequeno" data-aportar="${i}">Aportar</button>`
              : d.falta > 0.5 && mesVisto === hoje ? html`<a class="botao sec pequeno" href="#/aportes">Aportar</a>` : ""}
          </div>`)}</div>
          ${guia.soma_pct && Math.abs(guia.soma_pct - 100) > 0.5 ? html`<p class="texto-p mt2 neg">Os destinos somam ${fmt.num(guia.soma_pct, 0)}% — o valor foi dividido proporcionalmente.</p>` : ""}
        </div>`}
      </section>

      <section class="secao">${cartaoPlano(plano, FC.salario.rendaDoMes(ganhos, hoje).fixa)}</section>

      <section class="secao">
        <div class="secao-topo"><h2>Últimos 6 meses</h2><span class="sub">quanto entrou e quanto virou investimento</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>Mês</th><th class="n">Renda</th><th class="n">Meta do plano</th><th class="n">Investido</th><th class="n">% da renda</th><th></th></tr></thead>
          <tbody>${[...historico].reverse().map((h) => html`<tr>
            <td>${nomeMes(h.mes)}</td>
            <td class="n rs">${fmt.brlTexto(h.renda)}</td>
            <td class="n rs">${h.meta ? fmt.brlTexto(h.meta) : "—"}</td>
            <td class="n rs">${fmt.brlTexto(h.investido)}</td>
            <td class="n">${h.renda ? fmt.num((h.investido / h.renda) * 100, 0) + "%" : "—"}</td>
            <td>${h.meta ? (h.investido >= h.meta - 0.5 ? FC.pilula("verde", "meta cumprida") : FC.pilula(h.mes === hoje ? "cinza" : "amarelo", h.mes === hoje ? "em andamento" : "abaixo da meta")) : ""}</td></tr>`)}</tbody></table></div>
      </section>

      <section class="secao">
        <div class="secao-topo"><h2>Ganhos</h2><span class="sub">fixos valem todo mês; extras, só no mês em que caem</span></div>
        <div class="grade g2">
          <div><p class="rot fraco mb2" style="font-size:13px;font-weight:500">Todo mês</p>
            <div class="lista">${fixos.length ? fixos.map((g) => html`<div class="item clicavel" data-ganho="${g.id}">
              <div class="principal"><div class="titulo">${g.nome} ${ativoHoje(g) ? "" : FC.pilula("cinza", "encerrado")}</div>
                <div class="detalhe">${FC.salario.descreveRegra(g) ? FC.salario.descreveRegra(g) + (FC.salario.valeNoMes(g, mesVisto) ? " · " + FC.datas.br(FC.salario.dataRecebimento(g, mesVisto)).slice(0, 5) : "") + " · " : ""}${FC.CATEGORIAS_GANHO[g.categoria]} · desde ${FC.datas.mesAno(g.inicio)}${g.fim ? " até " + FC.datas.mesAno(g.fim) : ""}</div></div>
              <div class="valores"><b class="rs">${fmt.brlTexto(g.valor)}</b><small>por mês</small></div><span class="chevron">${icone("chevron", 18)}</span></div>`)
              : C.vazio("💼", "Nenhum ganho fixo", "Salário, pró-labore, aluguel — o que entra todo mês.")}</div></div>
          <div><p class="rot fraco mb2" style="font-size:13px;font-weight:500">Extras</p>
            <div class="lista">${avulsos.length ? avulsos.map((g) => html`<div class="item clicavel" data-ganho="${g.id}">
              <div class="principal"><div class="titulo">${g.nome}</div><div class="detalhe">${FC.CATEGORIAS_GANHO[g.categoria]} · ${FC.datas.br(g.inicio)}</div></div>
              <div class="valores"><b class="rs">${fmt.brlTexto(g.valor)}</b></div><span class="chevron">${icone("chevron", 18)}</span></div>`)
              : C.vazio("🎁", "Nenhum extra", "Bônus, 13º, férias, freelas.")}</div></div>
        </div>
      </section>
    `);

    // ---- navegação de mês
    FC.$("#mes-ant", raiz).addEventListener("click", () => { mesVisto = somaMes(mesVisto, -1); FC.rerender({ suave: true, semAnimacao: true }); });
    FC.$("#mes-prox", raiz).addEventListener("click", () => { mesVisto = somaMes(mesVisto, 1); FC.rerender({ suave: true, semAnimacao: true }); });
    const mh = FC.$("#mes-hoje", raiz); if (mh) mh.addEventListener("click", () => { mesVisto = hoje; FC.rerender({ suave: true, semAnimacao: true }); });

    // ---- ganhos
    FC.$("#bt-ganho", raiz).addEventListener("click", () => formGanho());
    FC.$$("[data-ganho]", raiz).forEach((el) => el.addEventListener("click", () => formGanho(ganhos.find((g) => g.id === el.dataset.ganho))));

    // ---- guia: aportar o que falta
    FC.$$("[data-aportar]", raiz).forEach((bt) => bt.addEventListener("click", () => {
      const d = guia.destinos[Number(bt.dataset.aportar)];
      FC.aportarRapido({ tipo: d.tipo === "ativo" ? "ativo" : "caixa", nome: d.alvo, valor: d.falta });
    }));

    // ---- plano
    const form = FC.$("#f-plano", raiz);
    const lista = FC.$("#pl-destinos", form);
    const lerDestinos = () => FC.$$("[data-dest]", lista).map((row) => ({
      tipo: FC.$("[data-campo=tipo]", row).value, alvo: FC.$("[data-campo=alvo]", row).value, pct: FC.lerNum(FC.$("[data-campo=pct]", row).value) || 0 }));
    const atualizaSoma = () => {
      const s = FC.soma(lerDestinos(), (d) => d.pct);
      const el = FC.$("#pl-soma", form);
      el.textContent = `Soma: ${fmt.num(s, 0)}%`;
      el.className = Math.abs(s - 100) < 0.5 ? "pos" : "neg";
      const r = FC.salario.rendaDoMes(ganhos, hoje);
      const pct = FC.lerNum(FC.$("#pl-pct", form).value) || 0;
      FC.$("#pl-dica-pct", form).textContent = r.total ? `= ${fmt.brlTexto((r.total * pct) / 100)} este mês` : "";
    };
    const redesenhaDestinos = (ds) => { lista.innerHTML = String(html`${ds.map(linhaDestino)}`); ligaDestinos(); atualizaSoma(); };
    function ligaDestinos() {
      FC.$$("[data-dest]", lista).forEach((row) => {
        FC.$("[data-campo=tipo]", row).addEventListener("change", () => {
          const ds = lerDestinos(); ds[Number(row.dataset.dest)].alvo = null; redesenhaDestinos(ds);
        });
      });
      FC.$$("[data-remove]", lista).forEach((bt) => bt.addEventListener("click", () => {
        const ds = lerDestinos(); ds.splice(Number(bt.dataset.remove), 1); redesenhaDestinos(ds);
      }));
    }
    ligaDestinos();
    form.addEventListener("input", atualizaSoma);
    atualizaSoma();
    let modo = plano.modo;
    FC.$$("#pl-modo button", form).forEach((bt) => bt.addEventListener("click", () => {
      modo = bt.dataset.m;
      FC.$("#pl-campo-pct", form).hidden = modo === "valor";
      FC.$("#pl-campo-valor", form).hidden = modo !== "valor";
    }));
    FC.$("#pl-add", form).addEventListener("click", () => {
      const ds = lerDestinos();
      const usados = new Set(ds.filter((d) => d.tipo === "pilar").map((d) => d.alvo));
      const livre = FC.PILARES.find((p) => !usados.has(p.chave));
      ds.push({ tipo: "pilar", alvo: livre ? livre.chave : "acoes", pct: Math.max(0, 100 - FC.soma(ds, (d) => d.pct)) });
      redesenhaDestinos(ds);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const destinos = lerDestinos().filter((d) => d.alvo && d.pct > 0);
      const soma = FC.soma(destinos, (d) => d.pct);
      if (destinos.length && Math.abs(soma - 100) > 0.5) return FC.ui.aviso(`Os destinos somam ${fmt.num(soma, 0)}% — ajuste para 100%.`, "erro");
      const novo = { modo, percentual: FC.lerNum(FC.$("#pl-pct", form).value) || 0, valor: FC.lerNum(FC.$("#pl-valor", form).value) || 0,
        reinvestir_dividendos: FC.$("#pl-reinv", form).checked, destinos };
      try {
        await FC.ui.ocupado(FC.$("button[type=submit]", form), () => FC.db.gravaPrefs({ plano: novo }));
        await C.depoisDeMudar("Plano salvo — as projeções já usam ele");
      } catch (err) { FC.ui.erro(err); }
    });
  };
})();
