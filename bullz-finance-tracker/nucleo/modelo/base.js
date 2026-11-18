/* Do banco ao retrato da carteira, sem interface: preferências com os
 * padrões, o que pedir ao mercado, como juntar o que volta e a montagem.
 *
 * Dois chamadores passam por aqui para calcularem igual:
 *   - o app (src/estado/app.ts), que cuida do que é de tela (cache local,
 *     repintar, relógio de cotações) e usa as peças soltas;
 *   - a Edge Function do MCP (supabase/functions/mcp), que usa `carrega()`
 *     inteiro, uma vez por chamada de ferramenta. */
(function () {
  const FC = window.FC;

  // ---------------------------------------------------------------- preferências
  function montaPrefs(brutas) {
    const p = {
      alocacao_alvo: { ...FC.PADRAO_ALOCACAO, ...(brutas.alocacao_alvo || {}) },
      premissas: FC.mescla(FC.PADRAO_PREMISSAS, brutas.premissas),
      // objetivos e dados dos títulos moram no mesmo jsonb, mas não são premissas da projeção
      premissas_salvas: !!brutas.premissas && Object.keys(brutas.premissas).some((k) => k !== "objetivos" && k !== "titulos"),
      regras: brutas.regras ? FC.mescla(FC.PADRAO_REGRAS, brutas.regras) : JSON.parse(JSON.stringify(FC.PADRAO_REGRAS)),
      renda: brutas.renda || JSON.parse(JSON.stringify(FC.PADRAO_RENDA)),
      agro: FC.mescla(FC.PADRAO_AGRO, brutas.agro),
      plano: FC.mescla(FC.PADRAO_PLANO, brutas.plano),
      proventos: FC.mescla(FC.PADRAO_PROVENTOS, brutas.proventos),
      layout: brutas.layout || null,
      hierarquia: FC.mescla(FC.PADRAO_HIERARQUIA || {}, brutas.hierarquia),
    };
    // proventos: o destino é a fonte; o booleano do plano sai dele
    p.plano.destino_proventos = FC.salario.destinoProventos(p.plano, p.proventos);
    p.plano.reinvestir_dividendos = FC.salario.reinvesteProventos(p.plano.destino_proventos, p.proventos);
    // aporte mensal: com plano configurado, ele é a fonte e a premissa vira
    // derivada (a projeção usa o plano; ver FC.projecao.projeta)
    const comPlano = !!(p.plano.destinos && p.plano.destinos.length);
    p.premissas.aporte_mensal_fonte = comPlano ? "plano" : "premissa";
    return p;
  }

  // ---------------------------------------------------------------- mercado
  // tickers cujo histórico interessa: carteira, watchlist e o que aparece
  // nos aportes (para o gráfico de crescimento do patrimônio)
  function itensDeMercado(base) {
    const m = new Map();
    for (const a of base.ativos) m.set(a.ticker, { ticker: a.ticker, classe: a.classe });
    for (const a of base.aportes) {
      if (a.tipo === "ativo" && a.ticker && !m.has(a.ticker)) m.set(a.ticker, { ticker: a.ticker, classe: "acao_br" });
    }
    return [...m.values()];
  }

  // o raio-x da CVM entra em cada FII do universo (e serve de par para os outros)
  function juntaCvm(universo, cvm) {
    if (!(cvm && cvm.fundos && universo && universo.fiis)) return;
    for (const [t, v] of Object.entries(cvm.fundos)) {
      const f = universo.fiis[t];
      if (!f) continue;
      f.cvm = { ...v, fonte: cvm.fonte };
      f.vacancia_financeira = v.vacancia_financeira ?? null;
      f.concentracao = v.tipo === "papel" ? (v.cri || {}).maior : v.tipo === "fof" ? (v.fii || {}).maior
        : v.tipo === "hibrido" ? v.maior_imovel ?? (v.cri || {}).maior ?? null : v.maior_imovel ?? null;
    }
  }

  // sem a série diária (ou com ela incompleta), a renda fixa rende pela
  // taxa anual do Banco Central em vez de ficar parada no valor aplicado
  function aplicaIndices(mercado, indices) {
    const reserva = (mercado.universo && mercado.universo.macro) || {};
    if (indices || (reserva.cdi != null && !(mercado.indices && mercado.indices.tem))) {
      mercado.indices = FC.rentab.preparaIndices(indices || {}, reserva);
    }
  }

  // ---------------------------------------------------------------- tudo de uma vez
  // Lê as tabelas, busca o mercado (se pedido) e monta `FC.estado.dados`.
  // Não grava nada e não guarda dado de usuário em lugar nenhum além do
  // próprio `FC.estado`. Falha de mercado não derruba a leitura: volta em
  // `erroMercado` e as posições saem sem preço.
  async function carrega({ comMercado = true, comProventos = false } = {}) {
    const estado = (FC.estado = FC.estado || {});
    estado.mercado = estado.mercado || { universo: null, historicos: {}, spot: {} };
    estado.erroMercado = null;
    estado.base = await FC.db.carregaTudo();
    estado.prefs = montaPrefs(estado.base.prefsBrutas);
    estado.prefs.modulos = FC.resolveModulos(estado.base.prefsBrutas.modulos, estado.base);

    if (comMercado) {
      try {
        const anos = estado.prefs.regras.janela_historico_anos || 3;
        const itens = itensDeMercado(estado.base);
        const naCarteira = estado.base.ativos.map((a) => ({ ticker: a.ticker, classe: a.classe }));
        const quieto = (p) => p.catch((e) => { console.error(e); return null; });
        const [universo, historicos, indices, cvm, spot] = await Promise.all([
          FC.mercado.universo(),
          FC.mercado.historicos(itens, anos),
          quieto(FC.mercado.indices()),
          quieto(FC.mercado.fiisCvm()),
          quieto(FC.mercado.cotacoes(naCarteira)),
        ]);
        estado.mercado.universo = universo;
        estado.mercado.historicos = { ...estado.mercado.historicos, ...historicos };
        juntaCvm(universo, cvm);
        aplicaIndices(estado.mercado, indices);
        for (const [t, v] of Object.entries(spot || {})) if (v && !v.erro) estado.mercado.spot[t] = v;
        if (comProventos) {
          const pagam = naCarteira.filter((a) => a.classe !== "cripto");
          estado.proventos = pagam.length ? await quieto(FC.mercado.proventos(pagam)) : {};
        }
      } catch (e) {
        console.error(e);
        estado.erroMercado = e.message || String(e);
      }
    }
    estado.dados = FC.carteira.monta(estado.base, estado.mercado, estado.prefs);
    return estado;
  }

  FC.base = { montaPrefs, itensDeMercado, juntaCvm, aplicaIndices, carrega };
})();
