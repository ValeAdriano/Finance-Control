/* Dividendos: quanto cai por mês, quando cai, e de qual ação. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt, ok } = FC;
  const C = FC.comum;

  const COR_TIPO = { Dividendo: "verde", JCP: "azul", Rendimento: "terra" };
  const nomeMes = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function linhaPagamento(p, comAcao) {
    const cor = COR_TIPO[p.tipo] || "cinza";
    const quando = p.pagamento ? FC.datas.br(p.pagamento) : "a definir";
    const dia = p.pagamento || p.data_com;
    return html`<div class="item">
      <div style="width:48px;text-align:center"><b style="font-size:17px;display:block;line-height:1">${dia.slice(8, 10)}</b><small class="muito-fraco">${FC.datas.mesAno(dia)}</small></div>
      <div class="principal"><div class="titulo">${p.ticker} ${FC.pilula(cor, p.tipo)}
          ${p.status === "anunciado" ? FC.pilula("amarelo", "data com " + FC.datas.br(p.data_com).slice(0, 5)) : ""}</div>
        <div class="detalhe">${fmt.qtd(p.quantidade)} × ${fmt.preco(p.valor_por_acao)}${p.tipo === "JCP" ? " (−15% IR)" : ""} · data com ${FC.datas.br(p.data_com)} · paga ${quando}${p.estimado_base ? " · pela posição inicial" : ""}</div></div>
      <div class="valores"><b class="pos rs">${fmt.brlTexto(p.valor)}</b><small>${p.status === "pago" ? "recebido" : p.status}</small></div>
      ${comAcao ? (p.lancado ? html`<span class="pilula verde" title="já está em Aportes">lançado</span>`
        : html`<button class="botao texto pequeno" data-lanca="${p.origem}" title="Registrar em Aportes como provento">Lançar</button>`) : ""}
    </div>`;
  }

  FC.telas.dividendos = async function (raiz) {
    const d = FC.estado.dados;
    if (!FC.estado.proventos || !FC.estado.mercado.universo) {
      raiz.innerHTML = String(html`${C.cabecalho("Dividendos", "Quanto suas ações e FIIs pagam, e quando.")}${C.estadoMercado()}
        <div class="carregando-tela" style="min-height:30vh"><div class="roda"></div><span>Buscando os proventos de cada ativo…</span></div>`);
      if (FC.estado.mercado.universo) FC.carregaProventos().then(() => { if (location.hash.startsWith("#/dividendos")) FC.rerender({ suave: true }); });
      return;
    }
    const r = FC.dividendos.analisa(d, FC.estado.base, FC.estado.proventos);
    const s = r.resumo;
    const hoje = FC.datas.hoje();

    if (!r.porAtivo.length) {
      raiz.innerHTML = String(html`${C.cabecalho("Dividendos", "Quanto suas ações e FIIs pagam, e quando.")}
        <div class="lista">${C.vazio("💸", "Nenhuma ação ou FII na carteira", "Quando você tiver ações, FIIs ou ETFs, esta tela mostra quanto cada um paga por mês, as próximas datas de pagamento e o total recebido.",
          html`<a class="botao" href="#/aportes">Registrar uma compra</a>`)}</div>
        <p class="texto-p mt2">Cripto não paga dividendos e fica fora desta tela.</p>`);
      return;
    }

    const maxMes = Math.max(...r.serie.map((m) => m.total), 0);
    raiz.innerHTML = String(html`
      ${C.cabecalho("Dividendos", "Quanto suas ações e FIIs pagam, e quando.",
        html`<button class="botao sec" id="bt-atualiza-div">${icone("atualizar", 17)} Atualizar</button>`)}
      <div class="cartao heroi">
        <p class="rotulo">Renda mensal estimada</p>
        <p class="valor"><span class="rs" data-conta="${s.mensal_estimado}">${fmt.brlTexto(s.mensal_estimado)}</span> <span style="font-size:.4em;color:var(--ink-2);font-weight:500">por mês</span></p>
        <div class="chips">
          <span class="chip">Próximos 30 dias <b class="rs">${fmt.brlTexto(s.proximos_30d)}</b></span>
          <span class="chip">Recebido em ${hoje.slice(0, 4)} <b class="rs">${fmt.brlTexto(s.no_ano)}</b></span>
          <span class="chip">Últimos 12 meses <b class="rs">${fmt.brlTexto(s.recebido_12m)}</b></span>
          ${ok(s.dy_carteira) ? html`<span class="chip">DY das posições <b>${fmt.num(s.dy_carteira)}%</b></span>` : ""}
        </div>
      </div>
      <p class="texto-p mt2">Estimativa = o que cada ação pagou por cota nos últimos 12 meses × a quantidade que você tem hoje ÷ 12. JCP entra líquido do IR de 15%. Fonte: Fundamentus (data com e data de pagamento de cada provento).</p>

      <section class="secao">
        <div class="secao-topo"><h2>Por mês</h2><span class="sub">pela data de pagamento · meses futuros com o que já foi anunciado</span></div>
        <div class="cartao">
          ${maxMes > 0 ? FC.graficos.colunas({ barras: r.serie.map((m) => ({ rotulo: FC.datas.mesAno(m.mes + "-01"), titulo: nomeMes(m.mes) + (m.futuro ? " · a receber" : ""), valor: m.total, detalhe: m.itens, cor: m.futuro ? "var(--s3)" : "var(--s2)" })) })
            : html`<p class="texto-p">Nenhum pagamento nos últimos 12 meses para a sua posição.</p>`}
          <div class="legenda-g"><span><i class="q k2"></i>recebido</span><span><i class="q k3"></i>a receber (anunciado)</span></div>
        </div>
      </section>

      <section class="secao">
        <div class="secao-topo"><h2>Próximos pagamentos</h2><span class="sub">anunciados pelas empresas e fundos</span></div>
        <div class="lista">${r.proximos.length ? r.proximos.map((p) => linhaPagamento(p, false))
          : C.vazio("📅", "Nada anunciado ainda", "Quando uma empresa ou FII anunciar o próximo provento, ele aparece aqui com a data com e a data de pagamento.")}</div>
        <p class="texto-p mt2">Para receber, é preciso ter a ação no fim da <b>data com</b>. Quando a data com ainda não passou, o valor usa a quantidade que você tem hoje.</p>
      </section>

      <section class="secao">
        <div class="secao-topo"><h2>Por ativo</h2><span class="sub">o que cada um paga, com a sua quantidade</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>Ativo</th><th class="n">Quantidade</th><th class="n">Por mês</th><th class="n">12 meses</th><th class="n">DY</th><th class="n">Sobre seu PM</th><th>Frequência</th><th>Próximo</th></tr></thead>
          <tbody>${r.porAtivo.map((a) => html`<tr class="clicavel" data-abre="${a.ticker}">
            <td><b>${a.ticker}</b><span class="leg">${a.tipo_rotulo}${a.erro ? " · sem dados da fonte" : a.sem_dados ? " · nenhum provento registrado" : ""}</span></td>
            <td class="n">${fmt.qtd(a.quantidade)}</td>
            <td class="n"><b class="rs">${fmt.brlTexto(a.mensal_estimado)}</b></td>
            <td class="n"><span class="rs">${fmt.brlTexto(a.recebido_12m)}</span><span class="leg">${fmt.preco(a.por_acao_12m)} por cota</span></td>
            <td class="n">${ok(a.dy_12m) ? fmt.num(a.dy_12m) + "%" : "—"}</td>
            <td class="n">${ok(a.yoc) ? fmt.num(a.yoc) + "%" : "—"}</td>
            <td>${a.frequencia}</td>
            <td>${a.proximo ? html`<b>${a.proximo.pagamento ? FC.datas.br(a.proximo.pagamento).slice(0, 5) : "a definir"}</b><span class="leg rs">${fmt.brlTexto(a.proximo.valor)}</span>` : html`<span class="muito-fraco">—</span>`}</td>
          </tr>`)}</tbody></table></div>
        <p class="texto-p mt2"><b>Sobre seu PM</b> (yield on cost) é o que a ação pagou em 12 meses dividido pelo seu preço médio — quanto o dinheiro que você colocou está rendendo em proventos.</p>
      </section>

      <section class="secao">
        <details><summary style="cursor:pointer;font-size:20px;font-weight:600;letter-spacing:-.02em">Recebidos <span class="fraco" style="font-size:14px;font-weight:400">· ${r.recebidos.length} pagamento${r.recebidos.length === 1 ? "" : "s"}</span></summary>
          <p class="texto-p mt2 mb2">Calculados pela sua posição em cada data com. <b>Lançar</b> registra o pagamento em Aportes como provento (sem duplicar), para ele entrar no histórico de proventos do Início.</p>
          <div class="lista">${r.recebidos.length ? r.recebidos.slice(0, 120).map((p) => linhaPagamento(p, true)) : C.vazio("🧾", "Nenhum recebido", "Os pagamentos já feitos para a sua posição aparecem aqui.")}</div>
        </details>
      </section>
    `);

    FC.$$("[data-abre]", raiz).forEach((tr) => tr.addEventListener("click", () => C.abreAtivo(tr.dataset.abre)));
    FC.$("#bt-atualiza-div", raiz).addEventListener("click", async (e) => {
      await FC.ui.ocupado(e.currentTarget, () => FC.carregaProventos(true));
      FC.rerender({ suave: true });
      FC.ui.aviso("Proventos atualizados");
    });
    FC.$$("[data-lanca]", raiz).forEach((b) => b.addEventListener("click", async () => {
      const p = r.pagamentos.find((x) => x.origem === b.dataset.lanca);
      if (!p) return;
      try {
        await FC.ui.ocupado(b, () => FC.db.inserirVarios("aportes", [{ tipo: "provento", ticker: p.ticker, valor: Number(p.valor.toFixed(2)),
          data: p.pagamento || p.data_com, observacao: `${p.tipo} · ${fmt.qtd(p.quantidade)} × ${fmt.preco(p.valor_por_acao)}`, origem: p.origem }], "user_id,origem"));
        await C.depoisDeMudar(`${p.tipo} de ${p.ticker} lançado`);
      } catch (e) { FC.ui.erro(e); }
    }));
  };
})();
