/* O que muda quando o painel roda dentro do app (iOS / Android).
 *
 * A ponte com os plugins nativos (window.FCNativo) só existe no app; no
 * navegador FC.app fica null e nada aqui roda. Tudo que é do aparelho —
 * bloqueio por Face ID, avisos — é guardado só neste aparelho. */
(function () {
  const FC = window.FC;
  const N = window.FCNativo;
  FC.app = null;
  if (!N) return;
  const { html, icone } = FC;

  document.documentElement.classList.add("app-nativo", "app-" + N.plataforma);

  // ---------------------------------------------------------------- backup
  // não há "baixar" numa WebView: grava o arquivo e abre a folha de compartilhar
  FC.baixar = function (nome, conteudo) {
    N.compartilhaArquivo(nome, conteudo).catch((e) => FC.ui.erro(e));
  };

  // ---------------------------------------------------------------- barra de status
  function barra() {
    const t = FC.local.ler("tema", "auto");
    const escuro = t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    N.barraDeStatus(escuro);
  }
  const aplicaTema = FC.aplicaTema;
  FC.aplicaTema = function (tema) { aplicaTema(tema); barra(); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", barra);
  barra();

  // ---------------------------------------------------------------- bloqueio
  // Com o bloqueio ligado, o app pede Face ID / digital ao abrir e ao
  // voltar depois de 1 minuto em segundo plano. A tela de bloqueio entra
  // já ao sair, para o painel não aparecer na troca de apps.
  const VOLTA_SEM_PEDIR = 60 * 1000;
  const bloqueioLigado = () => !!FC.local.ler("bloqueio-bio", false);
  let saiuEm = 0, trava = null, esperando = null;

  function mostraTrava() {
    if (trava) return trava;
    trava = document.createElement("div");
    trava.className = "trava";
    trava.innerHTML = String(html`<div class="trava-in">
      <div class="logo-g">${FC.logo(30)}</div>
      <h1>Finance Control</h1><p class="sub">Bloqueado</p>
      <button class="botao" type="button">${icone("rosto", 18)} Desbloquear</button></div>`);
    document.body.appendChild(trava);
    FC.$("button", trava).addEventListener("click", () => pede());
    return trava;
  }
  function tiraTrava() { if (trava) { trava.remove(); trava = null; } }

  async function pede() {
    if (esperando) return esperando;
    esperando = N.biometria.autenticar("Desbloquear seus investimentos").then((ok) => {
      esperando = null;
      if (ok) { tiraTrava(); resolveTrava && resolveTrava(); resolveTrava = null; }
      return ok;
    });
    return esperando;
  }
  let resolveTrava = null;
  // resolve quando o dono se identificar (pode tentar quantas vezes quiser)
  function destrava() {
    if (!bloqueioLigado()) return Promise.resolve();
    mostraTrava();
    const p = new Promise((r) => { resolveTrava = r; });
    pede();
    return p;
  }

  N.ciclo.aoSair(() => {
    saiuEm = Date.now();
    if (bloqueioLigado() && FC.estado && FC.estado.base) mostraTrava();
  });
  N.ciclo.aoVoltar(() => {
    if (!trava) return;
    if (Date.now() - saiuEm < VOLTA_SEM_PEDIR) return tiraTrava();
    pede();
  });

  // ---------------------------------------------------------------- voltar (Android)
  N.ciclo.aoVoltarTela(() => {
    const fundos = FC.$$(".fundo");
    if (fundos.length) { const x = FC.$(".fechar", fundos.at(-1)); if (x) return x.click(); }
    if (trava) return N.ciclo.fecharApp();
    // detalhe (#/ativos/ITSA4) volta para a lista; uma tela volta para o início
    const partes = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!partes.length || (partes[0] === "inicio" && partes.length === 1)) return N.ciclo.fecharApp();
    location.hash = partes.length > 1 ? "#/" + partes[0] : "#/inicio";
  });

  // ---------------------------------------------------------------- avisos
  // Agendados no próprio aparelho (sem servidor de push): salário,
  // proventos anunciados e o lembrete do plano. Refeitos sempre que os
  // dados mudam; o iOS guarda até 64 avisos pendentes.
  const avisosLigados = () => !!FC.local.ler("avisos", false);
  const as = (iso, hora) => new Date(iso + "T" + String(hora).padStart(2, "0") + ":00:00");
  let espera = null;

  function montaAvisos() {
    const e = FC.estado;
    if (!e || !e.base) return [];
    const hoje = FC.datas.hoje();
    const lista = [];
    // salário: no dia, com quanto o plano manda investir
    const plano = e.prefs && e.prefs.plano;
    for (const p of FC.salario.proximos(e.base.ganhos || [], hoje, 3)) {
      let texto = `${p.ganho.nome || FC.CATEGORIAS_GANHO[p.ganho.categoria] || "Ganho"}: ${FC.fmt.brlTexto(p.valor)}.`;
      if (plano && plano.destinos && plano.destinos.length) {
        const g = FC.salario.planoDoMes({ plano, ganhos: e.base.ganhos || [], base: e.base, mes: p.data.slice(0, 7) });
        if (g.total > 0) texto += ` O plano do mês é investir ${FC.fmt.brlTexto(g.total)}.`;
      }
      lista.push({ titulo: "Dia de receber", texto, quando: as(p.data, 9), rota: "#/salario" });
    }
    // proventos anunciados com data de pagamento
    if (e.proventos && e.dados) {
      try {
        const r = FC.dividendos.analisa(e.dados, e.base, e.proventos);
        const porDia = {};
        for (const x of r.proximos.filter((x) => x.pagamento && x.pagamento >= hoje && x.valor > 0)) {
          (porDia[x.pagamento] = porDia[x.pagamento] || []).push(x);
        }
        for (const [dia, itens] of Object.entries(porDia)) {
          const total = FC.soma(itens, (x) => x.valor);
          const quem = itens.map((x) => x.ticker).filter((t, i, a) => a.indexOf(t) === i).join(", ");
          lista.push({ titulo: "Proventos caindo hoje", texto: `${quem}: cerca de ${FC.fmt.brlTexto(total)}.`, quando: as(dia, 10), rota: "#/dividendos" });
        }
      } catch (err) { console.error(err); }
    }
    // perto do fim do mês, confere o plano
    if (plano && plano.destinos && plano.destinos.length) {
      for (let i = 0; i < 3; i++) {
        const mes = FC.datas.soma(hoje.slice(0, 8) + "01", 32 * i).slice(0, 7);
        const dia = FC.datas.soma(`${mes}-${String(FC.datas.ultimoDiaDoMes(mes)).padStart(2, "0")}`, -5);
        lista.push({ titulo: "Guia do mês", texto: "Faltam poucos dias para o mês acabar. Confira o que falta aportar no plano.", quando: as(dia, 19), rota: "#/salario" });
      }
    }
    return lista.map((x, i) => ({ ...x, id: i + 1 }));
  }

  async function agendaAvisos() {
    if (!avisosLigados()) return;
    try {
      if (!(await N.avisos.permitido(false))) return;
      await N.avisos.agenda(montaAvisos());
    } catch (e) { console.error(e); }
  }
  N.avisos.aoTocar((rota) => { if (rota) location.hash = rota; });

  // ---------------------------------------------------------------- ajustes
  async function secaoAjustes() {
    const bio = await N.biometria.disponivel();
    return html`<div class="lista">
      <div class="item"><span style="color:var(--acento)">${icone("rosto", 22)}</span>
        <div class="principal"><div class="titulo">Bloquear com ${bio.nome}</div>
          <div class="detalhe">${bio.ok ? "pede ao abrir o app e ao voltar depois de 1 minuto" : bio.semCadastro ? `cadastre ${bio.nome} nos ajustes do aparelho para usar` : "este aparelho não tem biometria; o código do aparelho serve"}</div></div>
        <label class="interruptor"><input type="checkbox" id="aj-bio" ${bloqueioLigado() ? "checked" : ""}><span></span></label></div>
      <div class="item"><span style="color:var(--acento)">${icone("sino", 22)}</span>
        <div class="principal"><div class="titulo">Avisos</div>
          <div class="detalhe">dia do salário, proventos anunciados e lembrete do plano no fim do mês</div></div>
        <label class="interruptor"><input type="checkbox" id="aj-avisos" ${avisosLigados() ? "checked" : ""}><span></span></label></div>
    </div>`;
  }
  function ligaAjustes(raiz) {
    const bio = FC.$("#aj-bio", raiz), av = FC.$("#aj-avisos", raiz);
    if (bio) bio.addEventListener("change", async () => {
      // para ligar ou desligar, o dono se identifica
      const ok = await N.biometria.autenticar(bio.checked ? "Ligar o bloqueio do app" : "Desligar o bloqueio do app");
      if (!ok) { bio.checked = !bio.checked; return; }
      FC.local.gravar("bloqueio-bio", bio.checked);
      FC.ui.aviso(bio.checked ? "Bloqueio ligado" : "Bloqueio desligado");
    });
    if (av) av.addEventListener("change", async () => {
      if (av.checked) {
        if (!(await N.avisos.permitido(true))) {
          av.checked = false;
          return FC.ui.aviso("Permita as notificações do Finance Control nos ajustes do aparelho.", "erro");
        }
        FC.local.gravar("avisos", true);
        await agendaAvisos();
        FC.ui.aviso("Avisos ligados");
      } else {
        FC.local.gravar("avisos", false);
        await N.avisos.cancelaTudo().catch(() => {});
        FC.ui.aviso("Avisos desligados");
      }
    });
  }

  FC.app = {
    plataforma: N.plataforma,
    destrava,
    agendaAvisos() { clearTimeout(espera); espera = setTimeout(agendaAvisos, 1500); },
    secaoAjustes, ligaAjustes,
    // ao sair da conta, nada do dono fica agendado no aparelho
    async aoSair() { await N.avisos.cancelaTudo().catch(() => {}); },
    escondeAbertura: () => N.escondeAbertura().catch(() => {}),
  };
})();
