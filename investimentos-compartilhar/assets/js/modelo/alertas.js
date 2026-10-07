/* Alertas: o que merece atenção na carteira, em linguagem de gente.
 * Concentração, títulos vencendo, limite do FGC, reserva de emergência e
 * exposição ao dólar. Só lê os dados: não grava nada.
 *
 * FC.alertas.calcula(dados, base, prefs) → [{ nivel, titulo, texto, link? }]
 * nivel: "alto" | "medio" | "info" — a lista sai com os altos primeiro. */
(function () {
  const FC = window.FC;

  const LIMITE_ATIVO = 20;          // % do investido em um só ativo
  const LIMITE_SETOR = 35;          // % do investido em um só setor
  const LIMITE_DOLAR = 30;          // % do investido atrelado ao dólar
  const FGC_POR_INSTITUICAO = 250000;
  const FGC_GLOBAL = 1000000;       // teto por CPF, renovado a cada 4 anos
  const FGC_PERTO = 0.8;            // avisa a partir de 80% do teto global
  const DIAS_VENCIMENTO = 30;

  // ETFs da B3 que andam com o dólar (bolsa lá fora, cripto)
  const ETF_DOLAR = new Set(["IVVB11", "NASD11", "SPXI11", "WRLD11", "ACWI11", "XINA11", "EURP11", "HASH11", "QBTC11", "BITH11", "ETHE11", "QETH11"]);

  const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  // garantido pelo FGC: CDB, RDB, LCI, LCA, LC, LIG e poupança.
  // Tesouro, debênture, CRI, CRA e fundos não têm a garantia.
  function garantidoFGC(nome) {
    const n = sem(nome);
    if (/TESOURO|\bLFT\b|\bNTN|\bLTN\b|DEBENTURE|\bCRI\b|\bCRA\b|\bFUNDO\b/.test(n)) return false;
    return /\b(CDB|RDB|LCI|LCA|LC|LIG|LH)\b|POUPANCA/.test(n);
  }
  // nome que sugere título isento de IR para pessoa física
  function sugereIsento(nome) {
    return /\b(LCI|LCA|CRI|CRA|LIG)\b|POUPANCA/.test(sem(nome));
  }

  const objetivosDe = (prefs) => (FC.objetivos ? FC.objetivos(prefs)
    : { meses_reserva: 6, ...(((prefs || {}).premissas || {}).objetivos || {}) });
  const titulosDe = (prefs) => ((prefs || {}).premissas || {}).titulos || {};
  const brl = (v) => FC.fmt.brlTexto(v, 0);
  const pct = (v) => FC.fmt.num(v, 0) + "%";
  const ORDEM = { alto: 0, medio: 1, info: 2 };

  function calcula(dados, base, prefs) {
    const saida = [];
    if (!dados) return saida;
    const hoje = FC.datas.hoje();
    const ativos = (dados.ativos || []).filter((a) => a.posicao && a.posicao.atual > 0);
    const rf = (dados.rendaFixa || []).filter((t) => (t.valor_aplicado || 0) > 0.005);
    const investido = FC.soma(ativos, (a) => a.posicao.atual) + FC.soma(rf, (t) => t.valor_aplicado);
    const meta = titulosDe(prefs);
    const obj = objetivosDe(prefs);

    // ---- concentração: um ativo (ETF de índice já é diversificado) ou um setor
    if (investido > 0) {
      for (const a of ativos) {
        if (a.classe === "etf_br" || a.classe === "etf_us") continue;
        const p = (a.posicao.atual / investido) * 100;
        if (p > LIMITE_ATIVO) saida.push({ nivel: p > 2 * LIMITE_ATIVO ? "alto" : "medio", titulo: `${a.ticker} é ${pct(p)} do que você tem investido`,
          texto: `Acima de ${LIMITE_ATIVO}% em um só ativo, um problema nele pesa muito no total. Considere direcionar os próximos aportes para outros.`,
          link: "#/ativos" });
      }
      const setores = {};
      for (const a of ativos) {
        if (!a.segmento || a.classe === "etf_br" || a.classe === "etf_us" || a.classe === "cripto") continue;
        setores[a.segmento] = (setores[a.segmento] || 0) + a.posicao.atual;
      }
      for (const [s, v] of Object.entries(setores)) {
        const p = (v / investido) * 100;
        if (p > LIMITE_SETOR) saida.push({ nivel: "medio", titulo: `${pct(p)} em um só setor (${s})`,
          texto: `Mais de ${LIMITE_SETOR}% do investido depende do mesmo setor. Uma crise nele afeta tudo de uma vez.`, link: "#/ativos" });
      }
    }

    // ---- títulos vencendo (ou já vencidos com saldo)
    for (const t of rf) {
      if (!t.vencimento) continue;
      const dias = FC.datas.dias(hoje, t.vencimento);
      if (dias < 0) saida.push({ nivel: "medio", titulo: `${t.nome} venceu em ${FC.datas.br(t.vencimento)}`,
        texto: `Ainda aparece com ${brl(t.valor_aplicado)}. Se o dinheiro já caiu na conta, registre o resgate ou atualize o título.`, link: "#/ativos" });
      else if (dias <= DIAS_VENCIMENTO) saida.push({ nivel: "medio", titulo: `${t.nome} vence ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}`,
        texto: `Cerca de ${brl(t.valor_aplicado)} voltam para a conta em ${FC.datas.br(t.vencimento)}. Vale decidir antes para onde vai esse dinheiro.`, link: "#/ativos" });
    }

    // ---- FGC: até R$ 250 mil por instituição e R$ 1 milhão no total
    const garantidos = rf.filter((t) => garantidoFGC(t.nome));
    const porInst = {}, semInst = [];
    for (const t of garantidos) {
      const inst = String((meta[t.id] || {}).instituicao || "").trim();
      if (!inst) { semInst.push(t); continue; }
      const k = sem(inst);
      (porInst[k] = porInst[k] || { nome: inst, valor: 0, n: 0 }).valor += t.valor_aplicado;
      porInst[k].n++;
    }
    for (const g of Object.values(porInst)) {
      if (g.valor > FGC_POR_INSTITUICAO) saida.push({ nivel: "alto", titulo: `${brl(g.valor)} em ${g.nome}: acima da garantia do FGC`,
        texto: `O FGC cobre até ${brl(FGC_POR_INSTITUICAO)} por instituição. Se ${g.nome} quebrar, ${brl(g.valor - FGC_POR_INSTITUICAO)} ficariam sem garantia. Considere dividir entre bancos diferentes.`,
        link: "#/ativos" });
    }
    const semInstValor = FC.soma(semInst, (t) => t.valor_aplicado);
    if (semInst.length && semInstValor > FGC_POR_INSTITUICAO) saida.push({ nivel: "info", titulo: "Informe o banco dos seus títulos",
      texto: `${semInst.length} título(s) com garantia do FGC, somando ${brl(semInstValor)}, estão sem instituição. Sem ela não dá para conferir o limite de ${brl(FGC_POR_INSTITUICAO)} por banco.`,
      link: "#/ativos" });
    const totalGarantido = FC.soma(garantidos, (t) => t.valor_aplicado);
    if (totalGarantido > FGC_GLOBAL) saida.push({ nivel: "alto", titulo: "Acima do teto global do FGC",
      texto: `Você tem ${brl(totalGarantido)} em títulos garantidos; o FGC cobre no máximo ${brl(FGC_GLOBAL)} por pessoa somando todos os bancos. Tesouro Direto não depende do FGC.`, link: "#/ativos" });
    else if (totalGarantido >= FGC_GLOBAL * FGC_PERTO) saida.push({ nivel: "medio", titulo: "Perto do teto global do FGC",
      texto: `Você tem ${brl(totalGarantido)} em títulos garantidos; o teto do FGC é ${brl(FGC_GLOBAL)} por pessoa, somando todos os bancos.`, link: "#/ativos" });

    // ---- reserva de emergência
    const custo = Number(obj.custo_vida_mensal) || 0;
    const meses = Number(obj.meses_reserva) || 6;
    const daReserva = rf.filter((t) => (meta[t.id] || {}).reserva);
    if (custo > 0) {
      const alvo = custo * meses;
      const tem = FC.soma(daReserva, (t) => t.valor_aplicado);
      if (!daReserva.length) {
        if (rf.length) saida.push({ nivel: "info", titulo: "Qual título é a sua reserva de emergência?",
          texto: `Marque, ao editar cada título, os que são reserva. Assim o painel confere se você tem os ${brl(alvo)} (${meses} meses de custo de vida).`, link: "#/ativos" });
        else saida.push({ nivel: "medio", titulo: "Você ainda não tem reserva de emergência cadastrada",
          texto: `A meta é ${brl(alvo)} (${meses} meses de custo de vida), num título que dê para resgatar a qualquer momento.`, link: "#/ativos" });
      } else if (tem < alvo) {
        saida.push({ nivel: tem < alvo / 2 ? "alto" : "medio", titulo: `Reserva de emergência em ${pct((tem / alvo) * 100)} da meta`,
          texto: `Você tem ${brl(tem)} de ${brl(alvo)} (${meses} meses de custo de vida). Faltam ${brl(alvo - tem)} — vale completar antes de arriscar mais.`, link: "#/ativos" });
      }
    } else if (daReserva.length || rf.length) {
      saida.push({ nivel: "info", titulo: "Informe seu custo de vida",
        texto: "Com ele o painel mede se a reserva de emergência está completa e quanto falta para viver de renda.", link: "#/ajustes" });
    }

    // ---- exposição ao dólar (só informativo)
    if (investido > 0) {
      const dolar = FC.soma(ativos.filter((a) => a.classe === "acao_us" || a.classe === "etf_us" || a.classe === "cripto" || ETF_DOLAR.has(a.ticker)), (a) => a.posicao.atual);
      const p = (dolar / investido) * 100;
      if (p > LIMITE_DOLAR) saida.push({ nivel: "info", titulo: `${pct(p)} do investido acompanha o dólar`,
        texto: "Ações e ETFs de fora e cripto sobem e descem também com o câmbio. Não é problema — só saiba que uma queda do dólar reduz esse pedaço em reais." });
    }

    return saida.map((a, i) => ({ ...a, _i: i })).sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || a._i - b._i).map(({ _i, ...a }) => a);
  }

  FC.alertas = { calcula, garantidoFGC, sugereIsento, FGC_POR_INSTITUICAO, FGC_GLOBAL };
})();
