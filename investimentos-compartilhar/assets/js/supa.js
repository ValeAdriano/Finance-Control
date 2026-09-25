/* Tudo o que fala com o Supabase passa por aqui: sessão, tabelas e a
 * Edge Function de mercado. As telas nunca montam consulta sozinhas. */
(function () {
  const FC = window.FC;

  const sb = window.supabase.createClient(FC.config.supabaseUrl, FC.config.supabaseChave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "fc-sessao" },
  });
  FC.sb = sb;

  function checa({ data, error }) {
    if (error) throw error;
    return data;
  }

  // ------------------------------------------------------------------ sessão
  FC.auth = {
    async sessao() { return checa(await sb.auth.getSession()).session; },
    async temDono() {
      const { data, error } = await sb.rpc("painel_tem_dono");
      if (error) return true; // na dúvida, esconde o cadastro
      return !!data;
    },
    async entrar(email, senha) { return checa(await sb.auth.signInWithPassword({ email, password: senha })); },
    async cadastrar(email, senha) { return checa(await sb.auth.signUp({ email, password: senha })); },
    async sair() { await sb.auth.signOut(); },
    async trocarSenha(nova) { return checa(await sb.auth.updateUser({ password: nova })); },
    // verificação em duas etapas (TOTP)
    async nivel() { return checa(await sb.auth.mfa.getAuthenticatorAssuranceLevel()); },
    async fatores() { return checa(await sb.auth.mfa.listFactors()); },
    async inscreverTotp() {
      // um fator pendente de outra tentativa impede a nova inscrição
      const f = await FC.auth.fatores();
      for (const x of (f.all || []).filter((x) => x.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: x.id });
      }
      return checa(await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Finance Control " + Date.now() }));
    },
    async verificarTotp(factorId, codigo) {
      const d = checa(await sb.auth.mfa.challenge({ factorId }));
      return checa(await sb.auth.mfa.verify({ factorId, challengeId: d.id, code: codigo }));
    },
    async removerTotp(factorId) { return checa(await sb.auth.mfa.unenroll({ factorId })); },
    usuario: null,
  };

  // ------------------------------------------------------------------ leitura em páginas
  async function tudo(tabela, ordem, asc = true) {
    const passo = 1000;
    let ini = 0, saida = [];
    for (;;) {
      let q = sb.from(tabela).select("*").range(ini, ini + passo - 1);
      if (ordem) q = q.order(ordem, { ascending: asc });
      const pag = checa(await q);
      saida = saida.concat(pag);
      if (pag.length < passo) return saida;
      ini += passo;
    }
  }

  const num = (v) => (v == null ? null : Number(v));
  function normAtivo(a) { return { ...a, quantidade: num(a.quantidade) || 0, preco_medio: num(a.preco_medio) }; }
  function normRF(r) { return { ...r, taxa: num(r.taxa), valor_aplicado: num(r.valor_aplicado) || 0 }; }
  function normAporte(a) { return { ...a, quantidade: num(a.quantidade), preco: num(a.preco), valor: num(a.valor) }; }
  function normMov(m) {
    return { ...m, cabecas: Number(m.cabecas), peso_medio_kg: num(m.peso_medio_kg), preco_arroba: num(m.preco_arroba),
             preco_cabeca: num(m.preco_cabeca), valor_total: num(m.valor_total) || 0, despesas: num(m.despesas) || 0 };
  }

  // ------------------------------------------------------------------ dados
  FC.db = {
    async carregaTudo() {
      const [ativos, rendaFixa, aportes, prefs, movs, custos, pesagens, historico] = await Promise.all([
        tudo("ativos", "id"), tudo("renda_fixa", "id"), tudo("aportes", "data"),
        sb.from("preferencias").select("*").maybeSingle().then(checa),
        tudo("agro_movimentos", "data"), tudo("agro_custos", "data"), tudo("agro_pesagens", "data"),
        tudo("patrimonio_historico", "data"),
      ]);
      return {
        ativos: ativos.map(normAtivo),
        rendaFixa: rendaFixa.map(normRF),
        aportes: aportes.map(normAporte),
        prefsBrutas: prefs || {},
        historico: historico.map((h) => ({ ...h, patrimonio: num(h.patrimonio), renda_variavel: num(h.renda_variavel) || 0,
          cripto: num(h.cripto) || 0, renda_fixa: num(h.renda_fixa) || 0, agro: num(h.agro) || 0, investido: num(h.investido) })),
        agro: { movs: movs.map(normMov), custos: custos.map((c) => ({ ...c, valor: num(c.valor) })),
                pesagens: pesagens.map((p) => ({ ...p, peso_medio_kg: num(p.peso_medio_kg), cabecas: Number(p.cabecas) })) },
      };
    },

    // genéricos
    async inserir(tabela, linha) { return checa(await sb.from(tabela).insert(linha).select().single()); },
    async inserirVarios(tabela, linhas, conflito) {
      if (!linhas.length) return [];
      const saida = [];
      for (let i = 0; i < linhas.length; i += 500) {
        let q = conflito
          ? sb.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: conflito, ignoreDuplicates: true })
          : sb.from(tabela).insert(linhas.slice(i, i + 500));
        saida.push(...(checa(await q.select()) || []));
      }
      return saida;
    },
    async atualizar(tabela, id, campos) { return checa(await sb.from(tabela).update(campos).eq("id", id).select().single()); },
    async apagar(tabela, id) { checa(await sb.from(tabela).delete().eq("id", id)); },

    async gravaPrefs(campos) {
      const uid = FC.auth.usuario.id;
      return checa(await sb.from("preferencias").upsert({ user_id: uid, ...campos, atualizado_em: new Date().toISOString() }).select().single());
    },

    // foto do dia: no mesmo dia, a mais recente substitui a anterior
    async gravaRegistro(linha) {
      return checa(await sb.from("patrimonio_historico").upsert({ ...linha, user_id: FC.auth.usuario.id }, { onConflict: "user_id,data" }).select().single());
    },
    async log(evento, detalhe = {}) {
      try { await sb.from("log_sistema").insert({ user_id: FC.auth.usuario.id, origem: "app", evento, detalhe }); } catch (e) { /* log não pode travar o app */ }
    },
    async logs(limite = 60) {
      return checa(await sb.from("log_sistema").select("*").order("quando", { ascending: false }).limit(limite));
    },

    async apagaConta() {
      // apaga os dados de todas as tabelas; a conta continua existindo
      for (const t of ["aportes", "ativos", "renda_fixa", "agro_movimentos", "agro_custos", "agro_pesagens", "preferencias", "patrimonio_historico"]) {
        checa(await sb.from(t).delete().not("user_id", "is", null));
      }
    },
  };

  // ------------------------------------------------------------------ mercado
  // Cache em memória + no navegador: dado público de mercado, guardado só
  // para a próxima abertura ser instantânea. A fonte da verdade é a Edge
  // Function, que tem o próprio cache no banco.
  const memoria = {};
  const VALIDADE = { universo: 60 * 60 * 1000, historicos: 60 * 60 * 1000, benchmarks: 6 * 60 * 60 * 1000 };

  async function chama(corpo) {
    const { data, error } = await sb.functions.invoke("mercado", { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.erro || msg; } catch (e) { /* sem corpo */ }
      throw new Error("Mercado: " + msg);
    }
    return data;
  }

  function doNavegador(chave, validade) {
    const x = memoria[chave] || FC.local.ler("m:" + chave, null);
    if (x && Date.now() - x.t < validade) return x.d;
    return null;
  }
  function guarda(chave, d) {
    memoria[chave] = { t: Date.now(), d };
    // o universo inteiro passa de 500 KB; o navegador aguenta, mas se
    // faltar espaço simplesmente não guarda
    FC.local.gravar("m:" + chave, { t: Date.now(), d });
  }

  FC.mercado = {
    async universo(forcar = false) {
      if (!forcar) { const c = doNavegador("universo", VALIDADE.universo); if (c) return c; }
      const d = await chama({ acao: "universo", forcar });
      guarda("universo", d);
      return d;
    },
    async historicos(itens, anos = 3, forcar = false) {
      const saida = {}, faltam = [];
      for (const it of itens) {
        const k = `h:${it.ticker}:${anos}`;
        const c = !forcar && doNavegador(k, VALIDADE.historicos);
        if (c) saida[it.ticker] = c; else faltam.push(it);
      }
      for (let i = 0; i < faltam.length; i += 40) {
        const lote = faltam.slice(i, i + 40);
        const d = await chama({ acao: "historicos", itens: lote, anos, forcar });
        for (const [t, s] of Object.entries(d || {})) {
          saida[t] = s;
          if (!s.erro) guarda(`h:${t}:${anos}`, s);
        }
      }
      return saida;
    },
    async benchmarks(anos = 5, forcar = false) {
      const k = "bench:" + anos;
      if (!forcar) { const c = doNavegador(k, VALIDADE.benchmarks); if (c) return c; }
      const d = await chama({ acao: "benchmarks", anos, forcar });
      guarda(k, d);
      return d;
    },
    // dividendos/JCP/rendimentos com data com e de pagamento (cache de 6 h aqui, 12 h no servidor)
    async proventos(itens, forcar = false) {
      const saida = {}, faltam = [];
      for (const it of itens) {
        const c = !forcar && doNavegador("prov:" + it.ticker, 6 * 60 * 60 * 1000);
        if (c) saida[it.ticker] = c; else faltam.push(it);
      }
      if (faltam.length) {
        const d = (await chama({ acao: "proventos", itens: faltam })) || {};
        for (const [t, v] of Object.entries(d)) { saida[t] = v; if (!v.erro) guarda("prov:" + t, v); }
      }
      return saida;
    },
    // preço de agora: CoinGecko para cripto, Yahoo para bolsa (cache de 1 min no servidor)
    async cotacoes(itens) {
      if (!itens.length) return {};
      return (await chama({ acao: "cotacoes", itens })) || {};
    },
    limpaCacheLocal() {
      for (const k of Object.keys(memoria)) delete memoria[k];
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("fc:m:")).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* sem armazenamento */ }
    },
  };
})();
