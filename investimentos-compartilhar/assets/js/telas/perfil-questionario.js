/* Questionário do perfil do investidor e a porta de entrada do fluxo.
 *
 * Três portas levam ao mesmo questionário e ao mesmo motor; muda só o que
 * acontece se a pessoa adiar:
 *   conta nova      tela cheia logo depois do cadastro; sair salva o rascunho
 *   conta antiga    convite no primeiro login, até 3 adiamentos; depois o
 *                   card fica fixo no Início (nunca bloqueia o acesso)
 *   revisão         12 meses (sugerida) ou 24 (obrigatória)
 *
 * Uma pergunta por tela, faixas em vez de valores, "por que perguntamos"
 * recolhível e rascunho salvo a cada resposta. Sem carrossel. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone } = FC;
  const P = FC.PERFIL;

  const estado = () => FC.estado.perfil || (FC.estado.perfil = { indisponivel: false, atual: null, rascunho: null, plano: null, adiamentos: 0, modo: "educativo" });
  const dispo = () => !estado().indisponivel;
  let aberto = null;

  // ---------------------------------------------------------------- dados do sistema
  function agroPct() {
    const d = FC.estado.dados;
    if (!d || !d.resumo || !(d.resumo.patrimonio > 0)) return null;
    return Math.round(((d.resumo.agro || 0) / d.resumo.patrimonio) * 100);
  }

  // ---------------------------------------------------------------- carregar e decidir
  async function carrega() {
    const e = estado();
    Object.assign(e, await FC.perfilDb.carrega());
    try { e.mfa = ((await FC.auth.fatores()).totp || []).some((f) => f.status === "verified"); } catch (x) { e.mfa = false; }
    return e;
  }

  // chamado na entrada do app. Devolve true se abriu algo por cima (e o tour fica de fora)
  async function inicia() {
    const e = await carrega();
    if (e.indisponivel) return false;
    FC.rerender({ suave: true, semAnimacao: true });
    const u = FC.auth.usuario || {};
    const criada = u.created_at ? Date.now() - new Date(u.created_at).getTime() : Infinity;
    const nova = !e.atual && !e.rascunho && (!(u.user_metadata || {}).onboarding_visto || criada < 24 * 3600 * 1000) && e.adiamentos === 0;

    if (e.atual) {
      const rev = FC.perfil.revisao(e.atual, { rendaAtual: null });
      if (rev.estado === "obrigatoria" && !FC.local.ler("perfil-venceu-sessao", false)) {
        FC.local.gravar("perfil-venceu-sessao", true);
        FC.db.log("perfil_revisao_vencida", { versao: e.atual.versao_modelo });
        convite({ revisao: true });
        return true;
      }
      ativacao();
      return false;
    }
    if (nova) {
      marcaTourVisto();
      abre({ origem: "cadastro" });
      return true;
    }
    if (e.rascunho) return false;           // o card "Termine seu perfil" cuida
    if (e.adiamentos < P.max_adiamentos) { convite({}); return true; }
    return false;
  }

  // a pessoa já chegou ao primeiro valor: avisa o funil uma vez por conta
  function ativacao() {
    const e = estado(), b = FC.estado.base;
    if (e.ativou || !e.atual || !b) return;
    const tem = (b.ativos || []).length || (b.aportes || []).length || (b.rendaFixa || []).length || (e.plano && e.plano.decisao === "aplicado");
    if (!tem) return;
    e.ativou = true;
    const dias = (Date.now() - new Date((FC.auth.usuario || {}).created_at || Date.now()).getTime()) / 86400000;
    FC.perfilDb.evento("ativacao", dias <= 7 ? "em_7_dias" : "depois");
  }

  async function marcaTourVisto() {
    try {
      const r = await FC.sb.auth.updateUser({ data: { onboarding_visto: new Date().toISOString() } });
      if (r.data && r.data.user) FC.auth.usuario = r.data.user;
    } catch (x) { /* a apresentação por passos fica disponível em Ajustes */ }
  }

  // ---------------------------------------------------------------- convite (conta antiga e revisão)
  function convite({ revisao = false }) {
    const e = estado();
    const restantes = P.max_adiamentos - e.adiamentos;
    const f = FC.ui.folha({
      titulo: revisao ? "Hora de revisar seu perfil" : "Monte seu plano de investimento",
      corpo: html`<div class="pq-convite">
        <div class="pq-convite-ic">${icone("bussola", 30)}</div>
        <p class="texto-p" style="font-size:15.5px;color:var(--ink)">${revisao
          ? "Seu perfil passou de 24 meses. Sua situação e seus objetivos podem ter mudado, então vale refazer em poucos minutos."
          : "Responda cerca de 20 perguntas rápidas, em 3 minutos, e receba seu perfil, o quanto guardar por mês e a alocação por classe."}</p>
        ${e.atual || !(FC.estado.dados && FC.estado.dados.resumo.patrimonio > 0) ? "" : html`<p class="texto-p">Já preenchemos o que o sistema sabe da sua carteira. Você só confirma.</p>`}
        ${!revisao && restantes > 0 ? html`<p class="fraco" style="font-size:13px">Você pode adiar ${restantes === 1 ? "mais uma vez" : `mais ${restantes} vezes`}. Nada do que você já tem fica bloqueado.</p>` : ""}
      </div>`,
      rodape: html`${revisao ? "" : html`<button class="botao sec" data-r="depois">Agora não</button>`}<button class="botao" data-r="ir">${revisao ? "Revisar agora" : "Começar"}</button>`,
    });
    FC.$("[data-r=ir]", f.el).addEventListener("click", () => { f.fechar(); abre({ origem: revisao ? "revisao" : "migracao" }); });
    const depois = FC.$("[data-r=depois]", f.el);
    if (depois) depois.addEventListener("click", async () => {
      f.fechar();
      e.adiamentos++;
      await FC.perfilDb.evento("adiado", "convite");
      FC.rerender({ suave: true, semAnimacao: true });
    });
  }

  // ---------------------------------------------------------------- questionário
  function abre({ origem = "cadastro", inicial = {}, irPara = null } = {}) {
    if (aberto) return;
    const e = estado();
    const base = FC.estado.base, dados = FC.estado.dados;
    // o que o sistema já sabe: a pessoa só confirma
    const sugerido = e.atual ? e.atual.respostas : FC.perfil.sugereRespostas(base, dados);
    const resp = { ...sugerido, ...((e.rascunho && e.rascunho.respostas) || {}), ...inicial };
    delete resp.agro_pct;
    const perguntas = P.perguntas;
    let i = irPara != null ? Math.max(0, perguntas.findIndex((q) => q.id === irPara)) + 1 : e.rascunho && !e.atual ? Math.min(perguntas.length, (e.rascunho.passo || 0)) : 0;
    const inicio = Date.now();
    let visto = new Set();
    let timerSalva = null;

    const fundo = document.createElement("div");
    fundo.className = "pq-fundo";
    fundo.innerHTML = String(html`<div class="pq" role="dialog" aria-modal="true" aria-label="Perfil do investidor">
      <div class="pq-topo">
        <button class="botao texto pequeno" type="button" data-pq="sair">${icone("fechar", 16)} Sair e continuar depois</button>
        <span class="pq-bloco" id="pq-bloco"></span>
      </div>
      <div class="pq-progresso"><i id="pq-prog"></i></div>
      <div class="pq-corpo" id="pq-corpo" tabindex="-1"></div>
      <div class="pq-rodape">
        <button class="botao sec" type="button" data-pq="voltar">Voltar</button>
        <button class="botao texto" type="button" data-pq="pular" hidden>Pular por agora</button>
        <button class="botao" type="button" data-pq="avancar">Continuar</button>
      </div>
    </div>`);
    document.body.appendChild(fundo);
    document.documentElement.classList.add("ob-aberto");
    aberto = fundo;
    const $ = (s) => FC.$(s, fundo);

    function guarda() {
      clearTimeout(timerSalva);
      timerSalva = setTimeout(() => { FC.perfilDb.salvaRascunho(resp, i).then((r) => { e.rascunho = r; }).catch(() => { /* tenta na próxima resposta */ }); }, 350);
    }
    async function guardaJa() {
      clearTimeout(timerSalva);
      try { e.rascunho = await FC.perfilDb.salvaRascunho(resp, i); } catch (x) { /* segue */ }
    }

    function fecha() {
      document.removeEventListener("keydown", tecla);
      fundo.classList.remove("visivel");
      document.documentElement.classList.remove("ob-aberto");
      setTimeout(() => fundo.remove(), 260);
      aberto = null;
    }

    // ---- telas
    function consentimento() {
      return html`<div class="pq-intro">
        <div class="pq-convite-ic">${icone("bussola", 32)}</div>
        <h1>Vamos montar o seu perfil</h1>
        <p class="pq-sub">Cerca de 20 perguntas, uma por tela, em menos de 3 minutos. No fim você recebe o seu perfil, quanto guardar por mês e como dividir.</p>
        <ul class="pq-lista">
          <li>${icone("check", 16)} <span><b>O que coletamos:</b> suas respostas, sempre em faixas (nunca o valor exato de renda ou patrimônio).</span></li>
          <li>${icone("check", 16)} <span><b>Para quê:</b> calcular o perfil e o plano. Nada é enviado a terceiros nem a serviços externos.</span></li>
          <li>${icone("cadeado", 16)} <span><b>Seus direitos:</b> só você vê estas respostas, pode baixá-las em Ajustes → Dados e elas são apagadas junto com a conta.</span></li>
          <li>${icone("info", 16)} <span>É uma ferramenta pessoal baseada no questionário. <b>Não é recomendação de investimento.</b></span></li>
        </ul>
        ${e.atual ? html`<p class="pq-sub">Suas respostas anteriores já vêm marcadas: confirme ou mude.</p>` : ""}
      </div>`;
    }

    function perguntaHtml(q) {
      const bl = P.blocos.find((b) => b.id === q.bloco);
      const atual = resp[q.id];
      const marcado = (id) => (q.multipla ? Array.isArray(atual) && atual.includes(id) : atual === id);
      return html`<div class="pq-pergunta" data-q="${q.id}">
        <p class="pq-eixo">${bl.nome} · ${bl.eixo}</p>
        <h1 id="pq-titulo">${q.texto}</h1>
        ${q.multipla ? html`<p class="pq-sub">Pode marcar mais de um.</p>` : ""}
        <div class="pq-opcoes" role="${q.multipla ? "group" : "radiogroup"}" aria-labelledby="pq-titulo">
          ${q.opcoes.map((o) => html`<button type="button" class="pq-opcao ${o.nd ? "nd" : ""}" role="${q.multipla ? "checkbox" : "radio"}" aria-checked="${marcado(o.id)}" data-o="${o.id}">
            <span class="pq-marca">${icone("check", 14)}</span><span>${o.rotulo}</span></button>`)}
        </div>
        ${q.dinheiro ? html`<p class="pq-sub">Guardamos só a faixa. “Prefiro não dizer” funciona, mas deixa o plano menos preciso.</p>` : ""}
        <details class="pq-porque"><summary>Por que perguntamos?</summary><p>${q.porque}</p></details>
      </div>`;
    }

    function resumoFinal() {
      const pend = FC.perfil.faltantes(resp);
      return html`<div class="pq-intro">
        <div class="pq-convite-ic">${icone("check", 32)}</div>
        <h1>${pend.length ? "Faltam algumas respostas" : "Tudo pronto"}</h1>
        <p class="pq-sub">${pend.length ? `Faltam ${pend.length} pergunta${pend.length > 1 ? "s" : ""} que o cálculo exige.` : "Com as suas respostas, calculamos o perfil, o plano e a alocação."}</p>
        ${pend.length ? html`<ul class="pq-lista">${pend.map((id) => html`<li><button type="button" class="botao texto" data-vai="${id}">${FC.perfil.pergunta(id).texto}</button></li>`)}</ul>` : ""}
        ${FC.perfil.opcionaisEmAberto(resp).length && !pend.length ? html`<p class="pq-sub">Algumas perguntas opcionais ficaram para depois: elas aparecem no checklist do Início e deixam o plano mais preciso.</p>` : ""}
      </div>`;
    }

    // ---- navegação: 0 = consentimento · 1..N = perguntas · N+1 = fim
    function pinta() {
      const total = perguntas.length;
      const corpo = $("#pq-corpo");
      const q = i >= 1 && i <= total ? perguntas[i - 1] : null;
      corpo.innerHTML = String(i === 0 ? consentimento() : q ? perguntaHtml(q) : resumoFinal());
      corpo.classList.remove("entra"); void corpo.offsetWidth; corpo.classList.add("entra");
      $("#pq-prog").style.width = (i / (total + 1)) * 100 + "%";
      const bl = q ? P.blocos.find((b) => b.id === q.bloco) : null;
      $("#pq-bloco").textContent = bl ? `Bloco ${bl.n} de ${P.blocos.length}` : "";
      $("[data-pq=voltar]").style.visibility = i > 0 ? "visible" : "hidden";
      const pular = $("[data-pq=pular]");
      pular.hidden = !(q && !q.essencial);
      const av = $("[data-pq=avancar]");
      const final = i > total;
      av.textContent = i === 0 ? "Concordo e começo" : final ? (FC.perfil.faltantes(resp).length ? "Responder o que falta" : "Ver meu perfil") : "Continuar";
      av.disabled = q ? !(q.multipla || resp[q.id]) : false;
      // funil: cada bloco visto e concluído, sem dado financeiro
      if (q && !visto.has(q.bloco)) { visto.add(q.bloco); FC.perfilDb.evento("passo_visto", "bloco_" + P.blocos.find((b) => b.id === q.bloco).n); }
      corpo.focus({ preventScroll: true });
      guarda();
    }

    function blocoConcluido(deIdx, paraIdx) {
      const a = perguntas[deIdx - 1], b = perguntas[paraIdx - 1];
      if (a && (!b || b.bloco !== a.bloco)) FC.perfilDb.evento("bloco_concluido", "bloco_" + P.blocos.find((x) => x.id === a.bloco).n);
    }

    async function vai(n) {
      const total = perguntas.length;
      const novo = Math.max(0, Math.min(total + 1, n));
      if (novo > i) blocoConcluido(i, novo);
      i = novo;
      pinta();
    }

    async function avancar() {
      const total = perguntas.length;
      if (i > total) {
        if (FC.perfil.faltantes(resp).length) return vai(perguntas.findIndex((q) => q.id === FC.perfil.faltantes(resp)[0]) + 1);
        return conclui();
      }
      vai(i + 1);
    }

    function escolhe(botao) {
      const q = perguntas[i - 1];
      const id = botao.dataset.o;
      if (q.multipla) {
        const lista = Array.isArray(resp[q.id]) ? resp[q.id].slice() : [];
        const k = lista.indexOf(id);
        if (k >= 0) lista.splice(k, 1); else lista.push(id);
        resp[q.id] = lista;
        botao.setAttribute("aria-checked", String(k < 0));
        guarda();
        return;
      }
      resp[q.id] = id;
      FC.$$(".pq-opcao", fundo).forEach((b) => b.setAttribute("aria-checked", String(b === botao)));
      $("[data-pq=avancar]").disabled = false;
      FC.perfilDb.evento("respondido", q.id);
      guarda();
      setTimeout(() => { if (aberto && perguntas[i - 1] === q) avancar(); }, 220);
    }

    async function conclui() {
      const btn = $("[data-pq=avancar]");
      const dadosFinal = { ...resp };
      const pct = agroPct();
      if (pct != null) dadosFinal.agro_pct = pct;
      for (const k of Object.keys(dadosFinal)) if (dadosFinal[k] == null || (Array.isArray(dadosFinal[k]) && !dadosFinal[k].length && k !== "produtos")) delete dadosFinal[k];
      const calculo = FC.perfil.calcula(dadosFinal);
      let rec;
      try {
        rec = FC.recomendacao.gera({ resp: dadosFinal, res: calculo, prefs: FC.estado.prefs, dados: FC.estado.dados, base, mercado: FC.estado.mercado, modo: e.modo });
      } catch (x) { console.error(x); FC.ui.erro(x); return; }
      try {
        await FC.ui.ocupado(btn, async () => {
          clearTimeout(timerSalva);
          const reg = await FC.perfilDb.conclui({ respostas: dadosFinal, calculo, origem, necessidade: rec.necessidade });
          const seguro = JSON.parse(JSON.stringify(rec));     // Infinity vira null
          await FC.perfilDb.salvaPlano({ perfilId: reg.id, plano: seguro, modo: e.modo });
          await FC.perfilDb.apagaRascunho();
          await FC.perfilDb.evento("perfil_concluido", origem, Date.now() - inicio);
          FC.db.log("perfil_calculado", { perfil: calculo.perfil, versao: calculo.versao, origem, consistencia: calculo.consistencia });
          await carrega();
        });
      } catch (x) {
        FC.ui.erro(/perfil_adulterado|versao_modelo/.test(String(x.message)) ? new Error("Não consegui conferir o resultado no servidor. Atualize a página e tente de novo.") : x);
        return;
      }
      fecha();
      location.hash = "#/perfil";
      FC.rerender();
    }

    async function sair() {
      await guardaJa();
      fecha();
      FC.rerender({ suave: true, semAnimacao: true });
      FC.ui.aviso("Progresso salvo. Continue quando quiser pelo Início.");
    }

    function tecla(ev) {
      if (ev.key === "Escape") { ev.preventDefault(); sair(); }
      else if (ev.key === "Enter" && ev.target.tagName !== "BUTTON" && !$("[data-pq=avancar]").disabled) { ev.preventDefault(); avancar(); }
    }

    fundo.addEventListener("click", (ev) => {
      const op = ev.target.closest(".pq-opcao");
      if (op) return escolhe(op);
      const vaiA = ev.target.closest("[data-vai]");
      if (vaiA) return vai(perguntas.findIndex((q) => q.id === vaiA.dataset.vai) + 1);
      const b = ev.target.closest("[data-pq]");
      if (!b) return;
      const acao = b.dataset.pq;
      if (acao === "sair") sair();
      else if (acao === "voltar") vai(i - 1);
      else if (acao === "avancar") avancar();
      else if (acao === "pular") { const q = perguntas[i - 1]; delete resp[q.id]; vai(i + 1); }
    });
    document.addEventListener("keydown", tecla);
    FC.perfilDb.evento("passo_visto", "consentimento");
    requestAnimationFrame(() => { fundo.classList.add("visivel"); pinta(); });
  }

  FC.perfilFluxo = { inicia, abre, convite, carrega, ativacao, dispo };
})();
