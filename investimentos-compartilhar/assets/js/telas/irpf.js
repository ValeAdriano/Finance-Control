/* Imposto de renda: o rascunho da declaração de um ano (Bens e Direitos,
 * rendimentos, vendas e DARF) e quanto sobraria resgatando tudo hoje. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone, fmt } = FC;

  let anoSel = null;                    // fica escolhido enquanto o app está aberto
  const NOME_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const nomeMes = (m) => `${NOME_MES[Number(m.slice(5, 7)) - 1]}`;
  const brl = (v) => fmt.brl(v);

  // anos com algum lançamento, do primeiro até o atual
  function anosPossiveis(base) {
    const atual = Number(FC.datas.hoje().slice(0, 4));
    let ini = atual - 1;
    const datas = [
      ...(base.aportes || []).map((a) => a.data),
      ...(base.ativos || []).map((a) => a.data_base || String(a.criado_em || "").slice(0, 10)),
      ...(base.rendaFixa || []).map((t) => t.data_inicio || String(t.criado_em || "").slice(0, 10)),
    ].filter((d) => /^\d{4}/.test(d || ""));
    for (const d of datas) ini = Math.min(ini, Number(d.slice(0, 4)));
    const anos = [];
    for (let a = atual; a >= Math.max(ini, atual - 15); a--) anos.push(a);
    return anos;
  }

  // ---------------------------------------------------------------- CSV
  const n2 = (v) => (FC.ok(v) ? v.toFixed(2).replace(".", ",") : "");
  const cel = (v) => { const s = String(v == null ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function csv(r) {
    const L = [];
    const linha = (...c) => L.push(c.map(cel).join(";"));
    linha(`Imposto de renda ${r.ano + 1} (ano-calendário ${r.ano}) — estimativa para conferência`);
    linha("");
    linha("BENS E DIREITOS");
    linha("Grupo", "Código", "Nome", "Discriminação", `31/12/${r.ano - 1}`, `31/12/${r.ano}`);
    for (const b of r.bens) linha(b.grupo, b.codigo, b.nome, b.discriminacao, n2(b.anterior), n2(b.atual));
    linha("");
    linha("RENDIMENTOS ISENTOS");
    linha("Código", "Fonte", "Tipo", "Valor");
    for (const x of r.rendimentos.isentos) linha(x.ficha.codigo, x.ticker, x.tipo, n2(x.liquido));
    linha("");
    linha("TRIBUTAÇÃO EXCLUSIVA (JCP líquido)");
    linha("Código", "Fonte", "Bruto", "IR na fonte", "Líquido");
    for (const x of r.rendimentos.exclusiva) linha(x.ficha.codigo, x.ticker, n2(x.bruto), n2(x.ir_fonte), n2(x.liquido));
    if (r.rendimentos.exterior.length) {
      linha("");
      linha("DIVIDENDOS DO EXTERIOR");
      linha("Ativo", "Líquido recebido");
      for (const x of r.rendimentos.exterior) linha(x.ticker, n2(x.liquido));
    }
    linha("");
    linha("VENDAS");
    linha("Data", "Ativo", "Classe", "Quantidade", "Preço", "Total", "Preço médio", "Ganho");
    for (const v of r.vendas) linha(v.data, v.ticker, v.classe, String(v.quantidade).replace(".", ","), n2(v.preco), n2(v.total), n2(v.preco_medio), n2(v.ganho));
    linha("");
    linha("APURAÇÃO MENSAL");
    linha("Mês", "Vendas ações", "Ganho ações", "Ações isentas", "Ganho ETF", "Ganho FII", "Base 15%", "Base 20%", "DARF 6015", "IR cripto");
    for (const m of r.meses) linha(m.mes, n2(m.vendido_acoes), n2(m.ganho_acoes), m.isento_acoes ? "sim" : "não", n2(m.ganho_etf), n2(m.ganho_fii),
      n2(m.base_comum), n2(m.base_fii), n2(m.darf_6015), n2(m.ir_cripto));
    return "﻿" + L.join("\r\n");
  }

  async function copia(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      // sem permissão de área de transferência: o velho truque do textarea
      const t = document.createElement("textarea");
      t.value = texto; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } finally { t.remove(); }
    }
    FC.ui.aviso("Discriminação copiada");
  }

  // ---------------------------------------------------------------- blocos
  function tabelaBens(r) {
    if (!r.bens.length) return html`<div class="lista"><div class="vazio">Nenhum bem com posição em 31/12/${r.ano - 1} ou 31/12/${r.ano}.</div></div>`;
    return html`<div class="cartao sem-pad rolagem"><table class="tabela">
      <thead><tr><th>Código</th><th>Bem</th><th>Discriminação</th><th class="n">31/12/${r.ano - 1}</th><th class="n">31/12/${r.ano}</th><th></th></tr></thead>
      <tbody>${r.bens.map((b, i) => html`<tr>
        <td><b>${b.grupo}-${b.codigo}</b><span class="leg" title="${b.codigo_nome}">${b.codigo_incerto ? "conferir código" : b.tipo === "renda_fixa" ? (b.isento ? "isento" : "tributado") : ""}</span></td>
        <td><b>${b.nome}</b>${b.custo_parcial ? html`<span class="leg">${FC.pilula("amarelo", "custo incompleto")}</span>` : ""}</td>
        <td style="min-width:260px;max-width:440px;font-size:13px;color:var(--ink-2)">${b.discriminacao}</td>
        <td class="n"><span class="rs">${fmt.brlTexto(b.anterior)}</span></td>
        <td class="n"><b class="rs">${fmt.brlTexto(b.atual)}</b></td>
        <td><button class="botao texto pequeno" data-copia="${i}" title="Copiar a discriminação">Copiar</button></td>
      </tr>`)}</tbody>
      <tfoot><tr><td colspan="3"><b>Total</b></td><td class="n"><span class="rs">${fmt.brlTexto(r.totais.bens_anterior)}</span></td><td class="n"><b class="rs">${fmt.brlTexto(r.totais.bens_atual)}</b></td><td></td></tr></tfoot>
    </table></div>`;
  }

  function listaRend(itens, vazio, comIr) {
    if (!itens.length) return html`<div class="lista"><div class="vazio">${vazio}</div></div>`;
    return html`<div class="lista">${itens.map((x) => html`<div class="item">
      <div class="principal"><div class="titulo">${x.ticker} ${FC.pilula("cinza", "cód. " + x.ficha.codigo)}${x.estimado ? FC.pilula("amarelo", "estimado") : ""}</div>
        <div class="detalhe">${x.ficha.nome}${x.n > 1 ? ` · ${x.n} pagamentos` : ""}${comIr ? ` · bruto ${fmt.brlTexto(x.bruto)}, IR na fonte ${fmt.brlTexto(x.ir_fonte)}` : ""}</div></div>
      <div class="valores"><b class="rs">${fmt.brlTexto(x.liquido)}</b><small>${comIr ? "líquido" : x.tipo}</small></div>
    </div>`)}</div>`;
  }

  function tabelaMeses(r) {
    if (!r.meses.length) return html`<div class="lista"><div class="vazio">Nenhuma venda registrada em ${r.ano}.</div></div>`;
    return html`<div class="cartao sem-pad rolagem"><table class="tabela">
      <thead><tr><th>Mês</th><th class="n">Vendas de ações</th><th class="n">Ganho ações</th><th class="n">Ganho ETF</th><th class="n">Ganho FII</th><th class="n">Cripto vendida</th><th class="n">DARF</th></tr></thead>
      <tbody>${r.meses.map((m) => html`<tr>
        <td><b>${nomeMes(m.mes)}</b><span class="leg">${m.vendas.map((v) => v.ticker).filter((t, i, a) => a.indexOf(t) === i).join(", ")}</span></td>
        <td class="n"><span class="rs">${fmt.brlTexto(m.vendido_acoes)}</span><span class="leg">${m.vendido_acoes ? (m.isento_acoes ? "até R$ 20 mil: isento" : "passou de R$ 20 mil") : ""}</span></td>
        <td class="n ${m.ganho_acoes < 0 ? "neg" : ""}"><span class="rs">${fmt.brlTexto(m.ganho_acoes)}</span></td>
        <td class="n ${m.ganho_etf < 0 ? "neg" : ""}"><span class="rs">${m.vendido_etf ? fmt.brlTexto(m.ganho_etf) : "—"}</span></td>
        <td class="n ${m.ganho_fii < 0 ? "neg" : ""}"><span class="rs">${m.vendido_fii ? fmt.brlTexto(m.ganho_fii) : "—"}</span></td>
        <td class="n"><span class="rs">${m.vendido_cripto ? fmt.brlTexto(m.vendido_cripto) : "—"}</span>${m.ir_cripto ? html`<span class="leg rs">IR ${fmt.brlTexto(m.ir_cripto)}</span>` : m.vendido_cripto ? html`<span class="leg">até R$ 35 mil: isento</span>` : ""}</td>
        <td class="n">${m.darf_6015 > 0.005 ? html`<b class="rs">${fmt.brlTexto(m.darf_6015)}</b><span class="leg">${m.darf_6015 < 10 ? "abaixo de R$ 10: acumula" : "código 6015"}</span>` : html`<span class="muito-fraco">—</span>`}
          ${m.prejuizo_comum + m.prejuizo_fii > 0.005 ? html`<span class="leg">prejuízo a compensar ${fmt.brlTexto(m.prejuizo_comum + m.prejuizo_fii)}</span>` : ""}</td>
      </tr>`)}</tbody></table></div>
      <details class="mt2"><summary style="cursor:pointer">Vendas para conferência (${r.vendas.length})</summary>
        <div class="cartao sem-pad rolagem mt2"><table class="tabela">
          <thead><tr><th>Data</th><th>Ativo</th><th class="n">Quantidade</th><th class="n">Preço</th><th class="n">Total</th><th class="n">Preço médio</th><th class="n">Ganho</th></tr></thead>
          <tbody>${r.vendas.map((v) => html`<tr><td>${FC.datas.br(v.data)}</td><td><b>${v.ticker}</b><span class="leg">${(FC.CLASSES || {})[v.classe] || v.classe}</span></td>
            <td class="n">${fmt.qtd(v.quantidade)}</td><td class="n">${fmt.preco(v.preco)}</td><td class="n"><span class="rs">${fmt.brlTexto(v.total)}</span></td>
            <td class="n">${fmt.preco(v.preco_medio)}</td><td class="n ${v.ganho < 0 ? "neg" : v.ganho > 0 ? "pos" : ""}"><span class="rs">${v.ganho == null ? "sem custo" : fmt.brlTexto(v.ganho)}</span></td></tr>`)}</tbody>
        </table></div></details>`;
  }

  function blocoResgate(s) {
    const pc = s.por_classe;
    const linhas = [["Bolsa (ações, FIIs, ETFs)", pc.bolsa], ["Cripto", pc.cripto], ["Renda fixa", pc.renda_fixa], ["Agro", pc.agro]].filter(([, c]) => c.bruto > 0.005);
    return html`<div class="cartao">
      <dl class="kpis">
        <div class="kpi"><dt>Valor bruto hoje</dt><dd>${brl(s.bruto)}</dd></div>
        <div class="kpi"><dt>IR + IOF estimado</dt><dd>${brl(s.ir_estimado)}</dd></div>
        <div class="kpi"><dt>Líquido</dt><dd>${brl(s.liquido)}<small>${s.bruto ? fmt.num((s.liquido / s.bruto) * 100, 1) + "% do bruto" : ""}</small></dd></div>
        <div class="kpi"><dt>Ganho líquido</dt><dd class="${s.ganho_liquido < 0 ? "neg" : ""}">${brl(s.ganho_liquido)}<small>sobre <span class="rs">${fmt.brlTexto(s.aplicado)}</span> que saíram do bolso</small></dd></div>
      </dl></div>
      ${linhas.length ? html`<div class="cartao sem-pad rolagem mt2"><table class="tabela">
        <thead><tr><th>Classe</th><th class="n">Bruto</th><th class="n">Imposto</th><th class="n">Líquido</th></tr></thead>
        <tbody>${linhas.map(([nome, c]) => html`<tr><td><b>${nome}</b></td><td class="n"><span class="rs">${fmt.brlTexto(c.bruto)}</span></td>
          <td class="n"><span class="rs">${fmt.brlTexto(c.ir)}</span></td><td class="n"><b class="rs">${fmt.brlTexto(c.liquido)}</b></td></tr>`)}</tbody></table></div>` : ""}
      <ul class="texto-p mt2" style="padding-left:18px">${s.notas.map((n) => html`<li>${n}</li>`)}</ul>`;
  }

  // ---------------------------------------------------------------- tela
  FC.telas.irpf = async function (raiz) {
    const C = FC.comum;
    const base = FC.estado.base, d = FC.estado.dados;
    const anos = anosPossiveis(base);
    const anoPadrao = Number(FC.datas.hoje().slice(0, 4)) - 1;
    if (anoSel == null || !anos.includes(anoSel)) anoSel = anos.includes(anoPadrao) ? anoPadrao : anos[0];
    // os proventos calculados vêm do Fundamentus: busca e repinta quando chegarem
    if (!FC.estado.proventos && FC.estado.mercado && FC.estado.mercado.universo && FC.carregaProventos) {
      FC.carregaProventos().then(() => { if (location.hash.startsWith("#/irpf")) FC.rerender({ suave: true }); }).catch(() => {});
    }

    let r, s;
    try { r = FC.impostos.irpf(base, d, anoSel); } catch (e) { console.error(e); r = null; }
    try { s = d ? FC.impostos.resumo(d, base) : null; } catch (e) { console.error(e); s = null; }

    const seletor = html`<div class="campo"><select id="irpf-ano" aria-label="Ano-calendário">${anos.map((a) => html`<option value="${a}" ${a === anoSel ? "selected" : ""}>Ano-calendário ${a} (IR ${a + 1})</option>`)}</select></div>`;
    const cab = C && C.cabecalho ? C.cabecalho("Imposto de renda", "Rascunho da declaração e o imposto se resgatasse tudo hoje.", seletor)
      : html`<div class="cabecalho"><div><h1>Imposto de renda</h1></div><div class="direita">${seletor}</div></div>`;
    const aviso = html`<div class="mensagem alerta mb3">${icone("alerta", 18)}<span><b>Estimativa para conferência</b>: confira com o informe de rendimentos da corretora/banco antes de declarar. Os códigos e regras seguem a declaração vigente e podem mudar.</span></div>`;

    if (!r) {
      raiz.innerHTML = String(html`${cab}${aviso}<div class="mensagem info">${icone("info", 18)}<span>Não foi possível montar o relatório deste ano.</span></div>`);
    } else {
      const t = r.totais;
      raiz.innerHTML = String(html`
        ${cab}${aviso}
        ${C && C.estadoMercado ? C.estadoMercado() : ""}
        <dl class="kpis cartao mb3">
          <div class="kpi"><dt>Bens em 31/12/${r.ano}</dt><dd>${brl(t.bens_atual)}<small>pelo custo · antes <span class="rs">${fmt.brlTexto(t.bens_anterior)}</span></small></dd></div>
          <div class="kpi"><dt>Rendimentos isentos</dt><dd>${brl(t.isentos)}</dd></div>
          <div class="kpi"><dt>JCP (exclusiva)</dt><dd>${brl(t.exclusiva)}</dd></div>
          <div class="kpi"><dt>DARF no ano</dt><dd>${brl(t.darf + t.ir_cripto)}<small>ações, ETF, FII e cripto</small></dd></div>
        </dl>
        ${r.avisos.length ? html`<div class="mensagem info mb3">${icone("info", 18)}<span>${r.avisos.map((a) => html`${a}<br>`)}</span></div>` : ""}

        <section class="secao">
          <div class="secao-topo"><h2>Bens e Direitos</h2><span class="sub">situação pelo custo de aquisição, não pelo valor de mercado</span></div>
          <div class="mb2" style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="botao sec pequeno" id="irpf-copia-tudo">Copiar todas as discriminações</button>
            <button class="botao sec pequeno" id="irpf-csv">${icone("baixar", 16)} Baixar CSV</button>
          </div>
          ${tabelaBens(r)}
          <p class="texto-p mt2">Preencha corretora/instituição e CNPJ na discriminação. Quem tinha o bem antes de cadastrá-lo no app deve conferir a coluna de 31/12/${r.ano - 1}.</p>
        </section>

        <section class="secao">
          <div class="secao-topo"><h2>Rendimentos isentos</h2><span class="sub">dividendos, rendimentos de FII e LCI/LCA</span></div>
          ${listaRend(r.rendimentos.isentos, `Nenhum rendimento isento em ${r.ano}.`, false)}
        </section>

        <section class="secao">
          <div class="secao-topo"><h2>Tributação exclusiva</h2><span class="sub">JCP: informe o valor líquido (15% já retido)</span></div>
          ${listaRend(r.rendimentos.exclusiva, `Nenhum JCP em ${r.ano}.`, true)}
          ${r.rendimentos.exterior.length ? html`<h3 class="mt3 mb2" style="font-size:16px">Dividendos do exterior</h3>
            ${listaRend(r.rendimentos.exterior, "", false)}
            <p class="texto-p mt2">Desde 2024, dividendos do exterior pagam 15% na declaração anual (Lei 14.754/2023), descontado o imposto retido lá fora conforme acordo.</p>` : ""}
          <p class="texto-p mt2">Rendimentos de CDB e Tesouro aparecem no informe do banco ao resgatar (código 06) e não são estimados aqui.</p>
        </section>

        <section class="secao">
          <div class="secao-topo"><h2>Vendas e DARF</h2><span class="sub">ganho pelo preço médio · ações até R$ 20 mil no mês isentas · FII 20% sempre</span></div>
          ${tabelaMeses(r)}
          ${t.ganho_exterior ? html`<p class="texto-p mt2">Exterior: ganho de <span class="rs">${fmt.brlTexto(t.ganho_exterior)}</span> no ano — 15% (<span class="rs">${fmt.brlTexto(t.ir_exterior)}</span>) na declaração anual.</p>` : ""}
        </section>

        ${s ? html`<section class="secao">
          <div class="secao-topo"><h2>Se resgatasse tudo hoje</h2><span class="sub">quanto sobraria depois do imposto</span></div>
          ${blocoResgate(s)}
        </section>` : ""}

        <section class="secao">
          <details><summary style="cursor:pointer">Premissas deste relatório</summary>
            <ul class="texto-p mt2" style="padding-left:18px">${r.notas.map((n) => html`<li>${n}</li>`)}</ul></details>
        </section>
      `);
    }

    const sel = FC.$("#irpf-ano", raiz);
    if (sel) sel.addEventListener("change", () => { anoSel = Number(sel.value); FC.telas.irpf(raiz); });
    if (!r) return;
    FC.$$("[data-copia]", raiz).forEach((b) => b.addEventListener("click", () => copia(r.bens[Number(b.dataset.copia)].discriminacao)));
    const tudo = FC.$("#irpf-copia-tudo", raiz);
    if (tudo) tudo.addEventListener("click", () => copia(r.bens.map((b) => `${b.grupo}-${b.codigo} · ${b.nome}\n${b.discriminacao}\n31/12/${r.ano - 1}: ${n2(b.anterior)} · 31/12/${r.ano}: ${n2(b.atual)}`).join("\n\n")));
    const bt = FC.$("#irpf-csv", raiz);
    if (bt) bt.addEventListener("click", () => FC.baixar(`irpf-${r.ano}.csv`, csv(r), "text/csv;charset=utf-8"));
  };

  FC.telas.irpf.csv = csv;               // exposto para teste
})();
