/* Resultado do perfil e plano: o perfil em destaque, os três eixos, o
 * plano em passos numerados, alocação atual contra alvo, candidatos por
 * classe e o botão Aplicar plano (com a prévia do antes e do depois).
 *
 * Rota #/perfil (resultado) e #/perfil/relatorio (relatório). */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone, fmt } = FC;
  const C = FC.comum;
  const P = FC.PERFIL;
  const pct0 = (v) => fmt.num(v, 0) + "%";
  const brl = (v) => fmt.brlTexto(v, 0);

  const COR_PERFIL = { conservador: "azul", moderado: "amarelo", arrojado: "verde" };
  const NOME_PILAR = FC.PILAR_NOME;
  const CLASSES = FC.recomendacao.CLASSES;

  // ---------------------------------------------------------------- recomendação viva
  // recalcula com o que o app sabe agora (cotações, carteira, regras); se algo
  // falhar, mostra o plano que foi guardado na hora da avaliação
  function recomendacao(reg, planoGuardado, modo) {
    const e = FC.estado;
    try {
      const res = FC.perfil.calcula(reg.respostas);
      return { res, rec: FC.recomendacao.gera({ resp: reg.respostas, res, prefs: e.prefs, dados: e.dados, base: e.base, mercado: e.mercado, modo }) };
    } catch (x) {
      console.error(x);
      return planoGuardado ? { res: FC.perfil.calcula(reg.respostas), rec: planoGuardado.plano } : null;
    }
  }
  FC.perfilRecomendacao = recomendacao;

  // ---------------------------------------------------------------- peças
  const regua = (rotulo, valor, dica) => html`<div class="pr-eixo">
    <div class="pr-eixo-topo"><span>${rotulo}${dica ? FC.ajuda(dica) : ""}</span><b>${valor == null ? "—" : fmt.int(valor)}</b></div>
    <div class="pr-regua"><i style="width:${valor || 0}%"></i><span class="pr-marca" style="left:34%"></span><span class="pr-marca" style="left:64%"></span></div>
  </div>`;

  function eixos(res, rec) {
    const nec = rec.necessidade;
    const ref = rec.retorno_referencia;
    let linhaNec;
    if (nec == null) linhaNec = "Informe o valor da meta para calcular o retorno que o objetivo exige.";
    else if (nec === Infinity || nec === null) linhaNec = "Nem com 100% ao ano a meta fecha.";
    else linhaNec = `O objetivo exige ${fmt.num(nec * 100, 1)}% ao ano acima da inflação; o perfil rende em torno de ${fmt.num(ref * 100, 1)}%.`;
    return html`<div class="pr-eixos">
      ${regua("Tolerância", res.tolerancia, "O quanto você aguenta sentir uma queda. Vem das perguntas do bloco 4.")}
      ${regua("Capacidade", res.capacidade, "O quanto você pode perder sem mexer na sua vida: renda, reserva, dívidas, prazo.")}
      <div class="pr-eixo"><div class="pr-eixo-topo"><span>Necessidade${FC.ajuda("O retorno real por ano que o seu objetivo exige. É uma conta, não uma pergunta.")}</span>
        <b>${nec == null ? "—" : nec === Infinity ? "impossível" : fmt.num(nec * 100, 1) + "%"}</b></div><p class="pr-eixo-nota">${linhaNec}</p></div>
    </div>`;
  }

  function alocacaoAtual(rec, aloc) {
    const d = FC.estado.dados;
    const atual = {};
    if (d && d.alocacao) for (const l of d.alocacao) atual[l.chave] = l.pct_meta != null ? l.pct_meta : l.pct;
    const temCarteira = d && d.resumo && d.resumo.patrimonio > 0;
    return html`<div class="cartao pr-aloc">
      <div class="flex entre"><h3>${rec.rotulos.alocacao}</h3><span class="fraco" style="font-size:12.5px">${temCarteira ? "sua carteira × alvo do perfil" : "alvo do perfil"}</span></div>
      <div class="pr-aloc-linhas">
        ${CLASSES.map((c) => {
          const alvo = aloc.classes[c.chave], at = atual[c.pilar];
          const f = aloc.faixas[c.chave];
          return html`<div class="pr-aloc-linha">
            <div class="pr-aloc-nome"><b>${c.nome}</b><span class="fraco">${f ? `faixa ${f[0]} a ${f[1]}%` : ""}</span></div>
            ${FC.graficos.barraAlocacao(temCarteira && at != null ? at : alvo, temCarteira ? alvo : null, 100, `var(--s${CLASSES.indexOf(c) + 1})`)}
            <div class="pr-aloc-num"><b>${pct0(alvo)}</b>${temCarteira && at != null ? html`<span class="fraco">hoje ${pct0(at)}</span>` : ""}</div>
          </div>`;
        })}
      </div>
      ${aloc.notas.length ? html`<ul class="pr-notas">${aloc.notas.map((n) => html`<li>${n.texto}</li>`)}</ul>` : ""}
      <details class="mt2"><summary style="cursor:pointer;color:var(--acento);font-size:14px">Como dividir a renda fixa</summary>
        <div class="pr-rf">${aloc.renda_fixa_divisao.map((x) => html`<div><b>${x.pct}%</b><span>${x.rotulo}</span></div>`)}</div>
        <p class="fraco" style="font-size:13px">A reserva de emergência fica em pós-fixado com liquidez diária. CDI alto puxa para pós-fixado; juro real alto puxa para IPCA+.</p>
      </details>
    </div>`;
  }

  function plano(rec) {
    const p = rec.plano;
    return html`<div class="cartao">
      <h3>Seu plano</h3>
      <ol class="pr-passos">${p.passos.map((s, k) => html`<li class="${s.feito ? "feito" : ""}">
        <span class="pr-n">${s.feito ? icone("check", 14) : k + 1}</span>
        <div><b>${s.titulo}</b><p>${s.resumo}</p>
          ${s.valor_total != null || s.valor_mensal != null || s.meses != null ? html`<p class="pr-num">
            ${s.valor_total != null ? html`Falta <b>${brl(s.valor_total)}</b>` : ""}
            ${s.valor_mensal != null && s.valor_total != null ? " · " : ""}
            ${s.valor_mensal != null ? html`<b>${brl(s.valor_mensal)}</b> por mês` : ""}
            ${s.meses != null ? html` · chega em cerca de <b>${s.meses}</b> ${s.meses === 1 ? "mês" : "meses"}` : ""}</p>` : ""}
        </div></li>`)}</ol>
      ${p.aporte_mensal != null && !p.exclusivo ? html`<p class="fraco" style="font-size:13px">Aporte sugerido: a sobra informada vezes ${fmt.num(p.fator * 100, 0)}% (fator do perfil). Ajuste como quiser em Salário.</p>` : ""}
    </div>`;
  }

  function conflitos(rec) {
    if (!rec.conflitos.length) return "";
    return html`<div class="lista mt3">${rec.conflitos.map((c) => {
      const s = c.saidas;
      const extra = s ? html`<ul class="pr-saidas">
        ${s.aporte_necessario != null ? html`<li>Aportar <b>${brl(s.aporte_necessario)}</b> por mês, mantendo o prazo;</li>` : ""}
        ${s.prazo_necessario != null ? html`<li>ou esperar <b>${fmt.num(s.prazo_necessario, 1)} anos</b>, com o aporte atual;</li>` : ""}
        ${s.meta_possivel != null ? html`<li>ou ajustar a meta para cerca de <b>${brl(s.meta_possivel)}</b>.</li>` : ""}</ul>` : "";
      return C.itemAlerta({ nivel: c.nivel, titulo: c.titulo, texto: html`${c.texto} ${extra}` });
    })}</div>`;
  }

  function candidatos(rec, res) {
    const c = rec.candidatos;
    const educativo = rec.modo !== "completo";
    const total = Object.values(c.por_classe).reduce((s, l) => s + l.length, 0);
    if (rec.plano.exclusivo) return "";
    const NOMES = { acoes: "Ações e ETFs", fiis: "FIIs", cripto: "Cripto" };
    return html`<div class="cartao">
      <h3>${rec.rotulos.candidatos}</h3>
      <p class="sub">${educativo
        ? "Itens da sua carteira, da lista de acompanhamento e do universo de Renda que passam nos quatro filtros do perfil. É uma lista de verificação, não uma indicação."
        : "Do que o painel conhece, o que passa nos quatro filtros do perfil, do maior score para o menor."}</p>
      ${total ? Object.entries(c.por_classe).filter(([, l]) => l.length).map(([k, l]) => html`<div class="mt3">
        <p class="rot fraco" style="font-size:12.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">${NOMES[k]}</p>
        <div class="lista mt1">${l.map((a) => html`<div class="item clicavel" data-ticker="${a.ticker}" role="button" tabindex="0">
          <div class="principal"><div class="titulo">${a.ticker}${a.estudar ? html` ${FC.pilula("cinza", "para estudar")}` : ""}
            <span class="fraco" style="font-weight:400;font-size:12.5px"> · ${a.origem === "carteira" ? "na carteira" : a.origem === "watchlist" ? "acompanhando" : "universo de Renda"}</span></div>
            <div class="detalhe" style="white-space:normal">${a.motivo}</div>
            ${a.alerta ? html`<div class="detalhe" style="white-space:normal;color:var(--amarelo)">${icone("alerta", 13)} ${a.alerta}</div>` : ""}
            <div class="detalhe">Peso máximo ${a.peso_max}% da carteira${a.peso_atual > 0 ? ` · hoje ${fmt.num(a.peso_atual, 1)}%` : ""}</div></div>
          <div class="direita-item">${FC.anel ? FC.anel(a.score, a.cor) : html`<b>${Math.round(a.score)}</b>`}</div></div>`)}</div></div>`)
        : html`<p class="texto-p mt2">Nenhum item da sua carteira ou lista passa nos filtros agora. Cadastre ativos em Investimentos para ver como cada um se encaixa no seu perfil.</p>`}
      ${c.descartados.length ? html`<details class="mt3"><summary style="cursor:pointer;color:var(--acento);font-size:14px">Por que ${c.descartados.length} ficaram de fora</summary>
        <div class="lista mt2">${c.descartados.slice(0, 40).map((d) => html`<div class="item"><div class="principal"><div class="titulo">${d.ticker}</div>
          <div class="detalhe" style="white-space:normal">${d.motivos.join("; ")}</div></div></div>`)}</div></details>` : ""}
      <p class="fraco mt3" style="font-size:12.5px">${rec.rotulos.aviso}</p>
    </div>`;
  }

  // ---------------------------------------------------------------- aplicar o plano
  async function aplicar(reg, planoReg, rec) {
    const prefs = FC.estado.prefs;
    const antes = { ...prefs.alocacao_alvo };
    const depois = FC.recomendacao.metasDoPlano(rec.alocacao);
    const f = FC.ui.folha({
      titulo: "Aplicar o plano às suas metas",
      corpo: html`<p class="texto-p">As metas de alocação de Ajustes passam a ser as do perfil ${FC.perfil.nomeDoPerfil(rec.perfil)}. O rebalanceamento e o “onde colocar o aporte do mês” passam a apontar para a classe mais abaixo do alvo.</p>
        <div class="pr-antes-depois mt3">
          <div class="cab"><span></span><span>Antes</span><span>Depois</span></div>
          ${FC.PILARES.filter((p) => depois[p.chave] != null || antes[p.chave]).map((p) => html`<div class="lin">
            <span>${p.nome}</span><span>${pct0(antes[p.chave] || 0)}</span><b class="${(antes[p.chave] || 0) !== depois[p.chave] ? "muda" : ""}">${pct0(depois[p.chave] || 0)}</b></div>`)}
        </div>
        <p class="fraco mt3" style="font-size:12.5px">Dá para voltar atrás em Ajustes → Metas de alocação.</p>`,
      rodape: html`<button class="botao sec" data-r="nao">Cancelar</button><button class="botao" data-r="sim">Aplicar plano</button>`,
    });
    FC.$("[data-r=nao]", f.el).addEventListener("click", () => f.fechar());
    FC.$("[data-r=sim]", f.el).addEventListener("click", async (ev) => {
      try {
        await FC.ui.ocupado(ev.currentTarget, async () => {
          await FC.db.gravaPrefs({ alocacao_alvo: depois });
          if (planoReg) await FC.perfilDb.decide(planoReg.id, "aplicado", antes, depois);
          await FC.perfilDb.evento("plano_aplicado");
          FC.db.log("plano_aplicado", { perfil: rec.perfil, versao: P.versao });
        });
        f.fechar();
        await FC.perfilFluxo.carrega();
        await FC.comum.depoisDeMudar("Plano aplicado às suas metas");
      } catch (x) { FC.ui.erro(x); }
    });
  }

  async function recusar(planoReg, rec) {
    if (!(await FC.ui.confirma("As metas atuais continuam como estão e a sua escolha fica registrada. Dá para aplicar depois.", { titulo: "Manter as metas atuais?", botao: "Manter" }))) return;
    try {
      if (planoReg) await FC.perfilDb.decide(planoReg.id, "recusado", FC.estado.prefs.alocacao_alvo, null);
      await FC.perfilDb.evento("plano_recusado");
      FC.db.log("plano_recusado", { perfil: rec.perfil, versao: P.versao });
      await FC.perfilFluxo.carrega();
      FC.rerender({ suave: true });
      FC.ui.aviso("Metas mantidas");
    } catch (x) { FC.ui.erro(x); }
  }

  // ---------------------------------------------------------------- abas da tela
  function abas(atual) {
    return html`<div class="segmentado mb3" role="tablist" id="pr-abas">
      <button type="button" data-aba="resultado" aria-pressed="${atual === "resultado"}">Resultado</button>
      <button type="button" data-aba="relatorio" aria-pressed="${atual === "relatorio"}">Relatório</button></div>`;
  }

  FC.telas.perfil = async function (raiz, params = []) {
    const e = FC.estado.perfil;
    const aba = params[0] === "relatorio" ? "relatorio" : "resultado";
    if (!e || e.indisponivel) {
      raiz.innerHTML = String(html`<div class="estreita">${C.cabecalho("Perfil do investidor", "Seu perfil e o plano que sai dele.")}
        <div class="mensagem alerta">${icone("alerta", 18)}<span>O perfil ainda não está disponível nesta instalação: aplique o schema.sql atualizado no Supabase.</span></div></div>`);
      return;
    }
    if (!e.atual) {
      raiz.innerHTML = String(html`<div class="estreita">${C.cabecalho("Perfil do investidor", "Três minutos para o seu plano.")}
        <div class="cartao vazio centro" style="padding:40px 20px">
          <div class="icone-grande" style="color:var(--acento)">${icone("bussola", 34)}</div>
          <h3 style="margin-top:12px">${e.rascunho ? "Você parou no meio" : "Você ainda não fez o seu perfil"}</h3>
          <p class="texto-p" style="margin-inline:auto">${e.rascunho ? "Suas respostas estão salvas. Continue de onde parou." : "Cerca de 20 perguntas, uma por tela, e você recebe o perfil, quanto guardar por mês e a alocação por classe."}</p>
          <button class="botao mt3" id="pr-comeca">${e.rascunho ? "Continuar" : "Começar"}</button></div></div>`);
      FC.$("#pr-comeca", raiz).addEventListener("click", () => FC.perfilFluxo.abre({ origem: "cadastro" }));
      return;
    }
    const r = recomendacao(e.atual, e.plano, e.modo);
    if (!r) { raiz.innerHTML = String(html`<div class="mensagem erro">Não consegui montar o resultado.</div>`); return; }
    const { res, rec } = r;
    const faixa = res.faixa;
    const rev = FC.perfil.revisao(e.atual);
    const corpoRel = aba === "relatorio" && FC.perfilRelatorio ? await FC.perfilRelatorio.corpo(e, res, rec) : null;

    raiz.innerHTML = String(html`<div class="estreita perfil-tela">
      ${C.cabecalho("Perfil do investidor", `Avaliado em ${FC.datas.br(e.atual.criado_em.slice(0, 10))} · válido até ${FC.datas.br(e.atual.valido_ate)} · ${e.atual.versao_modelo}`,
        html`<button class="botao sec" id="pr-refaz">${icone("atualizar", 16)} Refazer</button>`)}
      ${abas(aba)}
      ${rev.estado === "obrigatoria" ? html`<div class="mensagem alerta mb3">${icone("alerta", 18)}<span>Este perfil passou de 24 meses. Refaça para o plano continuar valendo.</span></div>`
        : rev.estado === "sugerida" ? html`<div class="mensagem info mb3">${icone("info", 18)}<span>Faz mais de 12 meses. Vale revisar se a sua situação mudou.</span></div>` : ""}
      ${aba === "relatorio" ? corpoRel : html`
        <div class="cartao pr-destaque">
          <p class="rot fraco">Seu perfil</p>
          <h2 class="pr-perfil">${faixa.nome}</h2>
          <p>${FC.pilula(COR_PERFIL[res.perfil], `score ${res.score}`)} ${res.consistencia === "baixa" ? FC.pilula("amarelo", "baixa consistência") : ""}
            ${res.precisao === "reduzida" ? FC.pilula("cinza", "precisão reduzida") : ""}</p>
          <p class="texto-p mt2">${res.limitado_por === "capacidade"
            ? "O perfil é o menor entre tolerância e capacidade, e aqui o limite é a sua situação financeira."
            : "O perfil é o menor entre tolerância e capacidade, e aqui o limite é o quanto você se sente confortável com oscilação."}</p>
          ${res.tetos.length ? html`<ul class="pr-notas">${res.tetos.map((t) => html`<li>${FC.recomendacao.texto(t.regra, t)}</li>`)}</ul>` : ""}
          ${eixos(res, rec)}
        </div>
        ${conflitos(rec)}
        <div class="grade g2 mt3">${plano(rec)}${alocacaoAtual(rec, rec.alocacao)}</div>
        <div class="mt3">${candidatos(rec, res)}</div>
        ${rec.avisos.length ? html`<ul class="pr-avisos mt3">${rec.avisos.map((a) => html`<li>${a}</li>`)}</ul>` : ""}
        ${e.plano ? html`<div class="cartao mt3 pr-decisao">
          ${e.plano.decisao === "aplicado" ? html`<p>${icone("check", 16)} Plano aplicado em ${FC.datas.br((e.plano.decidido_em || "").slice(0, 10))}.</p>
              <button class="botao sec pequeno" id="pr-aplica">Aplicar de novo com os números de hoje</button>`
            : e.plano.decisao === "recusado" ? html`<p>Você manteve as metas atuais em ${FC.datas.br((e.plano.decidido_em || "").slice(0, 10))}.</p>
              <button class="botao" id="pr-aplica">Aplicar plano</button>`
            : html`<p>Aplicar grava a alocação-alvo nas suas metas, depois de mostrar o antes e o depois.</p>
              <div class="flex" style="gap:10px"><button class="botao" id="pr-aplica">Aplicar plano</button><button class="botao sec" id="pr-recusa">Manter minhas metas</button></div>`}
        </div>` : ""}`}
      <p class="fraco centro mt4" style="font-size:12.5px">${rec.rotulos.aviso}</p>
    </div>`);

    FC.$$("#pr-abas [data-aba]", raiz).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.aba === "relatorio" ? "#/perfil/relatorio" : "#/perfil"; }));
    FC.$("#pr-refaz", raiz).addEventListener("click", () => {
      FC.perfilDb.evento("revisao_aberta");
      FC.perfilFluxo.abre({ origem: "revisao" });
    });
    const planoReg = e.plano;
    const ap = FC.$("#pr-aplica", raiz), rc = FC.$("#pr-recusa", raiz);
    if (ap) ap.addEventListener("click", () => aplicar(e.atual, planoReg, rec));
    if (rc) rc.addEventListener("click", () => recusar(planoReg, rec));
    FC.$$("[data-ticker]", raiz).forEach((el) => el.addEventListener("click", () => C.abreAtivo && C.abreAtivo(el.dataset.ticker)));
    if (FC.perfilRelatorio && aba === "relatorio") FC.perfilRelatorio.liga(raiz, e, res, rec);
  };
})();
