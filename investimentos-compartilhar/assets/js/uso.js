/* Uso do app, para o painel do administrador — de forma ANÔNIMA (LGPD).
 *
 * O que sai daqui não diz quem é a pessoa nem quanto ela tem:
 *  - nada de user_id ou e-mail: o "visitante" é um código aleatório do
 *    aparelho, trocado a cada 90 dias, sem ligação com a conta;
 *  - a tela é só o nome da rota (#/ativos/PETR4 vira "ativos");
 *  - o elemento clicado é descrito por id, atributos de uma lista fechada
 *    ou um rótulo curto sem números, valores, e-mails ou tickers;
 *  - mensagens de erro passam pelo mesmo filtro.
 * Telas, cliques e folhas só são gravados com o consentimento do usuário
 * (Ajustes → Privacidade). Erros técnicos, sem dado pessoal, são gravados
 * por legítimo interesse, para o app continuar funcionando. */
(function () {
  const FC = window.FC;
  const MAX_FILA = 40, INTERVALO = 15000, SESSAO_OCIOSA = 30 * 60 * 1000;
  // atributos que descrevem a ação sem carregar dados da pessoa
  const ATRIBUTOS_OK = ["rota", "acao", "p", "v", "m", "rv", "t", "cmp", "comeca", "aba", "modo", "tipo", "periodo", "vista", "filtro", "inicio-agro", "modulo"];

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem */ } },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* idem */ } },
  };
  const aleatorio = () => {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
  };

  // ---------------------------------------------------------------- identidade anônima
  function visitante() {
    let v = ls.get("fc:anon"), em = Number(ls.get("fc:anon-em")) || 0;
    if (!v || Date.now() - em > 90 * 864e5) { v = aleatorio(); ls.set("fc:anon", v); ls.set("fc:anon-em", String(Date.now())); }
    return v;
  }
  function sessao() {
    let s = ss.get("fc:sessao"), ult = Number(ss.get("fc:sessao-ult")) || 0;
    if (!s || Date.now() - ult > SESSAO_OCIOSA) { s = aleatorio(); ss.set("fc:sessao", s); }
    ss.set("fc:sessao-ult", String(Date.now()));
    return s;
  }
  const aparelho = () => (innerWidth < 640 ? "celular" : innerWidth < 1024 ? "tablet" : "computador");

  // ---------------------------------------------------------------- anonimização
  function limpaTexto(t, max = 60) {
    return String(t || "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
      .replace(/\b[A-Z]{4}\d{1,2}\b/g, "<ticker>")
      .replace(/R\$\s?[\d.,]+/g, "<valor>")
      .replace(/\d+([.,]\d+)*/g, "#")
      .replace(/\s+/g, " ").trim().slice(0, max);
  }
  // descreve um elemento clicável sem dizer nada sobre a pessoa
  function descreve(el) {
    if (el.id && !/\d{3,}/.test(el.id)) return "#" + el.id;
    for (const a of ATRIBUTOS_OK) {
      const v = el.getAttribute("data-" + a);
      if (v != null && v.length <= 30 && !/\d{2,}|[A-Z]{4}\d/.test(v)) return `[${a}=${v}]`;
    }
    const outro = Array.from(el.attributes).find((x) => x.name.startsWith("data-") && x.name !== "data-conta");
    const rotulo = el.getAttribute("aria-label") || el.getAttribute("title") || (el.matches("button, a, summary, label, .chip") ? el.textContent : "");
    const txt = limpaTexto(rotulo, 40);
    const tag = el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : "");
    if (txt && !/^[#<>\s]*$/.test(txt)) return `${tag} “${txt}”`;
    return outro ? `${tag}[${outro.name.slice(5)}]` : tag;
  }
  // a rota sem os parâmetros (que podem ter ticker ou nome de título)
  const rotaAgora = () => ((location.hash || "#/inicio").replace(/^#\/?/, "").split("/")[0] || "inicio").slice(0, 40);
  const rotaPrefixo = () => {
    const p = (location.hash || "").replace(/^#\/?/, "").split("/");
    // sub-rotas fixas (ex.: retrospectiva/mes) ajudam a ler a jornada
    return p[0] === "retrospectiva" && /^(mes|ano)$/.test(p[1] || "") ? "retrospectiva/" + p[1] : rotaAgora();
  };

  // ---------------------------------------------------------------- fila
  let fila = [], ligado = false, consente = false, timer = null;
  function grava(tipo, campos = {}) {
    if (!ligado) return;
    if (tipo !== "erro" && !consente) return;
    fila.push({ quando: new Date().toISOString(), visitante: visitante(), sessao: sessao(), tipo,
      rota: rotaPrefixo(), aparelho: aparelho(), detalhe: {}, ...campos });
    if (fila.length >= MAX_FILA) envia();
  }
  async function envia(saindo = false) {
    if (!fila.length) return;
    const lote = fila.splice(0, fila.length);
    try {
      if (saindo) {
        // na saída da página o cliente do Supabase não termina a tempo
        const s = (await FC.sb.auth.getSession()).data.session;
        if (!s) return;
        fetch(FC.config.supabaseUrl + "/rest/v1/uso_eventos", {
          method: "POST", keepalive: true, body: JSON.stringify(lote),
          headers: { apikey: FC.config.supabaseChave, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json", Prefer: "return=minimal" },
        }).catch(() => {});
      } else {
        const { error } = await FC.sb.from("uso_eventos").insert(lote);
        if (error) throw error;
      }
    } catch (e) { /* métrica nunca trava o app nem vira erro na tela */ }
  }

  // ---------------------------------------------------------------- telas e tempo
  let telaAtual = null, telaDesde = 0, visivelMs = 0, ocultoDesde = null;
  function fechaTela() {
    if (!telaAtual) return;
    const agora = Date.now();
    const dur = agora - telaDesde - visivelMs - (ocultoDesde ? agora - ocultoDesde : 0);
    grava("tela", { rota: telaAtual, alvo: "saida", duracao_ms: Math.max(0, Math.min(dur, 86400000)) });
  }
  function novaTela() {
    const r = rotaPrefixo();
    if (r === telaAtual) return;
    fechaTela();
    telaAtual = r; telaDesde = Date.now(); visivelMs = 0; ocultoDesde = document.hidden ? Date.now() : null;
    grava("tela", { rota: r, alvo: "entrada" });
  }

  // ---------------------------------------------------------------- ganchos
  function liga() {
    const CLICAVEL = "a, button, [role=button], .clicavel, summary, label, select, input[type=checkbox], input[type=radio], .chip";
    document.addEventListener("click", (e) => {
      const el = e.target.closest && e.target.closest(CLICAVEL);
      if (!el || !document.body.contains(el)) return;
      const naFolha = el.closest(".folha");
      grava("clique", { alvo: descreve(el).slice(0, 120), detalhe: naFolha ? { folha: limpaTexto(naFolha.getAttribute("aria-label"), 50) } : {} });
    }, true);
    window.addEventListener("hashchange", () => setTimeout(novaTela, 0));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { ocultoDesde = Date.now(); envia(true); }
      else if (ocultoDesde) { visivelMs += Date.now() - ocultoDesde; ocultoDesde = null; }
    });
    window.addEventListener("pagehide", () => { fechaTela(); envia(true); });
    window.addEventListener("error", (e) => erro(e.error || e.message, "janela"));
    window.addEventListener("unhandledrejection", (e) => erro(e.reason, "promessa"));

    // folhas: abrir, enviar e fechar (com ou sem enviar)
    const folhaOriginal = FC.ui.folha;
    FC.ui.folha = function (op) {
      const titulo = limpaTexto(op.titulo, 50) || "folha";
      const abriu = Date.now();
      let enviou = false;
      const aoFechar = op.aoFechar;
      const api = folhaOriginal.call(this, { ...op, aoFechar: () => {
        grava("folha_fecha", { alvo: titulo, duracao_ms: Math.min(Date.now() - abriu, 86400000), detalhe: { enviou } });
        aoFechar && aoFechar();
      } });
      // só folha com campo para preencher entra na conta de abandono
      const temForm = !!api.el.querySelector("form, input:not([type=hidden]), select, textarea");
      grava("folha_abre", { alvo: titulo, detalhe: { form: temForm } });
      api.el.addEventListener("submit", () => { if (!enviou) { enviou = true; grava("folha_envia", { alvo: titulo, duracao_ms: Date.now() - abriu }); } }, true);
      // botões de salvar que não passam por submit
      api.el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-acao=salvar], [data-acao=confirmar]");
        if (b && !enviou && !api.el.querySelector("form")) { enviou = true; grava("folha_envia", { alvo: titulo, duracao_ms: Date.now() - abriu }); }
      }, true);
      return api;
    };
    // erros que o app mostra na tela
    const erroOriginal = FC.ui.erro;
    FC.ui.erro = function (e) { erro(e, "tela"); return erroOriginal.apply(this, arguments); };
    timer = setInterval(() => envia(), INTERVALO);
  }

  function erro(e, onde) {
    const msg = e && (e.message || e.error_description || e.msg) || String(e || "");
    if (!msg || /ResizeObserver loop/.test(msg)) return;
    const pilha = e && e.stack ? String(e.stack).split("\n").find((l) => /assets\/js\//.test(l)) : "";
    const local = pilha ? (pilha.match(/assets\/js\/[\w/.-]+:\d+/) || [""])[0] : "";
    grava("erro", { alvo: limpaTexto(msg, 120), detalhe: { onde, local } });
  }

  // ---------------------------------------------------------------- consentimento
  // guardado na conta (vale em todos os aparelhos) e lido aqui
  function lerConsentimento() {
    const u = FC.auth.usuario;
    const c = u && u.user_metadata && u.user_metadata.consentimento_uso;
    return c ? !!c.aceito : null;           // null = ainda não respondeu
  }
  async function defineConsentimento(aceito) {
    const r = await FC.sb.auth.updateUser({ data: { consentimento_uso: { aceito, em: new Date().toISOString().slice(0, 10), versao: 1 } } });
    if (r.data && r.data.user) FC.auth.usuario = r.data.user;
    consente = aceito;
    if (aceito) { telaAtual = null; novaTela(); }
  }
  function pedeConsentimento() {
    if (lerConsentimento() !== null || FC.$(".aviso-uso")) return;
    const el = document.createElement("div");
    el.className = "aviso-uso";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Privacidade");
    el.innerHTML = `<div><b>Ajude a melhorar o Finance Control</b>
      <p>Podemos registrar, de forma anônima, as telas que você abre e os botões que toca — nunca seus valores, ativos, nome ou e-mail. Os dados somem em 180 dias e você muda de ideia quando quiser em Ajustes → Privacidade.</p></div>
      <div class="aviso-uso-bt"><button class="botao sec pequeno" data-uso="nao">Agora não</button><button class="botao pequeno" data-uso="sim">Aceitar</button></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visivel"));
    el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-uso]");
      if (!b) return;
      el.classList.remove("visivel");
      setTimeout(() => el.remove(), 300);
      try { await defineConsentimento(b.dataset.uso === "sim"); } catch (err) { /* tenta de novo na próxima visita */ }
    });
  }

  FC.uso = {
    // chamado ao entrar no app (usuário já conhecido)
    inicia() {
      consente = lerConsentimento() === true;
      if (!ligado) { ligado = true; liga(); }
      telaAtual = null;
      novaTela();
    },
    para() { fechaTela(); envia(true); telaAtual = null; },
    pedeConsentimento, defineConsentimento, lerConsentimento,
    // para testes e para o painel explicar o que é coletado
    _descreve: descreve, _limpa: limpaTexto, envia,
  };
})();
