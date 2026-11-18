/* Movimento interno: trocar um ativo por outro sem dinheiro novo (Marco 3).
 *
 * BNB → ITUB4, cripto → renda fixa, venda do gado → pote. Um movimento
 * gera a baixa da origem e a entrada no destino, todos com o mesmo
 * movimento_interno_id. Regras:
 *   1. não é aporte: o Salário e o plano do mês ignoram (FC.salario);
 *   2. não entra como aplicado/devolvido na TIR e no retorno TOTAL da
 *      carteira (FC.rentab.carteira); entra no resultado do ativo e da classe;
 *   3. a origem realiza resultado pelo preço médio da baixa;
 *   4. o destino herda como custo o valor líquido (bruto − custos);
 *   5. o destino pode ser um pote.
 *
 * `planeja` não grava: devolve as linhas para gravar e o efeito. */
(function () {
  const FC = window.FC;
  const TIPOS = ["ativo", "titulo_rf", "pote", "agro_lote"];
  const somaCustos = (c) => Object.values(c || {}).reduce((s, v) => s + (Number(v) || 0), 0);

  // RF › Ações › Cripto: RF = caixa, Ações = ações + FIIs, Cripto = alternativos
  function grupos(valoresPorPilar) {
    const v = (k) => Number(valoresPorPilar[k]) || 0;
    return { rf: v("caixa"), acoes: v("acoes") + v("real_estate"), cripto: v("alternativos") };
  }
  // quanto a carteira está fora da ordem (0 = em ordem)
  function foraDaOrdem(g) { return Math.max(0, g.acoes - g.rf) + Math.max(0, g.cripto - g.acoes); }

  function pilarDe(tipo, id, estado) {
    const d = estado.dados;
    if (tipo === "ativo") { const a = d.ativos.find((x) => x.ticker === id); return a ? a.pilar : null; }
    if (tipo === "titulo_rf") { const t = d.rendaFixa.find((x) => x.id === id || x.nome === id); return t ? t.pilar || "caixa" : null; }
    if (tipo === "pote") return "caixa";
    if (tipo === "agro_lote") return "agro";
    return null;
  }

  /**
   * mov: { data, origem_tipo, origem_id, origem_quantidade, origem_preco,
   *        destino_tipo, destino_id, destino_quantidade, destino_preco,
   *        custos: {taxa, spread, saque, impostos}, observacao }
   * Para ativo, *_id é o ticker; para título, o id ou o nome; para pote, o
   * id, o tipo ou o nome.
   */
  function planeja(estado, mov) {
    const d = estado.dados, base = estado.base;
    if (!TIPOS.includes(mov.origem_tipo)) throw new Error("origem_tipo inválido.");
    if (!TIPOS.includes(mov.destino_tipo)) throw new Error("destino_tipo inválido.");
    if (mov.destino_tipo === "agro_lote") throw new Error("O agro não é destino de movimento interno: registre a compra no agro.");
    const dia = mov.data || FC.datas.hoje();
    const custos = mov.custos || {};
    const totalCustos = somaCustos(custos);
    const id = (FC.potes && FC.potes.uuid) ? FC.potes.uuid() : String(Date.now());
    const linhas = [];
    let bruto, resultado = null, pmBaixa = null, origemNome;

    // ------------------------------------------------------------ origem
    if (mov.origem_tipo === "ativo") {
      const a = d.ativos.find((x) => x.ticker === mov.origem_id);
      if (!a || !a.posicao) throw new Error(`${mov.origem_id} não tem posição na carteira.`);
      const q = Number(mov.origem_quantidade);
      if (!(q > 0)) throw new Error("Informe a quantidade que sai da origem.");
      if (q > a.posicao.quantidade + 1e-9) throw new Error(`A posição de ${a.ticker} é ${a.posicao.quantidade}; não dá para tirar ${q}.`);
      const preco = Number(mov.origem_preco) > 0 ? Number(mov.origem_preco) : a.preco;
      if (!(preco > 0)) throw new Error(`Sem preço para ${a.ticker}: informe origem_preco.`);
      bruto = q * preco;
      pmBaixa = a.posicao.preco_medio;
      resultado = pmBaixa != null ? (preco - pmBaixa) * q - totalCustos : null;
      origemNome = a.ticker;
      linhas.push({ tabela: "aportes", linha: { tipo: "ativo", ticker: a.ticker, quantidade: -q, preco, valor: -bruto, data: dia, venda: true,
        observacao: `movimento interno → ${mov.destino_id}`.slice(0, 160), movimento_interno_id: id } });
    } else if (mov.origem_tipo === "titulo_rf") {
      const t = d.rendaFixa.find((x) => x.id === mov.origem_id || x.nome === mov.origem_id);
      if (!t) throw new Error(`Título "${mov.origem_id}" não encontrado.`);
      bruto = Number(mov.origem_preco) > 0 && Number(mov.origem_quantidade) > 0 ? Number(mov.origem_preco) * Number(mov.origem_quantidade) : Number(mov.origem_quantidade);
      if (!(bruto > 0)) throw new Error("Informe o valor que sai do título (origem_quantidade em reais).");
      if (bruto > t.valor_aplicado + 0.005) throw new Error(`${t.nome} tem ${FC.fmt.brlTexto(t.valor_aplicado)}.`);
      // o rendimento realizado é proporcional ao que sai do título
      const fr = t.valor_aplicado > 0 ? bruto / t.valor_aplicado : 0;
      const principal = (t.rent && t.rent.aplicado != null ? t.rent.aplicado - (t.rent.devolvido || 0) : t.principal) || 0;
      resultado = bruto - principal * fr - totalCustos;
      origemNome = t.nome;
      linhas.push({ tabela: "aportes", linha: { tipo: "caixa", titulo: t.nome, valor: -bruto, data: dia, observacao: `movimento interno → ${mov.destino_id}`.slice(0, 160), movimento_interno_id: id } });
    } else if (mov.origem_tipo === "pote") {
      const pts = d.potes;
      if (!pts) throw new Error("A conta não tem potes.");
      const p = pts.potes.find((x) => x.id === mov.origem_id || x.tipo === mov.origem_id || String(x.nome).toLowerCase() === String(mov.origem_id).toLowerCase());
      if (!p) throw new Error(`Pote "${mov.origem_id}" não encontrado.`);
      bruto = Number(mov.origem_quantidade);
      if (!(bruto > 0)) throw new Error("Informe o valor que sai do pote (origem_quantidade em reais).");
      if (bruto > p.valor_movimentos + 0.005) throw new Error(`${p.nome} tem ${FC.fmt.brlTexto(p.valor_movimentos)} fora de títulos; para usar um título, a origem é o título.`);
      resultado = -totalCustos;
      origemNome = p.nome;
      linhas.push({ tabela: "potes_movimentos", linha: { pote_id: p.id, data: dia, valor: -bruto, descricao: `movimento interno → ${mov.destino_id}`.slice(0, 160), movimento_interno_id: id } });
    } else {
      // agro_lote: o bruto vem da venda já registrada no agro (FC.agro, Marco 4)
      bruto = Number(mov.origem_preco) * Number(mov.origem_quantidade);
      if (!(bruto > 0)) throw new Error("Informe cabeças (origem_quantidade) e preço por cabeça (origem_preco).");
      origemNome = `lote ${mov.origem_id}`;
      resultado = mov.resultado_realizado != null ? Number(mov.resultado_realizado) : null;
    }

    const liquido = bruto - totalCustos;
    if (!(liquido > 0)) throw new Error("Os custos consomem todo o valor da origem.");

    // ------------------------------------------------------------ destino
    let destinoNome;
    if (mov.destino_tipo === "ativo") {
      const a = d.ativos.find((x) => x.ticker === mov.destino_id);
      const qd = Number(mov.destino_quantidade) > 0 ? Number(mov.destino_quantidade)
        : Number(mov.destino_preco) > 0 ? liquido / Number(mov.destino_preco) : a && a.preco > 0 ? liquido / a.preco : null;
      if (!(qd > 0)) throw new Error(`Informe a quantidade ou o preço de ${mov.destino_id}.`);
      destinoNome = mov.destino_id;
      linhas.push({ tabela: "aportes", linha: { tipo: "ativo", ticker: mov.destino_id, quantidade: qd, preco: liquido / qd, valor: liquido, data: dia,
        observacao: `movimento interno ← ${origemNome}`.slice(0, 160), movimento_interno_id: id }, cadastrar: !a });
    } else if (mov.destino_tipo === "titulo_rf") {
      const t = d.rendaFixa.find((x) => x.id === mov.destino_id || x.nome === mov.destino_id);
      if (!t) throw new Error(`Título "${mov.destino_id}" não encontrado: cadastre-o antes (valor aplicado 0).`);
      destinoNome = t.nome;
      linhas.push({ tabela: "aportes", linha: { tipo: "caixa", titulo: t.nome, valor: liquido, data: dia, observacao: `movimento interno ← ${origemNome}`.slice(0, 160), movimento_interno_id: id } });
    } else {
      const pts = d.potes;
      if (!pts) throw new Error("A conta não tem potes.");
      const p = pts.potes.find((x) => x.id === mov.destino_id || x.tipo === mov.destino_id || String(x.nome).toLowerCase() === String(mov.destino_id).toLowerCase());
      if (!p) throw new Error(`Pote "${mov.destino_id}" não encontrado.`);
      destinoNome = p.nome;
      linhas.push({ tabela: "potes_movimentos", linha: { pote_id: p.id, data: dia, valor: liquido, descricao: `movimento interno ← ${origemNome}`.slice(0, 160), movimento_interno_id: id } });
    }

    const registro = {
      id, data: dia, origem_tipo: mov.origem_tipo, origem_id: String(mov.origem_id), origem_quantidade: Number(mov.origem_quantidade) || null,
      origem_preco: Number(mov.origem_preco) || null, destino_tipo: mov.destino_tipo, destino_id: String(mov.destino_id),
      destino_quantidade: Number(mov.destino_quantidade) || null, destino_preco: Number(mov.destino_preco) || null,
      custos, observacao: (mov.observacao || "").slice(0, 160),
    };

    // alocação antes e depois (pelo valor de mercado; preço parado)
    const antes = Object.fromEntries((d.alocacao || []).map((l) => [l.chave, l.valor]));
    const depois = { ...antes };
    const po = pilarDe(mov.origem_tipo, mov.origem_id, estado), pd = pilarDe(mov.destino_tipo, mov.destino_id, estado) || "alternativos";
    if (po) depois[po] = (depois[po] || 0) - bruto;
    depois[pd] = (depois[pd] || 0) + liquido;
    const ga = grupos(antes), gd = grupos(depois);
    const fa = foraDaOrdem(ga), fd = foraDaOrdem(gd);
    const total = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    const pct = (o) => { const t = total(o); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, t ? (v / t) * 100 : 0])); };

    return {
      registro, linhas,
      efeito: {
        origem: origemNome, destino: destinoNome, bruto, custos: totalCustos, liquido,
        preco_medio_da_baixa: pmBaixa, resultado_realizado: resultado,
        patrimonio_antes: total(antes), patrimonio_depois: total(depois),
        alocacao_antes: antes, alocacao_depois: depois, alocacao_antes_pct: pct(antes), alocacao_depois_pct: pct(depois),
        ordem: { antes: ga, depois: gd, fora_antes: fa, fora_depois: fd, respeitada_antes: fa < 0.5, respeitada_depois: fd < 0.5,
          efeito: fd < fa - 0.5 ? "melhora" : fd > fa + 0.5 ? "piora" : "igual" },
      },
    };
  }

  FC.movimentos = { planeja, grupos, foraDaOrdem, TIPOS };
})();
