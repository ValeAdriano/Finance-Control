/* Casca do app: sessão, navegação, estado e carregamento.
 *
 * Fluxo: sem sessão → login. Com sessão → carrega as tabelas (rápido),
 * pinta a tela e só então busca o mercado (lento), repintando quando
 * chega. Assim nada fica em branco esperando o Fundamentus. */
(function () {
  const FC = window.FC;
  const { html, icone } = FC;

  const ROTAS = [
    { id: "inicio", nome: "Início", icone: "inicio" },
    { id: "ativos", nome: "Investimentos", icone: "ativos" },
    { id: "agro", nome: "Agro", icone: "agro" },
    { id: "aportes", nome: "Aportes", icone: "aportes" },
    { id: "dividendos", nome: "Dividendos", icone: "moeda" },
    { id: "salario", nome: "Salário", icone: "carteira" },
    { id: "renda", nome: "Renda", icone: "renda" },
    { id: "simular", nome: "Simular", icone: "simular" },
    { id: "projecoes", nome: "Projeções", icone: "projecoes" },
    { id: "ajustes", nome: "Ajustes", icone: "ajustes", oculta: true },
  ];
  const NO_CELULAR = ["inicio", "ativos", "agro", "aportes"];

  const estado = (FC.estado = { base: null, prefs: null, mercado: { universo: null, historicos: {}, spot: {} }, dados: null,
    carregandoMercado: false, erroMercado: null, spotEm: null, proventos: null, proventosEm: null });

  // proventos dos ativos que pagam dividendo (carteira e o que já teve aporte)
  FC.carregaProventos = async function (forcar = false) {
    if (!estado.base) return null;
    const itens = estado.base.ativos.filter((a) => a.classe !== "cripto").map((a) => ({ ticker: a.ticker, classe: a.classe }));
    if (!itens.length) { estado.proventos = {}; return estado.proventos; }
    if (!forcar && estado.proventos && Date.now() - estado.proventosEm < 30 * 60 * 1000
        && itens.every((i) => estado.proventos[i.ticker])) return estado.proventos;
    try {
      estado.proventos = { ...(estado.proventos || {}), ...(await FC.mercado.proventos(itens, forcar)) };
      estado.proventosEm = Date.now();
    } catch (e) { console.error(e); estado.proventos = estado.proventos || {}; }
    return estado.proventos;
  };

  // ---------------------------------------------------------------- preferências
  FC.montaPrefs = function (brutas) {
    return {
      alocacao_alvo: { ...FC.PADRAO_ALOCACAO, ...(brutas.alocacao_alvo || {}) },
      premissas: FC.mescla(FC.PADRAO_PREMISSAS, brutas.premissas),
      premissas_salvas: !!brutas.premissas,
      regras: brutas.regras ? FC.mescla(FC.PADRAO_REGRAS, brutas.regras) : JSON.parse(JSON.stringify(FC.PADRAO_REGRAS)),
      renda: brutas.renda || JSON.parse(JSON.stringify(FC.PADRAO_RENDA)),
      agro: FC.mescla(FC.PADRAO_AGRO, brutas.agro),
      plano: FC.mescla(FC.PADRAO_PLANO, brutas.plano),
    };
  };

  FC.recalcula = function () {
    if (!estado.base) return;
    estado.dados = FC.carteira.monta(estado.base, estado.mercado, estado.prefs);
  };

  FC.recarregaBase = async function () {
    estado.base = await FC.db.carregaTudo();
    estado.prefs = FC.montaPrefs(estado.base.prefsBrutas);
    FC.recalcula();
  };

  // tickers cujo histórico interessa: carteira, watchlist e o que aparece
  // nos aportes (para a curva de evolução)
  function itensDeMercado() {
    const m = new Map();
    for (const a of estado.base.ativos) m.set(a.ticker, { ticker: a.ticker, classe: a.classe });
    for (const a of estado.base.aportes) {
      if (a.tipo === "ativo" && a.ticker && !m.has(a.ticker)) m.set(a.ticker, { ticker: a.ticker, classe: "acao_br" });
    }
    return [...m.values()];
  }

  FC.carregaMercado = async function (forcar = false) {
    if (estado.carregandoMercado) return;
    estado.carregandoMercado = true;
    estado.erroMercado = null;
    atualizaBotaoAtualizar();
    try {
      const anos = estado.prefs.regras.janela_historico_anos || 3;
      const [universo, historicos] = await Promise.all([
        FC.mercado.universo(forcar),
        FC.mercado.historicos(itensDeMercado(), anos, forcar),
      ]);
      estado.mercado = { ...estado.mercado, universo, historicos: { ...estado.mercado.historicos, ...historicos } };
      await buscaCotacoes();
      FC.recalcula();
      estado.erroMercado = null;
      await gravaRegistroDoDia();
      FC.carregaProventos(forcar);
    } catch (e) {
      estado.erroMercado = e.message || String(e);
      console.error(e);
    } finally {
      estado.carregandoMercado = false;
      atualizaBotaoAtualizar();
      FC.rerender({ suave: true });
    }
  };

  // ---------------------------------------------------------------- preço de agora
  // A cada minuto, com o app aberto: cripto pelo CoinGecko, bolsa pelo
  // Yahoo. O valor de cada posição é quantidade × esse preço.
  function itensDaCarteira() {
    return estado.base.ativos.map((a) => ({ ticker: a.ticker, classe: a.classe }));
  }
  async function buscaCotacoes() {
    try {
      const s = await FC.mercado.cotacoes(itensDaCarteira());
      for (const [t, v] of Object.entries(s)) if (v && !v.erro) estado.mercado.spot[t] = v;
      estado.spotEm = new Date();
      return true;
    } catch (e) { console.error(e); return false; }
  }

  let relogio = null;
  function ligaAtualizacaoAutomatica() {
    clearInterval(relogio);
    relogio = setInterval(async () => {
      if (document.hidden || !estado.base || estado.carregandoMercado || !estado.mercado.universo) return;
      if (!(await buscaCotacoes())) return;
      FC.recalcula();
      gravaRegistroDoDia();
      // não repinta embaixo de quem está digitando ou com uma folha aberta
      const ocupado = FC.$(".fundo") || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (!ocupado) FC.rerender({ suave: true, semAnimacao: true });
    }, 60 * 1000);
  }
  document.addEventListener("visibilitychange", () => {
    // voltou para a aba depois de um tempo: atualiza na hora
    if (!document.hidden && estado.base && estado.spotEm && Date.now() - estado.spotEm > 60 * 1000) {
      buscaCotacoes().then((ok) => { if (ok) { FC.recalcula(); FC.rerender({ suave: true, semAnimacao: true }); } });
    }
  });

  // ---------------------------------------------------------------- registro diário
  // Uma foto por dia do patrimônio, cada classe e cada ativo. Grava no
  // máximo a cada 15 minutos; no mesmo dia, a mais recente substitui.
  let ultimoRegistro = 0;
  async function gravaRegistroDoDia(forcar = false) {
    const d = estado.dados;
    if (!d || !estado.mercado.universo || estado.erroMercado) return;
    if (!forcar && Date.now() - ultimoRegistro < 15 * 60 * 1000) return;
    const r = d.resumo;
    if (!(r.patrimonio > 0)) return;
    // se algum ativo da carteira ficou sem preço, a foto sairia menor que a realidade
    if (d.ativos.some((a) => a.na_carteira && !a.erro && !FC.ok(a.preco))) return;
    ultimoRegistro = Date.now();
    const hoje = FC.datas.hoje();
    const jaTinha = (estado.base.historico || []).some((h) => h.data === hoje);
    const ativos = d.ativos.filter((a) => a.posicao).map((a) => ({ ticker: a.ticker, classe: a.classe, pilar: a.pilar,
      quantidade: a.posicao.quantidade, preco: a.preco, valor: a.posicao.atual, custo: a.posicao.custo }));
    const linha = { data: hoje, registrado_em: new Date().toISOString(), origem: "app", patrimonio: r.patrimonio,
      renda_variavel: r.bolsa, cripto: r.cripto, renda_fixa: r.renda_fixa, agro: r.agro, investido: r.investido || null,
      por_pilar: Object.fromEntries(d.alocacao.map((l) => [l.chave, l.valor])), ativos };
    try {
      const salvo = await FC.db.gravaRegistro(linha);
      const h = estado.base.historico.filter((x) => x.data !== hoje);
      h.push({ ...salvo, patrimonio: Number(salvo.patrimonio), renda_variavel: Number(salvo.renda_variavel), cripto: Number(salvo.cripto),
        renda_fixa: Number(salvo.renda_fixa), agro: Number(salvo.agro), investido: salvo.investido == null ? null : Number(salvo.investido) });
      estado.base.historico = h.sort((a, b) => a.data.localeCompare(b.data));
      d.registros = estado.base.historico;
      if (!jaTinha) FC.db.log("registro_diario", { patrimonio: r.patrimonio, ativos: ativos.length });
    } catch (e) { console.error(e); }
  }
  FC.gravaRegistroDoDia = gravaRegistroDoDia;

  // busca só os históricos que faltam (depois de cadastrar um ativo novo)
  FC.completaMercado = async function () {
    const faltam = itensDeMercado().filter((i) => !estado.mercado.historicos[i.ticker]);
    if (!faltam.length || !estado.mercado.universo) { await buscaCotacoes(); FC.recalcula(); gravaRegistroDoDia(true); return; }
    try {
      const h = await FC.mercado.historicos(faltam, estado.prefs.regras.janela_historico_anos || 3);
      Object.assign(estado.mercado.historicos, h);
    } catch (e) { console.error(e); }
    await buscaCotacoes();
    FC.recalcula();
    gravaRegistroDoDia(true);
  };

  // ---------------------------------------------------------------- casca
  function casca() {
    const r = FC.$("#raiz");
    r.innerHTML = String(html`
      <header class="topo"><div class="topo-in">
        <a class="marca" href="#/inicio"><span class="logo">${FC.logo(16)}</span>Finance Control</a>
        <nav class="abas" aria-label="Seções">
          ${ROTAS.filter((x) => !x.oculta).map((x) => html`<a href="#/${x.id}" data-rota="${x.id}">${x.nome}</a>`)}
        </nav>
        <div class="acoes-topo">
          <button class="icone-bt" id="bt-privado" title="Esconder valores (modo privado)" aria-label="Esconder valores"></button>
          <button class="icone-bt" id="bt-atualizar" title="Atualizar cotações" aria-label="Atualizar cotações">${icone("atualizar", 19)}</button>
          <a class="icone-bt" href="#/ajustes" title="Ajustes" aria-label="Ajustes" data-rota="ajustes">${icone("ajustes", 19)}</a>
        </div>
      </div></header>
      <main id="conteudo" tabindex="-1"></main>
      <div class="barra-abas"><nav aria-label="Seções">
        ${NO_CELULAR.map((id) => { const x = ROTAS.find((y) => y.id === id); return html`<a href="#/${x.id}" data-rota="${x.id}">${icone(x.icone, 24)}<span>${x.nome}</span></a>`; })}
        <button type="button" id="bt-mais" data-rota="mais">${icone("mais", 24)}<span>Mais</span></button>
      </nav></div>`);
    FC.$("#bt-privado").addEventListener("click", () => {
      const v = !document.body.classList.contains("privado");
      FC.local.gravar("privado", v);
      aplicaPrivado();
    });
    FC.$("#bt-atualizar").addEventListener("click", async () => {
      FC.mercado.limpaCacheLocal();
      await FC.carregaMercado(true);
      if (!estado.erroMercado) {
        FC.ui.aviso("Cotações atualizadas");
        gravaRegistroDoDia(true);
        FC.db.log("precos", { manual: true, ativos: estado.base.ativos.length, patrimonio: estado.dados.resumo.patrimonio });
      } else {
        FC.ui.aviso(estado.erroMercado, "erro");
        FC.db.log("erro", { etapa: "atualizar cotações", erro: estado.erroMercado });
      }
    });
    FC.$("#bt-mais").addEventListener("click", abreMais);
    aplicaPrivado();
  }

  FC.aplicaPrivado = aplicaPrivado;
  function aplicaPrivado() {
    const v = !!FC.local.ler("privado", false);
    document.body.classList.toggle("privado", v);
    const b = FC.$("#bt-privado");
    if (b) {
      b.innerHTML = String(icone(v ? "olhoFechado" : "olho", 19));
      b.setAttribute("aria-pressed", String(v));
      b.title = v ? "Mostrar valores" : "Esconder valores (modo privado)";
    }
  }

  function atualizaBotaoAtualizar() {
    const b = FC.$("#bt-atualizar");
    if (b) b.classList.toggle("girando", estado.carregandoMercado);
  }

  function abreMais() {
    const extras = ROTAS.filter((x) => !NO_CELULAR.includes(x.id));
    const f = FC.ui.folha({
      titulo: "Mais",
      corpo: html`<div class="lista">
        ${extras.map((x) => html`<a class="item clicavel" href="#/${x.id}" style="color:inherit;text-decoration:none">
          <span style="color:var(--acento)">${icone(x.icone, 22)}</span><div class="principal"><div class="titulo">${x.nome}</div></div>
          <span class="chevron">${icone("chevron", 18)}</span></a>`)}
        <button class="item clicavel" id="mais-sair" style="width:100%;border:0;background:none;text-align:left;cursor:pointer">
          <span style="color:var(--vermelho)">${icone("sair", 22)}</span><div class="principal"><div class="titulo" style="color:var(--vermelho)">Sair</div></div></button>
      </div>`,
    });
    FC.$$("a.item", f.el).forEach((a) => a.addEventListener("click", () => f.fechar()));
    FC.$("#mais-sair", f.el).addEventListener("click", async () => { f.fechar(); await FC.sair(); });
  }

  FC.sair = async function () {
    await FC.auth.sair();
    FC.local.apagar("ultimo-uso");
    estado.base = null; estado.dados = null;
    clearInterval(relogio);
    FC.mercado.limpaCacheLocal();
    location.hash = "";
    FC.telas.login(FC.$("#raiz"));
  };

  // ---------------------------------------------------------------- rotas
  function rotaAtual() {
    const partes = (location.hash || "#/inicio").replace(/^#\/?/, "").split("/");
    const id = ROTAS.some((r) => r.id === partes[0]) ? partes[0] : "inicio";
    return { id, params: partes.slice(1).map(decodeURIComponent) };
  }

  let ultimaRota = null;
  FC.rerender = async function ({ suave = false, semAnimacao = false } = {}) {
    const main = FC.$("#conteudo");
    if (!main || !estado.base) return;
    const { id, params } = rotaAtual();
    FC.$$("[data-rota]").forEach((a) => {
      const atual = a.dataset.rota === id || (a.dataset.rota === "mais" && !NO_CELULAR.includes(id));
      if (atual) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const mudouDeTela = ultimaRota !== id;
    ultimaRota = id;
    const rolagem = window.scrollY;
    const pagina = document.createElement("div");
    pagina.className = suave && !mudouDeTela ? (semAnimacao ? "sem-anim" : "") : "pagina";
    try {
      await FC.telas[id](pagina, params);
    } catch (e) {
      console.error(e);
      pagina.innerHTML = String(html`<div class="mensagem erro">${icone("alerta", 18)}<span>Algo deu errado ao montar esta tela: ${e.message || e}</span></div>`);
    }
    main.replaceChildren(pagina);
    FC.animar(pagina, { semAnimacao: semAnimacao && !mudouDeTela });
    if (mudouDeTela) { window.scrollTo(0, 0); document.title = (ROTAS.find((r) => r.id === id) || {}).nome + " · Finance Control"; }
    else window.scrollTo(0, rolagem);
  };

  window.addEventListener("hashchange", () => FC.rerender());

  // ---------------------------------------------------------------- sessão de 7 dias
  // O login fica guardado nesta máquina e só cai depois de 7 dias SEM USO.
  // O Supabase renovaria a sessão para sempre (o limite de inatividade no
  // servidor é recurso do plano Pro), então o app mede o uso e, passado o
  // prazo, encerra a sessão — inclusive o token no Supabase.
  const INATIVIDADE_MAX = 7 * 24 * 60 * 60 * 1000;
  const CHAVE_USO = "ultimo-uso";
  let ultimaMarca = 0;
  function marcaUso() {
    const agora = Date.now();
    if (agora - ultimaMarca < 60 * 1000) return;   // no máximo 1 gravação por minuto
    ultimaMarca = agora;
    FC.local.gravar(CHAVE_USO, agora);
  }
  FC.marcaUso = () => { ultimaMarca = 0; marcaUso(); };
  function expirou() {
    const u = FC.local.ler(CHAVE_USO, null);
    return u != null && Date.now() - u > INATIVIDADE_MAX;
  }
  async function encerraPorInatividade() {
    try { await FC.sb.auth.signOut(); } catch (e) { /* já sem sessão */ }
    estado.base = null; estado.dados = null;
    clearInterval(relogio);
    FC.local.apagar(CHAVE_USO);
    FC.mercado.limpaCacheLocal();
    location.hash = "";
    FC.telas.login(FC.$("#raiz"), { aviso: "Sua sessão foi encerrada depois de 7 dias sem uso. Entre de novo." });
  }
  ["click", "keydown", "touchstart", "scroll"].forEach((ev) =>
    window.addEventListener(ev, () => { if (estado.base) marcaUso(); }, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !estado.base) return;
    if (expirou()) encerraPorInatividade(); else marcaUso();
  });
  // aba esquecida aberta: confere de tempos em tempos
  setInterval(() => { if (estado.base && expirou()) encerraPorInatividade(); }, 10 * 60 * 1000);

  // ---------------------------------------------------------------- início
  FC.entrarNoApp = async function () {
    const r = FC.$("#raiz");
    r.innerHTML = '<div class="carregando-tela"><div class="roda"></div><span>Abrindo seus dados…</span></div>';
    try {
      const s = await FC.auth.sessao();
      FC.auth.usuario = s.user;
      FC.marcaUso();
      await FC.recarregaBase();
    } catch (e) {
      FC.ui.erro(e);
      FC.telas.login(r);
      return;
    }
    casca();
    await FC.rerender();
    FC.carregaMercado(false);
    ligaAtualizacaoAutomatica();
  };

  async function inicia() {
    // sessão guardada, mas parada há mais de 7 dias: não entra
    if (expirou()) {
      try { await FC.sb.auth.signOut(); } catch (e) { /* segue */ }
      FC.local.apagar(CHAVE_USO);
      return FC.telas.login(FC.$("#raiz"), { aviso: "Sua sessão foi encerrada depois de 7 dias sem uso. Entre de novo." });
    }
    let s = null;
    try { s = await FC.auth.sessao(); } catch (e) { /* sem sessão */ }
    if (!s) return FC.telas.login(FC.$("#raiz"));
    // com verificação em duas etapas ligada, a sessão só vale depois do código
    try {
      const n = await FC.auth.nivel();
      if (n.nextLevel === "aal2" && n.currentLevel !== "aal2") return FC.telas.login(FC.$("#raiz"), { etapa: "mfa" });
    } catch (e) { /* segue */ }
    FC.entrarNoApp();
  }

  FC.sb.auth.onAuthStateChange((ev) => {
    if (ev === "SIGNED_OUT" && estado.base) { estado.base = null; FC.telas.login(FC.$("#raiz")); }
  });

  document.addEventListener("DOMContentLoaded", inicia);
  if (document.readyState !== "loading") inicia();
})();
