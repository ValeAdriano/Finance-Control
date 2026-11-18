/* Potes: o dinheiro da renda fixa separado por finalidade (Marco 2).
 *
 * Um pote tem um tipo (reserva de emergência, oportunidade, oportunidade do
 * agro, IR a pagar, livre) e um saldo. O saldo é:
 *   títulos de renda fixa com pote_id do pote (título sem pote = "livre")
 * + o caixa de proventos, se preferencias.proventos.pote_id apontar para ele
 * + os movimentos do pote (potes_movimentos).
 *
 * Mover entre potes grava dois movimentos de sinal contrário com o mesmo
 * transferencia_id: o patrimônio e a alocação não mudam (a soma é zero).
 * Dinheiro que entra de fora (venda do gado, Marco 3) é um movimento sem
 * par: entra no pilar caixa. O pilar caixa soma todos os potes.
 *
 * Sem a tabela `potes` no banco (migration 0002 não aplicada), `analisa`
 * devolve null e o app segue como antes. */
(function () {
  const FC = window.FC;

  FC.TIPOS_POTE = {
    reserva_emergencia: { nome: "Reserva de emergência", cor: "verde", ordem: 1 },
    oportunidade: { nome: "Oportunidade", cor: "azul", ordem: 2 },
    oportunidade_agro: { nome: "Oportunidade do agro", cor: "terra", ordem: 3 },
    ir_a_pagar: { nome: "IR a pagar", cor: "vermelho", ordem: 4, comprometido: true },
    livre: { nome: "Livre", cor: "cinza", ordem: 5 },
  };

  function uuid() {
    const c = typeof crypto !== "undefined" ? crypto : null;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // os potes que toda conta começa tendo (um de cada tipo)
  function padroes() {
    return Object.entries(FC.TIPOS_POTE).map(([tipo, t]) => ({ nome: t.nome, tipo, meta_valor: null }));
  }

  /** o pote que recebe o que não tem pote (o "livre" mais antigo) */
  function livreDe(potes) {
    return potes.filter((p) => p.tipo === "livre").sort((a, b) => String(a.criado_em || "").localeCompare(String(b.criado_em || "")))[0] || null;
  }

  /**
   * base: { potes, potesMovs, rendaFixa (com valor de hoje) }
   * opcoes: { caixaProventos: {ativo, saldo}, poteProventos: id|null, objetivos }
   */
  function analisa(potes, movs, rendaFixa, opcoes = {}) {
    if (!potes || !potes.length) return null;
    const livre = livreDe(potes);
    const porId = new Map(potes.map((p) => [p.id, {
      ...p, meta_valor: p.meta_valor == null ? null : Number(p.meta_valor),
      titulos: [], valor_titulos: 0, valor_movimentos: 0, valor_proventos: 0, saldo: 0,
      ...(FC.TIPOS_POTE[p.tipo] ? { cor: FC.TIPOS_POTE[p.tipo].cor, comprometido: !!FC.TIPOS_POTE[p.tipo].comprometido } : {}),
    }]));
    const alvo = (id) => porId.get(id) || (livre ? porId.get(livre.id) : null);
    for (const t of rendaFixa || []) {
      const p = alvo(t.pote_id);
      if (!p) continue;
      const v = Number(t.valor_aplicado) || 0;
      p.titulos.push({ id: t.id, nome: t.nome, valor: v });
      p.valor_titulos += v;
    }
    for (const m of movs || []) {
      const p = alvo(m.pote_id);
      if (p) p.valor_movimentos += Number(m.valor) || 0;
    }
    const cx = opcoes.caixaProventos;
    if (cx && cx.ativo && cx.saldo > 0) {
      const p = alvo(opcoes.poteProventos);
      if (p) p.valor_proventos += cx.saldo;
    }
    const lista = [...porId.values()].map((p) => {
      p.saldo = p.valor_titulos + p.valor_movimentos + p.valor_proventos;
      p.falta_para_meta = p.meta_valor != null ? Math.max(0, p.meta_valor - p.saldo) : null;
      return p;
    }).sort((a, b) => ((FC.TIPOS_POTE[a.tipo] || {}).ordem || 9) - ((FC.TIPOS_POTE[b.tipo] || {}).ordem || 9) || String(a.nome).localeCompare(String(b.nome)));

    const total = FC.soma(lista, (p) => p.saldo);
    // dinheiro que entrou nos potes de fora (sem par): soma no pilar caixa
    const externo = FC.soma(movs || [], (m) => Number(m.valor) || 0);
    const comprometido = FC.soma(lista.filter((p) => p.comprometido), (p) => p.saldo);

    // reserva de emergência: medida SÓ pelo pote reserva_emergencia
    const obj = opcoes.objetivos || {};
    const reservaPotes = lista.filter((p) => p.tipo === "reserva_emergencia");
    const custo = Number(obj.custo_vida_mensal) || 0, meses = Number(obj.meses_reserva) || 6;
    const temReserva = FC.soma(reservaPotes, (p) => p.saldo);
    const metaReserva = reservaPotes.find((p) => p.meta_valor != null) ? FC.soma(reservaPotes, (p) => p.meta_valor || 0) : custo > 0 ? custo * meses : null;
    const reserva = {
      saldo: temReserva, meta: metaReserva, meses_cobertos: custo > 0 ? temReserva / custo : null,
      abaixo_da_meta: metaReserva != null ? temReserva < metaReserva - 0.5 : null, falta: metaReserva != null ? Math.max(0, metaReserva - temReserva) : null,
    };
    return { potes: lista, total, externo, comprometido, reserva, livre_id: livre ? livre.id : null };
  }

  /** valida e monta a transferência (sem gravar). Devolve as duas linhas. */
  function transferencia(estadoPotes, { de, para, valor, data, descricao }) {
    if (!estadoPotes) throw new Error("Os potes ainda não existem nesta conta.");
    const v = Number(valor);
    if (!(v > 0)) throw new Error("Informe um valor positivo.");
    const acha = (x) => estadoPotes.potes.find((p) => p.id === x || p.tipo === x || String(p.nome).toLowerCase() === String(x).toLowerCase());
    const o = acha(de), d = acha(para);
    if (!o) throw new Error(`Pote de origem "${de}" não encontrado.`);
    if (!d) throw new Error(`Pote de destino "${para}" não encontrado.`);
    if (o.id === d.id) throw new Error("Origem e destino são o mesmo pote.");
    if (v > o.saldo + 0.005) throw new Error(`${o.nome} tem ${FC.fmt.brlTexto(o.saldo)}; não dá para tirar ${FC.fmt.brlTexto(v)}.`);
    const id = uuid();
    const dia = data || FC.datas.hoje();
    const txt = descricao || `${o.nome} → ${d.nome}`;
    return {
      origem: o, destino: d, valor: v,
      linhas: [
        { pote_id: o.id, data: dia, valor: -v, descricao: txt, transferencia_id: id },
        { pote_id: d.id, data: dia, valor: v, descricao: txt, transferencia_id: id },
      ],
    };
  }

  FC.potes = { padroes, analisa, transferencia, livreDe, uuid };
})();
