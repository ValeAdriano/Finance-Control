/* As quatro lentes e o avaliador.
 *
 * O veredito é a aplicação mecânica dos SEUS critérios (Ajustes →
 * Regras). Não é recomendação: é o seu checklist, calculado rápido e
 * sempre do mesmo jeito. As lentes discordam de propósito — um FII pode
 * estar barato contra a própria história e caro contra os pares, e ver
 * as duas coisas é o ponto. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  const TITULOS = { regra: "Seu alvo", historica: "Histórico", pares: "Pares", macro: "Renda fixa" };
  const corDaNota = (n) => (n == null ? "cinza" : n >= 70 ? "verde" : n >= 45 ? "amarelo" : "vermelho");
  const nota = (lente, n, texto = "", referencia = null, detalhes = {}) =>
    ({ lente, nota: n, texto, referencia, detalhes, titulo: TITULOS[lente] || lente, cor: corDaNota(n) });

  function interpola(v, otimo, aceitavel, ruim, menor) {
    const d = (a, b) => Math.max(a - b, 1e-9);
    if (menor) {
      if (v <= otimo) return 100;
      if (v <= aceitavel) return 100 - (40 * (v - otimo)) / d(aceitavel, otimo);
      if (v <= ruim) return 60 - (60 * (v - aceitavel)) / d(ruim, aceitavel);
      return 0;
    }
    if (v >= otimo) return 100;
    if (v >= aceitavel) return 100 - (40 * (otimo - v)) / d(otimo, aceitavel);
    if (v >= ruim) return 60 - (60 * (aceitavel - v)) / d(aceitavel, ruim);
    return 0;
  }

  function f(v, u = "") {
    if (!ok(v)) return "—";
    if (u === "R$") return Math.abs(v) >= 1e6 ? "R$ " + FC.fmt.num(v / 1e6, 1) + " mi" : "R$ " + FC.fmt.int(v);
    if (Math.abs(v) >= 1000) return FC.fmt.int(v);
    return FC.fmt.num(v) + u;
  }

  // ---------------------------------------------------------------- lentes
  function lenteRegra(valor, cfg) {
    if (!ok(valor) || cfg.otimo == null) return nota("regra", null, "sem faixa configurada");
    const menor = cfg.direcao === "menor_melhor";
    const n = interpola(valor, cfg.otimo, cfg.aceitavel, cfg.ruim, menor);
    const u = cfg.unidade || "";
    return nota("regra", n, `seu ótimo é ${menor ? "até" : "a partir de"} ${f(cfg.otimo, u)}; aceitável ${f(cfg.aceitavel, u)}`, cfg.otimo);
  }

  function lenteHistorica(valor, serie, cfg, anos) {
    const vals = (serie || []).map((x) => x[1]).filter(ok);
    if (!ok(valor) || vals.length < 20) return nota("historica", null, "histórico insuficiente");
    const menor = cfg.direcao === "menor_melhor";
    const melhores = vals.filter((v) => (menor ? v > valor : v < valor)).length;
    const n = (100 * melhores) / vals.length;
    const ord = [...vals].sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    const alvo = menor ? ord[Math.floor(ord.length / 4)] : ord[Math.floor((3 * ord.length) / 4)];
    const u = cfg.unidade || "";
    return nota("historica", n,
      `melhor que ${Math.round(n)}% dos últimos ${anos} anos; mediana ${f(mediana, u)} (hoje ${valor < mediana ? "abaixo" : "acima"})`,
      alvo, { mediana, min: ord[0], max: ord.at(-1) });
  }

  const MIN_PARES = 10;
  function lentePares(valor, valoresPares, cfg, grupo) {
    const pares = (valoresPares || []).filter(ok);
    if (!ok(valor) || pares.length < MIN_PARES) return nota("pares", null, `amostra insuficiente (${pares.length} pares com o dado)`);
    const menor = cfg.direcao === "menor_melhor";
    const piores = pares.filter((v) => (menor ? v > valor : v < valor)).length;
    const n = (100 * piores) / pares.length;
    const ord = [...pares].sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    return nota("pares", n, `melhor que ${Math.round(n)}% dos ${pares.length} de ${grupo}; mediana ${f(mediana, cfg.unidade || "")}`,
      mediana, { mediana, n: pares.length });
  }

  const IR_LONGO_PRAZO = 0.15;
  function lenteMacro(valor, cfg, macro, isento) {
    const ancora = cfg.ancora_macro;
    if (!ancora || !ok(valor) || !macro[ancora]) return nota("macro", null, "sem âncora macro");
    const bruto = macro[ancora];
    const base = isento ? bruto * (1 - IR_LONGO_PRAZO) : bruto;
    const rot = isento ? `${ancora.toUpperCase()} líquido de IR` : ancora.toUpperCase();
    const spread = valor - base;
    const n = Math.max(0, Math.min(100, 50 + (spread / 3) * 50));
    return nota("macro", n, `${f(valor, "%")} contra ${f(base, "%")} do ${rot}: ${f(Math.abs(spread))} p.p. ${spread >= 0 ? "acima" : "abaixo"}`,
      base, { spread, base, bruto });
  }

  // ---------------------------------------------------------------- perfis
  function perfilDoFii(ticker, segmento, regras) {
    if ((regras.override_perfil || {})[ticker]) return regras.override_perfil[ticker];
    if ((regras.segmentos_papel || []).includes(segmento)) return "fii_papel";
    return "fii_tijolo";
  }
  function perfilDoAtivo(ticker, classe, universo, regras) {
    if (classe === "fii") return perfilDoFii(ticker, (universo.fiis[ticker] || {}).segmento || "", regras);
    return classe;
  }

  // ---------------------------------------------------------------- limpeza
  // O Fundamentus escreve 0 querendo dizer "não informado"; P/L negativo
  // é prejuízo, não barato; e alguns números são impossíveis (vacância de
  // 91% num shopping é a ocupação invertida). Melhor calar que errar.
  const ZERO_E_AUSENTE = new Set(["vacancia", "cap_rate", "dy", "pvp", "pl", "roe", "ffo_yield", "ev_ebitda", "roic", "liquidez"]);
  const NEGATIVO_E_RUIM = new Set(["pl", "pvp", "ev_ebitda"]);
  const PLAUSIVEL = { vacancia: [0, 60], cap_rate: [0, 30], dy: [0, 40], pvp: [0, 5], ffo_yield: [0, 40] };

  function sanitiza(chave, valor) {
    if (!ok(valor)) return [null, false, null];
    if (NEGATIVO_E_RUIM.has(chave) && valor <= 0) return [null, true, null];
    if (ZERO_E_AUSENTE.has(chave) && valor === 0) return [null, false, null];
    const fx = PLAUSIVEL[chave];
    if (fx && !(fx[0] <= valor && valor <= fx[1])) return [null, false, `valor implausível na fonte: ${FC.fmt.num(valor)}`];
    return [valor, false, null];
  }

  function grupoDePares(ticker, classe, perfil, universo, regras) {
    let pares, nome;
    if (classe === "fii") {
      const seg = (universo.fiis[ticker] || {}).segmento || "";
      pares = Object.entries(universo.fiis)
        .filter(([k, v]) => k !== ticker && perfilDoFii(k, v.segmento || "", regras) === perfil && (perfil === "fii_papel" || v.segmento === seg))
        .map(([, v]) => v);
      nome = perfil === "fii_papel" ? "fundos de papel" : "FIIs de " + seg;
    } else if (classe === "acao_br") {
      // sem classificação setorial gratuita: compara com a B3 líquida
      pares = Object.entries(universo.acoes).filter(([k, v]) => k !== ticker && (v.liquidez || 0) > 1e6).map(([, v]) => v);
      nome = "ações líquidas da B3";
    } else {
      return ["", {}];
    }
    const metricas = {};
    for (const p of pares) {
      for (const [k, v] of Object.entries(p)) {
        if (typeof v !== "number") continue;
        const [limpo] = sanitiza(k, v);
        if (limpo != null) (metricas[k] = metricas[k] || []).push(limpo);
      }
    }
    return [nome, metricas];
  }

  // ---------------------------------------------------------------- séries
  // DY de 12 meses olhando de uma data do passado
  function dyEm(data, dividendos, preco) {
    if (!preco) return null;
    const ini = FC.datas.soma(data, -365);
    let soma = 0;
    for (const [d, v] of dividendos) if (d > ini && d <= data) soma += v;
    return soma ? (soma / preco) * 100 : null;
  }

  function serieDy(h) {
    if (!h.precos.length || !h.dividendos.length) return [];
    const inicio = FC.datas.soma(h.precos[0][0], 365);
    const saida = [];
    h.precos.forEach(([d, p], i) => {
      if (d < inicio || i % 5) return;
      const dy = dyEm(d, h.dividendos, p);
      if (dy) saida.push([d, dy]);
    });
    return saida;
  }

  function seriePremioMedia(h, janela = 200) {
    const p = h.precos;
    if (p.length < janela + 20) return [];
    const saida = [];
    let soma = 0;
    for (let i = 0; i < janela; i++) soma += p[i][1];
    for (let i = janela; i < p.length; i++) {
      soma += p[i][1] - p[i - janela][1];
      if (i % 5) continue;
      const media = soma / janela;
      if (media) saida.push([p[i][0], (p[i][1] / media - 1) * 100]);
    }
    return saida;
  }

  // P/VP histórico APROXIMADO: o VPA de hoje projetado para trás
  function seriePvp(h, pvpHoje) {
    if (!pvpHoje || !h.precos.length || !h.preco) return [];
    const vpa = h.preco / pvpHoje;
    return h.precos.filter((_, i) => !(i % 5)).map(([d, p]) => [d, p / vpa]);
  }

  function valoresAtuais(ticker, classe, universo, h) {
    let base = {};
    if (classe === "fii") base = { ...(universo.fiis[ticker] || {}) };
    else if (classe === "acao_br") base = { ...(universo.acoes[ticker] || {}) };
    if (h) {
      if (base.cotacao == null) base.cotacao = h.preco;
      const ultima = h.precos.length ? h.precos.at(-1)[0] : null;
      const dyCalc = ultima ? dyEm(ultima, h.dividendos, h.preco) : null;
      if (dyCalc) {
        base.dy_calculado = dyCalc;
        if (classe !== "fii" && classe !== "acao_br") base.dy = dyCalc;
      }
      if (h.max_52s && h.preco) base.dist_maxima_52s = (1 - h.preco / h.max_52s) * 100;
      if (h.media_200d && h.preco) base.premio_media_200d = (h.preco / h.media_200d - 1) * 100;
    }
    return base;
  }

  // ---------------------------------------------------------------- avaliação
  // `agora`: preço ao vivo {preco}. Com ele, os múltiplos que dependem do
  // preço (DY, P/L, P/VP) são recalculados — lucro, dividendo e patrimônio
  // por cota continuam os do Fundamentus.
  function avalia(ticker, classe, universo, historicos, regras, agora) {
    ticker = ticker.toUpperCase();
    const anos = regras.janela_historico_anos || 3;
    const perfil = perfilDoAtivo(ticker, classe, universo, regras);
    const cfgPerfil = regras.perfis[perfil];
    const avisos = [];
    if (!cfgPerfil) return { ticker, classe, erro: `o perfil «${perfil}» não existe nas suas regras` };

    let h = historicos[ticker];
    if (h && h.erro) { avisos.push("histórico de preços indisponível"); h = null; }
    if (!h) h = null;

    const valores = valoresAtuais(ticker, classe, universo, h);
    if (agora && ok(agora.preco) && ok(valores.cotacao) && valores.cotacao > 0) {
      const k = agora.preco / valores.cotacao;
      if (ok(valores.dy) && valores.dy_calculado !== valores.dy) valores.dy = valores.dy / k;
      if (ok(valores.pl)) valores.pl = valores.pl * k;
      if (ok(valores.pvp)) valores.pvp = valores.pvp * k;
      valores.cotacao = agora.preco;
    }
    if (!Object.keys(valores).length) return { ticker, classe, erro: "ativo não encontrado nas fontes" };

    const series = h ? { dy: serieDy(h), pvp: seriePvp(h, valores.pvp), premio_media_200d: seriePremioMedia(h) } : {};
    const [grupo, pares] = grupoDePares(ticker, classe, perfil, universo, regras);
    const macro = universo.macro || {};
    const pesos = regras.pesos_lentes;
    const isento = cfgPerfil.isento_ir != null ? !!cfgPerfil.isento_ir : perfil.startsWith("fii");

    if (h && h.precos_descartados) avisos.push(`${h.precos_descartados} dia(s) do histórico foram descartados por valores corrompidos na fonte`);
    if (ok(valores.dy) && ok(valores.dy_calculado) && Math.abs(valores.dy - valores.dy_calculado) > 2) {
      avisos.push(`DY diverge entre as fontes: Fundamentus ${FC.fmt.num(valores.dy)}% contra ${FC.fmt.num(valores.dy_calculado)}% pelos proventos do Yahoo`);
    }

    const metricas = [];
    let somaPesos = 0, somaNotas = 0;
    for (const [chave, cfg] of Object.entries(cfgPerfil.metricas)) {
      const [valor, sinalRuim, descarte] = sanitiza(chave, valores[chave]);
      if (descarte) avisos.push(`«${cfg.rotulo || chave}» não foi avaliado — ${descarte}`);
      // a lente histórica compara com uma série medida do MESMO jeito
      const valorHist = chave === "dy" ? valores.dy_calculado : valor;
      const valorMacro = chave === "dy" ? valorHist : valor;

      let notaMetrica, alvo, notas;
      if (sinalRuim) {
        notas = [lenteRegra(null, cfg)];
        notas[0].texto = "valor negativo ou nulo — tratado como reprovado";
        notaMetrica = 0; alvo = null;
      } else {
        notas = [
          lenteRegra(valor, cfg),
          lenteHistorica(valorHist, series[chave], cfg, anos),
          lentePares(valor, pares[chave], cfg, grupo),
          lenteMacro(valorMacro, cfg, macro, isento),
        ];
        const validas = notas.filter((n) => n.nota != null).map((n) => [n, pesos[n.lente] || 0]);
        const sp = validas.reduce((s, [, p]) => s + p, 0);
        notaMetrica = validas.length && sp ? validas.reduce((s, [n, p]) => s + n.nota * p, 0) / sp : null;
        const refs = notas.map((n) => n.referencia).filter(ok);
        alvo = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : null;
      }
      if (notaMetrica != null) {
        somaPesos += cfg.peso || 1;
        somaNotas += notaMetrica * (cfg.peso || 1);
      }
      let alt = null;
      if (chave === "dy" && ok(valores.dy_calculado) && ok(valor) && Math.abs(valores.dy_calculado - valor) > 0.3) {
        alt = { rotulo: "por proventos (Yahoo)", valor: valores.dy_calculado };
      }
      const dadas = notas.map((n) => n.nota).filter((n) => n != null);
      let divergencia = 0;
      if (dadas.length > 1) {
        const m = dadas.reduce((a, b) => a + b, 0) / dadas.length;
        divergencia = Math.sqrt(dadas.reduce((s, x) => s + (x - m) ** 2, 0) / dadas.length);
      }
      metricas.push({
        chave, rotulo: cfg.rotulo || chave, rotulo_curto: FC.ROTULO_CURTO[chave] || cfg.rotulo || chave,
        unidade: cfg.unidade || "", valor, valor_alt: alt, sinal_ruim: sinalRuim, peso: cfg.peso || 1,
        nota: notaMetrica, alvo, divergencia, lentes: notas, serie: series[chave] || [],
        escala: { otimo: cfg.otimo, aceitavel: cfg.aceitavel, ruim: cfg.ruim, direcao: cfg.direcao },
      });
    }

    const score = somaPesos ? somaNotas / somaPesos : null;
    const fx = regras.vereditos;
    let veredito, cor;
    if (score == null) { veredito = "sem dados"; cor = "cinza"; }
    else if (score >= fx.atende) { veredito = "atende seus critérios"; cor = "verde"; }
    else if (score >= fx.observar) { veredito = "zona cinzenta"; cor = "amarelo"; }
    else { veredito = "fora dos seus critérios"; cor = "vermelho"; }

    const comDado = metricas.filter((m) => m.valor != null);
    return {
      ticker, classe, perfil, segmento: valores.segmento || "", grupo_pares: grupo,
      preco: valores.cotacao ?? (h ? h.preco : null), moeda: h ? h.moeda : "BRL",
      score, veredito, veredito_curto: FC.VEREDITO_CURTO[veredito], cor, metricas, avisos,
      conflitos: metricas.filter((m) => m.divergencia >= 25),
      destaques: [...comDado].sort((a, b) => b.peso - a.peso).slice(0, 3),
      max_52s: h ? h.max_52s : null, min_52s: h ? h.min_52s : null,
      serie_preco: h ? h.precos : [],
      cambio: h ? h.cambio : null,
      tipo_rotulo: FC.CLASSE_ROTULO[perfil] || FC.CLASSE_ROTULO[classe] || classe,
    };
  }

  // ---------------------------------------------------------------- renda fixa
  function avaliaRendaFixa(item, macro) {
    if (item.taxa == null) {
      return { ...item, base: "taxa não informada", nominal: null, real: null, premio_cdi: null, cor: "cinza", leitura: "preencha a taxa contratada" };
    }
    const tipo = item.tipo, taxa = Number(item.taxa);
    const cdi = macro.cdi, ipca = macro.ipca_12m;
    let nominal = null, base = tipo;
    if (tipo === "cdi" && cdi) { nominal = (cdi * taxa) / 100; base = `${FC.fmt.num(taxa, 0)}% do CDI`; }
    else if (tipo === "ipca" && ipca) { nominal = ((1 + ipca / 100) * (1 + taxa / 100) - 1) * 100; base = `IPCA + ${FC.fmt.num(taxa)}%`; }
    else if (tipo === "prefixado") { nominal = taxa; base = `prefixado ${FC.fmt.num(taxa)}%`; }
    const real = nominal && ipca ? ((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100 : null;
    const premio = nominal && cdi ? nominal - cdi : null;
    let cor, leitura;
    if (premio == null) { cor = "cinza"; leitura = "sem dados do Banco Central"; }
    else if (premio >= 1) { cor = "verde"; leitura = `${FC.fmt.delta(premio, 2)} p.p. sobre o CDI`; }
    else if (premio >= -0.5) { cor = "amarelo"; leitura = `${FC.fmt.delta(premio, 2)} p.p. — praticamente o CDI`; }
    else { cor = "vermelho"; leitura = `${FC.fmt.delta(premio, 2)} p.p. abaixo do CDI`; }
    return { ...item, base, nominal, real, premio_cdi: premio, cor, leitura };
  }

  FC.avaliador = { avalia, avaliaRendaFixa, dyEm, interpola, corDaNota, perfilDoAtivo };
})();
