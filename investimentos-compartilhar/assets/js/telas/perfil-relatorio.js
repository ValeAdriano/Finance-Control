/* Relatório do perfil: o porquê de cada recomendação, no espírito do
 * relatório de adequação que a ESMA pede para robo-advice. Cada conta vê
 * o seu. Exporta em PDF pelo CSS de impressão, com o aviso de que é uma
 * ferramenta pessoal baseada no questionário. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt } = FC;
  const P = FC.PERFIL;
  const brl = (v) => fmt.brlTexto(v, 0);

  const quando = (iso) => (iso ? FC.datas.br(String(iso).slice(0, 10)) : "—");
  const ROTULO_ORIGEM = { cadastro: "Cadastro", migracao: "Primeiro login após a novidade", revisao: "Revisão", comportamento: "Alerta de comportamento" };

  function resumo(e, res) {
    const r = e.atual;
    return html`<section class="cartao rel-bloco">
      <h3>Resumo</h3>
      <dl class="kpis" style="margin-top:12px">
        <div class="kpi pequeno"><dt>Perfil</dt><dd>${res.faixa.nome}</dd></div>
        <div class="kpi pequeno"><dt>Score</dt><dd>${res.score}</dd></div>
        <div class="kpi pequeno"><dt>Tolerância</dt><dd>${res.tolerancia}</dd></div>
        <div class="kpi pequeno"><dt>Capacidade</dt><dd>${res.capacidade}</dd></div>
        <div class="kpi pequeno"><dt>Consistência</dt><dd>${res.consistencia === "alta" ? "Alta" : "Baixa"}</dd></div>
      </dl>
      <p class="texto-p mt2">Avaliado em ${quando(r.criado_em)} (${ROTULO_ORIGEM[r.origem] || r.origem}), válido até ${quando(r.valido_ate)}, calculado pelo modelo <code>${r.versao_modelo}</code>.</p>
    </section>`;
  }

  function porQueEstePerfil(res) {
    const itens = FC.perfil.contribuicoes(res._resp);
    const bloco = (eixo, titulo) => {
      const l = itens.filter((x) => x.eixo === eixo).sort((a, b) => a.pontos / (a.max || 1) - b.pontos / (b.max || 1));
      return html`<div><h4>${titulo}</h4><ul class="rel-lista">${l.map((x) => html`<li>
        <span>${x.pergunta}<small>${x.resposta}${x.neutro ? " (sem resposta: pontos neutros)" : ""}</small></span>
        <b>${x.pontos}/${x.max}</b></li>`)}</ul></div>`;
    };
    return html`<section class="cartao rel-bloco">
      <h3>Por que este perfil</h3>
      <p class="sub">As respostas que mais limitaram cada eixo aparecem primeiro.</p>
      <div class="grade g2 mt2">${bloco("capacidade", "Capacidade")}${bloco("tolerancia", "Tolerância")}</div>
      ${res.tetos.length || res.descontos.length ? html`<h4 class="mt3">Tetos aplicados</h4><ul class="rel-lista">
        ${res.tetos.map((t) => html`<li><span>${FC.recomendacao.texto(t.regra, t)}</span></li>`)}
        ${res.descontos.map((d) => html`<li><span>${FC.recomendacao.texto(d.regra, d)}</span></li>`)}</ul>` : ""}
      <p class="texto-p mt2">Perfil final = menor valor entre tolerância e capacidade. Conhecimento declarado: <b>${{ nenhum: "nenhum em renda variável", basico: "básico", experiente: "experiente" }[res.conhecimento]}</b>; ele limita produtos, não o perfil.</p>
    </section>`;
  }

  function planoERazoes(e, rec) {
    const dec = e.plano ? e.plano.decisao : null;
    const ids = Object.keys(rec.regras || {});
    return html`<section class="cartao rel-bloco">
      <h3>Plano e decisão</h3>
      <p class="texto-p">${dec === "aplicado" ? `Aplicado às metas em ${quando(e.plano.decidido_em)}.` : dec === "recusado" ? `Recusado em ${quando(e.plano.decidido_em)}: as metas atuais foram mantidas.` : "Ainda sem decisão."}</p>
      <ol class="pr-passos">${rec.plano.passos.map((s, k) => html`<li class="${s.feito ? "feito" : ""}"><span class="pr-n">${k + 1}</span>
        <div><b>${s.titulo}</b><p>${s.texto}</p><p class="fraco" style="font-size:12px">regra <code>${s.regra}</code></p></div></li>`)}</ol>
      <h4 class="mt3">Alocação alvo</h4>
      <ul class="rel-lista">${FC.recomendacao.CLASSES.map((c) => html`<li><span>${c.nome}</span><b>${rec.alocacao.classes[c.chave]}%</b></li>`)}</ul>
      <h4 class="mt3">Por que cada recomendação</h4>
      <ul class="rel-lista">${rec.alocacao.notas.map((n) => html`<li><span>${n.texto}<small><code>${n.regra}</code></small></span></li>`)}
        ${rec.conflitos.map((c) => html`<li><span>${c.titulo}. ${c.texto}<small><code>${c.regra}</code></small></span></li>`)}
        ${ids.length ? "" : ""}</ul>
    </section>`;
  }

  function aderencia(rec) {
    const pcr = FC.recomendacao.planoContraRealidade({ plano: rec.plano, alocacaoAlvo: FC.estado.prefs.alocacao_alvo, dados: FC.estado.dados, base: FC.estado.base });
    if (!pcr) return "";
    return html`<section class="cartao rel-bloco">
      <h3>Aderência</h3>
      ${cartaoPlanoRealidade(pcr, true)}
    </section>`;
  }

  function comportamento(rec) {
    const l = rec.conflitos.filter((c) => ["carteira_acima_perfil", "vendas_em_queda"].includes(c.id));
    return html`<section class="cartao rel-bloco"><h3>Comportamento</h3>
      ${l.length ? html`<ul class="rel-lista">${l.map((c) => html`<li><span><b>${c.titulo}</b><small>${c.texto}</small></span></li>`)}</ul>`
        : html`<p class="texto-p">Nenhum alerta: a carteira e as vendas dos últimos 12 meses estão coerentes com o perfil declarado.</p>`}</section>`;
  }

  async function historico() {
    let l = [];
    try { l = await FC.perfilDb.historico(); } catch (x) { /* sem acesso */ }
    return html`<section class="cartao rel-bloco"><h3>Histórico</h3>
      <p class="sub">Cada avaliação fica guardada como foi feita. Nada é sobrescrito.</p>
      <ol class="rel-linha-tempo mt2">${l.map((r, k) => {
        const ant = l[k + 1];
        const dif = ant ? FC.perfil.diferencas(ant, r) : [];
        return html`<li><b>${quando(r.criado_em)}</b> · ${FC.perfil.nomeDoPerfil(r.perfil)} · score ${r.score} <small class="fraco">(${ROTULO_ORIGEM[r.origem] || r.origem}, ${r.versao_modelo})</small>
          ${ant ? html`<div class="fraco" style="font-size:12.5px">${dif.length ? `Mudou: ${dif.slice(0, 6).map((d) => `${d.pergunta.replace(/\?$/, "")}: ${d.de} → ${d.para}`).join("; ")}${dif.length > 6 ? ` e mais ${dif.length - 6}` : ""}.` : "Mesmas respostas da avaliação anterior."}</div>` : html`<div class="fraco" style="font-size:12.5px">Primeira avaliação.</div>`}</li>`;
      })}</ol></section>`;
  }

  // cartão compartilhado com o Início: plano contra realidade
  function cartaoPlanoRealidade(p, embutido = false) {
    const tem = p.aporte_sugerido != null;
    const pctAporte = tem && p.aporte_sugerido > 0 ? Math.min(100, (p.aporte_feito / p.aporte_sugerido) * 100) : 0;
    return html`<div class="${embutido ? "" : "cartao"} pr-realidade">
      ${embutido ? "" : html`<div class="flex entre"><h3>Plano contra realidade</h3><a class="botao texto pequeno" href="#/perfil">Ver plano</a></div>`}
      <div class="grade g2 mt2">
        <div><p class="rot fraco" style="font-size:12.5px">Aporte do mês</p>
          <p class="pr-num"><b>${brl(p.aporte_feito)}</b>${tem ? html` de ${brl(p.aporte_sugerido)}` : ""}</p>
          ${tem ? html`<div class="pr-regua"><i style="width:${pctAporte}%"></i></div>` : ""}</div>
        ${p.reserva ? html`<div><p class="rot fraco" style="font-size:12.5px">Reserva de emergência</p>
          <p class="pr-num"><b>${fmt.num(p.reserva.meses_atual, 1)}</b> de ${p.reserva.meses_alvo} meses</p>
          <div class="pr-regua"><i style="width:${Math.min(100, (p.reserva.meses_atual / p.reserva.meses_alvo) * 100)}%"></i></div></div>` : ""}
      </div>
      ${p.desvios.length ? html`<ul class="rel-lista mt2">${p.desvios.map((d) => html`<li><span>${d.nome}</span>
        <b style="color:${Math.abs(d.desvio) > 5 ? "var(--amarelo)" : "inherit"}">${fmt.num(d.atual, 0)}% <small>alvo ${fmt.num(d.alvo, 0)}%</small></b></li>`)}</ul>` : ""}
    </div>`;
  }

  async function corpo(e, res, rec) {
    res._resp = e.atual.respostas;
    return html`<div class="rel">
      <div class="flex entre quebra mb3 rel-acoes"><span class="fraco" style="font-size:13px">Relatório do perfil</span>
        <div class="flex" style="gap:8px"><button class="botao sec pequeno" id="rel-json">${icone("exportar", 15)} Baixar JSON</button>
        <button class="botao sec pequeno" id="rel-pdf">${icone("recibo", 15)} Exportar PDF</button></div></div>
      ${resumo(e, res)}${porQueEstePerfil(res)}${planoERazoes(e, rec)}${aderencia(rec)}${comportamento(rec)}${await historico()}
      <p class="rel-aviso">Este relatório é uma ferramenta pessoal baseada no questionário que você respondeu. Não é recomendação de investimento nem substitui a análise de um profissional habilitado.</p>
    </div>`;
  }

  function liga(raiz) {
    const pdf = FC.$("#rel-pdf", raiz);
    if (pdf) pdf.addEventListener("click", () => { document.title = "Relatório do perfil · Bullz"; window.print(); });
    const js = FC.$("#rel-json", raiz);
    if (js) js.addEventListener("click", async () => {
      try {
        const dados = await FC.perfilDb.exporta();
        FC.baixar(`perfil-bullz-${FC.datas.hoje()}.json`, JSON.stringify({ app: "bullz", tipo: "perfil", gerado: new Date().toISOString(), ...dados }, null, 2));
      } catch (x) { FC.ui.erro(x); }
    });
  }

  FC.perfilRelatorio = { corpo, liga, cartaoPlanoRealidade };
})();
