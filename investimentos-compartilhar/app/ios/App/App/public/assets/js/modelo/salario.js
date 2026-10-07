/* Salário e plano de investimento.
 *
 * A renda de um mês é a soma dos ganhos fixos que valem naquele mês
 * (entre início e fim) mais os avulsos com data no mês. O plano diz
 * quanto dessa renda vira investimento e para onde vai cada parte; o
 * guia do mês compara o planejado com o que você de fato aportou. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  FC.CATEGORIAS_GANHO = {
    salario: "Salário", pro_labore: "Pró-labore", extra: "Renda extra / freela", bonus: "Bônus / PLR",
    decimo_terceiro: "13º salário", ferias: "Férias", aluguel: "Aluguel recebido", outros: "Outros",
  };

  FC.PADRAO_PLANO = {
    modo: "percentual",            // percentual da renda | valor fixo
    percentual: 30,
    valor: 1000,
    reinvestir_dividendos: true,   // dividendos do mês entram no valor a aportar
    destinos: [],                  // [{tipo: pilar|ativo|renda_fixa, alvo, pct}]
  };

  const mesDe = (iso) => iso.slice(0, 7);
  function valeNoMes(g, mes) {
    if (g.tipo === "avulso") return mesDe(g.inicio) === mes;
    return mesDe(g.inicio) <= mes && (!g.fim || mesDe(g.fim) >= mes);
  }

  function rendaDoMes(ganhos, mes) {
    const itens = ganhos.filter((g) => valeNoMes(g, mes));
    return { mes, total: FC.soma(itens, (g) => g.valor), fixa: FC.soma(itens.filter((g) => g.tipo === "recorrente"), (g) => g.valor),
      avulsa: FC.soma(itens.filter((g) => g.tipo === "avulso"), (g) => g.valor), itens };
  }

  function mesesAte(mes, n) {
    const saida = [];
    let [a, m] = mes.split("-").map(Number);
    for (let i = 0; i < n; i++) {
      saida.unshift(`${a}-${String(m).padStart(2, "0")}`);
      m--; if (!m) { m = 12; a--; }
    }
    return saida;
  }

  // ---------------------------------------------------------------- destinos
  function rotuloDestino(d) {
    if (d.tipo === "pilar") return FC.PILAR_NOME[d.alvo] || d.alvo;
    return d.alvo;
  }
  // o pilar de um destino — é o que a projeção usa para distribuir o aporte
  function pilarDoDestino(d, base) {
    if (d.tipo === "pilar") return d.alvo;
    if (d.tipo === "ativo") { const a = base.ativos.find((x) => x.ticker === d.alvo); return a ? a.pilar : "alternativos"; }
    const r = base.rendaFixa.find((x) => x.nome === d.alvo);
    return r ? r.pilar : "caixa";
  }

  // quanto já entrou em um destino dentro do mês
  function aportadoNoMes(d, base, mes) {
    const noMes = (x) => x.data && mesDe(x.data) === mes;
    const ap = base.aportes.filter(noMes);
    if (d.tipo === "ativo") return FC.soma(ap.filter((a) => a.tipo === "ativo" && a.ticker === d.alvo), (a) => a.valor);
    if (d.tipo === "renda_fixa") return FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && a.titulo === d.alvo), (a) => a.valor);
    // pilar: tudo o que foi para ativos/títulos daquele pilar (+ compras de gado, se agro)
    const pilarAtivo = Object.fromEntries(base.ativos.map((a) => [a.ticker, a.pilar]));
    const pilarRf = Object.fromEntries(base.rendaFixa.map((r) => [r.nome, r.pilar]));
    let v = FC.soma(ap.filter((a) => a.tipo === "ativo" && pilarAtivo[a.ticker] === d.alvo), (a) => a.valor)
      + FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && (pilarRf[a.titulo] || "caixa") === d.alvo), (a) => a.valor);
    if (d.alvo === "agro") {
      v += FC.soma(base.agro.movs.filter((m) => noMes(m) && m.tipo === "compra"), (m) => m.valor_total + m.despesas)
        + FC.soma(base.agro.custos.filter(noMes), (c) => c.valor);
    }
    return v;
  }

  // ---------------------------------------------------------------- plano do mês
  function planoDoMes({ plano, ganhos, base, mes, dividendosDoMes = 0 }) {
    const renda = rendaDoMes(ganhos, mes);
    const valorBase = plano.modo === "valor" ? Number(plano.valor) || 0 : (renda.total * (Number(plano.percentual) || 0)) / 100;
    const div = plano.reinvestir_dividendos ? dividendosDoMes : 0;
    const total = valorBase + div;
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 0;
    const destinos = plano.destinos.map((d) => {
      const valor = somaPct ? (total * (Number(d.pct) || 0)) / somaPct : 0;
      const aportado = aportadoNoMes(d, base, mes);
      return { ...d, rotulo: rotuloDestino(d), pilar: pilarDoDestino(d, base), valor, aportado,
        falta: Math.max(0, valor - aportado), feito: valor > 0 ? Math.min(100, (aportado / valor) * 100) : 0 };
    });
    const aportadoTotal = FC.soma(destinos, (d) => d.aportado);
    return { mes, renda, valor_base: valorBase, dividendos: div, total, destinos, soma_pct: somaPct,
      aportado: aportadoTotal, falta: FC.soma(destinos, (d) => d.falta),
      sobra_renda: renda.total - valorBase };
  }

  // o plano no formato da projeção: aporte mensal e peso de cada pilar
  function paraProjecao(plano, ganhos, base) {
    if (!plano || !plano.destinos || !plano.destinos.length) return null;
    const mes = FC.datas.hoje().slice(0, 7);
    const renda = rendaDoMes(ganhos, mes);
    // avulsos distorcem um mês só: a projeção usa a renda fixa
    const aporte = plano.modo === "valor" ? Number(plano.valor) || 0 : (renda.fixa * (Number(plano.percentual) || 0)) / 100;
    const pesos = {};
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 1;
    for (const d of plano.destinos) {
      const p = pilarDoDestino(d, base);
      pesos[p] = (pesos[p] || 0) + (Number(d.pct) || 0) / somaPct;
    }
    return { aporte_mensal: aporte, pesos, renda_fixa_mensal: renda.fixa };
  }

  // ---------------------------------------------------------------- quando cai
  const REGRAS_DIA = { dia_util: "dia útil", dia_fixo: "dia fixo", ultimo_dia_util: "último dia útil" };
  function dataRecebimento(g, mes) {
    if (g.tipo === "avulso") return g.inicio;
    const n = Number(g.dia_numero) || 1;
    if (g.dia_regra === "dia_util") return FC.datas.diaUtil(mes, n);
    if (g.dia_regra === "ultimo_dia_util") return FC.datas.ultimoDiaUtil(mes);
    if (g.dia_regra === "dia_fixo") return `${mes}-${String(Math.min(n, FC.datas.ultimoDiaDoMes(mes))).padStart(2, "0")}`;
    return null;                  // sem regra: vale o mês, sem dia marcado
  }
  function descreveRegra(g) {
    if (g.tipo === "avulso") return null;
    if (g.dia_regra === "dia_util") return `${g.dia_numero || 1}º dia útil`;
    if (g.dia_regra === "ultimo_dia_util") return "último dia útil";
    if (g.dia_regra === "dia_fixo") return `todo dia ${g.dia_numero}`;
    return null;
  }
  // próximos recebimentos a partir de hoje (este mês e o seguinte)
  function proximos(ganhos, hojeIso, meses = 2) {
    const saida = [];
    let mes = hojeIso.slice(0, 7);
    for (let i = 0; i < meses; i++) {
      for (const g of ganhos.filter((x) => valeNoMes(x, mes))) {
        const d = dataRecebimento(g, mes);
        if (d && d >= hojeIso) saida.push({ ganho: g, data: d, valor: g.valor });
      }
      const [a, m] = mes.split("-").map(Number);
      mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    }
    return saida.sort((x, y) => x.data.localeCompare(y.data));
  }

  FC.salario = { dataRecebimento, descreveRegra, proximos, REGRAS_DIA, rendaDoMes, mesesAte, planoDoMes, paraProjecao, aportadoNoMes, rotuloDestino, pilarDoDestino, valeNoMes };
})();
