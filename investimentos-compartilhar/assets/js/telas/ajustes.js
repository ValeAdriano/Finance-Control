/* Ajustes: conta e segurança, aparência, metas, regras e dados. */
(function () {
  const FC = window.FC;
  const { html, icone, fmt } = FC;
  const C = FC.comum;

  const grupo = (titulo, sub, corpo) => html`<section class="secao"><div class="secao-topo"><h2>${titulo}</h2>${sub ? html`<span class="sub">${sub}</span>` : ""}</div>${corpo}</section>`;

  async function mfaEstado() {
    try {
      const f = await FC.auth.fatores();
      return (f.totp || []).find((x) => x.status === "verified") || null;
    } catch (e) { return null; }
  }

  FC.telas.ajustes = async function (raiz) {
    const u = FC.auth.usuario;
    const prefs = FC.estado.prefs;
    const totp = await mfaEstado();
    const tema = FC.local.ler("tema", "auto");
    const alvos = prefs.alocacao_alvo;
    const r = prefs.regras;

    raiz.innerHTML = String(html`<div class="estreita">
      ${C.cabecalho("Ajustes", "Conta, segurança e os critérios que o painel aplica.")}

      ${grupo("Conta e segurança", "", html`<div class="lista">
        <div class="item"><span style="color:var(--acento)">${icone("cadeado", 22)}</span>
          <div class="principal"><div class="titulo">${u.email}</div><div class="detalhe">Dono do painel · cadastro fechado para outras contas</div></div></div>
        <div class="item"><div class="principal"><div class="titulo">Como quer ser chamado</div><div class="detalhe">aparece na saudação do início</div></div>
          <input class="entrada" id="aj-nome" style="max-width:200px;min-height:38px" value="${(u.user_metadata || {}).nome || ""}" maxlength="40" placeholder="seu nome"></div>
        <div class="item clicavel" id="aj-senha"><span style="color:var(--ink-2)">${icone("editar", 20)}</span><div class="principal"><div class="titulo">Trocar senha</div></div><span class="chevron">${icone("chevron", 18)}</span></div>
        <div class="item clicavel" id="aj-mfa"><span style="color:${totp ? "var(--verde)" : "var(--ink-2)"}">${icone("escudo", 22)}</span>
          <div class="principal"><div class="titulo">Verificação em duas etapas</div><div class="detalhe">${totp ? "Ligada — o login pede o código do app autenticador" : "Desligada — ligue para exigir um código além da senha"}</div></div>
          ${FC.pilula(totp ? "verde" : "cinza", totp ? "ligada" : "desligada")}<span class="chevron">${icone("chevron", 18)}</span></div>
        <div class="item clicavel" id="aj-sair"><span style="color:var(--vermelho)">${icone("sair", 20)}</span><div class="principal"><div class="titulo" style="color:var(--vermelho)">Sair</div></div></div>
      </div>
      <p class="texto-p mt2">${icone("cadeado", 13)} A senha é guardada pelo Supabase Auth só como hash bcrypt, e todo o tráfego é HTTPS. Cada tabela tem Row Level Security: o banco só entrega uma linha a quem é dono dela.</p>`)}

      ${grupo("Aparência", "", html`<div class="lista">
        <div class="item"><div class="principal"><div class="titulo">Tema</div></div>
          <div class="segmentado" role="group" id="aj-tema">
            ${[["auto", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]].map(([k, v]) => html`<button type="button" data-tema="${k}" aria-pressed="${tema === k}">${v}</button>`)}</div></div>
        <div class="item"><div class="principal"><div class="titulo">Modo privado</div><div class="detalhe">borra os valores em reais; passe o mouse para ver</div></div>
          <label class="interruptor"><input type="checkbox" id="aj-privado" ${FC.local.ler("privado", false) ? "checked" : ""}><span></span></label></div>
      </div>`)}

      ${grupo("Metas de alocação", "em % do patrimônio; a soma precisa dar 100", html`<form class="cartao" id="f-metas">
        <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">
          ${FC.PILARES.map((p) => html`<div class="campo"><label for="meta-${p.chave}"><span class="ponto-e" style="background:${p.cor}"></span> ${p.nome}</label>
            <input id="meta-${p.chave}" name="${p.chave}" inputmode="decimal" value="${alvos[p.chave] ?? 0}"></div>`)}
        </div>
        <div class="flex entre mt2"><span id="soma-metas" class="fraco"></span><button class="botao" type="submit">Salvar metas</button></div>
      </form>`)}

      ${grupo("Regras de avaliação", "quanto cada lente pesa e onde fica cada veredito", html`<form class="cartao" id="f-regras">
        <p class="rot fraco mb2" style="font-size:13px;font-weight:500">Peso das lentes</p>
        <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
          ${[["historica", "Histórico"], ["regra", "Seu alvo"], ["pares", "Pares"], ["macro", "Renda fixa"]].map(([k, v]) => html`<div class="campo"><label for="pl-${k}">${v}</label><input id="pl-${k}" name="pl_${k}" inputmode="decimal" value="${r.pesos_lentes[k]}"></div>`)}
        </div>
        <div class="form mt2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          <div class="campo"><label for="v-atende">“Atende” a partir de</label><input id="v-atende" name="atende" inputmode="decimal" value="${r.vereditos.atende}"></div>
          <div class="campo"><label for="v-observar">“Zona cinzenta” a partir de</label><input id="v-observar" name="observar" inputmode="decimal" value="${r.vereditos.observar}"></div>
          <div class="campo"><label for="v-janela">Janela do histórico (anos)</label><input id="v-janela" name="janela" inputmode="numeric" value="${r.janela_historico_anos}"></div>
        </div>
        <details class="mt3"><summary style="cursor:pointer;color:var(--acento);font-size:14px">Faixas de cada indicador (avançado)</summary>
          <p class="texto-p mt2">Cada perfil tem suas métricas com ótimo (nota 100), aceitável (60) e ruim (0). <code>direcao</code> é <code>menor_melhor</code> ou <code>maior_melhor</code>.</p>
          <div class="campo mt1"><textarea id="regras-json" rows="16" spellcheck="false">${JSON.stringify({ perfis: r.perfis, override_perfil: r.override_perfil, segmentos_papel: r.segmentos_papel }, null, 2)}</textarea></div>
        </details>
        <div class="flex entre mt3 quebra"><button class="botao texto" type="button" id="bt-regras-padrao">Voltar ao padrão</button><button class="botao" type="submit">Salvar regras</button></div>
        <div id="regras-erro" class="mensagem erro mt2" hidden></div>
      </form>`)}

      ${grupo("Universo da aba Renda", "setores e empresas analisados", html`<form class="cartao" id="f-renda">
        <p class="texto-p mb2">Setores cujo lucro vem de tarifa regulada, contrato longo ou spread. <code>sem_ebitda: true</code> desliga o critério de dívida (bancos).</p>
        <div class="campo"><textarea id="renda-json" rows="14" spellcheck="false">${JSON.stringify(prefs.renda, null, 2)}</textarea></div>
        <div class="flex entre mt2 quebra"><button class="botao texto" type="button" id="bt-renda-padrao">Voltar ao padrão</button><button class="botao" type="submit">Salvar universo</button></div>
        <div id="renda-erro" class="mensagem erro mt2" hidden></div>
      </form>`)}

      ${grupo("Log do sistema", "atualizações de preço, registros diários e erros", html`<div class="lista" id="aj-log"><div class="vazio"><div class="roda" style="margin:0 auto"></div></div></div>
        <p class="texto-p mt2">O registro diário roda sozinho no Supabase todo dia às 18h10 (Brasília), mesmo com o app fechado. Com o app aberto, os preços são atualizados a cada minuto.</p>`)}

      ${grupo("Histórico mensal", "totais de meses anteriores ao app (ex.: anotados no Notion)", html`<form class="cartao" id="f-hist">
        <p class="texto-p mb2">Cole o CSV com as colunas <b>Ano</b>, <b>Mês</b> e <b>Total</b> (as outras são ignoradas). Cada mês com total vira um ponto no gráfico de crescimento, no último dia do mês. Meses já existentes são atualizados.</p>
        <div class="campo"><textarea id="hist-csv" rows="6" spellcheck="false" placeholder="N°,Ano,Mês,Total,Fechado&#10;1,2024,Janeiro,800,false"></textarea></div>
        <div class="flex entre mt2 quebra"><span class="fraco" id="hist-previa"></span><button class="botao" type="submit">Importar</button></div>
      </form>`)}

      ${grupo("Seus dados", "", html`<div class="lista">
        <div class="item clicavel" id="aj-exportar"><span style="color:var(--acento)">${icone("exportar", 22)}</span>
          <div class="principal"><div class="titulo">Baixar backup</div><div class="detalhe">tudo em um arquivo JSON: carteira, aportes, agro e preferências</div></div><span class="chevron">${icone("chevron", 18)}</span></div>
        <div class="item clicavel" id="aj-restaurar"><span style="color:var(--acento)">${icone("importar", 22)}</span>
          <div class="principal"><div class="titulo">Restaurar backup</div><div class="detalhe">acrescenta o conteúdo de um backup; o que já existe fica</div></div><span class="chevron">${icone("chevron", 18)}</span></div>
        <div class="item clicavel" id="aj-apagar"><span style="color:var(--vermelho)">${icone("lixo", 22)}</span>
          <div class="principal"><div class="titulo" style="color:var(--vermelho)">Apagar todos os dados</div><div class="detalhe">a conta continua; carteira, aportes e agro somem</div></div></div>
      </div><input type="file" id="aj-arquivo" accept=".json" hidden>`)}
    </div>`);

    // ---- conta
    let esperaNome = null;
    FC.$("#aj-nome", raiz).addEventListener("input", (e) => {
      clearTimeout(esperaNome);
      esperaNome = setTimeout(async () => {
        try { const d = await FC.sb.auth.updateUser({ data: { nome: e.target.value.trim() } }); if (d.data && d.data.user) FC.auth.usuario = d.data.user; FC.ui.aviso("Nome salvo"); } catch (err) { FC.ui.erro(err); }
      }, 700);
    });
    FC.$("#aj-senha", raiz).addEventListener("click", trocaSenha);
    FC.$("#aj-mfa", raiz).addEventListener("click", () => (totp ? desligaMfa(totp) : ligaMfa()));
    FC.$("#aj-sair", raiz).addEventListener("click", () => FC.sair());

    // ---- aparência
    FC.$$("#aj-tema button", raiz).forEach((b) => b.addEventListener("click", () => { FC.local.gravar("tema", b.dataset.tema); FC.aplicaTema(b.dataset.tema); }));
    FC.$("#aj-privado", raiz).addEventListener("change", (e) => { FC.local.gravar("privado", e.target.checked); FC.aplicaPrivado(); });

    // ---- metas
    const fm = FC.$("#f-metas", raiz);
    const somaMetas = () => {
      const d = FC.dadosDoForm(fm);
      const s = FC.PILARES.reduce((t, p) => t + (FC.lerNum(d[p.chave]) || 0), 0);
      const el = FC.$("#soma-metas", raiz);
      el.textContent = `Soma: ${fmt.num(s, 0)}%`;
      el.className = Math.abs(s - 100) < 0.01 ? "pos" : "neg";
      return s;
    };
    fm.addEventListener("input", somaMetas); somaMetas();
    fm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (Math.abs(somaMetas() - 100) > 0.01) return FC.ui.aviso("As metas precisam somar 100%.", "erro");
      const d = FC.dadosDoForm(fm);
      const alocacao_alvo = Object.fromEntries(FC.PILARES.map((p) => [p.chave, FC.lerNum(d[p.chave]) || 0]));
      try { await FC.ui.ocupado(FC.$("button[type=submit]", fm), () => FC.db.gravaPrefs({ alocacao_alvo })); await C.depoisDeMudar("Metas salvas"); } catch (err) { FC.ui.erro(err); }
    });

    // ---- regras
    const fr = FC.$("#f-regras", raiz);
    fr.addEventListener("submit", async (e) => {
      e.preventDefault();
      const erro = FC.$("#regras-erro", raiz);
      erro.hidden = true;
      const d = FC.dadosDoForm(fr);
      let avancado;
      try { avancado = JSON.parse(FC.$("#regras-json", raiz).value); } catch (err) { erro.textContent = "O JSON das faixas tem um erro: " + err.message; erro.hidden = false; return; }
      const regras = {
        ...avancado,
        pesos_lentes: Object.fromEntries(["historica", "regra", "pares", "macro"].map((k) => [k, FC.lerNum(d["pl_" + k]) ?? 0])),
        vereditos: { atende: FC.lerNum(d.atende) ?? 70, observar: FC.lerNum(d.observar) ?? 45 },
        janela_historico_anos: Math.max(1, Math.min(10, Math.round(FC.lerNum(d.janela) || 3))),
      };
      try {
        await FC.ui.ocupado(FC.$("button[type=submit]", fr), () => FC.db.gravaPrefs({ regras }));
        await C.depoisDeMudar("Regras salvas — scores recalculados", true);
      } catch (err) { FC.ui.erro(err); }
    });
    FC.$("#bt-regras-padrao", raiz).addEventListener("click", async () => {
      if (!(await FC.ui.confirma("Voltar todas as regras ao padrão?", { botao: "Voltar ao padrão" }))) return;
      try { await FC.db.gravaPrefs({ regras: null }); await C.depoisDeMudar("Regras padrão restauradas"); } catch (err) { FC.ui.erro(err); }
    });

    // ---- renda
    const fre = FC.$("#f-renda", raiz);
    fre.addEventListener("submit", async (e) => {
      e.preventDefault();
      const erro = FC.$("#renda-erro", raiz);
      erro.hidden = true;
      let renda;
      try { renda = JSON.parse(FC.$("#renda-json", raiz).value); if (!renda.setores) throw new Error("falta a chave “setores”"); }
      catch (err) { erro.textContent = "O JSON tem um erro: " + err.message; erro.hidden = false; return; }
      try { await FC.ui.ocupado(FC.$("button[type=submit]", fre), () => FC.db.gravaPrefs({ renda })); await C.depoisDeMudar("Universo salvo"); } catch (err) { FC.ui.erro(err); }
    });
    FC.$("#bt-renda-padrao", raiz).addEventListener("click", async () => {
      try { await FC.db.gravaPrefs({ renda: null }); await C.depoisDeMudar("Universo padrão restaurado"); } catch (err) { FC.ui.erro(err); }
    });

    // ---- dados
    FC.$("#aj-exportar", raiz).addEventListener("click", () => {
      const b = FC.estado.base;
      const limpa = (arr) => arr.map(({ user_id, ...x }) => x);
      const backup = { app: "finance-control", versao: 1, gerado: new Date().toISOString(),
        ativos: limpa(b.ativos), renda_fixa: limpa(b.rendaFixa), aportes: limpa(b.aportes),
        agro_movimentos: limpa(b.agro.movs), agro_custos: limpa(b.agro.custos), agro_pesagens: limpa(b.agro.pesagens),
        preferencias: (({ user_id, ...x }) => x)(b.prefsBrutas || {}) };
      FC.baixar(`finance-control-${FC.datas.hoje()}.json`, JSON.stringify(backup, null, 2));
      FC.ui.aviso("Backup baixado");
    });
    const arq = FC.$("#aj-arquivo", raiz);
    FC.$("#aj-restaurar", raiz).addEventListener("click", () => arq.click());
    arq.addEventListener("change", async () => {
      const f = arq.files[0];
      if (!f) return;
      try {
        const b = JSON.parse(await f.text());
        if (b.app !== "finance-control") throw new Error("este arquivo não é um backup do Finance Control");
        if (!(await FC.ui.confirma(`Acrescentar ${b.ativos.length} ativo(s), ${b.aportes.length} aporte(s) e ${b.agro_movimentos.length} movimento(s) do agro?`, { botao: "Restaurar" }))) return;
        const sem = (arr, ...campos) => arr.map((x) => { const y = { ...x }; for (const c of ["id", "user_id", "criado_em", "seq", ...campos]) delete y[c]; return y; });
        await FC.db.inserirVarios("ativos", sem(b.ativos), "user_id,ticker");
        await FC.db.inserirVarios("renda_fixa", sem(b.renda_fixa), "user_id,nome");
        const comOrigem = b.aportes.filter((a) => a.origem), semOrigem = b.aportes.filter((a) => !a.origem);
        await FC.db.inserirVarios("aportes", sem(comOrigem), "user_id,origem");
        await FC.db.inserirVarios("aportes", sem(semOrigem));
        await FC.db.inserirVarios("agro_movimentos", sem(b.agro_movimentos));
        await FC.db.inserirVarios("agro_custos", sem(b.agro_custos));
        await FC.db.inserirVarios("agro_pesagens", sem(b.agro_pesagens));
        if (b.preferencias) { const { atualizado_em, ...p } = b.preferencias; await FC.db.gravaPrefs(p); }
        await C.depoisDeMudar("Backup restaurado", true);
      } catch (err) { FC.ui.erro(err); }
      arq.value = "";
    });
    FC.$("#aj-apagar", raiz).addEventListener("click", apagaTudo);
    ligaHistorico(raiz);
    carregaLog(FC.$("#aj-log", raiz));
  };

  // ---------------------------------------------------------------- histórico mensal
  const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function lerHistorico(texto) {
    const linhas = FC.importador.csv(texto.trim());
    const tira = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const col = (l, nome) => l[Object.keys(l).find((k) => tira(k) === nome)];
    const saida = [];
    for (const l of linhas) {
      const ano = Number(col(l, "ano")), mesTxt = tira(col(l, "mes")), total = FC.lerNum(String(col(l, "total") || "").replace(/R\$/g, ""));
      const m = MESES.indexOf(mesTxt) + 1 || Number(mesTxt);
      if (!(ano > 1990 && m >= 1 && m <= 12 && total > 0)) continue;
      const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
      saida.push({ data: `${ano}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`, patrimonio: total });
    }
    return saida.sort((a, b) => a.data.localeCompare(b.data));
  }
  function ligaHistorico(raiz) {
    const form = FC.$("#f-hist", raiz), ta = FC.$("#hist-csv", raiz), pv = FC.$("#hist-previa", raiz);
    ta.addEventListener("input", () => {
      const l = lerHistorico(ta.value);
      pv.textContent = l.length ? `${l.length} mês(es) com total, de ${FC.datas.br(l[0].data).slice(3)} a ${FC.datas.br(l.at(-1).data).slice(3)}` : "";
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const l = lerHistorico(ta.value);
      if (!l.length) return FC.ui.aviso("Não encontrei meses com Ano, Mês e Total.", "erro");
      // não sobrescreve um dia que o próprio app registrou
      const doApp = new Set(FC.estado.base.historico.filter((h) => h.origem !== "importado").map((h) => h.data));
      const linhas = l.filter((x) => !doApp.has(x.data)).map((x) => ({ ...x, user_id: FC.auth.usuario.id, origem: "importado", por_pilar: { fonte: "importação" } }));
      try {
        await FC.ui.ocupado(FC.$("button[type=submit]", form), async () => {
          const { error } = await FC.sb.from("patrimonio_historico").upsert(linhas, { onConflict: "user_id,data" });
          if (error) throw error;
        });
        FC.db.log("importacao", { fonte: "CSV", meses: linhas.length });
        ta.value = ""; pv.textContent = "";
        await C.depoisDeMudar(`${linhas.length} mês(es) importado(s)`);
      } catch (err) { FC.ui.erro(err); }
    });
  }

  // ---------------------------------------------------------------- log
  const EVENTOS = {
    registro_diario: ["Registro diário", "azul"],
    precos: ["Cotações atualizadas", "verde"],
    aporte: ["Aporte", "terra"],
    importacao: ["Histórico importado", "azul"],
    erro: ["Erro", "vermelho"],
  };
  async function carregaLog(el) {
    try {
      const logs = await FC.db.logs(60);
      el.innerHTML = String(logs.length ? html`${logs.map((l) => {
        const [nome, cor] = EVENTOS[l.evento] || [l.evento, "cinza"];
        const det = l.detalhe || {};
        const texto = l.evento === "erro" ? `${det.etapa || ""}: ${det.erro || ""}`
          : l.evento === "aporte" ? `${det.destino || ""} · ${FC.fmt.brlTexto(det.valor)}`
          : l.evento === "importacao" ? `${det.meses} mês(es) · ${det.fonte || ""}`
          : [det.patrimonio != null ? "patrimônio " + FC.fmt.brlTexto(det.patrimonio) : "", det.ativos != null ? det.ativos + " ativo(s)" : "",
             det.sem_preco && det.sem_preco.length ? "sem preço: " + det.sem_preco.join(", ") : ""].filter(Boolean).join(" · ");
        return html`<div class="item"><div class="principal"><div class="titulo">${nome} ${FC.pilula(cor, l.origem === "automatico" ? "automático" : "app")}</div>
          <div class="detalhe rs">${texto || " "}</div></div>
          <div class="valores"><small>${new Date(l.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small></div></div>`;
      })}` : html`<div class="vazio">Nenhum evento ainda.</div>`);
    } catch (e) { el.innerHTML = String(html`<div class="vazio">${FC.ui.traduzErro(e.message)}</div>`); }
  }

  // ---------------------------------------------------------------- senha
  function trocaSenha() {
    const f = FC.ui.folha({
      titulo: "Trocar senha",
      corpo: html`<form class="form" id="f-senha">
        <div class="campo"><label for="s-nova">Nova senha</label><input id="s-nova" type="password" autocomplete="new-password" required></div>
        <div class="campo"><label for="s-rep">Repita</label><input id="s-rep" type="password" autocomplete="new-password" required>
          <span class="dica">Mínimo de 10 caracteres, com maiúscula, minúscula e número.</span></div>
        <div id="s-erro" class="mensagem erro" hidden></div></form>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="salvar">Trocar</button>`,
    });
    const form = FC.$("#f-senha", f.el);
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    FC.$("[data-acao=salvar]", f.el).addEventListener("click", () => form.requestSubmit());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = FC.$("#s-nova", form).value, b = FC.$("#s-rep", form).value, erro = FC.$("#s-erro", form);
      if (a !== b) { erro.textContent = "As senhas não coincidem."; erro.hidden = false; return; }
      if (!(a.length >= 10 && /[a-z]/.test(a) && /[A-Z]/.test(a) && /\d/.test(a))) { erro.textContent = "Mínimo de 10 caracteres, com maiúscula, minúscula e número."; erro.hidden = false; return; }
      try { await FC.ui.ocupado(FC.$("[data-acao=salvar]", f.el), () => FC.auth.trocarSenha(a)); f.fechar(); FC.ui.aviso("Senha trocada"); }
      catch (err) { erro.textContent = FC.ui.traduzErro(err.message); erro.hidden = false; }
    });
  }

  // ---------------------------------------------------------------- 2 etapas
  async function ligaMfa() {
    let dados;
    try { dados = await FC.auth.inscreverTotp(); } catch (e) { return FC.ui.erro(e); }
    const qr = dados.totp.qr_code;
    const qrUrl = qr.startsWith("data:") ? qr : "data:image/svg+xml;utf8," + encodeURIComponent(qr);
    const f = FC.ui.folha({
      titulo: "Ligar verificação em duas etapas",
      corpo: html`<div class="form">
        <p class="texto-p">1. Abra um app autenticador (Apple Senhas, Google Authenticator, 1Password, Authy) e escaneie o código.</p>
        <div class="centro"><img src="${qrUrl}" alt="QR code para o app autenticador" style="width:200px;height:200px;background:#fff;border-radius:16px;padding:10px"></div>
        <p class="texto-p centro">ou digite a chave: <code style="user-select:all;word-break:break-all">${dados.totp.secret}</code></p>
        <p class="texto-p">2. Digite o código de 6 dígitos que aparece no app.</p>
        <div class="campo"><input id="mfa-cod" class="codigo-mfa" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></div>
        <div id="mfa-erro" class="mensagem erro" hidden></div></div>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao" data-acao="ativar">Ativar</button>`,
    });
    const cod = FC.$("#mfa-cod", f.el);
    cod.addEventListener("input", () => { cod.value = cod.value.replace(/\D/g, ""); });
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", async () => { f.fechar(); try { await FC.auth.removerTotp(dados.id); } catch (e) { /* pendente */ } });
    FC.$("[data-acao=ativar]", f.el).addEventListener("click", async (e) => {
      const bt = e.currentTarget;
      try {
        await FC.ui.ocupado(bt, () => FC.auth.verificarTotp(dados.id, cod.value));
        f.fechar();
        FC.ui.aviso("Verificação em duas etapas ligada");
        FC.rerender({ suave: true });
      } catch (err) { const el = FC.$("#mfa-erro", f.el); el.textContent = /invalid/i.test(err.message) ? "Código incorreto. Confira o app e tente de novo." : FC.ui.traduzErro(err.message); el.hidden = false; }
    });
  }

  async function desligaMfa(totp) {
    if (!(await FC.ui.confirma("Desligar a verificação em duas etapas? O login volta a pedir só a senha.", { botao: "Desligar", perigo: true }))) return;
    try { await FC.auth.removerTotp(totp.id); FC.ui.aviso("Verificação em duas etapas desligada"); FC.rerender({ suave: true }); }
    catch (e) { FC.ui.erro(e); }
  }

  // ---------------------------------------------------------------- apagar
  function apagaTudo() {
    const f = FC.ui.folha({
      titulo: "Apagar todos os dados",
      corpo: html`<div class="form"><div class="mensagem erro">${icone("alerta", 18)}<span>Isto apaga carteira, renda fixa, aportes, agro e preferências. Não dá para desfazer — baixe um backup antes.</span></div>
        <div class="campo"><label for="conf-apaga">Digite <b>APAGAR</b> para confirmar</label><input id="conf-apaga" autocomplete="off"></div></div>`,
      rodape: html`<button class="botao sec" data-acao="cancelar">Cancelar</button><button class="botao perigo" data-acao="apagar" disabled>Apagar tudo</button>`,
    });
    const inp = FC.$("#conf-apaga", f.el), bt = FC.$("[data-acao=apagar]", f.el);
    inp.addEventListener("input", () => { bt.disabled = inp.value.trim() !== "APAGAR"; });
    FC.$("[data-acao=cancelar]", f.el).addEventListener("click", f.fechar);
    bt.addEventListener("click", async () => {
      try { await FC.ui.ocupado(bt, () => FC.db.apagaConta()); f.fechar(); await C.depoisDeMudar("Dados apagados"); } catch (e) { FC.ui.erro(e); }
    });
  }
})();
