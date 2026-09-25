/* Login. A senha nunca é guardada por este app: vai por HTTPS para o
 * Supabase Auth, que armazena só o hash bcrypt. A sessão é um token
 * assinado e renovado automaticamente. Com a verificação em duas etapas
 * ligada, a sessão só é liberada depois do código do autenticador. */
(function () {
  const FC = window.FC;
  FC.telas = FC.telas || {};
  const { html, icone } = FC;

  function forca(s) {
    let n = 0;
    if (s.length >= 10) n++;
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++;
    if (/\d/.test(s)) n++;
    if (s.length >= 14 || /[^A-Za-z0-9]/.test(s)) n++;
    return n;
  }
  const senhaValida = (s) => s.length >= 10 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);

  FC.telas.login = async function (raiz, { etapa, aviso } = {}) {
    document.title = "Entrar · Finance Control";
    raiz.innerHTML = '<div class="tela-login"><div class="roda"></div></div>';
    let modo = etapa || "entrar";
    let fatoresMfa = [];
    if (modo === "mfa") { try { fatoresMfa = ((await FC.auth.fatores()).totp || []).filter((f) => f.status === "verified"); } catch (e) { /* segue */ } }
    if (!etapa) {
      const temDono = await FC.auth.temDono();
      if (!temDono) modo = "criar";
    }

    const titulos = {
      entrar: ["Finance Control", "Entre para ver sua carteira."],
      criar: ["Bem-vindo", "Crie a conta de dono. Depois dela, o cadastro fecha para sempre."],
      mfa: ["Verificação", "Digite o código de 6 dígitos do seu app autenticador."],
    };
    const [t, sub] = titulos[modo];

    raiz.innerHTML = String(html`<div class="tela-login"><div class="caixa-login">
      <div class="logo-g">${FC.logo(30)}</div>
      <h1>${t}</h1><p class="sub">${sub}</p>
      <form class="form" id="f-login" novalidate>
        ${modo === "mfa" ? html`
          ${fatoresMfa.length > 1 ? html`<div class="campo"><label for="fator">Autenticador</label><select id="fator">${fatoresMfa.map((f) => html`<option value="${f.id}">${(f.friendly_name || "Autenticador").replace(/ \d{10,}$/, "").replace(/ [a-z0-9]{4}$/, "")}</option>`)}</select></div>` : ""}
          <div class="campo"><label for="codigo" class="sr">Código</label>
            <input id="codigo" name="codigo" class="codigo-mfa" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>
        ` : html`
          <div class="campo"><label for="email" class="sr">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="username" placeholder="E-mail" required></div>
          <div class="campo"><label for="senha" class="sr">Senha</label>
            <input id="senha" name="senha" type="password" autocomplete="${modo === "criar" ? "new-password" : "current-password"}" placeholder="Senha" required minlength="10">
            ${modo === "criar" ? html`<div class="forca" id="forca"><i></i><i></i><i></i><i></i></div>
              <span class="dica">Mínimo de 10 caracteres, com maiúscula, minúscula e número.</span>` : ""}
          </div>
          ${modo === "criar" ? html`<div class="campo"><label for="senha2" class="sr">Repita a senha</label>
            <input id="senha2" name="senha2" type="password" autocomplete="new-password" placeholder="Repita a senha" required></div>` : ""}
        `}
        ${aviso ? html`<div class="mensagem info">${icone("cadeado", 16)}<span>${aviso}</span></div>` : ""}
        <div id="erro-login" class="mensagem erro" hidden></div>
        <button class="botao cheio" type="submit">${modo === "criar" ? "Criar conta" : modo === "mfa" ? "Verificar" : "Entrar"}</button>
        ${modo === "mfa" ? html`<button class="botao texto" type="button" id="bt-sair-mfa">Usar outra conta</button>` : ""}
      </form>
      <p class="rodape">${icone("cadeado", 14)} Conexão criptografada · senha protegida com bcrypt · o login fica salvo neste aparelho por até 7 dias sem uso</p>
    </div></div>`);

    const form = FC.$("#f-login", raiz);
    const erro = FC.$("#erro-login", raiz);
    const mostraErro = (m) => { erro.textContent = m; erro.hidden = false; form.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 300 }); };

    if (modo === "criar") {
      FC.$("#senha", raiz).addEventListener("input", (e) => { FC.$("#forca", raiz).className = "forca n" + forca(e.target.value); });
    }
    if (modo === "mfa") {
      FC.$("#bt-sair-mfa", raiz).addEventListener("click", async () => { await FC.auth.sair(); FC.telas.login(raiz); });
      FC.$("#codigo", raiz).addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); if (e.target.value.length === 6) form.requestSubmit(); });
    }
    setTimeout(() => { const f = FC.$("input", form); f && f.focus(); }, 300);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      erro.hidden = true;
      const d = FC.dadosDoForm(form);
      const bt = FC.$("button[type=submit]", form);
      try {
        await FC.ui.ocupado(bt, async () => {
          if (modo === "mfa") {
            const escolhido = FC.$("#fator", raiz) ? FC.$("#fator", raiz).value : (fatoresMfa[0] || {}).id;
            if (!escolhido) throw new Error("Nenhum autenticador cadastrado.");
            await FC.auth.verificarTotp(escolhido, d.codigo);
            return FC.entrarNoApp();
          }
          if (!d.email || !d.senha) throw new Error("Preencha e-mail e senha.");
          if (modo === "criar") {
            if (!senhaValida(d.senha)) throw new Error("A senha precisa de ao menos 10 caracteres, com maiúscula, minúscula e número.");
            if (d.senha !== d.senha2) throw new Error("As senhas não coincidem.");
            await FC.auth.cadastrar(d.email, d.senha);
            const s = await FC.auth.sessao();
            if (!s) await FC.auth.entrar(d.email, d.senha);
            FC.ui.aviso("Conta criada. O cadastro agora está fechado.");
            return FC.entrarNoApp();
          }
          await FC.auth.entrar(d.email, d.senha);
          const n = await FC.auth.nivel();
          if (n.nextLevel === "aal2" && n.currentLevel !== "aal2") return FC.telas.login(raiz, { etapa: "mfa" });
          return FC.entrarNoApp();
        });
      } catch (err) {
        mostraErro(FC.ui.traduzErro(err.message || String(err)));
        if (modo === "mfa") { FC.$("#codigo", raiz).value = ""; FC.$("#codigo", raiz).focus(); }
      }
    });
  };
})();
