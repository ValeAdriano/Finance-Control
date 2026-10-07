/* Painel do administrador: vídeos de divulgação, cliques, jornadas e
 * logs com insights de usabilidade.
 *
 * Só abre para quem está em public.admins (a RLS garante: para os outros
 * a tabela de uso volta vazia). Os eventos são anônimos — ver uso.js. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone, fmt } = FC;
  const C = FC.comum;

  // ---------------------------------------------------------------- dados
  let cache = { dias: null, em: 0, eventos: null, erros: null };
  async function carrega(dias, forcar = false) {
    if (!forcar && cache.dias === dias && Date.now() - cache.em < 120000) return cache;
    const desde = new Date(Date.now() - dias * 864e5).toISOString();
    const eventos = [];
    for (let de = 0; de < 60000; de += 1000) {
      const { data, error } = await FC.sb.from("uso_eventos").select("quando,visitante,sessao,tipo,rota,alvo,duracao_ms,aparelho,detalhe")
        .gte("quando", desde).order("quando", { ascending: true }).range(de, de + 999);
      if (error) throw error;
      eventos.push(...data);
      if (data.length < 1000) break;
    }
    const r = await FC.sb.rpc("admin_erros_sistema", { dias });
    cache = { dias, em: Date.now(), eventos, erros: r.error ? [] : r.data || [] };
    return cache;
  }

  // ---------------------------------------------------------------- análise
  const nomeRota = (r) => {
    if (!r) return "—";
    if (r.startsWith("retrospectiva/")) return "Retrospectiva " + (r.endsWith("ano") ? "do ano" : "do mês");
    const x = FC.ROTAS.find((y) => y.id === r);
    return x ? x.nome : r;
  };
  const mediana = (xs) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
  const conta = (obj, k, n = 1) => { obj[k] = (obj[k] || 0) + n; };
  const ts = (e) => Date.parse(e.quando);

  function analisa(eventos) {
    // ---- sessões e passos
    const porSessao = {};
    for (const e of eventos) (porSessao[e.sessao] = porSessao[e.sessao] || []).push(e);
    const sessoes = Object.entries(porSessao).map(([id, evs]) => {
      evs.sort((a, b) => ts(a) - ts(b));
      const passos = [];
      for (const e of evs) {
        if (e.tipo === "tela" && e.alvo === "entrada") {
          passos.push({ rota: e.rota, inicio: ts(e), duracao: null, cliques: [], folhas: [], erros: [] });
          continue;
        }
        let p = passos.at(-1);
        if (!p) { p = { rota: e.rota, inicio: ts(e), duracao: null, cliques: [], folhas: [], erros: [] }; passos.push(p); }
        if (e.tipo === "tela" && e.alvo === "saida") {
          // a saída traz o tempo com a aba visível; vale para o último passo dessa rota
          const alvoP = [...passos].reverse().find((x) => x.rota === e.rota && x.duracao == null);
          if (alvoP) alvoP.duracao = e.duracao_ms;
        } else if (e.tipo === "clique") p.cliques.push({ alvo: e.alvo, t: ts(e), folha: e.detalhe && e.detalhe.folha });
        else if (e.tipo.startsWith("folha_")) p.folhas.push({ tipo: e.tipo, alvo: e.alvo, t: ts(e), form: e.detalhe && e.detalhe.form, enviou: e.detalhe && e.detalhe.enviou, dur: e.duracao_ms });
        else if (e.tipo === "erro") p.erros.push({ alvo: e.alvo, t: ts(e), local: e.detalhe && e.detalhe.local });
      }
      // passo sem saída gravada: até o próximo passo (ou o último evento)
      const fim = ts(evs.at(-1));
      passos.forEach((p, i) => { if (p.duracao == null) p.duracao = Math.max(0, (i < passos.length - 1 ? passos[i + 1].inicio : fim) - p.inicio); });
      const folhasAbertas = passos.flatMap((p) => p.folhas.filter((f) => f.tipo === "folha_abre" && f.form).map((f) => f.alvo));
      const folhasEnviadas = new Set(passos.flatMap((p) => p.folhas.filter((f) => f.tipo === "folha_envia").map((f) => f.alvo)));
      return {
        id, visitante: evs[0].visitante, aparelho: evs[0].aparelho, inicio: ts(evs[0]), fim,
        duracao: Math.max(fim - ts(evs[0]), passos.reduce((s, p) => s + (p.duracao || 0), 0)),
        passos, cliques: evs.filter((e) => e.tipo === "clique").length, erros: evs.filter((e) => e.tipo === "erro").length,
        ultima: passos.length ? passos.at(-1).rota : evs.at(-1).rota,
        abandonou: folhasAbertas.filter((f) => !folhasEnviadas.has(f)),
      };
    }).sort((a, b) => b.inicio - a.inicio);

    // ---- telas
    const telas = {};
    const tela = (r) => (telas[r] = telas[r] || { rota: r, visitas: 0, sessoes: new Set(), tempos: [], cliques: 0, saidas: 0, folhas: 0, envios: 0, voltas: 0 });
    for (const s of sessoes) {
      s.passos.forEach((p, i) => {
        const t = tela(p.rota);
        t.visitas++; t.sessoes.add(s.id); t.cliques += p.cliques.length;
        if (p.duracao != null) t.tempos.push(p.duracao);
        t.folhas += p.folhas.filter((f) => f.tipo === "folha_abre" && f.form).length;
        t.envios += p.folhas.filter((f) => f.tipo === "folha_envia").length;
        // ida e volta: A → B (menos de 5 s) → A
        if (i >= 2 && s.passos[i - 2].rota === p.rota && s.passos[i - 1].duracao < 5000) tela(s.passos[i - 1].rota).voltas++;
      });
      if (s.passos.length) tela(s.ultima).saidas++;
    }
    const listaTelas = Object.values(telas).map((t) => ({ ...t, sessoes: t.sessoes.size, tempo_mediano: mediana(t.tempos),
      taxa_saida: t.visitas ? t.saidas / t.visitas : 0, cliques_visita: t.visitas ? t.cliques / t.visitas : 0,
      taxa_envio: t.folhas ? Math.min(1, t.envios / t.folhas) : null })).sort((a, b) => b.visitas - a.visitas);

    // ---- cliques
    const cliques = eventos.filter((e) => e.tipo === "clique");
    const porDia = {}, porRota = {}, porAlvo = {};
    for (const c of cliques) {
      conta(porDia, c.quando.slice(0, 10));
      conta(porRota, c.rota);
      const k = c.rota + "|" + c.alvo;
      const a = (porAlvo[k] = porAlvo[k] || { rota: c.rota, alvo: c.alvo, cliques: 0, sessoes: new Set() });
      a.cliques++; a.sessoes.add(c.sessao);
    }
    const elementos = Object.values(porAlvo).map((a) => ({ ...a, sessoes: a.sessoes.size,
      pct_sessoes: telas[a.rota] ? a.sessoes.size / telas[a.rota].sessoes.size : null })).sort((a, b) => b.cliques - a.cliques);

    // ---- fluxos (transições entre telas)
    const trans = {};
    for (const s of sessoes) for (let i = 1; i < s.passos.length; i++) conta(trans, s.passos[i - 1].rota + "→" + s.passos[i].rota);
    const fluxos = Object.entries(trans).map(([k, n]) => { const [de, para] = k.split("→"); return { de, para, n }; }).sort((a, b) => b.n - a.n);
    // caminhos de entrada mais comuns (3 primeiras telas)
    const cam = {};
    for (const s of sessoes) if (s.passos.length >= 2) conta(cam, s.passos.slice(0, 3).map((p) => p.rota).join("→"));
    const caminhos = Object.entries(cam).map(([k, n]) => ({ passos: k.split("→"), n })).sort((a, b) => b.n - a.n);

    // ---- folhas: abertas × enviadas
    const folhas = {};
    for (const s of sessoes) for (const p of s.passos) for (const f of p.folhas) {
      const x = (folhas[f.alvo] = folhas[f.alvo] || { alvo: f.alvo, rota: p.rota, abertas: 0, enviadas: 0, form: false, tempos: [] });
      if (f.tipo === "folha_abre") { x.abertas++; x.form = x.form || !!f.form; }
      if (f.tipo === "folha_envia") { x.enviadas++; if (f.dur) x.tempos.push(f.dur); }
    }
    const listaFolhas = Object.values(folhas).filter((f) => f.form).map((f) => ({ ...f, abandono: f.abertas ? Math.max(0, 1 - f.enviadas / f.abertas) : 0,
      tempo_envio: mediana(f.tempos) })).sort((a, b) => b.abertas - a.abertas);

    // ---- cliques repetidos (3+ no mesmo elemento em 1,5 s): sinal de frustração
    const raiva = {};
    for (const s of sessoes) for (const p of s.passos) {
      const cs = p.cliques;
      for (let i = 2; i < cs.length; i++) {
        if (cs[i].alvo === cs[i - 1].alvo && cs[i].alvo === cs[i - 2].alvo && cs[i].t - cs[i - 2].t < 1500) {
          const k = p.rota + "|" + cs[i].alvo;
          const x = (raiva[k] = raiva[k] || { rota: p.rota, alvo: cs[i].alvo, vezes: 0, sessoes: new Set() });
          x.vezes++; x.sessoes.add(s.id);
        }
      }
    }
    const repetidos = Object.values(raiva).map((x) => ({ ...x, sessoes: x.sessoes.size })).sort((a, b) => b.vezes - a.vezes);

    // ---- erros agrupados pela mensagem (já anonimizada)
    const grupos = {};
    for (const e of eventos.filter((x) => x.tipo === "erro")) {
      const g = (grupos[e.alvo] = grupos[e.alvo] || { mensagem: e.alvo, vezes: 0, sessoes: new Set(), rotas: new Set(), ultima: 0, local: "" });
      g.vezes++; g.sessoes.add(e.sessao); g.rotas.add(e.rota); g.ultima = Math.max(g.ultima, ts(e)); g.local = g.local || (e.detalhe && e.detalhe.local) || "";
    }
    const erros = Object.values(grupos).map((g) => ({ ...g, sessoes: g.sessoes.size, rotas: [...g.rotas] })).sort((a, b) => b.vezes - a.vezes);

    return { sessoes, telas: listaTelas, porTela: telas, cliques: cliques.length, porDia, porRota, elementos, fluxos, caminhos,
      folhas: listaFolhas, repetidos, erros, visitantes: new Set(eventos.map((e) => e.visitante)).size };
  }

  // insights: frases curtas, as mais graves primeiro
  function insights(a) {
    const out = [];
    const nSess = a.sessoes.length || 1;
    // atrito
    for (const f of a.folhas.filter((f) => f.abertas >= 3 && f.abandono >= 0.4).slice(0, 4))
      out.push({ grau: f.abandono >= 0.7 ? 3 : 2, tipo: "Atrito", titulo: `“${f.alvo}” é abandonado em ${fmt.num(f.abandono * 100, 0)}% das vezes`,
        texto: `${f.abertas} aberturas e ${f.enviadas} envios em ${nomeRota(f.rota)}. Revise os campos obrigatórios e a clareza do formulário.` });
    for (const r of a.repetidos.slice(0, 3))
      out.push({ grau: r.sessoes >= 3 ? 3 : 2, tipo: "Atrito", titulo: `Cliques repetidos em ${r.alvo}`,
        texto: `${r.vezes} rajadas de 3+ cliques em ${nomeRota(r.rota)} (${r.sessoes} sessões). O elemento pode parecer clicável sem responder, ou estar lento.` });
    // gargalos de navegação
    for (const t of a.telas.filter((t) => t.visitas >= 5 && t.voltas / t.visitas >= 0.2).slice(0, 3))
      out.push({ grau: 2, tipo: "Gargalo", titulo: `Idas e voltas rápidas por ${nomeRota(t.rota)}`,
        texto: `Em ${fmt.num((t.voltas / t.visitas) * 100, 0)}% das visitas a pessoa entra e volta em menos de 5 s: o que ela procura não está ali.` });
    const comTempo = a.telas.filter((t) => t.visitas >= 5 && t.tempo_mediano != null);
    const medGeral = mediana(comTempo.map((t) => t.tempo_mediano)) || 0;
    for (const t of comTempo.filter((t) => t.tempo_mediano > medGeral * 2.5 && t.tempo_mediano > 60000).slice(0, 2))
      out.push({ grau: 1, tipo: "Gargalo", titulo: `${nomeRota(t.rota)} prende por muito tempo`,
        texto: `Tempo mediano de ${dur(t.tempo_mediano)}, ${fmt.num(t.tempo_mediano / medGeral, 1)}× o das outras telas. Pode ser leitura densa ou tarefa difícil.` });
    for (const t of a.telas.filter((t) => t.visitas >= 8 && t.taxa_saida >= 0.5 && t.rota !== "inicio").slice(0, 2))
      out.push({ grau: 2, tipo: "Abandono", titulo: `Muitas sessões terminam em ${nomeRota(t.rota)}`,
        texto: `${fmt.num(t.taxa_saida * 100, 0)}% das visitas a esta tela são as últimas da sessão.` });
    // erros recorrentes
    for (const e of a.erros.filter((e) => e.vezes >= 2).slice(0, 4))
      out.push({ grau: e.sessoes >= 3 ? 3 : 2, tipo: "Erro", titulo: e.mensagem,
        texto: `${e.vezes} vezes em ${e.sessoes} sessões (${e.rotas.map(nomeRota).join(", ")})${e.local ? " · " + e.local : ""}.` });
    // pouco usadas
    const totalVis = a.telas.reduce((s, t) => s + t.visitas, 0);
    if (totalVis >= 30) {
      const visiveis = FC.ROTAS.filter((r) => !["admin", "retrospectiva"].includes(r.id));
      const pouco = visiveis.filter((r) => ((a.porTela[r.id] || {}).visitas || 0) / totalVis < 0.02);
      if (pouco.length) out.push({ grau: 1, tipo: "Pouco usado", titulo: `${pouco.map((r) => r.nome).join(", ")} quase não são abertas`,
        texto: `Menos de 2% das visitas cada. Vale destacar melhor, explicar no onboarding ou deixar como módulo opcional.` });
      const clicados = new Set(a.elementos.map((e) => e.alvo));
      const chavesNav = FC.ROTAS.filter((r) => !r.oculta).map((r) => `[rota=${r.id}]`).filter((k) => !clicados.has(k));
      if (chavesNav.length) out.push({ grau: 1, tipo: "Pouco usado", titulo: "Itens do menu sem nenhum clique",
        texto: chavesNav.map((k) => nomeRota(k.slice(6, -1))).join(", ") + "." });
    }
    if (!out.length) out.push({ grau: 0, tipo: "Tudo certo", titulo: "Nenhum ponto de atrito com volume suficiente",
      texto: `${nSess} sessões no período. Os insights aparecem quando um padrão se repete.` });
    return out.sort((x, y) => y.grau - x.grau);
  }

  const dur = (ms) => {
    if (ms == null) return "—";
    const s = Math.round(ms / 1000);
    if (s < 60) return s + " s";
    const m = Math.floor(s / 60);
    return m < 60 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
  };
  const quando = (t) => { const d = new Date(t); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  const pct = (x) => (x == null ? "—" : fmt.num(x * 100, 0) + "%");

  // ---------------------------------------------------------------- tela
  const ABAS = [["videos", "Vídeos", "play"], ["cliques", "Cliques", "alvo"], ["jornadas", "Jornadas", "bussola"], ["logs", "Logs e insights", "info"]];
  let filtro = { dias: 30, aba: "cliques", comparaA: null, comparaB: null, tipo: "", rota: "", busca: "", sessao: null };

  FC.telas.admin = async function (raiz, params) {
    if (!FC.estado.admin) { location.hash = "#/inicio"; return; }
    if (params[0] && ABAS.some((a) => a[0] === params[0])) filtro.aba = params[0];
    raiz.innerHTML = String(html`${C.cabecalho("Administração", "Uso do sistema, anônimo, e material de divulgação.",
      html`<button class="botao sec" id="adm-recarrega">${icone("atualizar", 18)} Atualizar</button>`)}
      <div class="flex entre quebra mb3" style="gap:10px">
        <div class="segmentado adm-abas" role="tablist">${ABAS.map(([id, nome]) => html`<button type="button" data-aba="${id}" aria-pressed="${filtro.aba === id}">${nome}</button>`)}</div>
        ${filtro.aba !== "videos" ? html`<div class="segmentado" id="adm-dias">${[7, 30, 90].map((d) => html`<button type="button" data-d="${d}" aria-pressed="${filtro.dias === d}">${d} dias</button>`)}</div>` : ""}
      </div>
      <div id="adm-corpo"><div class="carregando-tela" style="min-height:240px"><div class="roda"></div><span>Lendo o uso…</span></div></div>`);
    FC.$$("[data-aba]", raiz).forEach((b) => b.addEventListener("click", () => { location.hash = "#/admin/" + b.dataset.aba; }));
    FC.$$("#adm-dias [data-d]", raiz).forEach((b) => b.addEventListener("click", () => { filtro.dias = Number(b.dataset.d); FC.rerender({ suave: true, semAnimacao: true }); }));
    FC.$("#adm-recarrega", raiz).addEventListener("click", () => { cache.em = 0; FC.rerender({ suave: true, semAnimacao: true }); });

    const corpo = FC.$("#adm-corpo", raiz);
    if (filtro.aba === "videos") { corpo.innerHTML = String(abaVideos()); ligaVideos(corpo); return; }
    let d;
    try { d = await carrega(filtro.dias); } catch (e) { corpo.innerHTML = String(html`<div class="mensagem erro">${icone("alerta", 18)}<span>Não deu para ler o uso: ${e.message || e}</span></div>`); return; }
    const a = analisa(d.eventos);
    const monta = { cliques: abaCliques, jornadas: abaJornadas, logs: abaLogs }[filtro.aba];
    corpo.innerHTML = String(monta(a, d));
    FC.animar(corpo, { semAnimacao: true });
    liga(corpo, a, d);
  };

  // ---------------------------------------------------------------- 1. vídeos
  function abaVideos() {
    return html`<div class="grade g2">
      <div class="cartao adm-video">
        <div class="adm-video-ic">${icone("play", 28)}</div>
        <h2>Vídeo de divulgação</h2>
        <p class="texto-p">${Math.round(FC.promo.TOTAL)} s com trilha, em formato vertical (stories e reels) ou horizontal, gerado no navegador com os números da conta logada. Dá para esconder os valores e trocar a frase final e o endereço do site.</p>
        <button class="botao mt3" id="adm-promo">${icone("play", 18)} Gerar vídeo</button>
      </div>
      <div class="cartao">
        <h2 style="font-size:17px">Como fica bom</h2>
        <ul class="adm-lista-dicas">
          <li>Use uma conta com histórico de pelo menos 6 meses: o gráfico e a retrospectiva ficam mais bonitos.</li>
          <li>Para publicar, ligue <b>Esconder valores</b>: os números viram percentuais.</li>
          <li>A conta de demonstração tem dados fictícios prontos para isso.</li>
          <li>O arquivo sai em WebM (ou MP4 no Safari). Instagram e TikTok aceitam os dois.</li>
        </ul>
      </div></div>`;
  }
  function ligaVideos(el) { FC.$("#adm-promo", el).addEventListener("click", () => FC.abrePromo()); }

  // ---------------------------------------------------------------- 2. cliques
  function abaCliques(a) {
    if (!a.cliques) return vazio();
    const rotas = a.telas.map((t) => t.rota);
    filtro.comparaA = rotas.includes(filtro.comparaA) ? filtro.comparaA : rotas[0];
    filtro.comparaB = rotas.includes(filtro.comparaB) ? filtro.comparaB : rotas[1] || rotas[0];
    const dias = [];
    for (let i = filtro.dias - 1; i >= 0; i--) { const dd = FC.datas.soma(FC.datas.hoje(), -i); dias.push([dd, a.porDia[dd] || 0]); }
    const barras = Object.entries(a.porRota).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([r, n]) => ({ rotulo: nomeRota(r).slice(0, 10), valor: n }));
    const A = a.porTela[filtro.comparaA], B = a.porTela[filtro.comparaB];
    const tA = a.telas.find((t) => t.rota === filtro.comparaA), tB = a.telas.find((t) => t.rota === filtro.comparaB);
    const linhaCmp = (rot, fa, fb, melhorMaior = true, formata = (x) => x) => {
      const va = fa(tA), vb = fb(tB);
      const ganha = va == null || vb == null || va === vb ? 0 : (va > vb) === melhorMaior ? 1 : -1;
      return html`<tr><td>${rot}</td><td class="n ${ganha > 0 ? "pos" : ""}">${formata(va)}</td><td class="n ${ganha < 0 ? "pos" : ""}">${formata(vb)}</td></tr>`;
    };
    return html`
      <dl class="kpis cartao mb3">
        <div class="kpi"><dt>Cliques</dt><dd>${fmt.int(a.cliques)}</dd></div>
        <div class="kpi"><dt>Sessões</dt><dd>${fmt.int(a.sessoes.length)}</dd></div>
        <div class="kpi"><dt>Visitantes anônimos</dt><dd>${fmt.int(a.visitantes)}</dd></div>
        <div class="kpi"><dt>Cliques por sessão</dt><dd>${fmt.num(a.cliques / (a.sessoes.length || 1), 1)}</dd></div>
      </dl>
      <div class="grade g2">
        <section class="cartao"><h2 class="adm-h">Cliques por dia</h2>
          ${FC.graficos.linhas({ series: [{ nome: "Cliques", pontos: dias, classe: "l1", area: true }], y: "int", altura: 220, zero: true, privado: false })}</section>
        <section class="cartao"><h2 class="adm-h">Cliques por página</h2>
          ${FC.graficos.colunas({ barras, y: "int", altura: 220, privado: false })}</section>
      </div>

      <section class="secao">
        <div class="secao-topo"><h2>Elementos mais clicados</h2><span class="sub">o elemento é descrito sem dados da pessoa</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>Elemento</th><th>Página</th><th class="n">Cliques</th><th class="n">Sessões</th><th class="n">% das sessões da página</th></tr></thead>
          <tbody>${a.elementos.slice(0, 25).map((e) => html`<tr><td class="adm-alvo">${e.alvo}</td><td>${nomeRota(e.rota)}</td>
            <td class="n">${fmt.int(e.cliques)}</td><td class="n">${fmt.int(e.sessoes)}</td><td class="n">${pct(e.pct_sessoes)}</td></tr>`)}</tbody></table></div>
      </section>

      <section class="secao">
        <div class="secao-topo"><h2>Comparar telas</h2><span class="sub">em verde, a melhor das duas em cada linha</span></div>
        <div class="cartao">
          <div class="adm-cmp mb2">
            <div class="campo"><label for="adm-ca">Tela A</label><select id="adm-ca">${rotas.map((r) => html`<option value="${r}" ${r === filtro.comparaA ? "selected" : ""}>${nomeRota(r)}</option>`)}</select></div>
            <div class="campo"><label for="adm-cb">Tela B</label><select id="adm-cb">${rotas.map((r) => html`<option value="${r}" ${r === filtro.comparaB ? "selected" : ""}>${nomeRota(r)}</option>`)}</select></div>
          </div>
          ${A && B ? html`<div class="rolagem"><table class="tabela">
            <thead><tr><th></th><th class="n">${nomeRota(filtro.comparaA)}</th><th class="n">${nomeRota(filtro.comparaB)}</th></tr></thead>
            <tbody>
              ${linhaCmp("Visitas", (t) => t.visitas, (t) => t.visitas, true, fmt.int)}
              ${linhaCmp("Sessões", (t) => t.sessoes, (t) => t.sessoes, true, fmt.int)}
              ${linhaCmp("Cliques por visita", (t) => t.cliques_visita, (t) => t.cliques_visita, true, (x) => fmt.num(x, 1))}
              ${linhaCmp("Tempo mediano", (t) => t.tempo_mediano, (t) => t.tempo_mediano, true, dur)}
              ${linhaCmp("Termina a sessão", (t) => t.taxa_saida, (t) => t.taxa_saida, false, pct)}
              ${linhaCmp("Idas e voltas rápidas", (t) => t.visitas ? t.voltas / t.visitas : 0, (t) => t.visitas ? t.voltas / t.visitas : 0, false, pct)}
              ${linhaCmp("Formulários enviados", (t) => t.taxa_envio, (t) => t.taxa_envio, true, pct)}
            </tbody></table></div>` : ""}
        </div>
      </section>

      <section class="secao">
        <div class="secao-topo"><h2>Fluxos entre telas</h2><span class="sub">de onde para onde as pessoas vão</span></div>
        <div class="cartao">${fluxosHtml(a.fluxos.slice(0, 12))}</div>
      </section>`;
  }
  function fluxosHtml(fl) {
    if (!fl.length) return html`<p class="texto-p">Ainda sem navegação entre telas.</p>`;
    const max = fl[0].n;
    return html`<div class="adm-fluxos">${fl.map((f) => html`<div class="adm-fluxo">
      <span class="adm-de">${nomeRota(f.de)}</span><span class="adm-seta">${icone("chevron", 14)}</span><span class="adm-para">${nomeRota(f.para)}</span>
      <span class="adm-barra"><i style="width:${(f.n / max) * 100}%"></i></span><b>${fmt.int(f.n)}</b></div>`)}</div>`;
  }

  // ---------------------------------------------------------------- 3. jornadas
  function abaJornadas(a) {
    if (!a.sessoes.length) return vazio();
    const sel = a.sessoes.find((s) => s.id === filtro.sessao) || a.sessoes[0];
    filtro.sessao = sel.id;
    const ultimas = {};
    for (const s of a.sessoes) if (s.passos.length) conta(ultimas, s.ultima);
    const barrasUlt = Object.entries(ultimas).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([r, n]) => ({ rotulo: nomeRota(r).slice(0, 10), valor: n }));
    const medDur = mediana(a.sessoes.map((s) => s.duracao));
    const medPassos = mediana(a.sessoes.map((s) => s.passos.length));
    return html`
      <dl class="kpis cartao mb3">
        <div class="kpi"><dt>Sessões</dt><dd>${fmt.int(a.sessoes.length)}</dd></div>
        <div class="kpi"><dt>Duração mediana</dt><dd>${dur(medDur)}</dd></div>
        <div class="kpi"><dt>Telas por sessão</dt><dd>${fmt.num(medPassos || 0, 0)}</dd></div>
        <div class="kpi"><dt>Saíram no meio de um formulário</dt><dd>${pct(a.sessoes.filter((s) => s.abandonou.length).length / a.sessoes.length)}</dd></div>
      </dl>
      <div class="adm-jornadas">
        <section class="cartao sem-pad adm-sessoes">
          <div class="adm-sessoes-topo"><b>Sessões</b><span class="fraco">${fmt.int(a.sessoes.length)}</span></div>
          <div class="adm-sessoes-lista">${a.sessoes.slice(0, 150).map((s) => html`<button type="button" class="adm-sessao ${s.id === sel.id ? "sel" : ""}" data-sessao="${s.id}">
            <span class="adm-sessao-l1"><b>${quando(s.inicio)}</b><span class="fraco">${dur(s.duracao)}</span></span>
            <span class="adm-sessao-l2">${s.passos.slice(0, 5).map((p) => nomeRota(p.rota)).join(" › ")}${s.passos.length > 5 ? " ›…" : ""}</span>
            <span class="adm-sessao-l3">${icone(s.aparelho === "celular" ? "celular" : "inicio", 12)} ${s.aparelho || ""} · ${s.cliques} cliques${s.erros ? html` · <span class="neg">${s.erros} erro${s.erros > 1 ? "s" : ""}</span>` : ""}${s.abandonou.length ? html` · <span class="amarelo-t">abandonou formulário</span>` : ""}</span>
          </button>`)}</div>
        </section>
        <section class="cartao adm-linha-tempo">${linhaDoTempo(sel)}</section>
      </div>

      <div class="grade g2 mt3">
        <section class="cartao"><h2 class="adm-h">Onde as sessões terminam</h2>
          ${FC.graficos.colunas({ barras: barrasUlt, y: "int", altura: 200, cor: "var(--s3)", privado: false })}</section>
        <section class="cartao"><h2 class="adm-h">Formulários abandonados</h2>
          ${a.folhas.length ? html`<table class="tabela"><thead><tr><th>Formulário</th><th class="n">Abertos</th><th class="n">Enviados</th><th class="n">Abandono</th></tr></thead>
            <tbody>${a.folhas.slice(0, 8).map((f) => html`<tr><td>${f.alvo}<div class="fraco" style="font-size:12px">${nomeRota(f.rota)}</div></td><td class="n">${f.abertas}</td><td class="n">${f.enviadas}</td>
              <td class="n ${f.abandono >= 0.5 ? "neg" : ""}">${pct(f.abandono)}</td></tr>`)}</tbody></table>` : html`<p class="texto-p">Nenhum formulário aberto no período.</p>`}</section>
      </div>

      <section class="secao">
        <div class="secao-topo"><h2>Caminhos mais comuns</h2><span class="sub">as três primeiras telas de cada sessão</span></div>
        <div class="cartao"><div class="adm-caminhos">${a.caminhos.slice(0, 8).map((c) => html`<div class="adm-caminho">
          ${c.passos.map((p, i) => html`${i ? html`<span class="adm-seta">${icone("chevron", 13)}</span>` : ""}<span class="chip">${nomeRota(p)}</span>`)}
          <b class="adm-caminho-n">${fmt.int(c.n)}×</b></div>`)}</div></div>
      </section>`;
  }
  function linhaDoTempo(s) {
    const total = s.passos.reduce((x, p) => x + (p.duracao || 0), 0) || 1;
    return html`<div class="flex entre quebra mb2"><div><h2 class="adm-h" style="margin:0">Sessão de ${quando(s.inicio)}</h2>
        <p class="fraco" style="font-size:13px">visitante ${s.visitante.slice(0, 6)} · ${s.aparelho || "—"} · ${dur(s.duracao)} · ${s.passos.length} telas</p></div></div>
      <div class="adm-faixa">${s.passos.map((p) => html`<i style="flex:${Math.max(p.duracao || 0, total * 0.02)}" title="${nomeRota(p.rota)} · ${dur(p.duracao)}"></i>`)}</div>
      <ol class="adm-passos">${s.passos.map((p, i) => html`<li class="${i === s.passos.length - 1 ? "ultimo" : ""}">
        <div class="adm-passo-topo"><b>${nomeRota(p.rota)}</b><span class="fraco">${dur(p.duracao)}</span></div>
        ${p.cliques.length || p.folhas.length || p.erros.length ? html`<ul class="adm-acoes">
          ${[...p.cliques.map((c) => ({ t: c.t, h: html`<li>${icone("alvo", 12)} ${c.alvo}${c.folha ? html` <span class="fraco">em “${c.folha}”</span>` : ""}</li>` })),
            ...p.folhas.map((f) => ({ t: f.t, h: html`<li class="${f.tipo === "folha_envia" ? "pos" : f.tipo === "folha_fecha" && !f.enviou && f.form !== false ? "" : ""}">${icone(f.tipo === "folha_envia" ? "check" : "recibo", 12)} ${f.tipo === "folha_abre" ? "abriu" : f.tipo === "folha_envia" ? "enviou" : f.enviou ? "fechou" : "fechou sem enviar"} “${f.alvo}”</li>` })),
            ...p.erros.map((e) => ({ t: e.t, h: html`<li class="neg">${icone("alerta", 12)} ${e.alvo}</li>` }))].sort((x, y) => x.t - y.t).map((x) => x.h)}
        </ul>` : ""}
        ${i === s.passos.length - 1 ? html`<p class="adm-fim">${s.abandonou.length ? html`Saiu com “${s.abandonou.join("”, “")}” aberto, sem enviar.` : "Fim da sessão."}</p>` : ""}
      </li>`)}</ol>`;
  }

  // ---------------------------------------------------------------- 4. logs e insights
  function abaLogs(a, d) {
    const ins = insights(a);
    const busca = filtro.busca.toLowerCase();
    const evs = d.eventos.filter((e) => (!filtro.tipo || e.tipo === filtro.tipo) && (!filtro.rota || e.rota === filtro.rota)
      && (!busca || [e.alvo, e.rota, e.tipo, e.sessao, JSON.stringify(e.detalhe)].join(" ").toLowerCase().includes(busca))).reverse();
    const rotas = [...new Set(d.eventos.map((e) => e.rota).filter(Boolean))].sort();
    const ROT_GRAU = ["ok", "baixo", "medio", "alto"];
    return html`
      <section class="secao" style="margin-top:0">
        <div class="secao-topo"><h2>Insights de usabilidade</h2><span class="sub">gerados a partir dos últimos ${filtro.dias} dias</span></div>
        <div class="adm-insights">${ins.map((x) => html`<div class="cartao adm-insight ${ROT_GRAU[x.grau]}">
          <span class="adm-insight-tipo">${x.tipo}</span><b>${x.titulo}</b><p>${x.texto}</p></div>`)}</div>
      </section>

      ${a.erros.length ? html`<section class="secao">
        <div class="secao-topo"><h2>Erros recorrentes no app</h2><span class="sub">mensagens agrupadas, sem dados pessoais</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>Mensagem</th><th class="n">Vezes</th><th class="n">Sessões</th><th>Telas</th><th>Última</th></tr></thead>
          <tbody>${a.erros.slice(0, 15).map((e) => html`<tr><td class="adm-alvo">${e.mensagem}${e.local ? html`<div class="fraco" style="font-size:12px">${e.local}</div>` : ""}</td>
            <td class="n">${e.vezes}</td><td class="n">${e.sessoes}</td><td>${e.rotas.map(nomeRota).join(", ")}</td><td>${quando(e.ultima)}</td></tr>`)}</tbody></table></div>
      </section>` : ""}

      ${d.erros.length ? html`<section class="secao">
        <div class="secao-topo"><h2>Erros do servidor</h2><span class="sub">fontes de preço e registro diário, sem dizer de quem</span></div>
        <div class="cartao sem-pad rolagem"><table class="tabela">
          <thead><tr><th>Quando</th><th>Etapa</th><th>Erro</th></tr></thead>
          <tbody>${d.erros.slice(0, 30).map((e) => html`<tr><td>${quando(Date.parse(e.quando))}</td><td>${e.etapa}</td><td class="adm-alvo">${e.erro}</td></tr>`)}</tbody></table></div>
      </section>` : ""}

      <section class="secao">
        <div class="secao-topo"><h2>Logs de uso</h2><span class="sub">${fmt.int(evs.length)} de ${fmt.int(d.eventos.length)} eventos</span></div>
        <div class="cartao">
          <div class="adm-filtros">
            <input class="entrada" id="adm-busca" type="search" placeholder="Buscar em elemento, tela, sessão…" value="${filtro.busca}">
            <span class="campo"><select id="adm-tipo"><option value="">Todos os tipos</option>${["tela", "clique", "folha_abre", "folha_envia", "folha_fecha", "erro"].map((t) => html`<option value="${t}" ${filtro.tipo === t ? "selected" : ""}>${t}</option>`)}</select></span>
            <span class="campo"><select id="adm-rota"><option value="">Todas as telas</option>${rotas.map((r) => html`<option value="${r}" ${filtro.rota === r ? "selected" : ""}>${nomeRota(r)}</option>`)}</select></span>
            <button class="botao sec pequeno" id="adm-csv">${icone("baixar", 15)} CSV</button>
          </div>
          <div class="rolagem adm-logs"><table class="tabela">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Tela</th><th>Elemento / mensagem</th><th class="n">Duração</th><th>Sessão</th></tr></thead>
            <tbody>${evs.slice(0, 400).map((e) => html`<tr class="${e.tipo === "erro" ? "adm-log-erro" : ""}"><td>${quando(ts(e))}</td><td><span class="pilula ${e.tipo === "erro" ? "vermelho" : e.tipo === "clique" ? "azul" : "cinza"}">${e.tipo}</span></td>
              <td>${nomeRota(e.rota)}</td><td class="adm-alvo">${e.alvo || ""}</td><td class="n">${e.duracao_ms != null ? dur(e.duracao_ms) : ""}</td>
              <td><button type="button" class="botao texto pequeno" data-ver-sessao="${e.sessao}">${e.sessao.slice(0, 6)}</button></td></tr>`)}</tbody></table>
            ${evs.length > 400 ? html`<p class="texto-p mt2">Mostrando os 400 mais recentes. Use os filtros ou baixe o CSV.</p>` : ""}</div>
        </div>
      </section>
      <p class="texto-p mt3">${icone("escudo", 14)} Coleta anônima: código aleatório do aparelho no lugar da conta, telas sem parâmetros, elementos e mensagens sem números, valores, e-mails ou tickers. Telas e cliques só com consentimento; erros por legítimo interesse. Tudo é apagado após 180 dias.</p>`;
  }

  function vazio() {
    return html`<div class="lista">${C.vazio("📊", "Ainda sem dados de uso", "Os eventos aparecem aqui quando pessoas que aceitaram a coleta anônima usarem o app. Erros técnicos aparecem para todos.")}</div>`;
  }

  // ---------------------------------------------------------------- eventos
  function liga(el, a, d) {
    const re = () => FC.rerender({ suave: true, semAnimacao: true });
    const sel = (id, f) => { const x = FC.$(id, el); if (x) x.addEventListener("change", () => { f(x.value); re(); }); };
    sel("#adm-ca", (v) => { filtro.comparaA = v; });
    sel("#adm-cb", (v) => { filtro.comparaB = v; });
    sel("#adm-tipo", (v) => { filtro.tipo = v; });
    sel("#adm-rota", (v) => { filtro.rota = v; });
    const b = FC.$("#adm-busca", el);
    if (b) {
      let t = null;
      b.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => { filtro.busca = b.value; await FC.rerender({ suave: true, semAnimacao: true }); const n = FC.$("#adm-busca"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); });
    }
    FC.$$("[data-sessao]", el).forEach((x) => x.addEventListener("click", () => {
      filtro.sessao = x.dataset.sessao;
      const alvo = FC.$(".adm-linha-tempo", el);
      FC.$$(".adm-sessao", el).forEach((y) => y.classList.toggle("sel", y === x));
      alvo.innerHTML = String(linhaDoTempo(a.sessoes.find((s) => s.id === filtro.sessao)));
      if (innerWidth < 900) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    FC.$$("[data-ver-sessao]", el).forEach((x) => x.addEventListener("click", () => { filtro.sessao = x.dataset.verSessao; location.hash = "#/admin/jornadas"; }));
    const csv = FC.$("#adm-csv", el);
    if (csv) csv.addEventListener("click", () => {
      const cab = ["quando", "visitante", "sessao", "tipo", "rota", "alvo", "duracao_ms", "aparelho", "detalhe"];
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const linhas = [cab.join(",")].concat(d.eventos.map((e) => cab.map((k) => esc(k === "detalhe" ? JSON.stringify(e.detalhe) : e[k])).join(",")));
      const url = URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/csv" }));
      const l = document.createElement("a");
      l.href = url; l.download = `uso-${filtro.dias}d-${FC.datas.hoje()}.csv`; l.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  }

  FC.admin = { analisa, insights, nomeRota };
})();
