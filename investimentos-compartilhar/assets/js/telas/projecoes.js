/* Projeções: a aritmética das premissas, em moeda de hoje. Mexer num
 * campo recalcula na hora; "Salvar como padrão" grava no Supabase. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;
  let rascunho = null;

  const campo = (id, rot, valor, dica, attrs = "") => html`<div class="campo"><label for="${id}">${rot}</label>
    <input id="${id}" name="${id}" inputmode="decimal" value="${valor ?? ""}" ${FC.cru(attrs)}>${dica ? html`<span class="dica">${dica}</span>` : ""}</div>`;

  function premissasDoForm(form, base) {
    const d = FC.dadosDoForm(form);
    const n = (k) => FC.lerNum(d[k]);
    return FC.mescla(base, {
      usar_plano: !!d.usar_plano,
      aporte_mensal: n("aporte_mensal") ?? base.aporte_mensal,
      horizonte_anos: Math.max(1, Math.min(60, Math.round(n("horizonte_anos") || base.horizonte_anos))),
      distribuicao_aporte: d.distribuicao_aporte,
      reinvestir_proventos: !!d.reinvestir_proventos,
      valorizacao_real_anual: Object.fromEntries(FC.PILARES.filter((p) => p.chave !== "caixa").map((p) => [p.chave, n("val_" + p.chave) ?? 0])),
      cenarios: { pessimista: n("cen_pessimista") ?? -4, otimista: n("cen_otimista") ?? 3 },
      macro_longo_prazo: { cdi: n("cdi_lp"), ipca: n("ipca_lp") },
    });
  }

  function resultado(p) {
    const b = p.base;
    const colocou = b.inicial + b.aportado;
    return html`
      ${p.alerta_caixa ? html`<div class="mensagem alerta mt3">${icone("alerta", 18)}<span><b>A premissa macro está conduzindo a projeção.</b>
        Com CDI de ${fmt.num(p.macro_lp.cdi)}% e IPCA de ${fmt.num(p.macro_lp.ipca)}%, o caixa rende ${fmt.num(p.caixa_real)}% real ao ano — mais que a renda variável nas suas premissas.
        Projetar juro real de ${fmt.num(p.macro_lp.juro_real)}% por ${p.premissas.horizonte_anos} anos empurra tudo para a renda fixa. Teste um cenário de longo prazo nos campos de CDI e IPCA.</span></div>` : ""}
      <section class="secao">
        <div class="secao-topo"><h2>Patrimônio projetado</h2><span class="sub">linha cheia é o cenário base; a faixa vai do pessimista ao otimista</span></div>
        <div class="cartao">
          <dl class="kpis mb3">
            <div class="kpi"><dt>Hoje</dt><dd>${fmt.brl(b.inicial, 0)}</dd></div>
            <div class="kpi"><dt>Em ${p.premissas.horizonte_anos} anos</dt><dd>${fmt.brl(b.final, 0)}<small>entre ${fmt.brl(p.pessimista.final, 0)} e ${fmt.brl(p.otimista.final, 0)}</small></dd></div>
            <div class="kpi"><dt>Você coloca</dt><dd>${fmt.brl(colocou, 0)}<small>o que tem hoje + os aportes</small></dd></div>
            <div class="kpi"><dt>Multiplicador</dt><dd>${colocou ? fmt.num(b.final / colocou, 1) + "×" : "—"}<small>sobre o dinheiro que você colocou</small></dd></div>
          </dl>
          ${FC.graficos.linhas({ series: [{ nome: "Cenário base", pontos: [[0, b.inicial], ...b.patrimonio], classe: "l1" },
            { nome: "Pessimista", pontos: [[0, b.inicial], ...p.pessimista.patrimonio], classe: "lref2" },
            { nome: "Otimista", pontos: [[0, b.inicial], ...p.otimista.patrimonio], classe: "lref2" }],
            banda: { inf: [[0, b.inicial], ...p.pessimista.patrimonio], sup: [[0, b.inicial], ...p.otimista.patrimonio] }, x: "anos", altura: 300 })}
          <div class="legenda-g"><span><i class="k1"></i>cenário base</span><span><i class="kbanda"></i>entre pessimista e otimista</span></div>
        </div>
      </section>
      <div class="grade g2 secao">
        <div class="cartao"><h3>Renda de proventos</h3><p class="sub mb2">quanto a carteira deposita por mês, pelo DY que os seus ativos pagaram nos últimos 12 meses</p>
          <dl class="kpis mb2"><div class="kpi pequeno"><dt>Hoje</dt><dd>${fmt.brl(b.renda_mensal_hoje)}<small>por mês</small></dd></div>
            <div class="kpi pequeno"><dt>Em ${p.premissas.horizonte_anos} anos</dt><dd>${fmt.brl(b.renda_mensal_final)}<small>por mês, em poder de compra de hoje</small></dd></div></dl>
          ${FC.graficos.linhas({ series: [{ nome: "Provento mensal", pontos: b.renda, classe: "l2", area: false }], x: "anos", altura: 200 })}</div>
        <div class="cartao"><h3>De onde vem o patrimônio</h3><p class="sub mb2">só a valorização depende de premissa; aportes são decisão sua e proventos vêm de dado observado</p>
          ${FC.graficos.composicao([{ valor: b.inicial, cor: "var(--sref)" }, { valor: b.aportado, cor: "var(--s1)" }, { valor: p.premissas.reinvestir_proventos ? b.proventos : 0, cor: "var(--s2)" }, { valor: b.valorizacao, cor: "var(--s3)" }])}
          <dl class="kpis mt3">
            <div class="kpi pequeno"><dt><i class="ponto-e" style="background:var(--sref)"></i> Hoje</dt><dd>${fmt.brl(b.inicial, 0)}</dd></div>
            <div class="kpi pequeno"><dt><i class="ponto-e" style="background:var(--s1)"></i> Aportes</dt><dd>${fmt.brl(b.aportado, 0)}</dd></div>
            <div class="kpi pequeno"><dt><i class="ponto-e" style="background:var(--s2)"></i> Proventos</dt><dd>${fmt.brl(b.proventos, 0)}</dd></div>
            <div class="kpi pequeno"><dt><i class="ponto-e" style="background:var(--s3)"></i> Valorização</dt><dd>${fmt.brl(b.valorizacao, 0)}</dd></div></dl></div>
      </div>
      <section class="secao">
        <div class="secao-topo"><h2>Premissas por pilar</h2><span class="sub">o retorno total é o número que você precisa achar plausível</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela"><thead><tr><th>Pilar</th><th class="n">Valor hoje</th><th class="n">Proventos</th><th class="n">Valorização real</th><th class="n">Retorno total real</th><th class="esconde-mob">Origem</th></tr></thead>
          <tbody>${p.pilares.map((l) => html`<tr><td><b>${l.nome}</b></td><td class="n">${fmt.brl(l.valor, 0)}</td><td class="n">${ok(l.dy) ? fmt.num(l.dy) + "%" : "—"}</td>
            <td class="n">${ok(l.valorizacao) ? fmt.num(l.valorizacao) + "%" : "—"}</td><td class="n"><b>${fmt.num(l.total)}%</b></td>
            <td class="fraco esconde-mob" style="font-size:13px">${l.chave === "caixa" ? "taxa contratada de cada título" : l.chave === "agro" ? "sua premissa de valorização do rebanho" : "DY observado + sua premissa"}</td></tr>`)}</tbody></table></div>
      </section>
      ${p.titulos_caixa.length ? html`<section class="secao"><div class="secao-topo"><h2>Renda fixa contratada</h2><span class="sub">a parte que não depende de premissa de mercado</span></div>
        <div class="lista">${p.titulos_caixa.map((t) => html`<div class="item"><div class="principal"><div class="titulo">${t.nome}</div><div class="detalhe">nominal ${fmt.num(t.nominal)}% a.a.</div></div>
          <div class="valores"><b>${fmt.num(t.real)}% real</b><small>${fmt.brl(t.valor, 0)}</small></div></div>`)}</div></section>` : ""}`;
  }

  FC.telas.projecoes = async function (raiz) {
    const prefs = FC.estado.prefs;
    const d = FC.estado.dados;
    const pp = FC.salario.paraProjecao(prefs.plano, FC.estado.base.ganhos || [], FC.estado.base);
    const temPlano = !!(pp && pp.aporte_mensal > 0);
    // o plano vale por padrão; só fica de fora se você desligar e salvar
    const prem = { ...(rascunho || prefs.premissas) };
    if (prem.usar_plano == null) prem.usar_plano = temPlano;
    if (!rascunho && !prefs.premissas_salvas) prem.reinvestir_proventos = prefs.plano.reinvestir_dividendos !== false;
    const usando = temPlano && prem.usar_plano;
    const dadosProj = { ...d, plano_projecao: pp };
    const m = d.macro;

    raiz.innerHTML = String(html`
      ${C.cabecalho("Projeções", "Projeção não é previsão: é a aritmética das premissas, em moeda de hoje.")}
      <form class="cartao" id="f-prem">
        ${temPlano ? html`<label class="check mb2" style="min-height:0"><span class="interruptor"><input type="checkbox" name="usar_plano" id="usar-plano" ${usando ? "checked" : ""}><span></span></span>
          <span>Usar meu plano do <a href="#/salario">Salário</a>: <b class="rs">${fmt.brlTexto(pp.aporte_mensal)}</b> por mês, divididos como no plano</span></label>`
          : html`<p class="texto-p mb2">${icone("info", 14)} Monte um plano em <a href="#/salario">Salário</a> para a projeção usar a sua renda e a divisão dos aportes.</p>`}
        <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          ${campo("aporte_mensal", "Aporte mensal (R$)", usando ? Number(pp.aporte_mensal.toFixed(2)) : prem.aporte_mensal, usando ? "vem do plano" : "", usando ? "disabled" : "")}
          ${campo("horizonte_anos", "Horizonte (anos)", prem.horizonte_anos)}
          <div class="campo"><label for="distribuicao_aporte">Destino do aporte</label><select id="distribuicao_aporte" name="distribuicao_aporte" ${usando ? "disabled" : ""}>
            ${usando ? html`<option>Conforme o plano</option>` : html`
            <option value="rebalancear" ${prem.distribuicao_aporte === "rebalancear" ? "selected" : ""}>Pilar mais defasado</option>
            <option value="proporcional" ${prem.distribuicao_aporte === "proporcional" ? "selected" : ""}>Proporcional à meta</option>`}</select></div>
          <label class="check" style="align-self:end"><span class="interruptor"><input type="checkbox" name="reinvestir_proventos" ${prem.reinvestir_proventos ? "checked" : ""}><span></span></span>Reinvestir dividendos</label>
        </div>
        <p class="rot fraco mt3 mb2" style="font-size:13px;font-weight:500">Valorização real ao ano, sem contar proventos (%)</p>
        <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
          ${FC.PILARES.filter((p) => p.chave !== "caixa").map((p) => campo("val_" + p.chave, p.nome, (prem.valorizacao_real_anual || {})[p.chave] ?? 0))}
          ${campo("cen_pessimista", "Pessimista (p.p.)", prem.cenarios.pessimista)}
          ${campo("cen_otimista", "Otimista (p.p.)", prem.cenarios.otimista)}
        </div>
        <p class="rot fraco mt3 mb2" style="font-size:13px;font-weight:500">Cenário macro de longo prazo — em branco usa o de hoje</p>
        <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          ${campo("cdi_lp", "CDI (% a.a.)", prem.macro_longo_prazo.cdi, `hoje ${ok(m.cdi) ? fmt.num(m.cdi) : "—"}%`, `placeholder="${ok(m.cdi) ? fmt.num(m.cdi) : ""}"`)}
          ${campo("ipca_lp", "IPCA (% a.a.)", prem.macro_longo_prazo.ipca, `hoje ${ok(m.ipca_12m) ? fmt.num(m.ipca_12m) : "—"}%`, `placeholder="${ok(m.ipca_12m) ? fmt.num(m.ipca_12m) : ""}"`)}
        </div>
        <div class="flex entre quebra mt3">
          <span class="fraco" id="marca-sim" style="font-size:13px">${rascunho ? "Simulação não salva — os números usam os valores acima." : prefs.premissas_salvas ? "Usando as premissas que você salvou." : "Usando as premissas padrão."}</span>
          <div class="flex">${prefs.premissas_salvas ? html`<button class="botao texto" type="button" id="bt-restaurar">Voltar ao padrão</button>` : ""}
            <button class="botao" type="button" id="bt-salvar">Salvar como padrão</button></div>
        </div>
      </form>
      <div id="resultado">${resultado(FC.projecao.projeta(dadosProj, prem))}</div>
    `);

    const form = FC.$("#f-prem", raiz);
    let espera = null;
    form.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        rascunho = premissasDoForm(form, prefs.premissas);
        const alvo = FC.$("#resultado", raiz);
        alvo.innerHTML = String(resultado(FC.projecao.projeta(dadosProj, rascunho)));
        FC.$("#marca-sim", raiz).textContent = "Simulação não salva — os números usam os valores acima.";
        FC.animar(alvo);
      }, 350);
    });
    form.addEventListener("change", (e) => {
      // ligar/desligar o plano muda quais campos valem: redesenha a tela
      if (e.target.id === "usar-plano") { rascunho = premissasDoForm(form, prefs.premissas); return FC.rerender({ suave: true, semAnimacao: true }); }
      form.dispatchEvent(new Event("input"));
    });
    FC.$("#bt-salvar", raiz).addEventListener("click", async (e) => {
      const p = premissasDoForm(form, prefs.premissas);
      try {
        await FC.ui.ocupado(e.currentTarget, () => FC.db.gravaPrefs({ premissas: p }));
        rascunho = null;
        await C.depoisDeMudar("Premissas salvas");
      } catch (err) { FC.ui.erro(err); }
    });
    const rest = FC.$("#bt-restaurar", raiz);
    if (rest) rest.addEventListener("click", async () => {
      try { await FC.db.gravaPrefs({ premissas: null }); rascunho = null; await C.depoisDeMudar("Premissas padrão restauradas"); } catch (err) { FC.ui.erro(err); }
    });
  };
})();
