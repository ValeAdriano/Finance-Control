/* Apresentação por passos: aparece no primeiro acesso de cada conta e
 * pode ser revista em Ajustes. O "já vi" fica nos metadados do usuário
 * no Supabase, então vale em qualquer aparelho. O último passo é
 * interativo: nome, tema e por onde começar. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone } = FC;

  // ---------------------------------------------------------------- ilustrações
  // pequenas cenas animadas em HTML/SVG, com dados de exemplo
  const cenas = {
    boasVindas: () => html`<div class="ob-cena ob-logo"><div class="ob-logo-g">${FC.logo(46)}</div>
      <div class="ob-orbita">${["inicio", "ativos", "agro", "aportes", "moeda", "projecoes"].map((n, i) => html`<span style="--i:${i}">${icone(n, 18)}</span>`)}</div></div>`,

    patrimonio: () => html`<div class="ob-cena ob-cartao">
      <div class="ob-rot">Patrimônio</div><div class="ob-valor" data-conta="148320">R$ 0</div>
      <div class="ob-delta">▲ 12,4% em 12 meses</div>
      <svg viewBox="0 0 280 90" class="ob-grafico" aria-hidden="true">
        <defs><linearGradient id="ob-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ob-stop1"/><stop offset="1" class="ob-stop0"/></linearGradient></defs>
        <path class="ob-area" d="M0 78 L25 72 L50 74 L75 62 L100 64 L125 52 L150 55 L175 40 L200 42 L225 28 L250 24 L280 12 L280 90 L0 90Z" fill="url(#ob-g)"/>
        <path class="ob-linha" d="M0 78 L25 72 L50 74 L75 62 L100 64 L125 52 L150 55 L175 40 L200 42 L225 28 L250 24 L280 12" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg></div>`,

    investimentos: () => html`<div class="ob-cena ob-lista">
      ${[["ITSA4", "Ações", "verde", "Atende", "+1,2%"], ["HGLG11", "FII", "amarelo", "Zona cinzenta", "−0,4%"], ["BTC", "Cripto", "azul", "Na carteira", "+3,8%"], ["Tesouro IPCA+", "Renda fixa", "cinza", "Contratado", "IPCA+6%"]]
        .map(([t, c, cor, v, d], i) => html`<div class="ob-linha-item" style="--i:${i}"><div><b>${t}</b><small>${c}</small></div>${FC.pilula(cor, v)}<span class="ob-var ${d.startsWith("−") ? "neg" : "pos"}">${d}</span></div>`)}
    </div>`,

    aportes: () => html`<div class="ob-cena ob-duas">
      <div class="ob-mini"><div class="ob-rot">${icone("aportes", 16)} Repetir aporte</div>
        <div class="ob-campo-f">ITSA4 · <b>20</b> × R$ 10,80</div><div class="ob-bt-f">Aportar R$ 216,00</div></div>
      <div class="ob-mini"><div class="ob-rot">${icone("boi", 16)} Rebanho</div>
        <div class="ob-bois">${Array.from({ length: 6 }, (_, i) => html`<span style="--i:${i}">${icone("boi", 20)}</span>`)}</div>
        <small>6 cabeças · compra, venda, custos e pesagens</small></div>
    </div>`,

    renda: () => html`<div class="ob-cena ob-cartao">
      <div class="ob-rot">Plano do mês · 30% do salário</div>
      <div class="ob-barra-plano">${[["var(--s1)", 50, "Ações"], ["var(--s2)", 30, "FIIs"], ["var(--s3)", 20, "Reserva"]].map(([c, p, n], i) => html`<span style="--c:${c};--p:${p}%;--i:${i}" title="${n}"></span>`)}</div>
      <div class="ob-legenda"><span><i style="background:var(--s1)"></i>Ações 50%</span><span><i style="background:var(--s2)"></i>FIIs 30%</span><span><i style="background:var(--s3)"></i>Reserva 20%</span></div>
      <div class="ob-rot mt2">Dividendos por mês</div>
      <div class="ob-colunas">${[30, 42, 28, 55, 47, 62, 58, 70, 66, 81, 77, 92].map((h, i) => html`<span style="--h:${h}%;--i:${i}"></span>`)}</div>
    </div>`,

    projecoes: () => html`<div class="ob-cena ob-cartao">
      <div class="ob-rot">Em 20 anos, em reais de hoje</div>
      <svg viewBox="0 0 280 110" class="ob-grafico alto" aria-hidden="true">
        <path class="ob-banda" d="M0 100 C90 90 180 55 280 8 L280 48 C180 78 90 96 0 100Z" />
        <path class="ob-linha" d="M0 100 C90 93 180 70 280 28" fill="none" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <div class="ob-legenda"><span>pessimista · base · otimista</span><span>com reinvestimento dos proventos</span></div>
    </div>`,

    seguranca: () => html`<div class="ob-cena ob-seg">
      <div class="ob-escudo">${icone("escudo", 44)}</div>
      <ul>
        <li>${icone("cadeado", 16)} Só você vê seus dados</li>
        <li>${icone("check", 16)} Verificação em duas etapas opcional</li>
        <li>${icone("olho", 16)} Modo privado borra os valores</li>
      </ul></div>`,
  };

  const COMECOS = [
    ["ativos", "ativos", "Cadastrar meus investimentos", "ações, FIIs, cripto e renda fixa"],
    ["salario", "carteira", "Registrar meu salário", "e montar o plano do mês"],
    ["aportes", "aportes", "Lançar um aporte", "o que você comprou hoje"],
    ["inicio", "inicio", "Só explorar", "vou olhando com calma"],
  ];

  function passos(nome) {
    return [
      { cena: "boasVindas", titulo: nome ? `Olá, ${nome}!` : "Boas-vindas ao Finance Control", texto: "Tudo o que você investe num lugar só: bolsa, cripto, renda fixa e até o gado. Em um minuto, veja o que dá para fazer." },
      { cena: "patrimonio", titulo: "Seu patrimônio, sempre atualizado", texto: "O Início soma tudo com preços de mercado a cada minuto e guarda uma foto por dia. O gráfico mostra quanto você cresceu na semana, no mês ou desde o começo." },
      { cena: "investimentos", titulo: "Cada ativo avaliado", texto: "Em Investimentos, cadastre o que tem ou acompanha. O painel busca cotações e dá um veredito olhando o histórico do ativo, suas regras, os pares e a renda fixa." },
      { cena: "aportes", titulo: "Aportes em dois toques", texto: "Registre cada compra e repita os aportes de sempre informando só quantidade e valor. No Agro, controle compra, venda, custos e o rebanho atual." },
      { cena: "renda", titulo: "Salário, plano e dividendos", texto: "Cadastre seus ganhos, defina quanto investir e para onde. O guia do mês mostra o que falta aportar, e Dividendos mostra quanto cada ativo paga e quando cai." },
      { cena: "projecoes", titulo: "Onde isso vai dar", texto: "Projeções usa seu plano, reinveste os proventos e mostra três cenários em reais de hoje. Em Simular, teste mudanças antes de fazer." },
      { cena: "seguranca", titulo: "Seus dados são só seus", texto: "Cada conta enxerga apenas os próprios dados. Em Ajustes você liga a verificação em duas etapas, baixa um backup e troca o tema." },
      { final: true, titulo: "Vamos começar?", texto: "Ajuste o básico. Dá para mudar tudo depois em Ajustes." },
    ];
  }

  // ---------------------------------------------------------------- abrir
  let aberto = null;
  FC.onboarding = {
    precisa() {
      const u = FC.auth.usuario;
      return !!u && !((u.user_metadata || {}).onboarding_visto);
    },
    abre,
  };

  function abre() {
    if (aberto) return;
    const u = FC.auth.usuario || {};
    const nomeAtual = (u.user_metadata || {}).nome || "";
    const lista = passos(nomeAtual);
    let i = 0, comeco = "ativos";
    const anterior = document.activeElement;

    const fundo = document.createElement("div");
    fundo.className = "ob-fundo";
    fundo.innerHTML = String(html`<div class="ob" role="dialog" aria-modal="true" aria-label="Apresentação do Finance Control">
      <div class="ob-topo"><div class="ob-progresso"><i></i></div>
        <button class="botao texto pequeno" type="button" data-ob="pular">Pular</button></div>
      <div class="ob-trilho">${lista.map((p, k) => html`<section class="ob-passo" data-k="${k}" aria-hidden="${k ? "true" : "false"}">
        ${p.final ? html`<div class="ob-final">
            <div class="campo"><label for="ob-nome">Como quer ser chamado?</label><input id="ob-nome" class="entrada" maxlength="40" value="${nomeAtual}" placeholder="seu nome" autocomplete="given-name"></div>
            <div class="campo"><label>Tema</label><div class="segmentado" role="group" id="ob-tema">
              ${[["auto", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]].map(([t, n]) => html`<button type="button" data-tema="${t}" aria-pressed="${FC.local.ler("tema", "auto") === t}">${n}</button>`)}</div></div>
            <div class="campo"><label>Por onde começar?</label><div class="ob-opcoes" role="radiogroup">
              ${COMECOS.map(([id, ic, t, d], n) => html`<button type="button" role="radio" class="ob-opcao" data-comeco="${id}" aria-checked="${n === 0}">
                <span class="ob-opcao-ic">${icone(ic, 20)}</span><span><b>${t}</b><small>${d}</small></span><span class="ob-marca">${icone("check", 14)}</span></button>`)}
            </div></div></div>`
          : html`<div class="ob-palco">${cenas[p.cena]()}</div>`}
        <h2>${p.titulo}</h2><p>${p.texto}</p></section>`)}</div>
      <div class="ob-rodape">
        <button class="botao sec" type="button" data-ob="voltar">Voltar</button>
        <div class="ob-pontos">${lista.map((_, k) => html`<button type="button" data-ir="${k}" aria-label="Passo ${k + 1}"></button>`)}</div>
        <button class="botao" type="button" data-ob="avancar">Próximo</button>
      </div></div>`);
    document.body.appendChild(fundo);
    document.documentElement.classList.add("ob-aberto");
    aberto = fundo;
    const $ = (s) => FC.$(s, fundo);

    function mostra(n) {
      i = Math.max(0, Math.min(lista.length - 1, n));
      FC.$$(".ob-passo", fundo).forEach((s, k) => {
        s.setAttribute("aria-hidden", k === i ? "false" : "true");
        s.classList.toggle("atual", k === i);
        s.classList.toggle("antes", k < i);
      });
      FC.$$(".ob-pontos button", fundo).forEach((b, k) => b.classList.toggle("atual", k === i));
      $(".ob-progresso i").style.width = ((i + 1) / lista.length) * 100 + "%";
      $("[data-ob=voltar]").style.visibility = i ? "visible" : "hidden";
      $("[data-ob=avancar]").textContent = lista[i].final ? "Começar" : i === 0 ? "Vamos lá" : "Próximo";
      $("[data-ob=pular]").style.visibility = lista[i].final ? "hidden" : "visible";
      const atual = FC.$(".ob-passo.atual", fundo);
      contaValores(atual);
      if (lista[i].final) { FC.ui.segmentado($("#ob-tema")); setTimeout(() => $("#ob-nome").focus({ preventScroll: true }), 350); }
    }

    // o valor de exemplo sobe até o número, como no Início
    function contaValores(raiz) {
      FC.$$("[data-conta]", raiz).forEach((el) => {
        const alvo = Number(el.dataset.conta), t0 = performance.now();
        const passo = (t) => {
          const f = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - f, 3);
          el.textContent = FC.fmt.brlTexto(alvo * e).replace(/,\d\d$/, "");
          if (f < 1 && aberto) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
    }

    async function fecha(concluiu) {
      const nome = concluiu ? $("#ob-nome").value.trim() : null;
      fundo.classList.add("saindo");
      document.removeEventListener("keydown", tecla);
      setTimeout(() => { fundo.remove(); document.documentElement.classList.remove("ob-aberto"); aberto = null; if (anterior && anterior.focus) anterior.focus(); }, 280);
      const dados = { onboarding_visto: new Date().toISOString() };
      if (concluiu && nome !== nomeAtual) dados.nome = nome;
      try {
        const r = await FC.sb.auth.updateUser({ data: dados });
        if (r.data && r.data.user) FC.auth.usuario = r.data.user;
      } catch (e) { console.error(e); }
      if (concluiu) {
        const destino = "#/" + comeco;
        if (location.hash !== destino) location.hash = destino; else FC.rerender();
        if (comeco !== "inicio") FC.ui.aviso(COMECOS.find((c) => c[0] === comeco)[2]);
      } else if (location.hash === "#/inicio" || !location.hash) FC.rerender({ suave: true, semAnimacao: true });
    }

    function tecla(e) {
      if (e.target.tagName === "INPUT" && e.key !== "Enter" && e.key !== "Escape") return;
      if (e.key === "ArrowRight" || (e.key === "Enter" && !lista[i].final)) { e.preventDefault(); avancar(); }
      else if (e.key === "Enter" && lista[i].final) { e.preventDefault(); fecha(true); }
      else if (e.key === "ArrowLeft") mostra(i - 1);
      else if (e.key === "Escape") fecha(false);
    }
    function avancar() { if (lista[i].final) fecha(true); else mostra(i + 1); }

    $("[data-ob=avancar]").addEventListener("click", avancar);
    $("[data-ob=voltar]").addEventListener("click", () => mostra(i - 1));
    $("[data-ob=pular]").addEventListener("click", () => fecha(false));
    FC.$$("[data-ir]", fundo).forEach((b) => b.addEventListener("click", () => mostra(Number(b.dataset.ir))));
    document.addEventListener("keydown", tecla);

    // arrastar para os lados no celular
    let x0 = null, y0 = null;
    const trilho = $(".ob-trilho");
    trilho.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    trilho.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) avancar(); else mostra(i - 1); }
      x0 = null;
    });

    // passo final: tema aplica na hora; escolha de começo
    FC.$$("#ob-tema button", fundo).forEach((b) => b.addEventListener("click", () => { FC.local.gravar("tema", b.dataset.tema); FC.aplicaTema(b.dataset.tema); }));
    FC.$$("[data-comeco]", fundo).forEach((b) => b.addEventListener("click", () => {
      comeco = b.dataset.comeco;
      FC.$$("[data-comeco]", fundo).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }));

    requestAnimationFrame(() => { fundo.classList.add("visivel"); mostra(0); });
  }
})();
