/* Retrospectivas do mês e do ano — contrato de dados e mocks.
 *
 * O vídeo é uma função pura dos dados: render(ctx, t, MonthRecap).
 * Tudo que é opcional (?) pode faltar; a cena correspondente some ou
 * vira outra, nunca mostra "R$ 0,00" solto. Valores em reais, % em
 * pontos percentuais (2.4 = 2,4%). Datas em ISO (AAAA-MM-DD). */
(function () {
  const FC = window.FC;

  /**
   * @typedef {Object} ItemValor
   * @property {string} rotulo
   * @property {number} valor
   */

  /**
   * @typedef {Object} MonthRecap
   * @property {"mes"|"ano"} [tipo]              padrão "mes"; "ano" usa o mesmo contrato para o ano inteiro
   * @property {string} mes                      "2026-09" (no ano: "2026")
   * @property {string} rotulo                   "Setembro de 2026" (no ano: "2026")
   * @property {number} seed                     derivada do mês; toda aleatoriedade do vídeo sai dela
   *
   * @property {Object}  patrimonio
   * @property {?number} patrimonio.inicial      último registro do mês anterior (null no 1º mês)
   * @property {number}  patrimonio.final        último registro do mês
   * @property {?number} patrimonio.variacao     final − inicial, em R$
   * @property {?number} patrimonio.variacao_pct
   * @property {?number} patrimonio.rendimento   variação sem o dinheiro novo: final − inicial − aportes líquidos
   * @property {?number} patrimonio.rendimento_pct  rendimento / inicial
   * @property {Array<[string, number]>} patrimonio.serie  [data, valor] diário — o fio que atravessa o vídeo
   *
   * @property {Object}  aportes
   * @property {number}  aportes.total           compras − vendas do mês (sem proventos)
   * @property {number}  aportes.quantidade      nº de lançamentos
   * @property {ItemValor[]} aportes.por_destino maiores destinos (ativo, título ou pilar)
   * @property {?{planejado: number, cumprido_pct: number}} aportes.plano  guia do mês do Salário
   *
   * @property {Object}  receitas
   * @property {number}  receitas.total          ganhos do mês (salário, extras…)
   * @property {Array<ItemValor & {categoria: string}>} receitas.por_categoria
   * @property {?number} receitas.taxa_investida_pct  aportes / receitas
   *
   * @property {?Object} despesas                o app ainda não registra gastos: hoje sempre null
   * @property {number}  despesas.total
   * @property {Array<ItemValor & {categoria: string}>} despesas.por_categoria
   * @property {?(ItemValor & {categoria: string})} despesas.campea
   * @property {Array<{categoria: string, rotulo: string, orcado: number, gasto: number}>} [despesas.orcamentos_estourados]
   *
   * @property {Object}  dividendos
   * @property {number}  dividendos.total
   * @property {number}  dividendos.pagamentos
   * @property {?{ticker: string, valor: number}} dividendos.maior
   *
   * @property {Array<{chave: string, nome: string, cor: string, pct: number, meta_pct: number}>} alocacao
   *           pilares do app: acoes, real_estate (FIIs), alternativos (cripto e ETFs), caixa (renda fixa), agro
   *
   * @property {Object}  destaques               variação do preço no mês, só ativos da carteira
   * @property {?{ticker: string, pct: number}} destaques.alta
   * @property {?{ticker: string, pct: number}} destaques.queda
   *
   * @property {Array<{nome: string, atual: number, alvo: number, pct: number}>} metas
   *           metas de valor (ex.: reserva de emergência); o app ainda não tem: hoje []
   *
   * @property {?{cabecas: number, variacao_cabecas: number, valor: number}} agro
   * @property {?{darf: number, vencimento: string, descricao: string}} ir   o app ainda não calcula: hoje null
   *
   * @property {Array<{mes: string, rotulo: string, variacao_pct: number}>} [meses]
   *           só no ano: a variação de cada mês (rendimento, sem aportes) — vira a etapa "mês a mês"
   */

  // semente estável por mês: mesmo mês, mesmo vídeo
  function seedDoMes(mes) {
    let h = 2166136261;
    for (const c of mes) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // série diária do mock: um passeio aleatório com semente fixa
  function serieMock(mes, inicial, final, seed) {
    let s = seed;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const dias = 30, pts = [];
    let v = inicial;
    for (let d = 1; d <= dias; d++) {
      const alvo = inicial + ((final - inicial) * d) / dias;
      v = alvo + (rnd() - 0.5) * inicial * 0.012;
      if (d === dias) v = final;
      pts.push([`${mes}-${String(d).padStart(2, "0")}`, Math.round(v * 100) / 100]);
    }
    return pts;
  }

  /** @type {MonthRecap} */
  const mes = "2026-09";
  const seed = seedDoMes(mes);
  FC.RECAP_MOCK = {
    mes, rotulo: "Setembro de 2026", seed,
    patrimonio: {
      inicial: 142380.55, final: 148320.4, variacao: 5939.85, variacao_pct: 4.17,
      rendimento: 3539.85, rendimento_pct: 2.49,
      serie: serieMock(mes, 142380.55, 148320.4, seed),
    },
    aportes: {
      total: 2400, quantidade: 5,
      por_destino: [{ rotulo: "ITSA4", valor: 1080 }, { rotulo: "Tesouro Selic", valor: 720 }, { rotulo: "BTC", valor: 600 }],
      plano: { planejado: 2400, cumprido_pct: 100 },
    },
    receitas: {
      total: 8000, por_categoria: [{ categoria: "salario", rotulo: "Salário", valor: 8000 }], taxa_investida_pct: 30,
    },
    despesas: null,
    dividendos: { total: 312.4, pagamentos: 4, maior: { ticker: "TAEE11", valor: 148.2 } },
    alocacao: [
      { chave: "acoes", nome: "Ações", cor: "#0a84ff", pct: 31.2, meta_pct: 30 },
      { chave: "real_estate", nome: "FIIs", cor: "#bf5af2", pct: 18.4, meta_pct: 25 },
      { chave: "alternativos", nome: "Cripto e ETFs", cor: "#ff9f0a", pct: 12.9, meta_pct: 10 },
      { chave: "caixa", nome: "Renda fixa", cor: "#30d158", pct: 27.5, meta_pct: 25 },
      { chave: "agro", nome: "Agro", cor: "#c9a77c", pct: 10, meta_pct: 10 },
    ],
    destaques: { alta: { ticker: "SOL", pct: 18.6 }, queda: { ticker: "HGLG11", pct: -3.2 } },
    metas: [],
    agro: { cabecas: 6, variacao_cabecas: 0, valor: 14830 },
    ir: null,
  };

  // o ano: patrimônio no fim de cada mês e o rendimento de cada um
  const ANO = "2026", seedAno = seedDoMes(ANO);
  const VARS = [2.1, 1.4, -1.2, 3.3, 0.8, -0.6, 2.7, 1.9, 4.2, 1.1, -0.4, 2.3];
  const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const serieAno = [];
  let pa = 101240;
  VARS.forEach((v, i) => { pa = pa * (1 + v / 100) + 2200; serieAno.push([`${ANO}-${String(i + 1).padStart(2, "0")}-28`, Math.round(pa * 100) / 100]); });
  FC.RECAP_ANO_MOCK = {
    tipo: "ano", mes: ANO, rotulo: ANO, seed: seedAno,
    patrimonio: {
      inicial: 101240, final: serieAno.at(-1)[1], variacao: serieAno.at(-1)[1] - 101240,
      variacao_pct: ((serieAno.at(-1)[1] / 101240) - 1) * 100,
      rendimento: serieAno.at(-1)[1] - 101240 - 26400, rendimento_pct: ((serieAno.at(-1)[1] - 101240 - 26400) / 101240) * 100,
      serie: [[`${ANO}-01-01`, 101240], ...serieAno],
    },
    aportes: {
      total: 26400, quantidade: 58,
      por_destino: [{ rotulo: "ITSA4", valor: 9600 }, { rotulo: "Tesouro Selic", valor: 7800 }, { rotulo: "BTC", valor: 4200 }],
      plano: { planejado: 28800, cumprido_pct: 92 },
    },
    receitas: { total: 104000, por_categoria: [{ categoria: "salario", rotulo: "Salário", valor: 96000 }, { categoria: "decimo_terceiro", rotulo: "13º salário", valor: 8000 }], taxa_investida_pct: 25 },
    despesas: null,
    dividendos: { total: 3480.6, pagamentos: 41, maior: { ticker: "TAEE11", valor: 1620.3 } },
    alocacao: FC.RECAP_MOCK.alocacao,
    destaques: { alta: { ticker: "SOL", pct: 142.3 }, queda: { ticker: "HGLG11", pct: -8.1 } },
    metas: [],
    agro: { cabecas: 6, variacao_cabecas: 6, valor: 14830 },
    ir: null,
    meses: VARS.map((v, i) => ({ mes: `${ANO}-${String(i + 1).padStart(2, "0")}`, rotulo: NOMES[i], variacao_pct: v })),
  };

  const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  // palavras que mudam entre a retrospectiva do mês e a do ano
  function periodo(d) {
    const ano = d.tipo === "ano";
    return ano
      ? { ano: true, nome: d.rotulo, o: "o ano", O: "O ano", do: "do ano", no: "no ano", Periodo: "Ano", primeiro: "Seu primeiro ano no painel" }
      : { ano: false, nome: d.rotulo.split(" ")[0], o: "o mês", O: "O mês", do: "do mês", no: "no mês", Periodo: "Mês", primeiro: "Seu primeiro mês no painel" };
  }

  // ---------------------------------------------------------------- formatos
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // valores grandes sem centavos: "R$ 148.320"; pequenos com: "R$ 312,40"
  const brl = (v, privado) => (privado ? "R$\u00a0•••" : "R$\u00a0" + (Math.abs(v) >= 1000 ? nf0 : nf2).format(v).replace("-", "−"));
  const pct = (v, sinal = true) => (sinal && v > 0 ? "+" : "") + nf1.format(v).replace("-", "−") + "%";
  const pontos = (v) => nf1.format(Math.abs(v)).replace(",0", "");

  // ---------------------------------------------------------------- extra
  // a cena 8 mostra o primeiro que existir, nesta ordem
  function escolheExtra(d) {
    if (d.agro && d.agro.cabecas > 0) return "agro";
    if (d.despesas && d.despesas.campea && d.despesas.campea.valor > 0) return "despesas";
    if (d.ir && d.ir.darf > 0) return "ir";
    if (d.metas && d.metas.some((m) => m.alvo > 0)) return "metas";
    return null;
  }

  // ---------------------------------------------------------------- linha do tempo
  // Uma etapa por cena (formato stories). Etapas sem dado somem. Cada uma
  // tem o tempo de leitura dela; a troca é uma "cortina" de 0,55 s.
  const DURACAO = { abertura: 5.5, resultado: 5.5, meses: 6, aportes: 5, renda: 5, dividendos: 5, destaques: 5.5, alocacao: 6, extra: 4.5, final: 4.5 };
  const TROCA = 0.55;
  // contador principal de cada etapa: [atraso depois da entrada, duração]
  const CONTADOR = { abertura: [2.0, 1.9], resultado: [0.7, 1.5], aportes: [0.9, 1.5], renda: [0.8, 1.5], dividendos: [0.9, 1.5], extra: [0.8, 1.2] };

  function plano(d, opts = {}) {
    const P = d.patrimonio, A = d.aportes, R = d.receitas, D = d.dividendos, X = d.destaques || {};
    const c = [{ id: "abertura" }];
    if (P.inicial != null && P.inicial > 0) c.push({ id: "resultado" });
    if (d.tipo === "ano" && (d.meses || []).filter((m) => m.variacao_pct != null).length >= 2) c.push({ id: "meses" });
    if (A.total > 0 || (A.plano && A.plano.planejado > 0)) c.push({ id: "aportes" });
    if (R.total > 0 && !(opts.privado && R.taxa_investida_pct == null)) c.push({ id: "renda" });
    if (D.total > 0) c.push({ id: "dividendos" });
    if ((X.alta && X.alta.pct > 0) || (X.queda && X.queda.pct < 0)) c.push({ id: "destaques" });
    if ((d.alocacao || []).some((a) => a.pct > 0)) c.push({ id: "alocacao" });
    const extra = escolheExtra(d);
    if (extra && !(opts.privado && extra === "ir")) c.push({ id: "extra", extra });
    c.push({ id: "final" });
    let t = 0;
    const cenas = c.map((x, i) => {
      const dur = DURACAO[x.id];
      const cena = { ...x, i, ini: t, fim: t + dur, dur };
      if (CONTADOR[x.id]) cena.contador = { ini: t + CONTADOR[x.id][0], dur: CONTADOR[x.id][1] };
      t += dur;
      return cena;
    });
    return { cenas, total: t, corpo: t - DURACAO.final, troca: TROCA };
  }

  // ---------------------------------------------------------------- textos
  // Templates determinísticos. Mês positivo celebra; negativo é honesto.
  function textos(d, opts = {}) {
    const pv = !!opts.privado, P = d.patrimonio, A = d.aportes, R = d.receitas, D = d.dividendos, X = d.destaques || {};
    const t = {}, pe = periodo(d);
    const primeiro = P.inicial == null || !(P.inicial > 0);
    t.abertura = { rotulo: d.rotulo, sub: primeiro ? pe.primeiro : "Seu patrimônio" };

    if (!primeiro) {
      const v = P.variacao_pct || 0, rend = P.rendimento;
      let frase;
      if (Math.abs(v) < 0.05) frase = `${pe.Periodo} estável: o patrimônio ficou onde estava.`;
      else if (v > 0) {
        frase = `${pe.Periodo} de alta: ${pct(v)}.`;
        if (rend != null && rend > 0 && A.total > 0) frase += pv ? ` Rendimento de ${pct(P.rendimento_pct || 0, false)}, fora os aportes.` : ` Rendimento de ${brl(rend)}, fora os aportes.`;
        else if (rend != null && rend <= 0 && A.total > 0) frase += " A alta veio dos seus aportes; o mercado ficou de lado.";
      } else {
        frase = `O patrimônio recuou ${pct(Math.abs(v), false)}.`;
        if (A.total > 0) frase += pv ? " Você seguiu aportando — é assim que se compra mais barato." : ` Você seguiu aportando ${brl(A.total)} — é assim que se compra mais barato.`;
        else frase += " Queda de mercado faz parte; o que conta é o prazo.";
      }
      t.resultado = { rotulo: `${pe.O} em uma linha`, frase, positivo: v >= 0 };
    }

    if (A.total > 0) {
      const n = A.quantidade;
      let frase = `${n} ${n === 1 ? "aporte" : "aportes"}.`;
      if (A.plano && A.plano.planejado > 0) frase += A.plano.cumprido_pct >= 100 ? " 100% do plano cumprido." : ` ${nf0.format(A.plano.cumprido_pct)}% do plano cumprido.`;
      t.aportes = { rotulo: "Você investiu", frase, pausa: false };
    } else if (A.plano && A.plano.planejado > 0) {
      t.aportes = { rotulo: "Aportes", frase: pv ? `${pe.Periodo} de pausa nos aportes — o plano segue de pé.` : `${pe.Periodo} de pausa — o plano pedia ${brl(A.plano.planejado)}.`, pausa: true };
    }

    if (R.total > 0) {
      const tx = R.taxa_investida_pct;
      t.renda = { rotulo: "Da sua renda",
        frase: tx != null ? (pv ? `${nf0.format(tx)}% de tudo que você recebeu virou investimento.` : `De ${brl(R.total)} recebidos, ${nf0.format(tx)}% ${tx === 1 ? "virou" : "viraram"} investimento.`) : `${brl(R.total, pv)} recebidos ${pe.no}.` };
    }

    if (D.total > 0) {
      let frase = `${D.pagamentos} ${D.pagamentos === 1 ? "pagamento" : "pagamentos"}.`;
      if (D.maior && D.pagamentos > 1) frase += pv ? ` ${D.maior.ticker} foi quem mais pagou.` : ` ${D.maior.ticker} pagou mais: ${brl(D.maior.valor)}.`;
      t.dividendos = { rotulo: "Dividendos recebidos", frase };
    }

    const alta = X.alta && X.alta.pct > 0 ? X.alta : null, queda = X.queda && X.queda.pct < 0 ? X.queda : null;
    if (alta || queda) {
      const partes = [];
      if (alta) partes.push(`${alta.ticker} subiu ${pct(alta.pct, false)}.`);
      if (queda) partes.push(`${queda.ticker} caiu ${pct(Math.abs(queda.pct), false)}.`);
      else partes.push("Nenhum ativo da carteira caiu.");
      t.destaques = { rotulo: `Os extremos ${pe.do}`, frase: partes.join(" "), alta, queda };
    }

    const al = (d.alocacao || []).filter((a) => a.pct > 0 || a.meta_pct > 0);
    if (al.length) {
      const comMeta = al.filter((a) => a.meta_pct > 0);
      let frase = "Como seu dinheiro está dividido.";
      if (comMeta.length) {
        const pior = comMeta.slice().sort((a, b) => Math.abs(b.pct - b.meta_pct) - Math.abs(a.pct - a.meta_pct))[0];
        const desvio = pior.pct - pior.meta_pct;
        if (Math.abs(desvio) < 1) frase = "Tudo dentro da meta. Carteira equilibrada.";
        else if (desvio < 0) frase = `${pior.nome} ${pior.nome.endsWith("s") ? "estão" : "está"} ${pontos(desvio)} pontos abaixo da meta — é por onde o próximo aporte rende mais.`;
        else frase = `${pior.nome} ${pior.nome.endsWith("s") ? "estão" : "está"} ${pontos(desvio)} pontos acima da meta.`;
      }
      t.alocacao = { rotulo: "Como está dividido", frase };
    }

    const ex = escolheExtra(d);
    if (ex === "agro") {
      const g = d.agro, dv = g.variacao_cabecas;
      t.extra = { rotulo: "No pasto", frase: `${g.cabecas} ${g.cabecas === 1 ? "cabeça" : "cabeças"} no pasto${pv ? "" : `, ${brl(g.valor, pv)} em rebanho`}.${dv > 0 ? ` +${dv} ${pe.no}.` : dv < 0 ? ` ${dv} ${pe.no}.` : ""}` };
    } else if (ex === "despesas") {
      const c = d.despesas.campea, n = (d.despesas.orcamentos_estourados || []).length;
      t.extra = { rotulo: "Onde mais foi dinheiro", frase: `${c.rotulo} liderou os gastos${pv ? "" : `: ${brl(c.valor, pv)}`}.${n ? ` ${n} ${n === 1 ? "orçamento estourou" : "orçamentos estouraram"}.` : " Nenhum orçamento estourado."}` };
    } else if (ex === "ir") {
      const [, m, dia] = d.ir.vencimento.split("-");
      t.extra = { rotulo: "Imposto do mês", frase: `DARF ${pv ? "" : `de ${brl(d.ir.darf)} `}vence em ${dia}/${m}. ${d.ir.descricao}` };
    } else if (ex === "metas") {
      const m = d.metas.filter((x) => x.alvo > 0).sort((a, b) => b.pct - a.pct)[0];
      t.extra = { rotulo: "Sua meta", frase: `${m.nome}: ${nf0.format(Math.min(100, m.pct))}% do caminho.` };
    }
    // só no ano: mês a mês
    const ms = (d.meses || []).filter((m) => m.variacao_pct != null);
    if (pe.ano && ms.length >= 2) {
      const melhor = ms.reduce((a, b) => (b.variacao_pct > a.variacao_pct ? b : a));
      const pior = ms.reduce((a, b) => (b.variacao_pct < a.variacao_pct ? b : a));
      const azul = ms.filter((m) => m.variacao_pct > 0).length;
      t.meses = { rotulo: "Mês a mês", melhor, pior, azul, total: ms.length,
        frase: azul === ms.length ? `Todos os ${ms.length} meses no azul.` : `${azul} de ${ms.length} meses no azul. ${pior.variacao_pct < 0 ? `O pior foi ${MES_LONGO[Number(pior.mes.slice(5, 7)) - 1]}, e o ano seguiu.` : ""}`.trim() };
    }
    t.final = { rotulo: d.rotulo, periodo: pe };
    return t;
  }

  // ---------------------------------------------------------------- som
  // Eventos sonoros derivados da mesma linha do tempo do vídeo.
  function eventos(d, opts = {}) {
    const pl = plano(d, opts);
    const ev = [];
    pl.cenas.forEach((c, i) => {
      if (i > 0) ev.push({ t: c.ini, tipo: "whoosh" });
      if (c.contador) {
        const { ini, dur } = c.contador;
        const n = Math.floor(dur / 0.075);
        for (let k = 0; k < n; k++) {
          // os ticks desaceleram junto com o easing do contador
          const q = k / n, tq = ini + dur * (1 - Math.pow(1 - q, 0.55)) * 0.98;
          ev.push({ t: tq, tipo: "tick", freq: 620 + 900 * q });
        }
        ev.push({ t: ini + dur, tipo: "ding" });
      }
      if (c.id === "final") ev.push({ t: c.ini + 0.1, tipo: "acorde" });
    });
    const positivo = d.patrimonio.variacao_pct == null || d.patrimonio.variacao_pct >= 0;
    return { eventos: ev.sort((a, b) => a.t - b.t), total: pl.total, positivo };
  }

  // ---------------------------------------------------------------- dados
  // Ponto único de integração: hoje devolve o mock. Depois, montar o
  // MonthRecap a partir de patrimonio_historico, aportes, ganhos,
  // proventos e preferências do usuário no Supabase.
  async function getMonthRecap(userId, mes) {
    void userId; void mes;
    return FC.RECAP_MOCK;
  }
  // mesmo contrato, com tipo "ano" e a lista de meses
  async function getYearRecap(userId, ano) {
    void userId; void ano;
    return FC.RECAP_ANO_MOCK;
  }

  // quando o cartão aparece no Início: últimos 5 dias do mês / do ano
  function naJanela(tipo, hoje = FC.datas.hoje()) {
    if (tipo === "ano") return hoje.slice(5) >= "12-27";
    const mes = hoje.slice(0, 7), ultimo = FC.datas.ultimoDiaDoMes(mes);
    return Number(hoje.slice(8)) > ultimo - 5;
  }

  FC.recap = { seedDoMes, plano, textos, eventos, getMonthRecap, getYearRecap, naJanela, periodo, brl, pct };
})();
