/* Perfil do investidor: três eixos medidos separadamente.
 *
 *   Tolerância (T, 0 a 100)  o que a pessoa aguenta sentir  → bloco 4
 *   Capacidade (C, 0 a 100)  o que ela pode perder          → blocos 1 e 2
 *   Necessidade (N)          o retorno real que o objetivo exige → bloco 3,
 *                            calculado, nunca perguntado
 *
 * Perfil final = faixa de min(T, C). Sem LLM, sem rede: a mesma resposta
 * dá o mesmo resultado, e a versão do modelo (FC.PERFIL.versao) fica
 * gravada com cada avaliação.
 *
 * Esta regra é espelhada no banco (supabase/schema.sql, função
 * privado.perfil_confere): mexeu aqui, rode scripts/gera-perfil-sql.js. */
(function () {
  const FC = window.FC;
  const P = FC.PERFIL;

  const grampo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pergunta = (id) => P.perguntas.find((q) => q.id === id);
  const opcao = (q, id) => (q.opcoes || []).find((o) => o.id === id) || null;
  const maxDe = (q, campo) => Math.max(0, ...q.opcoes.map((o) => (o[campo] == null ? 0 : o[campo])));

  // a resposta escolhida de uma pergunta de escolha única (null = sem resposta)
  function escolhida(resp, id) {
    const q = pergunta(id);
    const v = resp && resp[id];
    return q && typeof v === "string" ? opcao(q, v) : null;
  }

  // ---------------------------------------------------------------- pendências
  // essenciais que faltam: sem elas o perfil não sai
  function faltantes(resp) {
    return P.perguntas.filter((q) => q.essencial && !(resp || {})[q.id]).map((q) => q.id);
  }
  // as que podem ficar para o checklist
  function opcionaisEmAberto(resp) {
    return P.perguntas.filter((q) => !q.essencial && !(resp || {})[q.id] && q.id !== "produtos").map((q) => q.id);
  }

  // ---------------------------------------------------------------- tolerância
  const itensT = () => P.perguntas.filter((q) => q.opcoes.some((o) => o.t != null));
  function tolerancia(resp) {
    const itens = itensT();
    let pontos = 0, maximo = 0;
    for (const q of itens) {
      maximo += maxDe(q, "t");
      const o = escolhida(resp, q.id);
      if (o && o.t != null) pontos += o.t;
    }
    return maximo ? Math.round((pontos / maximo) * 100) : 0;
  }

  // ---------------------------------------------------------------- consistência
  // cada par "espelho" é a mesma ideia perguntada de dois jeitos
  function espelhos(resp) {
    return P.espelhos.map(([a, b]) => {
      const oa = escolhida(resp, a), ob = escolhida(resp, b);
      if (!oa || !ob) return { a, b, ok: true, degraus: 0 };
      const degraus = Math.abs(oa.t - ob.t);
      return { a, b, degraus, ok: degraus < P.degraus_contradicao };
    });
  }

  // ---------------------------------------------------------------- capacidade
  function pontosDe(resp, id) {
    const q = pergunta(id), max = maxDe(q, "c");
    const o = escolhida(resp, id);
    if (o && o.c != null) return { pontos: o.c, max };
    return { pontos: Math.round(max * P.neutro), max, neutro: true };
  }

  function capacidade(resp, ctx = {}) {
    const itens = ["idade", "estab", "dependentes", "moradia", "patrimonio", "reserva"].map((id) => [id, pontosDe(resp, id)]);
    let pts = itens.reduce((s, [, x]) => s + x.pontos, 0);
    // poupar mais da renda vale mais: 25 pontos a partir de 30% de sobra
    const MAX_SOBRA = 25;
    const rv = escolhida(resp, "renda"), sv = escolhida(resp, "sobra");
    let pontosSobra;
    if (rv && sv && !rv.nd && !sv.nd && rv.v > 0) {
      // aritmética inteira: o banco recalcula igual, sem diferença de arredondamento
      const num = MAX_SOBRA * sv.v * 100, den = rv.v * Math.round(P.taxa_sobra_cheia * 100);
      pontosSobra = sv.v * 100 >= den ? MAX_SOBRA : Math.floor((2 * num + den) / (2 * den));
    } else pontosSobra = Math.round(MAX_SOBRA * P.neutro);
    pts += pontosSobra;

    const descontos = [];
    // o agro vem do sistema, mas fica nas respostas guardadas: o banco recalcula só com elas
    const agro = ctx.agro_pct != null ? ctx.agro_pct : resp.agro_pct;
    if (agro != null && agro > P.agro_alto.limite_pct) {
      pts -= P.agro_alto.desconto;
      descontos.push({ regra: "desconto.agro_alto", pontos: P.agro_alto.desconto });
    }
    let c = Math.round(grampo(pts, 0, 100));

    // tetos: nenhuma resposta compensa
    const tetos = [];
    const reserva = escolhida(resp, "reserva");
    if (resp.divida === "sim") tetos.push({ regra: "teto.divida_cara", limite: P.tetos.divida_cara });
    if (!reserva || reserva.nd || reserva.v < 3) tetos.push({ regra: "teto.reserva_curta", limite: P.tetos.reserva_curta });
    const prazo = escolhida(resp, "prazo");
    if (prazo && prazo.v < 2) tetos.push({ regra: "teto.prazo_curto", limite: P.tetos.prazo_curto });
    if (resp.saque === "provavel") tetos.push({ regra: "teto.saque_provavel", limite: P.tetos.saque_provavel });
    const aplicados = tetos.filter((t) => c > t.limite);
    for (const t of tetos) c = Math.min(c, t.limite);
    return { capacidade: c, pontos_brutos: Math.round(grampo(pts, 0, 100)), tetos, tetos_aplicados: aplicados, descontos, pontos_sobra: pontosSobra };
  }

  // ---------------------------------------------------------------- conhecimento
  // não muda o perfil: limita produtos
  function conhecimento(resp) {
    const t = escolhida(resp, "tempo");
    const q = pergunta("produtos");
    const usados = Array.isArray(resp.produtos) ? resp.produtos : [];
    const rv = q.opcoes.filter((o) => o.rv && usados.includes(o.id)).length;
    if (!t || t.k === 0 || rv === 0) return "nenhum";
    if (t.k >= 3 && rv >= 2) return "experiente";
    return "basico";
  }

  // ---------------------------------------------------------------- faixa e perfil
  function faixaDoScore(score) {
    return P.faixas.find((f) => score >= f.de && score <= f.ate) || P.faixas[0];
  }
  const nomeDoPerfil = (chave) => (P.faixas.find((f) => f.chave === chave) || {}).nome || chave;

  // ---------------------------------------------------------------- cálculo
  // resp: { idade: "31_40", ..., produtos: ["acoes"] }
  // ctx:  { agro_pct } — o que o sistema sabe e a pessoa não responde
  function calcula(resp, ctx = {}) {
    resp = resp || {};
    const T = tolerancia(resp);
    const cap = capacidade(resp, ctx);
    const score = Math.min(T, cap.capacidade);
    const faixa = faixaDoScore(score);
    const esp = espelhos(resp);
    const dinheiroSemResposta = P.perguntas.filter((q) => q.dinheiro && resp[q.id] === "nd").map((q) => q.id);
    const pendentes = faltantes(resp);
    return {
      versao: P.versao,
      tolerancia: T,
      capacidade: cap.capacidade,
      score,
      perfil: faixa.chave,
      faixa,
      limitado_por: T <= cap.capacidade ? "tolerancia" : "capacidade",
      consistencia: esp.every((e) => e.ok) ? "alta" : "baixa",
      espelhos: esp,
      tetos: cap.tetos_aplicados,
      descontos: cap.descontos,
      conhecimento: conhecimento(resp),
      pendentes,
      // "prefiro não dizer" reduz a precisão do plano e o resultado avisa
      precisao: dinheiroSemResposta.length ? "reduzida" : "alta",
      sem_resposta: dinheiroSemResposta,
      detalhe: { pontos_capacidade: cap.pontos_brutos, pontos_sobra: cap.pontos_sobra },
    };
  }

  // ---------------------------------------------------------------- necessidade
  // VF = VP·(1+r)^n + PMT·((1+r)^n − 1)/r, com PMT anual
  function valorFuturo(r, vp, pmtAnual, n) {
    if (Math.abs(r) < 1e-9) return vp + pmtAnual * n;
    const f = Math.pow(1 + r, n);
    return vp * f + pmtAnual * ((f - 1) / r);
  }
  const R_MAX = 1;   // 100% a.a. real: acima disso a meta é impossível

  // retorno real anual que leva de VP ao alvo. 0 = nem precisa de retorno;
  // Infinity = nem com 100% ao ano; null = faltam dados
  function necessidade({ vp, pmtMensal, anos, alvo }) {
    if (!(alvo > 0) || !(anos > 0)) return null;
    vp = Math.max(0, vp || 0);
    const pmt = Math.max(0, pmtMensal || 0) * 12;
    if (valorFuturo(0, vp, pmt, anos) >= alvo) return 0;
    if (valorFuturo(R_MAX, vp, pmt, anos) < alvo) return Infinity;
    let lo = 0, hi = R_MAX;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (valorFuturo(m, vp, pmt, anos) < alvo) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  // aporte mensal que fecha a meta com o retorno r
  function aporteNecessario({ vp, anos, alvo, r }) {
    if (!(alvo > 0) || !(anos > 0)) return null;
    const so = valorFuturo(r, Math.max(0, vp || 0), 0, anos);
    if (so >= alvo) return 0;
    const fator = Math.abs(r) < 1e-9 ? anos : (Math.pow(1 + r, anos) - 1) / r;
    return (alvo - so) / fator / 12;
  }
  // anos que a meta leva com o aporte e o retorno r (null: não chega em 80 anos)
  function prazoNecessario({ vp, pmtMensal, alvo, r }) {
    if (!(alvo > 0)) return null;
    const pmt = Math.max(0, pmtMensal || 0) * 12;
    if (valorFuturo(r, Math.max(0, vp || 0), pmt, 80) < alvo) return null;
    let lo = 0, hi = 80;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (valorFuturo(r, Math.max(0, vp || 0), pmt, m) < alvo) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------- referências
  // retorno real de referência de cada perfil, a partir das premissas que
  // já existem (CDI e IPCA do cenário e prêmio de cada classe)
  function retornoReal(prefs, macro) {
    const ml = ((prefs || {}).premissas || {}).macro_longo_prazo || {};
    const cdi = ml.cdi ?? (macro || {}).cdi ?? null;
    const ipca = ml.ipca ?? (macro || {}).ipca_12m ?? null;
    let real = P.retorno_real_padrao;
    if (cdi != null && ipca != null) real = ((1 + cdi / 100) / (1 + ipca / 100) - 1) * 100;
    return { cdi, ipca, real_rf: real };
  }
  // retorno real anual (fração) de uma alocação { renda_fixa, fiis, acoes, cripto } em %
  function retornoDaAlocacao(aloc, ref) {
    let r = 0;
    for (const [classe, pct] of Object.entries(aloc)) r += (pct / 100) * ((ref.real_rf + (P.premios[classe] || 0)) / 100);
    return r;
  }

  // ---------------------------------------------------------------- revisão
  // 24 meses: obrigatória. 12 meses ou renda informada diferente: sugerida.
  function revisao(registro, { hoje, rendaAtual } = {}) {
    if (!registro) return { estado: "sem_perfil" };
    const agora = hoje || new Date().toISOString().slice(0, 10);
    if (registro.valido_ate && agora > registro.valido_ate) return { estado: "obrigatoria", motivo: "vencido" };
    const criado = (registro.criado_em || "").slice(0, 10);
    if (criado) {
      const dias = Math.round((new Date(agora) - new Date(criado)) / 86400000);
      if (dias >= P.meses_revisao * 30.4) return { estado: "sugerida", motivo: "tempo" };
    }
    const antes = registro.respostas && registro.respostas.renda;
    if (rendaAtual && antes && antes !== "nd" && rendaAtual !== antes) return { estado: "sugerida", motivo: "renda" };
    return { estado: "ok" };
  }

  // ---------------------------------------------------------------- pré-preenchimento
  // o que o sistema já sabe, para a conta antiga só confirmar
  function sugereRespostas(base, dados) {
    const s = {};
    const pat = dados && dados.resumo ? dados.resumo.patrimonio : null;
    const total = pat > 0 ? pat : (((base || {}).historico || []).slice(-1)[0] || {}).patrimonio;
    if (total > 0) {
      const q = pergunta("patrimonio");
      const faixas = [["nada", 0], ["ate_10k", 10000], ["10_50k", 50000], ["50_200k", 200000], ["200k_1m", 1000000], ["1m_mais", Infinity]];
      s.patrimonio = (faixas.find(([, teto]) => total <= teto) || faixas.at(-1))[0];
      if (!opcao(q, s.patrimonio)) delete s.patrimonio;
    }
    const classes = new Set(((base || {}).ativos || []).filter((a) => a.lista === "carteira" || a.quantidade > 0).map((a) => a.classe));
    const usados = [];
    if (classes.has("acao_br") || classes.has("acao_us") || classes.has("etf_br") || classes.has("etf_us")) usados.push("acoes");
    if (classes.has("fii")) usados.push("fii");
    if (classes.has("cripto")) usados.push("cripto");
    if (((base || {}).rendaFixa || []).length) usados.push("renda_fixa");
    if (usados.length) s.produtos = usados;
    return s;
  }

  // ---------------------------------------------------------------- por que este perfil
  // cada resposta com os pontos que deu, por eixo: o Relatório mostra as que mais pesaram
  function contribuicoes(resp) {
    resp = resp || {};
    const itens = [];
    for (const id of ["idade", "estab", "dependentes", "moradia", "patrimonio", "reserva"]) {
      const q = pergunta(id), x = pontosDe(resp, id), o = escolhida(resp, id);
      itens.push({ eixo: "capacidade", id, pergunta: q.texto, resposta: o ? o.rotulo : "Sem resposta", pontos: x.pontos, max: x.max, neutro: !!x.neutro });
    }
    const cap = capacidade(resp);
    const rs = escolhida(resp, "sobra"), rr = escolhida(resp, "renda");
    itens.push({ eixo: "capacidade", id: "sobra", pergunta: "Quanto da renda sobra por mês", max: 25, pontos: cap.pontos_sobra,
      resposta: rs && rr ? `${rs.rotulo}, com renda ${rr.rotulo.toLowerCase()}` : "Sem resposta", neutro: !(rs && rr && !rs.nd && !rr.nd) });
    for (const q of itensT()) {
      const o = escolhida(resp, q.id);
      itens.push({ eixo: "tolerancia", id: q.id, pergunta: q.texto, resposta: o ? o.rotulo : "Sem resposta", pontos: o ? o.t : 0, max: maxDe(q, "t"), neutro: !o });
    }
    return itens;
  }

  // o que mudou entre duas avaliações (para o histórico)
  function diferencas(antes, depois) {
    const ra = (antes && antes.respostas) || {}, rd = (depois && depois.respostas) || {};
    const ids = [...new Set([...Object.keys(ra), ...Object.keys(rd)])].filter((k) => k !== "agro_pct");
    return ids.filter((k) => JSON.stringify(ra[k]) !== JSON.stringify(rd[k])).map((k) => {
      const q = pergunta(k);
      const rot = (v) => (Array.isArray(v) ? v.join(", ") : (q && opcao(q, v) ? opcao(q, v).rotulo : v == null ? "—" : String(v)));
      return { id: k, pergunta: q ? q.texto : k, de: rot(ra[k]), para: rot(rd[k]) };
    });
  }

  FC.perfil = {
    calcula, tolerancia, capacidade, conhecimento, espelhos, faltantes, opcionaisEmAberto,
    necessidade, aporteNecessario, prazoNecessario, valorFuturo, retornoReal, retornoDaAlocacao,
    revisao, sugereRespostas, faixaDoScore, nomeDoPerfil, pergunta, opcao, escolhida, contribuicoes, diferencas,
  };
})();
