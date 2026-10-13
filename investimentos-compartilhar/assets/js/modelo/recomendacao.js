/* Recomendação do perfil: cascata de três níveis.
 *
 *   1. plano      dívida → reserva → objetivos curtos → longo prazo
 *   2. alocação   faixas por classe, com o ponto dado pelo score bruto
 *   3. candidatos ativos que passam nos quatro filtros do perfil
 *
 * Cada item gerado carrega o id da regra que o produziu (`regra`), para o
 * Relatório explicar o porquê. Classes: renda_fixa, fiis, acoes, cripto;
 * no resto do app elas são os pilares caixa, real_estate, acoes e
 * alternativos (o agro fica fora do alvo: é ilíquido e operacional). */
(function () {
  const FC = window.FC;
  const P = FC.PERFIL;

  const CLASSES = [
    { chave: "renda_fixa", nome: "Renda fixa", pilar: "caixa" },
    { chave: "fiis", nome: "FIIs", pilar: "real_estate" },
    { chave: "acoes", nome: "Ações e ETFs", pilar: "acoes" },
    { chave: "cripto", nome: "Cripto", pilar: "alternativos" },
  ];
  const NOME_CLASSE = Object.fromEntries(CLASSES.map((c) => [c.chave, c.nome]));
  const RISCO = ["fiis", "acoes", "cripto"];
  const grampo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const CLASSE_DO_ATIVO = { acao_br: "acoes", acao_us: "acoes", etf_br: "acoes", etf_us: "acoes", fii: "fiis", cripto: "cripto" };
  // o módulo que liga cada classe de risco (renda fixa e ações BR sempre valem)
  const MODULO_DA_CLASSE = { fiis: "fii", cripto: "cripto" };

  const texto = (regra, params = {}) => String(P.regras[regra] || regra)
    .replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
  const regrasDoPerfil = (prefs) => FC.mescla(FC.PADRAO_REGRAS.perfil, (((prefs || {}).regras || {}).perfil) || null);

  // ---------------------------------------------------------------- nível 2
  // posição do score dentro da faixa do perfil: 0 = piso, 1 = teto
  function posicaoNaFaixa(score, faixa) {
    return faixa.ate > faixa.de ? grampo((score - faixa.de) / (faixa.ate - faixa.de), 0, 1) : 0;
  }

  // divide `total` (soma 100) em inteiros pela regra do maior resto
  function inteiros(valores) {
    const chaves = Object.keys(valores);
    const base = Object.fromEntries(chaves.map((k) => [k, Math.floor(valores[k])]));
    let falta = 100 - chaves.reduce((s, k) => s + base[k], 0);
    const ordem = [...chaves].sort((a, b) => (valores[b] - base[b]) - (valores[a] - base[a]));
    for (let i = 0; falta > 0 && i < ordem.length * 2; i++, falta--) base[ordem[i % ordem.length]]++;
    return base;
  }

  // Alvo por classe. Renda fixa recebe o resíduo e a hierarquia
  // renda fixa > ações > cripto vale sempre, qualquer que seja a regra editada.
  function alocacao({ perfil, score, regras, conhecimento, classesOff = [] }) {
    const faixaPerfil = P.faixas.find((f) => f.chave === perfil);
    const pos = posicaoNaFaixa(score, faixaPerfil);
    const f = regras.alocacao[perfil];
    const notas = [{ regra: "alocacao.faixa_perfil", perfil: faixaPerfil.nome, score }];
    const lerp = ([lo, hi]) => lo + pos * (hi - lo);

    // mais risco, menos renda fixa: o orçamento de risco sai da faixa dela
    const rfAlvo = f.renda_fixa[1] - pos * (f.renda_fixa[1] - f.renda_fixa[0]);
    const orcamento = Math.max(0, 100 - rfAlvo);
    const bruto = Object.fromEntries(RISCO.map((c) => [c, lerp(f[c])]));
    const soma = RISCO.reduce((s, c) => s + bruto[c], 0);
    const v = {};
    for (const c of RISCO) {
      let x = soma > 0 ? (bruto[c] / soma) * orcamento : 0;
      x = grampo(x, f[c][0], f[c][1]);
      v[c] = x;
    }
    // teto do conhecimento e módulos desligados
    const teto = P.conhecimento[conhecimento] || P.conhecimento.experiente;
    for (const c of RISCO) {
      if (classesOff.includes(c)) {
        if (v[c] > 0) notas.push({ regra: "alocacao.modulo_desligado", classe: NOME_CLASSE[c] });
        v[c] = 0;
      } else if (v[c] > teto[c]) {
        notas.push({ regra: "alocacao.teto_conhecimento", classe: NOME_CLASSE[c], teto: teto[c] });
        v[c] = teto[c];
      }
    }
    v.renda_fixa = 100 - RISCO.reduce((s, c) => s + v[c], 0);
    let n = inteiros(v);

    // hierarquia, em inteiros
    let mudou = false;
    while (n.renda_fixa <= n.acoes && n.acoes > 0) { n.acoes--; n.renda_fixa++; mudou = true; }
    while (n.acoes <= n.cripto && n.cripto > 0) { n.cripto--; n.renda_fixa++; mudou = true; }
    if (n.renda_fixa <= 0) { const maior = RISCO.slice().sort((a, b) => n[b] - n[a])[0]; n[maior]--; n.renda_fixa++; mudou = true; }
    if (mudou) notas.push({ regra: "alocacao.hierarquia" });
    if (f.cripto[1] > 0 && n.cripto > 0) notas.push({ regra: "alocacao.cripto_perfil", teto: f.cripto[1], perfil: faixaPerfil.nome });

    return {
      classes: n,
      pilares: Object.fromEntries(CLASSES.map((c) => [c.pilar, n[c.chave]]).concat([["agro", 0]])),
      posicao_na_faixa: pos,
      faixas: f,
      notas: notas.map((x) => ({ ...x, texto: texto(x.regra, x) })),
    };
  }

  // renda fixa por indexador: CDI alto puxa para pós-fixado, juro real alto para IPCA+
  function divisaoRendaFixa(macro, retorno) {
    let pos = 50, ipca = 35, pre = 15;
    const cdi = (macro || {}).cdi;
    if (cdi != null && cdi >= 12) { pos += 10; ipca -= 5; pre -= 5; }
    if (retorno && retorno.real_rf >= 6) { ipca += 15; pos -= 10; pre -= 5; }
    pre = Math.max(5, pre);
    const t = pos + ipca + pre;
    const r = inteiros({ pos: (pos / t) * 100, ipca: (ipca / t) * 100, pre: (pre / t) * 100 });
    return [
      { id: "pos", rotulo: "Pós-fixado (CDI ou Selic)", pct: r.pos },
      { id: "ipca", rotulo: "IPCA+ (inflação mais juro)", pct: r.ipca },
      { id: "pre", rotulo: "Prefixado", pct: r.pre },
    ];
  }

  // ---------------------------------------------------------------- nível 1
  function plano({ resp, res, regras, retorno }) {
    const v = (id) => { const o = FC.perfil.escolhida(resp, id); return o && !o.nd ? o.v : null; };
    const renda = v("renda"), sobra = v("sobra");
    const estab = (FC.perfil.escolhida(resp, "estab") || {}).v || "nd";
    const fator = regras.fator_aporte[res.perfil];
    const aporte = sobra != null ? Math.round(sobra * fator) : null;
    const custo = renda != null && sobra != null ? Math.max(0, renda - sobra) : null;
    const passos = [];

    if (resp.divida === "sim") {
      passos.push({ id: "quitar_divida", regra: "plano.divida_cara", titulo: "Quitar a dívida cara",
        resumo: "Direcione a sobra do mês para cartão rotativo ou cheque especial até zerar.",
        valor_mensal: sobra, exclusivo: true, texto: texto("plano.divida_cara") });
      return { passos, aporte_mensal: aporte, fator, custo_mensal: custo, reserva: null, exclusivo: true, estab };
    }

    // 2. reserva de emergência
    const meses = P.reserva_meses[estab] || 6;
    const reservaAtual = (FC.perfil.escolhida(resp, "reserva") || {}).v;
    const atual = reservaAtual == null ? null : reservaAtual;
    const faltaMeses = atual == null ? meses : Math.max(0, meses - atual);
    const faltaValor = custo != null ? faltaMeses * custo : null;
    const mesesParaChegar = faltaValor != null && aporte > 0 ? Math.ceil(faltaValor / aporte) : null;
    const reserva = { meses_alvo: meses, meses_atual: atual, falta_meses: faltaMeses, falta_valor: faltaValor, custo_mensal: custo, meses_para_chegar: mesesParaChegar };
    if (faltaMeses > 0) {
      passos.push({ id: "reserva", regra: meses === 12 ? "plano.reserva_12" : "plano.reserva_6", titulo: "Montar a reserva de emergência",
        resumo: `${meses} meses de custo de vida em renda fixa pós-fixada com liquidez diária.`,
        valor_total: faltaValor, valor_mensal: aporte, meses: mesesParaChegar, texto: texto(meses === 12 ? "plano.reserva_12" : "plano.reserva_6") });
    } else {
      passos.push({ id: "reserva_ok", regra: "plano.reserva_ok", titulo: "Reserva de emergência completa",
        resumo: "Nada a fazer aqui: mantenha o valor atualizado com o custo de vida.", feito: true, texto: texto("plano.reserva_ok") });
    }

    // 3. objetivo de até 2 anos
    const prazo = FC.perfil.escolhida(resp, "prazo");
    const curto = prazo && prazo.v < 2;
    if (curto) {
      passos.push({ id: "objetivo_curto", regra: "plano.objetivo_curto", titulo: "Objetivo de curto prazo em renda fixa",
        resumo: "Título com vencimento casado ao prazo, fora da carteira de risco.", texto: texto("plano.objetivo_curto") });
    }

    // 4. longo prazo, segundo o perfil
    if (!curto || faltaMeses === 0) {
      passos.push({ id: "longo_prazo", regra: "plano.longo_prazo", titulo: "Investir para o longo prazo",
        resumo: `Distribua os aportes pela alocação do perfil ${res.faixa.nome}.`, valor_mensal: aporte, texto: texto("plano.longo_prazo") });
    }
    return { passos, aporte_mensal: aporte, fator, custo_mensal: custo, reserva, exclusivo: false, estab };
  }

  // ---------------------------------------------------------------- necessidade e conflitos
  // alocação do meio das faixas de um perfil, normalizada para 100
  function alocacaoMedia(regras, chave) {
    const f = regras.alocacao[chave];
    const m = Object.fromEntries(Object.keys(f).map((c) => [c, (f[c][0] + f[c][1]) / 2]));
    const t = Object.values(m).reduce((s, x) => s + x, 0) || 1;
    return Object.fromEntries(Object.entries(m).map(([c, x]) => [c, (x / t) * 100]));
  }

  function conflitos({ resp, res, pl, regras, retorno, aloc }) {
    const lista = [];
    const vv = (id) => { const o = FC.perfil.escolhida(resp, id); return o && !o.nd ? o.v : null; };
    const alvoValor = vv("valor_alvo"), anos = vv("prazo"), vp = vv("patrimonio") || 0;
    const pmt = pl.aporte_mensal || 0;
    let necessidade = null;
    if (alvoValor && anos && resp.objetivo !== "reserva") {
      necessidade = FC.perfil.necessidade({ vp, pmtMensal: pmt, anos, alvo: alvoValor });
    }
    const referencia = FC.perfil.retornoDaAlocacao(aloc.classes, retorno);

    if (necessidade != null) {
      if (necessidade === Infinity || necessidade > referencia + 0.005) {
        const r = referencia;
        lista.push({ id: "meta_acima_perfil", regra: "conflito.meta_acima_perfil", nivel: "alto",
          titulo: "Sua meta pede mais risco do que cabe no seu perfil",
          texto: texto("conflito.meta_acima_perfil"),
          necessidade, referencia: r,
          saidas: {
            aporte_necessario: FC.perfil.aporteNecessario({ vp, anos, alvo: alvoValor, r }),
            prazo_necessario: FC.perfil.prazoNecessario({ vp, pmtMensal: pmt, alvo: alvoValor, r }),
            meta_possivel: FC.perfil.valorFuturo(r, vp, pmt * 12, anos),
          } });
      } else if (necessidade < referencia - 0.02) {
        // o perfil mais conservador cuja referência ainda bate a meta
        const menor = P.faixas.find((f) => FC.perfil.retornoDaAlocacao(alocacaoMedia(regras, f.chave), retorno) >= necessidade);
        if (menor && menor.chave !== res.perfil) {
          lista.push({ id: "meta_folgada", regra: "conflito.meta_folgada", nivel: "info",
            titulo: "Dá para chegar lá com menos risco",
            texto: texto("conflito.meta_folgada") + ` Uma alocação ${menor.nome.toLowerCase()} já entrega o retorno que a meta exige.`,
            necessidade, referencia, sugerido: menor.chave });
        }
      }
    }
    if (res.tolerancia >= 65 && res.capacidade <= 34 && res.limitado_por === "capacidade") {
      lista.push({ id: "tolerancia_acima_capacidade", regra: "conflito.tolerancia_acima_capacidade", nivel: "medio",
        titulo: "O limite é a sua situação, não a sua coragem",
        texto: texto("conflito.tolerancia_acima_capacidade") + " Reserva em dia e dívidas quitadas aumentam a capacidade." });
    }
    if (res.consistencia === "baixa") {
      lista.push({ id: "baixa_consistencia", regra: "conflito.baixa_consistencia", nivel: "medio",
        titulo: "Baixa consistência nas respostas", texto: texto("conflito.baixa_consistencia") + " Vale refazer em 30 dias." });
    }
    return { lista, necessidade, referencia };
  }

  // comportamento revelado: a carteira real contra o perfil declarado
  function comportamento({ res, regras, dados, base }) {
    const alertas = [];
    if (!dados) return alertas;
    const rf = dados.resumo.renda_fixa || 0, rv = (dados.resumo.bolsa || 0) + (dados.resumo.cripto || 0);
    const total = rf + rv;
    if (total > 0) {
      const pctRv = (rv / total) * 100;
      const maxRv = 100 - regras.alocacao[res.perfil].renda_fixa[0];
      if (pctRv > maxRv + 10) {
        alertas.push({ id: "carteira_acima_perfil", regra: "conflito.carteira_acima_perfil", nivel: "medio",
          titulo: "Sua carteira é mais arriscada que o seu perfil",
          texto: `${Math.round(pctRv)}% em renda variável e cripto; o perfil ${res.faixa.nome} vai até ${Math.round(maxRv)}%.` });
      }
    }
    // vendas com o preço 20% abaixo da máxima dos 12 meses anteriores
    const hoje = FC.datas ? FC.datas.hoje() : new Date().toISOString().slice(0, 10);
    const limite = new Date(new Date(hoje).getTime() - 365 * 86400000).toISOString().slice(0, 10);
    const hist = (FC.estado && FC.estado.mercado && FC.estado.mercado.historicos) || {};
    let emQueda = 0;
    for (const a of (base && base.aportes) || []) {
      if (a.tipo !== "ativo" || !a.venda || !a.ticker || a.data < limite) continue;
      const s = (hist[a.ticker] || {}).precos;
      if (!s || !s.length) continue;
      const antes = s.filter(([d]) => d <= a.data).slice(-252);
      if (antes.length < 20) continue;
      const maxima = Math.max(...antes.map(([, p]) => p));
      const preco = a.preco || antes.at(-1)[1];
      if (preco && preco <= maxima * 0.8) emQueda++;
    }
    if (emQueda >= 1) {
      alertas.push({ id: "vendas_em_queda", regra: "conflito.vendas_em_queda", nivel: "medio",
        titulo: "Vendas em quedas fortes",
        texto: `${emQueda} venda${emQueda > 1 ? "s" : ""} nos últimos 12 meses com o preço 20% ou mais abaixo da máxima do período. Isso contradiz a tolerância declarada.` });
    }
    return alertas;
  }

  // ---------------------------------------------------------------- nível 3
  const valorMetrica = (a, chave) => { const m = (a.metricas || []).find((x) => x.chave === chave); return m && m.valor != null ? m.valor : null; };

  function motivoDe(a) {
    const partes = (a.destaques || []).filter((m) => m.valor != null).slice(0, 3).map((m) => {
      const v = FC.fmt && FC.fmt.metrica ? FC.fmt.metrica(m.valor, m.unidade) : String(m.valor);
      return `${m.rotulo_curto || m.rotulo} ${v}`;
    });
    return partes.length ? partes.join(" · ") : "nota geral das quatro lentes";
  }
  function alertaDe(a) {
    if (a.conflitos && a.conflitos.length) return `As lentes divergem em ${a.conflitos[0].rotulo_curto || a.conflitos[0].rotulo}`;
    if (a.avisos && a.avisos.length) return a.avisos[0];
    const pior = (a.metricas || []).filter((m) => m.nota != null).sort((x, y) => x.nota - y.nota)[0];
    return pior && pior.nota < 60 ? `${pior.rotulo_curto || pior.rotulo} é o ponto mais fraco (nota ${Math.round(pior.nota)})` : null;
  }

  // universo: carteira, watchlist e as empresas da aba Renda
  function universo({ dados, prefs, mercado }) {
    const itens = [];
    const vistos = new Set();
    for (const a of (dados && dados.ativos) || []) {
      if (a.erro || a.score == null) continue;
      vistos.add(a.ticker);
      itens.push({ ...a, origem: a.na_carteira ? "carteira" : "watchlist" });
    }
    const u = mercado && mercado.universo;
    if (u && FC.avaliador && prefs) {
      const renda = prefs.renda || FC.PADRAO_RENDA;
      for (const bloco of Object.values(renda.setores || {})) {
        for (const ticker of Object.keys(bloco.empresas || {})) {
          if (vistos.has(ticker)) continue;
          vistos.add(ticker);
          try {
            const r = FC.avaliador.avalia(ticker, "acao_br", u, (mercado && mercado.historicos) || {}, prefs.regras, (mercado.spot || {})[ticker]);
            if (!r.erro && r.score != null) itens.push({ ...r, origem: "renda", posicao: null, na_carteira: false });
          } catch (e) { /* ativo fora do universo de mercado */ }
        }
      }
    }
    return itens;
  }

  function candidatos({ itens, res, regras, aloc, classesOff, investido, conhecimento }) {
    const perfil = res.perfil;
    const minimo = regras.score_minimo[perfil], pesoMax = regras.peso_max_ativo[perfil], liqMin = regras.liquidez_minima[perfil];
    const saida = { acoes: [], fiis: [], cripto: [] };
    const descartados = [];

    for (const a of itens) {
      const classe = CLASSE_DO_ATIVO[a.classe];
      if (!classe) continue;
      const motivos = [];
      const individual = a.classe === "acao_br" || a.classe === "acao_us";
      // passo 1: classe permitida pelo perfil e pelo conhecimento
      let estudar = false;
      if (classesOff.includes(classe)) motivos.push(`${NOME_CLASSE[classe]} está desligada em Ajustes → Módulos`);
      else if (aloc.classes[classe] <= 0) {
        if (conhecimento === "nenhum" && (individual || classe === "cripto" || classe === "fiis")) estudar = true;
        else motivos.push(`${NOME_CLASSE[classe]} fica fora da alocação do perfil`);
      } else if (conhecimento === "nenhum" && (individual || classe === "cripto")) estudar = true;
      // passo 2: score mínimo
      if (a.score < minimo) motivos.push(`nota ${Math.round(a.score)} abaixo do mínimo de ${minimo} do perfil`);
      // passo 3: filtros de risco
      const liq = valorMetrica(a, "liquidez");
      if (liq != null && liq < liqMin) motivos.push("liquidez diária abaixo do mínimo do perfil");
      let alertaExtra = null;
      if (classe === "fiis" && perfil === "conservador") {
        if (!["fii_tijolo", "fii_papel"].includes(a.perfil)) motivos.push("tipo de FII fora do que o perfil conservador aceita (só tijolo ou papel)");
        else {
          const conc = valorMetrica(a, "concentracao");
          const lim = a.perfil === "fii_papel" ? 10 : 30;
          if (conc != null && conc > lim) motivos.push(`concentração de ${Math.round(conc)}% acima do limite de ${lim}%`);
          else if (conc == null) alertaExtra = "sem dado de concentração do fundo";
        }
      }
      if (classe === "cripto") {
        const base = String(a.ticker || "").split("-")[0].toUpperCase();
        if (!P.cripto_grandes.includes(base)) motivos.push("fora das criptos de maior capitalização");
      }
      // passo 4: concentração
      const peso = a.posicao && investido > 0 ? (a.posicao.atual / investido) * 100 : 0;
      const tetoPeso = estudar ? Math.min(pesoMax, P.estudar_peso_max) : pesoMax;
      if (peso >= tetoPeso) motivos.push(`já pesa ${peso.toFixed(1).replace(".", ",")}% da carteira, no limite de ${tetoPeso}%`);

      const item = { ticker: a.ticker, nome: a.tipo_rotulo, classe: a.classe, grupo: classe, score: a.score, cor: a.cor,
        veredito: a.veredito_curto, origem: a.origem, na_carteira: !!a.na_carteira, peso_atual: peso, peso_max: tetoPeso,
        estudar, motivo: motivoDe(a), alerta: alertaDe(a) || alertaExtra, regra: "candidato.filtros" };
      if (motivos.length) descartados.push({ ...item, motivos });
      else saida[classe].push(item);
    }
    for (const c of Object.keys(saida)) {
      saida[c].sort((x, y) => y.score - x.score);
      saida[c] = saida[c].slice(0, 5);
    }
    return { por_classe: saida, descartados };
  }

  // ---------------------------------------------------------------- tudo junto
  function gera({ resp, res, prefs, dados, base, mercado, modo = "educativo" }) {
    const regras = regrasDoPerfil(prefs);
    const macro = (dados && dados.macro) || (mercado && mercado.universo && mercado.universo.macro) || {};
    const retorno = FC.perfil.retornoReal(prefs, macro);
    const modulo = (k) => (FC.modulo ? FC.modulo(k) : true);
    const classesOff = RISCO.filter((c) => MODULO_DA_CLASSE[c] && !modulo(MODULO_DA_CLASSE[c]));

    const aloc = alocacao({ perfil: res.perfil, score: res.score, regras, conhecimento: res.conhecimento, classesOff });
    aloc.renda_fixa_divisao = divisaoRendaFixa(macro, retorno);
    const pl = plano({ resp, res, regras, retorno });
    const conf = conflitos({ resp, res, pl, regras, retorno, aloc });
    const comp = comportamento({ res, regras, dados, base });

    const investido = dados && dados.resumo ? (dados.resumo.bolsa || 0) + (dados.resumo.cripto || 0) + (dados.resumo.renda_fixa || 0) : 0;
    const itens = universo({ dados, prefs, mercado });
    const cand = pl.exclusivo ? { por_classe: { acoes: [], fiis: [], cripto: [] }, descartados: [] }
      : candidatos({ itens, res, regras, aloc, classesOff, investido, conhecimento: res.conhecimento });

    const educativo = modo !== "completo";
    return {
      versao: P.versao, modo, perfil: res.perfil, score: res.score,
      plano: pl, alocacao: aloc, candidatos: cand, conflitos: [...conf.lista, ...comp],
      necessidade: conf.necessidade, retorno_referencia: conf.referencia, retorno_real: retorno,
      rotulos: {
        alocacao: educativo ? "Modelo de referência" : "Alocação sugerida",
        candidatos: educativo ? "Ativos que passam nos filtros do seu perfil" : "Ativos candidatos",
        aviso: educativo ? "Ferramenta pessoal com base no questionário que você respondeu. Não é recomendação de investimento." : "Ferramenta pessoal baseada no questionário. Não substitui a análise de um profissional.",
      },
      avisos: [
        ...(res.precisao === "reduzida" ? ["Você escolheu “prefiro não dizer” em alguma pergunta de dinheiro: o plano fica menos preciso."] : []),
        "O resultado vem só das suas respostas ao questionário. Responder outra coisa muda o plano.",
      ],
      // o texto de cada regra usada, para o Relatório
      regras: Object.fromEntries([...pl.passos.map((p) => p.regra), ...aloc.notas.map((n) => n.regra), ...res.tetos.map((t) => t.regra), ...res.descontos.map((d) => d.regra),
        ...conf.lista.map((c) => c.regra), "alocacao.faixa_perfil"].map((id) => [id, P.regras[id]])),
    };
  }

  // ---------------------------------------------------------------- plano contra realidade
  // aporte do mês, distância da alocação-alvo e progresso da reserva
  function planoContraRealidade({ plano: p, alocacaoAlvo, dados, base }) {
    if (!p || !dados) return null;
    const mes = (FC.datas ? FC.datas.hoje() : new Date().toISOString().slice(0, 10)).slice(0, 7);
    const feito = ((base && base.aportes) || []).filter((a) => a.data.slice(0, 7) === mes && !a.venda && a.valor > 0 && (a.tipo === "ativo" || a.tipo === "caixa"))
      .reduce((s, a) => s + a.valor, 0);
    const desvios = (dados.alocacao || []).filter((l) => !l.fora_meta && l.alvo_pct > 0).map((l) => ({ pilar: l.chave, nome: l.nome, atual: l.pct_meta ?? l.pct, alvo: l.alvo_pct, desvio: (l.pct_meta ?? l.pct) - l.alvo_pct }));
    const rf = (dados.resumo || {}).renda_fixa || 0;
    const reserva = p.reserva && p.reserva.custo_mensal > 0 && p.reserva.meses_alvo
      ? { meses_alvo: p.reserva.meses_alvo, meses_atual: Math.min(p.reserva.meses_alvo, rf / p.reserva.custo_mensal) } : null;
    return { mes, aporte_feito: feito, aporte_sugerido: p.aporte_mensal, desvios, reserva };
  }

  // metas gravadas em preferencias.alocacao_alvo
  function metasDoPlano(aloc) {
    return { ...aloc.pilares };
  }

  FC.recomendacao = { CLASSES, gera, alocacao, plano, candidatos, divisaoRendaFixa, planoContraRealidade, metasDoPlano, texto, regrasDoPerfil, inteiros };
})();
